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

// GPT 프롬프트 템플릿 (태그 기반 문의 내용 추출 - 넓은 범위)
const createAnalysisPrompt = (ticketContent, customerTags = []) => {
  const tagContext = customerTags.length > 0 
    ? `\n**고객 태그 컨텍스트:**\n이 티켓의 고객 태그: ${customerTags.map(tag => tag.replace('고객_', '')).join(', ')}\n위 태그들과 직접적 또는 간접적으로 관련된 모든 문의 내용을 추출하세요.\n`
    : '';

  return `
당신은 Zendesk 티켓에서 실제 고객이 작성한 내용을 추출하는 전문가입니다.
고객의 태그와 관련된 내용을 **넓은 범위**에서 파악하여 놓치지 않고 추출해주세요.
${tagContext}
**검색 결과 제외 기준:**
- 티켓 제목에 "수신전화", "발신전화" 텍스트가 포함된 내용

**문의 내용에서 제외해야 할 내용들 (최소한만 제외):**
- 명백한 시스템 자동 응답 (여신BOT, 매니저L, 매니저B, 매니저D, Matrix_bot, Caller 메시지)
- 인증번호, 전화번호, 연락처 정보
- URL 링크 및 파일 관련 코드
- Screenshot_, hcaptcha, img_ 등 시스템 파일명
- 1~2글자의 무의미한 텍스트

**포함해야 할 내용들 (넓은 범위 적용):**
- 태그와 직접 관련된 명확한 문의나 문제
- 태그와 간접적으로 관련될 수 있는 내용
- 고객의 상황 설명이나 배경 정보
- 단순해 보이지만 문맥상 의미가 있는 표현
- "안녕하세요"라도 뒤에 구체적인 문의가 이어지면 포함
- 감정 표현이나 만족도 표시도 태그와 관련되면 포함

**태그별 넓은 범위 추출 가이드:**
- "문의" 태그: 질문, 요청, 도움 구하기, 정보 확인, 상황 설명 등 모든 의사소통
- "불만" 태그: 불만, 문제점, 아쉬움, 개선 요청, 부정적 경험 등
- "칭찬" 태그: 칭찬, 감사, 긍정적 피드백, 만족 표현 등
- "결제" 태그: 결제, 환불, 요금, 카드, 계좌, 금액 관련 모든 내용
- "기능" 태그: 기능 사용, 조작법, 설정, 화면, 버튼 관련 등
- "오류" 태그: 오류, 버그, 안됨, 작동 안함, 문제 발생 등

**추출 우선순위:**
1. **1순위**: 태그와 직접 관련된 명확한 내용
2. **2순위**: 태그와 간접적으로 관련될 수 있는 내용
3. **3순위**: 문맥상 의미가 있어 보이는 고객 발언
4. **4순위**: 단순해도 고객이 실제 작성한 것으로 보이는 내용

**응답 기준 (관대하게 적용):**
- 태그와 조금이라도 관련이 있어 보이면 추출
- 의심스러우면 포함하는 쪽으로 판단
- 고객이 실제 작성한 것 같으면 일단 포함
- "구체적인 문의 내용 없음"은 정말 아무것도 없을 때만 사용

**응답 형식:**
- 관련 내용이 있으면: "1. [내용]" 형태로 번호를 매겨 응답
- 정말 아무 내용도 없으면: "구체적인 문의 내용 없음" 응답

**분석할 티켓:**
${ticketContent}

**태그 관련 고객 내용 (넓은 범위):**`;
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
          content: `당신은 Zendesk 티켓 분석 전문가입니다. 티켓 제목에 '수신전화' 또는 '발신전화'가 포함되면 무조건 '문의 내용 없음'으로 응답하세요. 

고객의 태그(${customerTags.map(tag => tag.replace('고객_', '')).join(', ')})와 관련된 내용을 **넓은 범위**에서 추출하세요. 

중요: 의심스러우면 포함하는 쪽으로 판단하고, 태그와 조금이라도 관련이 있어 보이면 추출하세요. "구체적인 문의 내용 없음"은 정말 아무것도 없을 때만 사용하세요.

단순한 인사말도 뒤에 문의가 이어지면 포함하고, 고객이 실제 작성한 것 같은 모든 내용을 추출하세요.`
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

    // 태그 기반 모의 분석 (넓은 범위)
    let mockInquiry = '';
    
    if (customerTags.length > 0) {
      // 태그가 있는 경우 태그 관련 문의로 생성 (관대하게)
      const tagNames = customerTags.map(tag => tag.replace('고객_', ''));
      
      // 제목에서 내용 추출 (더 관대하게)
      if (ticket.subject && !ticket.subject.includes('님과의 대화')) {
        mockInquiry = `1. ${tagNames.join(', ')} 관련하여 ${ticket.subject}에 대해 문의드립니다.`;
      } else {
        mockInquiry = `1. ${tagNames.join(', ')} 관련 문의가 있습니다.`;
      }
      
      // description에서 내용 추출 (필터링 최소화)
      if (ticket.description && ticket.description.length > 3) {
        // 기본적인 시스템 메시지만 제외하고 대부분 포함
        const cleanDescription = ticket.description
          .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot/g, '')
          .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
          .replace(/https?:\/\/[^\s]+/g, '')
          .trim();
        
        if (cleanDescription.length > 3) {
          const descContent = cleanDescription.substring(0, 100);
          mockInquiry += mockInquiry ? `\n2. ${descContent}${cleanDescription.length > 100 ? '...' : ''}` : `1. ${descContent}${cleanDescription.length > 100 ? '...' : ''}`;
        }
      }
      
      // 댓글에서도 내용 추출 (추가로)
      if (ticket.comments && Array.isArray(ticket.comments)) {
        let commentContent = '';
        ticket.comments.forEach(comment => {
          if (comment.body && comment.body.length > 3) {
            const cleanComment = comment.body
              .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot/g, '')
              .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
              .replace(/https?:\/\/[^\s]+/g, '')
              .trim();
            
            if (cleanComment.length > 3 && commentContent.length < 200) {
              commentContent += cleanComment + ' ';
            }
          }
        });
        
        if (commentContent.trim().length > 5) {
          const nextNumber = mockInquiry.includes('2.') ? '3' : (mockInquiry.includes('1.') ? '2' : '1');
          mockInquiry += `\n${nextNumber}. ${commentContent.trim().substring(0, 80)}...`;
        }
      }
    } else {
      // 태그가 없는 경우도 더 관대하게 처리
      let contentFound = false;
      
      if (ticket.subject && !ticket.subject.includes('님과의 대화')) {
        mockInquiry = `1. ${ticket.subject}에 대한 문의입니다.`;
        contentFound = true;
      }
      
      if (ticket.description && ticket.description.length > 3) {
        const cleanDescription = ticket.description
          .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot/g, '')
          .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
          .replace(/https?:\/\/[^\s]+/g, '')
          .trim();
        
        if (cleanDescription.length > 3) {
          const descContent = cleanDescription.substring(0, 100);
          if (contentFound) {
            mockInquiry += `\n2. ${descContent}${cleanDescription.length > 100 ? '...' : ''}`;
          } else {
            mockInquiry = `1. ${descContent}${cleanDescription.length > 100 ? '...' : ''}`;
            contentFound = true;
          }
        }
      }
      
      // 댓글도 확인
      if (!contentFound && ticket.comments && Array.isArray(ticket.comments)) {
        for (const comment of ticket.comments) {
          if (comment.body && comment.body.length > 5) {
            const cleanComment = comment.body
              .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot/g, '')
              .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
              .replace(/https?:\/\/[^\s]+/g, '')
              .trim();
            
            if (cleanComment.length > 5) {
              mockInquiry = `1. ${cleanComment.substring(0, 80)}...`;
              contentFound = true;
              break;
            }
          }
        }
      }
    }
    
    // 의미있는 문의 내용이 없는 경우만 "없음" 표시 (기준 완화)
    if (!mockInquiry || mockInquiry.trim().length < 5) {
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