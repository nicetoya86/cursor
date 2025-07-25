// GPT API를 사용한 티켓 분석 서비스
import OpenAI from 'openai';

// OpenAI 클라이언트 초기화 (환경변수에서 API 키 가져오기)
let openai = null;

// API 키가 있을 때만 OpenAI 클라이언트 초기화
const initializeOpenAI = () => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (apiKey && apiKey !== 'your_openai_api_key_here') {
    try {
      openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // 클라이언트 사이드에서 사용하기 위해 필요
      });
      console.log('✅ OpenAI 클라이언트가 초기화되었습니다.');
      return true;
    } catch (error) {
      console.error('❌ OpenAI 클라이언트 초기화 실패:', error);
      return false;
    }
  }
  
  console.log('ℹ️ OpenAI API 키가 설정되지 않았습니다. 모의 분석 모드를 사용합니다.');
  return false;
};

// GPT 프롬프트 템플릿
const createAnalysisPrompt = (ticketContent) => {
  return `
당신은 Zendesk 티켓에서 실제 고객이 작성한 내용만을 추출하는 전문가입니다.
아래 조건을 반드시 참고하여 문의 내용에 텍스트를 출력해주세요.

**검색 결과 제외 기준:**
- 티켓 제목에 "수신전화", "발신전화" 텍스트가 포함된 내용

**문의 내용에서 반드시 제외해야 할 내용들:**
- 시스템 자동 응답, BOT 메시지, 인사말
- 여신BOT, 매니저L, 매니저B, 매니저D, Matrix_bot, Caller의 모든 메시지
- 버튼 텍스트 (해결되었어요, 해결되지 않았어요, 확인, 취소 등)
- 인증번호, 전화번호, 연락처 정보
- **모든 URL 링크 (http, https, www로 시작하는 모든 링크)**
- **파일 관련 코드: 01JZ2DGNN715JGFYCG5J7EBGJY, 01JZ2DGTASEYR8RCZ7VZGJD8Q3 같은 랜덤 문자열**
- **의미없는 텍스트 조각: "s s 가", "s s 잘", "jpeg s" 등**
- **파일 확장자: jpeg, png, pdf 등**
- Screenshot_, hcaptcha, img_ 등 시스템 파일명
- 3글자 미만의 무의미한 텍스트

**추출 기준:**
1. 오직 고객이 직접 작성한 문장만 그대로 추출
2. 한국어(외국어)로 된 의미있는 내용만 포함
3. 각 문의를 번호로 정리
4. 불완전하거나 의미불명한 텍스트는 절대 포함하지 않음

**응답 형식:**
- 고객 문의가 있으면: "1. [문의내용]" 형태로 번호를 매겨 응답
- 문의 내용이 없으면: "문의 내용 없음" 응답

**분석할 티켓:**
${ticketContent}

**추출된 고객 문의:**`;
};

// 단일 티켓 분석
export const analyzeSingleTicket = async (ticket) => {
  try {
    // OpenAI 클라이언트 초기화 확인
    if (!openai) {
      const initialized = initializeOpenAI();
      if (!initialized) {
        throw new Error('OpenAI API 키가 설정되지 않았거나 올바르지 않습니다.');
      }
    }

    // 티켓의 모든 텍스트 내용을 수집
    let content = '';
    
    if (ticket.subject) content += `제목: ${ticket.subject}\n\n`;
    if (ticket.description) content += `설명: ${ticket.description}\n\n`;
    
    // 댓글 내용 수집
    if (ticket.comments && Array.isArray(ticket.comments)) {
      content += '댓글:\n';
      ticket.comments.forEach((comment, index) => {
        if (comment.body) {
          content += `댓글 ${index + 1}: ${comment.body}\n\n`;
        }
      });
    }
    
    // 기타 필드들도 포함
    const allContent = JSON.stringify(ticket, null, 2);
    content += `\n전체 데이터:\n${allContent}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "당신은 Zendesk 티켓 분석 전문가입니다. 티켓 제목에 '수신전화' 또는 '발신전화'가 포함되면 무조건 '문의 내용 없음'으로 응답하세요. 파일 코드(01JZ2DGNN715JGFYCG5J7EBGJY 같은), URL, 'ss가', 'ss잘', 'jpeg s' 같은 의미없는 텍스트는 절대 포함하지 마세요. 오직 고객이 직접 작성한 완전한 한국어 문장만 추출하세요."
        },
        {
          role: "user",
          content: createAnalysisPrompt(content)
        }
      ],
      temperature: 0.1, // 일관성을 위해 낮게 설정
      max_tokens: 1000
    });

    const extractedContent = response.choices[0].message.content.trim();
    
    return {
      ...ticket,
      gptAnalysis: {
        extractedInquiry: extractedContent,
        originalContent: content.substring(0, 500) + '...', // 원본 내용 일부 보관
        processedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('GPT 분석 오류:', error);
    
    // API 오류 시 기본값 반환
    return {
      ...ticket,
      gptAnalysis: {
        extractedInquiry: '분석 실패 - API 오류가 발생했습니다.',
        error: error.message,
        processedAt: new Date().toISOString()
      }
    };
  }
};

// 여러 티켓 배치 분석
export const analyzeTicketsWithGPT = async (tickets, onProgress = null) => {
  const results = [];
  const total = tickets.length;
  let excludedCount = 0;

  for (let i = 0; i < tickets.length; i++) {
    try {
      // 제목에 "수신전화" 또는 "발신전화"가 포함된 경우 분석에서 완전히 제외
      if (tickets[i].subject && (tickets[i].subject.includes('수신전화') || tickets[i].subject.includes('발신전화'))) {
        console.log(`티켓 ${tickets[i].id}: 제목에 전화 관련 키워드 포함으로 분석 결과에서 제외`);
        excludedCount++;
        
        // 진행률 콜백 호출 (제외된 티켓도 진행률에 포함)
        if (onProgress) {
          onProgress((i + 1) / total * 100);
        }
        continue; // 결과 배열에 추가하지 않고 다음 티켓으로
      }

      const analyzed = await analyzeSingleTicket(tickets[i]);
      results.push(analyzed);
      
      // 진행률 콜백 호출
      if (onProgress) {
        onProgress((i + 1) / total * 100);
      }
      
      // API 호출 제한을 피하기 위한 지연
      if (i < tickets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300)); // 0.3초 대기 (3배 빠르게)
      }
      
    } catch (error) {
      console.error(`티켓 ${tickets[i].id} 분석 실패:`, error);
      
      // 실패한 티켓도 결과에 포함 (오류 정보와 함께)
      results.push({
        ...tickets[i],
        gptAnalysis: {
          extractedInquiry: '분석 실패',
          error: error.message,
          processedAt: new Date().toISOString()
        }
      });
    }
  }

  return {
    analyzedTickets: results,
    summary: {
      total: total,
      analyzed: results.length,
      excluded: excludedCount,
      successful: results.filter(r => !r.gptAnalysis.error).length,
      failed: results.filter(r => r.gptAnalysis.error).length
    }
  };
};

// API 키 검증
export const validateApiKey = () => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey.trim() === '') {
    throw new Error('OpenAI API 키가 설정되지 않았습니다. .env 파일에 REACT_APP_OPENAI_API_KEY를 설정해주세요.');
  }
  
  if (!apiKey.startsWith('sk-')) {
    throw new Error('올바르지 않은 OpenAI API 키 형식입니다. API 키는 sk-로 시작해야 합니다.');
  }
  
  // OpenAI 클라이언트 초기화 시도
  const initialized = initializeOpenAI();
  if (!initialized) {
    throw new Error('OpenAI 클라이언트 초기화에 실패했습니다.');
  }
  
  return true;
};

// 개발용 모의 분석 (API 키가 없을 때 사용)
export const mockAnalyzeTickets = async (tickets, onProgress = null) => {
  const results = [];
  const total = tickets.length;
  let excludedCount = 0;

  for (let i = 0; i < tickets.length; i++) {
    // 모의 지연
    await new Promise(resolve => setTimeout(resolve, 150)); // 3배 빠르게
    
    const ticket = tickets[i];
    
    // 제목에 "수신전화" 또는 "발신전화"가 포함된 경우 분석에서 완전히 제외
    if (ticket.subject && (ticket.subject.includes('수신전화') || ticket.subject.includes('발신전화'))) {
      console.log(`티켓 ${ticket.id}: 제목에 전화 관련 키워드 포함으로 모의 분석 결과에서 제외`);
      excludedCount++;
      
      // 진행률 콜백 호출 (제외된 티켓도 진행률에 포함)
      if (onProgress) {
        onProgress((i + 1) / total * 100);
      }
      continue; // 결과 배열에 추가하지 않고 다음 티켓으로
    }

    // 간단한 모의 분석
    let mockInquiry = '';
    if (ticket.subject) {
      mockInquiry = `1. ${ticket.subject}에 대한 문의입니다.`;
    }
    if (ticket.description && ticket.description.length > 10) {
      mockInquiry += `\n2. ${ticket.description.substring(0, 100)}...`;
    }
    
    if (!mockInquiry) {
      mockInquiry = '구체적인 문의 내용을 찾을 수 없습니다.';
    }
    
    results.push({
      ...ticket,
      gptAnalysis: {
        extractedInquiry: mockInquiry,
        originalContent: '모의 분석 모드',
        processedAt: new Date().toISOString(),
        isMock: true
      }
    });
    
    // 진행률 콜백 호출
    if (onProgress) {
      onProgress((i + 1) / total * 100);
    }
  }

  return {
    analyzedTickets: results,
    summary: {
      total: total,
      analyzed: results.length,
      excluded: excludedCount,
      successful: results.length,
      failed: 0,
      isMock: true
    }
  };
}; 