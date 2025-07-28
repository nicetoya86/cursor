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

**문의 내용에서 제외해야 할 내용들 (엄격하게 적용):**
- **매니저/직원이 작성한 모든 내용 (여신BOT, 매니저L, 매니저B, 매니저D, Matrix_bot, Caller, 상담원, 직원 등)**
- **시스템 자동 응답 및 BOT 메시지 완전 제거**
- **"안녕하세요 고객님", "문의해주셔서 감사합니다", "도움이 되셨나요?" 등 상담원 멘트**
- **"해결되었어요", "해결되지 않았어요", "더 궁금해요" 등 시스템 버튼 응답**
- 인증번호, 전화번호, 연락처 정보
- URL 링크 및 파일 관련 코드
- Screenshot_, hcaptcha, img_ 등 시스템 파일명
- 1~2글자의 무의미한 텍스트
- **고객의 실명이나 개인정보 (이름, 닉네임 등은 제거하고 내용만 추출)**

**포함해야 할 내용들 (고객 작성 내용만):**
- **오직 고객이 직접 작성한 문의, 질문, 요청만 포함**
- 태그와 직접 관련된 고객의 문의나 문제
- 태그와 간접적으로 관련될 수 있는 고객의 내용
- 고객의 상황 설명이나 배경 정보
- 고객의 감정 표현이나 만족도 표시 (태그와 관련된 경우)

**중요한 구분 기준:**
- **고객이 작성한 내용**: "결제가 안되요", "로그인이 안됩니다", "도와주세요" 등
- **매니저/BOT 내용**: "안녕하세요 고객님", "확인해드리겠습니다", "문의해주셔서 감사합니다" 등
- **시스템 응답**: "해결되었어요", "더 궁금해요", "확인" 등

**추출 우선순위 (고객 내용만):**
1. **1순위**: 태그와 직접 관련된 고객의 명확한 문의
2. **2순위**: 태그와 간접적으로 관련된 고객의 내용
3. **3순위**: 고객이 작성한 상황 설명이나 배경 정보
4. **제외**: 매니저, BOT, 시스템이 작성한 모든 내용

**응답 기준 (고객 내용만 엄격 적용):**
- **고객이 직접 작성한 내용만 추출**
- 매니저나 BOT 내용이 의심되면 제외
- 태그와 관련된 고객의 실제 문의만 포함
- "구체적인 문의 내용 없음"은 고객 작성 내용이 정말 없을 때만 사용

**응답 형식:**
- 고객이 작성한 관련 내용이 있으면: "1. [고객 작성 내용]" 형태로 번호를 매겨 응답
- 고객 작성 내용이 없거나 매니저/BOT 내용만 있으면: "구체적인 문의 내용 없음" 응답

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

고객의 태그(${customerTags.map(tag => tag.replace('고객_', '')).join(', ')})와 관련된 내용을 추출하되, **오직 고객이 직접 작성한 내용만** 추출하세요.

**중요 - 완전히 제외해야 할 내용:**
- 여신BOT, 매니저L, 매니저B, 매니저D, Matrix_bot, Caller, 상담원이 작성한 모든 내용
- "안녕하세요 고객님", "문의해주셔서 감사합니다", "확인해드리겠습니다" 등 상담원 멘트
- "해결되었어요", "해결되지 않았어요", "더 궁금해요" 등 시스템 버튼 응답
- 시스템 자동 응답 및 BOT 메시지

**추출 대상:**
- 고객이 직접 작성한 문의, 질문, 요청, 불만, 칭찬만 추출
- 고객의 실명, 닉네임, 개인정보는 제거하고 문의 내용만 추출

매니저나 BOT 내용이 의심되면 무조건 제외하세요.`
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
      
      // description에서 내용 추출 (매니저/BOT 내용 엄격 제거)
      if (ticket.description && ticket.description.length > 3) {
        // 매니저/BOT 내용 엄격하게 제거
        const cleanDescription = ticket.description
          .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원/g, '')
          .replace(/안녕하세요\s*고객님|문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요/g, '')
          .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요|확인|취소|네|아니오/g, '')
          .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
          .replace(/운영시간|평일|주말|공휴일|점심시간|감사합니다|수고하세요/g, '')
          .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
          .replace(/https?:\/\/[^\s]+/g, '')
          .trim();
        
        // 상담원 멘트 패턴 추가 제거
        const furtherClean = cleanDescription
          .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
          .replace(/운영시간|평일|주말|공휴일|점심시간/g, '')
          .replace(/감사합니다|수고하세요|좋은\s*하루/g, '')
          .trim();
        
        if (furtherClean.length > 5) {
          const descContent = furtherClean.substring(0, 100);
          mockInquiry += mockInquiry ? `\n2. ${descContent}${furtherClean.length > 100 ? '...' : ''}` : `1. ${descContent}${furtherClean.length > 100 ? '...' : ''}`;
        }
      }
      
      // 댓글에서도 내용 추출 (매니저/BOT 내용 엄격 제거)
      if (ticket.comments && Array.isArray(ticket.comments)) {
        let commentContent = '';
        ticket.comments.forEach(comment => {
          if (comment.body && comment.body.length > 3) {
            // 매니저/BOT 내용 엄격하게 제거
            const cleanComment = comment.body
              .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원/g, '')
              .replace(/안녕하세요\s*고객님|문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요/g, '')
              .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요|확인|취소|네|아니오/g, '')
              .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
              .replace(/운영시간|평일|주말|공휴일|점심시간|감사합니다|수고하세요/g, '')
              .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
              .replace(/https?:\/\/[^\s]+/g, '')
              .trim();
            
            if (cleanComment.length > 5 && commentContent.length < 200) {
              commentContent += cleanComment + ' ';
            }
          }
        });
        
        if (commentContent.trim().length > 10) {
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
          .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원/g, '')
          .replace(/안녕하세요\s*고객님|문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요/g, '')
          .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요|확인|취소|네|아니오/g, '')
          .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
          .replace(/운영시간|평일|주말|공휴일|점심시간|감사합니다|수고하세요/g, '')
          .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
          .replace(/https?:\/\/[^\s]+/g, '')
          .trim();
        
        if (cleanDescription.length > 5) {
          const descContent = cleanDescription.substring(0, 100);
          if (contentFound) {
            mockInquiry += `\n2. ${descContent}${cleanDescription.length > 100 ? '...' : ''}`;
          } else {
            mockInquiry = `1. ${descContent}${cleanDescription.length > 100 ? '...' : ''}`;
            contentFound = true;
          }
        }
      }
      
      // 댓글도 확인 (매니저/BOT 내용 엄격 제거)
      if (!contentFound && ticket.comments && Array.isArray(ticket.comments)) {
        for (const comment of ticket.comments) {
          if (comment.body && comment.body.length > 5) {
            const cleanComment = comment.body
              .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원/g, '')
              .replace(/안녕하세요\s*고객님|문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요/g, '')
              .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요|확인|취소|네|아니오/g, '')
              .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
              .replace(/운영시간|평일|주말|공휴일|점심시간|감사합니다|수고하세요/g, '')
              .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
              .replace(/https?:\/\/[^\s]+/g, '')
              .trim();
            
            if (cleanComment.length > 10) {
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