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

**문의 내용에서 제외해야 할 내용들 (극도로 엄격하게 적용):**
- **매니저/직원/상담원이 작성한 모든 내용 완전 차단 (여신BOT, 매니저L, 매니저B, 매니저D, Matrix_bot, Caller, 상담원, 직원, 관리자, 운영자 등)**
- **시스템 자동 응답 및 모든 BOT 메시지 완전 제거**
- **상담원/매니저 멘트 완전 차단: "안녕하세요", "고객님", "문의해주셔서", "감사합니다", "확인해드리겠습니다", "도움이 되셨나요", "처리해드리겠습니다" 등**
- **시스템 버튼 응답 완전 차단: "해결되었어요", "해결되지 않았어요", "더 궁금해요", "확인", "취소", "네", "아니오" 등**
- **업무 관련 멘트 완전 차단: "빠른 시일 내", "답변드리겠습니다", "확인 후 연락", "운영시간", "평일", "주말", "공휴일" 등**
- **인사말 완전 차단: "안녕하세요", "수고하세요", "좋은 하루", "감사합니다" 등 (고객이 작성했더라도 뒤에 구체적 문의가 없으면 제외)**
- **단순 응답 완전 차단: "네", "예", "알겠습니다", "그렇습니다", "맞습니다" 등**
- **개인정보 완전 제거: 이름, 이메일 주소, 전화번호, 휴대전화번호, 주소, 생년월일, 카드번호 등**
- **시스템 안내 문구: "이름(name):", "휴대전화번호(country code is required):", "구매 목록(D):", "해결되지 않았어요", "상담원 연결" 등**
- **양식 입력 안내: "name:", "country code is required", "구매 목록", "특별한 복사 가능" 등**
- 인증번호, 전화번호, 연락처 정보
- URL 링크 및 파일 관련 코드  
- Screenshot_, hcaptcha, img_ 등 시스템 파일명
- 1~3글자의 무의미한 텍스트
- **고객의 실명이나 개인정보 (이름, 닉네임 등은 제거하고 내용만 추출)**

**포함해야 할 내용들 (넓은 범위의 고객 내용):**
- **고객이 직접 작성한 문의, 질문, 요청, 불만, 칭찬 포함**
- **최소 3글자 이상의 의미있는 문장 포함 (기준 완화)**
- **태그와 직접 또는 간접적으로 관련된 고객의 모든 문의나 문제**
- **고객의 상황 설명, 배경 정보, 경험담 포함**
- **고객의 감정 표현, 만족도, 의견 표시 (태그와 관련 여부 관계없이)**
- **인사말도 뒤에 문의가 이어지지 않더라도 고객이 작성했다면 포함**
- **고객의 단순한 응답이라도 문맥상 의미가 있으면 포함**

**중요한 구분 기준 (완화된 기준):**
- **우선 포함**: "결제가 안되요", "로그인할 수 없습니다", "화면이 이상해요", "환불해주세요", "서비스 불만족스럽습니다" 등 구체적 문의
- **고객 작성으로 판단되면 포함**: "안녕하세요 문의드립니다", "도움이 필요해요", "궁금한게 있어요", "문제가 생겼어요" 등
- **반드시 제외**: 명백한 상담원 멘트 "확인해드리겠습니다", "문의해주셔서 감사합니다", "도움이 되셨나요" 등
- **의심스러울 때**: 고객이 작성했을 가능성이 높으면 포함
- **길이 기준**: 3글자 이상이면 의미 있는 내용으로 판단

**추출 우선순위 (고객 내용만):**
1. **1순위**: 태그와 직접 관련된 고객의 명확한 문의
2. **2순위**: 태그와 간접적으로 관련된 고객의 내용
3. **3순위**: 고객이 작성한 상황 설명이나 배경 정보
4. **제외**: 매니저, BOT, 시스템이 작성한 모든 내용

**응답 기준 (넓은 범위의 고객 내용 추출):**
- **고객이 직접 작성한 모든 의미있는 내용 추출 (관대한 기준)**
- **매니저나 BOT 내용이 명백하게 확실할 때만 제외**
- **단순 인사라도 고객이 작성했다면 포함**
- **3글자 이상의 모든 의미있는 내용 포함**
- **"구체적인 문의 내용 없음"은 정말로 고객 작성 내용이 전혀 없을 때만 사용**
- **애매하거나 의심스러운 내용도 고객 작성 가능성이 있으면 포함**

**응답 형식 (관대한 기준):**
- **고객 작성 가능성이 있는 내용이 있으면**: "1. [고객 작성 내용]" 형태로 번호를 매겨 응답
- **명백한 매니저/BOT 내용만 있거나 아무 내용이 없으면**: "구체적인 문의 내용 없음" 응답
- **의심스러운 경우**: 고객 작성 가능성을 우선하여 포함

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

고객의 태그(${customerTags.map(tag => tag.replace('고객_', '')).join(', ')})와 관련된 내용을 추출하되, **넓은 범위에서 관대하게 고객이 직접 작성한 내용을 모두** 추출하세요.

**반드시 제외 - 명백한 상담원/시스템 내용만:**
- 여신BOT, 매니저L, 매니저B, 매니저D, Matrix_bot, Caller, 상담원, 직원, 관리자, 운영자가 명백하게 작성한 내용
- "확인해드리겠습니다", "문의해주셔서 감사합니다", "도움이 되셨나요", "처리해드리겠습니다" 등 명백한 상담원 표현
- "해결되었어요", "해결되지 않았어요", "더 궁금해요" 등 시스템 버튼 응답
- "빠른 시일 내", "답변드리겠습니다", "확인 후 연락", "운영시간" 등 명백한 업무 표현
- **개인정보 양식: "이름(name):", "휴대전화번호(country code is required):", 이메일 주소, 전화번호 등**
- **시스템 안내: "구매 목록(D):", "해결되지 않았어요", "상담원 연결", "특별한 복사 가능" 등**
- **양식 입력 필드: "name:", "country code is required", "@naver.com", "010-" 등**

**적극 추출 대상 (관대한 기준):**
- 고객이 직접 작성한 모든 문의, 질문, 요청, 불만, 칭찬
- 최소 3글자 이상의 의미있는 문장
- "안녕하세요", "도움이 필요해요", "궁금해요", "문제가 있어요" 등 고객 표현
- 고객의 상황 설명, 감정 표현, 의견
- 고객의 실명, 닉네임, 개인정보는 제거하고 문의 내용만 추출

**중요**: 의심스럽거나 애매한 경우 고객 작성 가능성을 우선하여 포함하세요. "구체적인 문의 내용 없음"은 정말로 아무 고객 내용이 없을 때만 사용하세요.`
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
      
      // description에서 내용 추출 (매니저/BOT 내용 및 개인정보 엄격 제거)
      if (ticket.description && ticket.description.length > 3) {
        // 매니저/BOT 내용 및 개인정보 엄격하게 제거
        const cleanDescription = ticket.description
          .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원|관리자|운영자/g, '')
          .replace(/문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요|처리해드리겠습니다/g, '')
          .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요/g, '')
          .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
          .replace(/운영시간|평일|주말|공휴일|점심시간/g, '')
          .replace(/이름\(name\):|휴대전화번호\(country\s*code\s*is\s*required\):|구매\s*목록\(D\):|특별한\s*복사\s*가능/g, '')
          .replace(/name:|country\s*code\s*is\s*required|@naver\.com|@gmail\.com|@hanmail\.net|010-\d+/g, '')
          .replace(/[가-힣]{2,4}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // 이메일 제거
          .replace(/010\d{8}|010-\d{4}-\d{4}/g, '') // 전화번호 제거
          .replace(/상담원\s*연결|해결되지\s*않았어요|구매\s*목록/g, '')
          .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
          .replace(/https?:\/\/[^\s]+/g, '')
          .trim();
        
        // 길이 기준 완화 (5글자 이상)
        if (cleanDescription.length > 5) {
          const descContent = cleanDescription.substring(0, 100);
          mockInquiry += mockInquiry ? `\n2. ${descContent}${cleanDescription.length > 100 ? '...' : ''}` : `1. ${descContent}${cleanDescription.length > 100 ? '...' : ''}`;
        }
      }
      
      // 댓글에서도 내용 추출 (매니저/BOT 내용 및 개인정보 제거)
      if (ticket.comments && Array.isArray(ticket.comments)) {
        let commentContent = '';
        ticket.comments.forEach(comment => {
          if (comment.body && comment.body.length > 3) {
            // 매니저/BOT 내용 및 개인정보 엄격하게 제거
            const cleanComment = comment.body
              .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원|관리자|운영자/g, '')
              .replace(/문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요|처리해드리겠습니다/g, '')
              .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요/g, '')
              .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
              .replace(/운영시간|평일|주말|공휴일|점심시간/g, '')
              .replace(/이름\(name\):|휴대전화번호\(country\s*code\s*is\s*required\):|구매\s*목록\(D\):|특별한\s*복사\s*가능/g, '')
              .replace(/name:|country\s*code\s*is\s*required|@naver\.com|@gmail\.com|@hanmail\.net|010-\d+/g, '')
              .replace(/[가-힣]{2,4}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // 이메일 제거
              .replace(/010\d{8}|010-\d{4}-\d{4}/g, '') // 전화번호 제거
              .replace(/상담원\s*연결|해결되지\s*않았어요|구매\s*목록/g, '')
              .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
              .replace(/https?:\/\/[^\s]+/g, '')
              .trim();
            
            // 길이 기준 완화 (5글자 이상)
            if (cleanComment.length > 5 && commentContent.length < 200) {
              commentContent += cleanComment + ' ';
            }
          }
        });
        
        // 최종 검증 완화 (10글자 이상)
        if (commentContent.trim().length > 10) {
          const nextNumber = mockInquiry.includes('2.') ? '3' : (mockInquiry.includes('1.') ? '2' : '1');
          mockInquiry += `\n${nextNumber}. ${commentContent.trim().substring(0, 80)}...`;
        }
      }
    } else {
      // 태그가 없는 경우도 더 엄격한 필터링을 적용합니다.
      let contentFound = false;
      
      if (ticket.subject && !ticket.subject.includes('님과의 대화')) {
        mockInquiry = `1. ${ticket.subject}에 대한 문의입니다.`;
        contentFound = true;
      }
      
      if (ticket.description && ticket.description.length > 3) {
        const cleanDescription = ticket.description
          .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원|관리자|운영자/g, '')
          .replace(/문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요|처리해드리겠습니다/g, '')
          .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요/g, '')
          .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
          .replace(/운영시간|평일|주말|공휴일|점심시간/g, '')
          .replace(/이름\(name\):|휴대전화번호\(country\s*code\s*is\s*required\):|구매\s*목록\(D\):|특별한\s*복사\s*가능/g, '')
          .replace(/name:|country\s*code\s*is\s*required|@naver\.com|@gmail\.com|@hanmail\.net|010-\d+/g, '')
          .replace(/[가-힣]{2,4}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // 이메일 제거
          .replace(/010\d{8}|010-\d{4}-\d{4}/g, '') // 전화번호 제거
          .replace(/상담원\s*연결|해결되지\s*않았어요|구매\s*목록/g, '')
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
      
      // 댓글도 확인 (매니저/BOT 내용 및 개인정보 제거)
      if (!contentFound && ticket.comments && Array.isArray(ticket.comments)) {
        for (const comment of ticket.comments) {
          if (comment.body && comment.body.length > 5) {
            const cleanComment = comment.body
              .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원|관리자|운영자/g, '')
              .replace(/문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요|처리해드리겠습니다/g, '')
              .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요/g, '')
              .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
              .replace(/운영시간|평일|주말|공휴일|점심시간/g, '')
              .replace(/이름\(name\):|휴대전화번호\(country\s*code\s*is\s*required\):|구매\s*목록\(D\):|특별한\s*복사\s*가능/g, '')
              .replace(/name:|country\s*code\s*is\s*required|@naver\.com|@gmail\.com|@hanmail\.net|010-\d+/g, '')
              .replace(/[가-힣]{2,4}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // 이메일 제거
              .replace(/010\d{8}|010-\d{4}-\d{4}/g, '') // 전화번호 제거
              .replace(/상담원\s*연결|해결되지\s*않았어요|구매\s*목록/g, '')
              .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
              .replace(/https?:\/\/[^\s]+/g, '')
              .trim();
            
            // 길이 기준 완화 (10글자 이상)
            if (cleanComment.length > 10) {
              mockInquiry = `1. ${cleanComment.substring(0, 80)}...`;
              contentFound = true;
              break;
            }
          }
        }
      }
    }
    
    // 의미있는 문의 내용이 없는 경우만 "없음" 표시 (기준 더 완화)
    if (!mockInquiry || mockInquiry.trim().length < 3) {
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