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

// GPT 프롬프트 템플릿 (태그 기반 문의 내용 추출)
const createAnalysisPrompt = (ticketContent, customerTags = []) => {
  const tagContext = customerTags.length > 0 
    ? `\n**고객 태그 컨텍스트:**\n이 티켓의 고객 태그: ${customerTags.map(tag => tag.replace('고객_', '')).join(', ')}\n위 태그들과 관련된 문의 내용만 추출하세요.\n`
    : '';

  return `
당신은 Zendesk 티켓에서 실제 고객이 작성한 내용만을 추출하는 전문가입니다.
특히 고객의 태그와 관련된 핵심 문의 내용만 정확히 추출해주세요.
${tagContext}
**검색 결과 제외 기준:**
- 티켓 제목에 "수신전화", "발신전화" 텍스트가 포함된 내용

**문의 내용에서 반드시 제외해야 할 내용들:**
- 시스템 자동 응답, BOT 메시지, 인사말 ("안녕하세요", "감사합니다" 등 단순 인사)
- 여신BOT, 매니저L, 매니저B, 매니저D, Matrix_bot, Caller의 모든 메시지
- 버튼 텍스트 및 시스템 응답 ("해결되었어요", "해결되지 않았어요", "확인", "취소", "더 궁금해요" 등)
- 인증번호, 전화번호, 연락처 정보
- 모든 URL 링크 (http, https, www로 시작하는 모든 링크)
- 파일 관련 코드 및 시스템 생성 문자열
- 의미없는 텍스트 조각 및 파일 확장자
- Screenshot_, hcaptcha, img_ 등 시스템 파일명
- 3글자 미만의 무의미한 텍스트
- **단순한 인사말, 감사 표현만 있는 내용 ("안녕하세요", "감사합니다", "수고하세요" 등)**

**추출 기준 (중요):**
1. **태그와 관련된 구체적인 문의나 문제 상황만 추출**
2. 단순한 인사말이나 버튼 클릭 응답은 제외
3. 고객이 실제로 도움을 요청하거나 문제를 설명한 내용만 포함
4. 각 문의를 번호로 정리하되, 태그와 관련없는 내용은 포함하지 않음
5. 불완전하거나 의미불명한 텍스트는 절대 포함하지 않음

**태그별 추출 가이드:**
- "문의" 태그: 질문이나 도움 요청 내용
- "불만" 태그: 불만사항이나 문제점 지적 내용  
- "칭찬" 태그: 긍정적 피드백이나 칭찬 내용
- "결제" 태그: 결제 관련 문의나 문제
- "기능" 태그: 기능 사용법이나 기능 관련 문의
- "오류" 태그: 오류나 버그 관련 신고

**응답 형식:**
- 태그와 관련된 구체적인 문의가 있으면: "1. [구체적인 문의내용]" 형태로 번호를 매겨 응답
- 단순 인사말이나 버튼 응답만 있으면: "구체적인 문의 내용 없음" 응답
- 태그와 무관한 내용만 있으면: "태그 관련 문의 내용 없음" 응답

**분석할 티켓:**
${ticketContent}

**태그 관련 고객 문의:**`;
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

    // 티켓의 고객 태그 추출
    const customerTags = ticket.tags && Array.isArray(ticket.tags) 
      ? ticket.tags.filter(tag => tag && tag.startsWith('고객_'))
      : [];
    
    console.log(`🏷️ 티켓 ${ticket.id} 고객 태그:`, customerTags);

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
          content: `당신은 Zendesk 티켓 분석 전문가입니다. 티켓 제목에 '수신전화' 또는 '발신전화'가 포함되면 무조건 '문의 내용 없음'으로 응답하세요. 특히 고객의 태그(${customerTags.map(tag => tag.replace('고객_', '')).join(', ')})와 관련된 구체적인 문의 내용만 추출하고, 단순한 인사말이나 버튼 응답은 제외하세요. 파일 코드, URL, 의미없는 텍스트는 절대 포함하지 마세요.`
        },
        {
          role: "user",
          content: createAnalysisPrompt(content, customerTags)
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

    // 티켓의 고객 태그 추출
    const customerTags = ticket.tags && Array.isArray(ticket.tags) 
      ? ticket.tags.filter(tag => tag && tag.startsWith('고객_'))
      : [];
    
    console.log(`🏷️ 모의 분석 - 티켓 ${ticket.id} 고객 태그:`, customerTags);

    // 태그 기반 모의 분석
    let mockInquiry = '';
    
    if (customerTags.length > 0) {
      // 태그가 있는 경우 태그 관련 문의로 생성
      const tagNames = customerTags.map(tag => tag.replace('고객_', ''));
      
      if (ticket.subject && !ticket.subject.includes('님과의 대화')) {
        mockInquiry = `1. ${tagNames.join(', ')} 관련하여 ${ticket.subject}에 대해 문의드립니다.`;
      } else {
        mockInquiry = `1. ${tagNames.join(', ')} 관련 문의가 있습니다.`;
      }
      
      if (ticket.description && ticket.description.length > 10) {
        // 단순한 인사말이나 버튼 응답 제외
        const cleanDescription = ticket.description
          .replace(/안녕하세요/g, '')
          .replace(/감사합니다/g, '')
          .replace(/해결되었어요|해결되지 않았어요|더 궁금해요/g, '')
          .trim();
        
        if (cleanDescription.length > 5) {
          mockInquiry += `\n2. ${cleanDescription.substring(0, 80)}...`;
        }
      }
    } else {
      // 태그가 없는 경우 기본 모의 분석
      if (ticket.subject && !ticket.subject.includes('님과의 대화')) {
        mockInquiry = `1. ${ticket.subject}에 대한 문의입니다.`;
      }
      
      if (ticket.description && ticket.description.length > 10) {
        const cleanDescription = ticket.description
          .replace(/안녕하세요|감사합니다|해결되었어요|해결되지 않았어요|더 궁금해요/g, '')
          .trim();
        
        if (cleanDescription.length > 5) {
          mockInquiry += mockInquiry ? `\n2. ${cleanDescription.substring(0, 80)}...` : `1. ${cleanDescription.substring(0, 80)}...`;
        }
      }
    }
    
    // 의미있는 문의 내용이 없는 경우
    if (!mockInquiry || mockInquiry.trim().length < 10) {
      mockInquiry = customerTags.length > 0 
        ? `${customerTags.map(tag => tag.replace('고객_', '')).join(', ')} 관련 구체적인 문의 내용 없음` 
        : '구체적인 문의 내용 없음';
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