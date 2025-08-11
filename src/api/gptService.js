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
- **시스템 버튼 응답 완전 차단: "해결되었어요", "해결되지 않았어요", "더 궁금해요", "확인", "취소", "네", "아니오", "매니져연결", "매니저연결" 등**
- **업무 관련 멘트 완전 차단: "빠른 시일 내", "답변드리겠습니다", "확인 후 연락", "운영시간", "평일", "주말", "공휴일" 등**
- **인사말 완전 차단: "안녕하세요", "수고하세요", "좋은 하루", "감사합니다" 등 (고객이 작성했더라도 뒤에 구체적 문의가 없으면 제외)**
- **단순 응답 완전 차단: "네", "예", "알겠습니다", "그렇습니다", "맞습니다" 등**
- **개인정보 완전 제거: 이름, 이메일 주소, 전화번호, 휴대전화번호, 주소, 생년월일, 카드번호 등**
- **시스템 안내 문구: "이름(name):", "휴대전화번호(country code is required):", "구매 목록(D):", "해결되지 않았어요", "상담원 연결", "매니져연결" 등**
- **양식 입력 안내: "name:", "country code is required", "구매 목록", "특별한 복사 가능", "2.5버전업", "디저트곰" 등**
- **포인트/적립 관련 시스템 안내: "추천인 코드 강제입력 처리 도메인", "추천인 포인트 5,000p 적립", "사절" 등**
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
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `당신은 Zendesk 티켓 분석 전문가입니다. 티켓 제목에 '수신전화' 또는 '발신전화'가 포함되면 무조건 '문의 내용 없음'으로 응답하세요. 

고객의 태그(${customerTags.map(tag => tag.replace('고객_', '')).join(', ')})와 관련된 내용을 추출하되, **오직 고객이 직접 작성한 순수한 문의 내용만** 추출하세요.

**절대 제외 - 무조건 차단:**
- 여신BOT, 매니저L, 매니저B, 매니저D, Matrix_bot, Caller, 상담원, 직원, 관리자, 운영자가 작성한 모든 내용
- "확인해드리겠습니다", "문의해주셔서 감사합니다", "도움이 되셨나요", "처리해드리겠습니다" 등 상담원 표현
- "해결되었어요", "해결되지 않았어요", "더 궁금해요", "매니져연결", "매니자연결" 등 시스템 버튼
- "빠른 시일 내", "답변드리겠습니다", "확인 후 연락", "운영시간" 등 업무 표현
- **개인정보: 이름, 이메일, 전화번호 등**
- **시스템 안내: "추천인 코드", "포인트 적립", "2.5버전업", "디저트곰" 등**
- **양식 필드: "name:", "country code is required" 등**

**중요 지침:**
1. **중복 내용 절대 금지** - 같은 내용을 여러 번 출력하지 마세요
2. **매니저 내용 완전 차단** - 조금이라도 의심되면 제외
3. **오직 고객 문의만** - 실제 고객이 작성한 구체적인 문의, 질문, 요청만 추출
4. **한 번만 출력** - 같은 의미의 내용은 한 번만 포함

고객이 직접 작성한 구체적인 문의 내용이 정말로 없으면 "구체적인 문의 내용 없음"으로 응답하세요.`
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
      // 제외 조건 검사 (제목 + 태그)
      const shouldExclude = () => {
        const ticket = tickets[i];
        
        // 제외할 제목 키워드
        const excludeKeywords = ['수신전화', '발신전화', 'LMS 전송'];
        if (ticket.subject) {
          const hasExcludedKeyword = excludeKeywords.some(keyword => 
            ticket.subject.includes(keyword)
          );
          if (hasExcludedKeyword) return true;
        }
        
        // 고객 태그가 없는 경우 제외
        const customerTags = ticket.tags && Array.isArray(ticket.tags) 
          ? ticket.tags.filter(tag => tag && tag.startsWith('고객_'))
          : [];
        if (customerTags.length === 0) return true;
        
        return false;
      };
      
      if (shouldExclude()) {
        console.log(`티켓 ${tickets[i].id}: 제외 조건 (제목 또는 태그 없음)으로 분석 결과에서 제외`);
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
    
    // 제외 조건 검사 (제목 + 태그)
    const shouldExclude = () => {
      // 제외할 제목 키워드
      const excludeKeywords = ['수신전화', '발신전화', 'LMS 전송'];
      if (ticket.subject) {
        const hasExcludedKeyword = excludeKeywords.some(keyword => 
          ticket.subject.includes(keyword)
        );
        if (hasExcludedKeyword) return true;
      }
      
      // 고객 태그가 없는 경우 제외
      const customerTags = ticket.tags && Array.isArray(ticket.tags) 
        ? ticket.tags.filter(tag => tag && tag.startsWith('고객_'))
        : [];
      if (customerTags.length === 0) return true;
      
      return false;
    };
    
    if (shouldExclude()) {
      console.log(`티켓 ${ticket.id}: 제외 조건 (제목 또는 태그 없음)으로 모의 분석 결과에서 제외`);
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
      
      // description에서 내용 추출 (매니저/BOT 내용 및 개인정보 극도로 엄격 제거)
      if (ticket.description && ticket.description.length > 3) {
        // 매니저/BOT 내용 및 개인정보 극도로 엄격하게 제거
        const cleanDescription = ticket.description
          .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원|관리자|운영자/g, '')
          .replace(/문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요|처리해드리겠습니다/g, '')
          .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요|매니져연결|매니자연결/g, '')
          .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
          .replace(/운영시간|평일|주말|공휴일|점심시간/g, '')
          .replace(/이름\(name\):|휴대전화번호\(country\s*code\s*is\s*required\):|구매\s*목록\(D\):|특별한\s*복사\s*가능/g, '')
          .replace(/name:|country\s*code\s*is\s*required|@naver\.com|@gmail\.com|@hanmail\.net|010-\d+/g, '')
          .replace(/[가-힣]{2,4}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // 이메일 제거
          .replace(/010\d{8}|010-\d{4}-\d{4}/g, '') // 전화번호 제거
          .replace(/상담원\s*연결|해결되지\s*않았어요|구매\s*목록/g, '')
          .replace(/추천인\s*코드|포인트\s*적립|2\.5버전업|디저트곰|사절/g, '')
          .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
          .replace(/https?:\/\/[^\s]+/g, '')
          .trim();
        
        // 길이 기준 및 중복 방지 (8글자 이상, 의미있는 내용만)
        if (cleanDescription.length > 8 && !mockInquiry.includes(cleanDescription.substring(0, 20))) {
          const descContent = cleanDescription.substring(0, 100);
          mockInquiry += mockInquiry ? `\n2. ${descContent}${cleanDescription.length > 100 ? '...' : ''}` : `1. ${descContent}${cleanDescription.length > 100 ? '...' : ''}`;
        }
      }
      
      // 댓글에서도 내용 추출 (매니저/BOT 내용 및 개인정보 극도로 엄격 제거)
      if (ticket.comments && Array.isArray(ticket.comments)) {
        let commentContent = '';
        let addedContents = new Set(); // 중복 방지용
        
        ticket.comments.forEach(comment => {
          if (comment.body && comment.body.length > 3) {
            // 매니저/BOT 내용 및 개인정보 극도로 엄격하게 제거
            const cleanComment = comment.body
              .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원|관리자|운영자/g, '')
              .replace(/문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요|처리해드리겠습니다/g, '')
              .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요|매니져연결|매니자연결/g, '')
              .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
              .replace(/운영시간|평일|주말|공휴일|점심시간/g, '')
              .replace(/이름\(name\):|휴대전화번호\(country\s*code\s*is\s*required\):|구매\s*목록\(D\):|특별한\s*복사\s*가능/g, '')
              .replace(/name:|country\s*code\s*is\s*required|@naver\.com|@gmail\.com|@hanmail\.net|010-\d+/g, '')
              .replace(/[가-힣]{2,4}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // 이메일 제거
              .replace(/010\d{8}|010-\d{4}-\d{4}/g, '') // 전화번호 제거
              .replace(/상담원\s*연결|해결되지\s*않았어요|구매\s*목록/g, '')
              .replace(/추천인\s*코드|포인트\s*적립|2\.5버전업|디저트곰|사절/g, '')
              .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
              .replace(/https?:\/\/[^\s]+/g, '')
              .trim();
            
            // 길이 기준 강화 및 중복 방지 (8글자 이상, 중복 없음)
            const contentKey = cleanComment.substring(0, 20);
            if (cleanComment.length > 8 && !addedContents.has(contentKey) && commentContent.length < 150) {
              commentContent += cleanComment + ' ';
              addedContents.add(contentKey);
            }
          }
        });
        
        // 최종 검증 강화 (15글자 이상, 중복 없음)
        if (commentContent.trim().length > 15 && !mockInquiry.includes(commentContent.trim().substring(0, 20))) {
          const nextNumber = mockInquiry.includes('2.') ? '3' : (mockInquiry.includes('1.') ? '2' : '1');
          mockInquiry += `\n${nextNumber}. ${commentContent.trim().substring(0, 80)}...`;
        }
      }
    } else {
      // 태그가 없는 경우도 중복 방지와 더 강한 필터링을 적용합니다.
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
          .replace(/추천인\s*코드|포인트\s*적립|2\.5버전업|디저트곰|사절/g, '')
          .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
          .replace(/https?:\/\/[^\s]+/g, '')
          .trim();
        
        // 길이 기준 강화 (8글자 이상)
        if (cleanDescription.length > 8) {
          const descContent = cleanDescription.substring(0, 100);
          if (contentFound) {
            mockInquiry += `\n2. ${descContent}${cleanDescription.length > 100 ? '...' : ''}`;
          } else {
            mockInquiry = `1. ${descContent}${cleanDescription.length > 100 ? '...' : ''}`;
            contentFound = true;
          }
        }
      }
      
      // 댓글도 확인 (매니저/BOT 내용 및 개인정보 극도로 엄격 제거)
      if (!contentFound && ticket.comments && Array.isArray(ticket.comments)) {
        for (const comment of ticket.comments) {
          if (comment && comment.body && comment.body.length > 5) {
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
              .replace(/추천인\s*코드|포인트\s*적립|2\.5버전업|디저트곰|사절/g, '')
              .replace(/Screenshot_\w+|hcaptcha|img_\w+/g, '')
              .replace(/https?:\/\/[^\s]+/g, '')
              .trim();
            
            // 길이 기준 강화 (15글자 이상)
            if (cleanComment.length > 15) {
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

// 선택된 태그별 문의 내용 분석 (새로운 버전)
export const analyzeSelectedTags = async (tickets, selectedTags) => {
  try {
    // OpenAI 클라이언트 초기화 확인
    if (!openai) {
      const initialized = initializeOpenAI();
      if (!initialized) {
        throw new Error('OpenAI API 키가 설정되지 않았거나 올바르지 않습니다.');
      }
    }

    const results = {};
    let totalInquiries = 0;

    // 각 선택된 태그별로 분석 수행
    for (const selectedTag of selectedTags) {
      const tagName = selectedTag.displayName;
      const originalTagName = selectedTag.originalName;
      
      console.log(`🔍 ${tagName} 태그 분석 중...`);

      // 해당 태그를 가진 모든 티켓들 찾기 (검색 결과와 일치)
      console.log(`🔍 전체 티켓 수: ${tickets.length}개`);
      console.log(`🎯 찾을 태그: "${originalTagName}"`);
      
      // 더 강력한 태그 매칭 로직
      const taggedTickets = tickets.filter(ticket => {
        if (!ticket.tags || !Array.isArray(ticket.tags)) {
          return false;
        }
        
        // 정확한 매칭 시도
        const hasExactMatch = ticket.tags.includes(originalTagName);
        
        // 부분 매칭도 시도 (고객_ 접두사 제거)
        const tagWithoutPrefix = originalTagName.replace('고객_', '');
        const hasPartialMatch = ticket.tags.some(tag => 
          tag.includes(tagWithoutPrefix) || 
          tag.replace('고객_', '') === tagWithoutPrefix
        );
        
        const isMatched = hasExactMatch || hasPartialMatch;
        
        if (isMatched) {
          console.log(`✅ 매칭된 티켓 ${ticket.id}:`, {
            ticketTags: ticket.tags,
            targetTag: originalTagName,
            exactMatch: hasExactMatch,
            partialMatch: hasPartialMatch
          });
        }
        
        return isMatched;
      });

      console.log(`📊 태그 매칭 결과: ${taggedTickets.length}개 티켓 발견`);

      if (taggedTickets.length === 0) {
        console.log(`⚠️ ${tagName} 태그에 해당하는 티켓이 없습니다.`);
        
        // 디버깅을 위해 모든 티켓의 태그 출력
        console.log(`🔍 전체 티켓의 태그 샘플 (처음 5개):`);
        tickets.slice(0, 5).forEach((ticket, index) => {
          console.log(`티켓 ${index + 1} (ID: ${ticket.id}):`, ticket.tags);
        });
        
        continue;
      }

            // 티켓에서 선택된 태그와 관련된 문의 내용 수집 (검색 결과와 정확히 동일한 내용만)
      const inquiries = [];
      let inquiryCount = 0;
      
      console.log(`🔍 ${tagName} 태그: ${taggedTickets.length}개 티켓에서 실제 문의 내용 수집 중...`);
      console.log(`🎯 선택된 태그 정보:`, { tagName, originalTagName });
      
      for (const ticket of taggedTickets) {
        console.log(`📋 티켓 ${ticket.id} 분석 중...`);
        console.log(`🏷️ 티켓 태그:`, ticket.tags);
        
        let ticketInquiry = '';
        
        // 1순위: GPT 분석 결과가 있으면 사용 (이미 필터링된 고객 문의 내용)
        if (ticket.gptAnalysis && ticket.gptAnalysis.extractedInquiry) {
          const inquiry = ticket.gptAnalysis.extractedInquiry;
          console.log(`🤖 GPT 분석 결과 확인: "${inquiry}"`);
          if (inquiry && 
              !inquiry.includes('구체적인 문의 내용 없음') && 
              !inquiry.includes('분석 실패') &&
              inquiry.length > 10) {
            ticketInquiry = inquiry;
            console.log(`✅ GPT 분석 결과 사용: ${inquiry.substring(0, 50)}...`);
          } else {
            console.log(`⚠️ GPT 분석 결과 제외: ${inquiry}`);
          }
        } else {
          console.log(`⚠️ GPT 분석 결과 없음`);
        }
        
        // 2순위: GPT 분석 결과가 없거나 부족하면 원본에서 직접 추출
        if (!ticketInquiry || ticketInquiry.length < 10) {
          let rawContent = '';
          
          console.log(`🔍 티켓 ${ticket.id} 원본 내용 추출 중...`);
          console.log(`📋 제목: ${ticket.subject}`);
          console.log(`📝 설명: ${ticket.description ? ticket.description.substring(0, 100) + '...' : '없음'}`);
          console.log(`💬 댓글 수: ${ticket.comments ? ticket.comments.length : 0}`);
          
          // 제목에서 문의 내용 추출 (전화 관련 제외)
          if (ticket.subject && 
              !ticket.subject.includes('수신전화') && 
              !ticket.subject.includes('발신전화') &&
              !ticket.subject.includes('LMS 전송')) {
            const cleanSubject = ticket.subject
              .replace(/iOS User [a-f0-9]+님과의 대화/, '') // iOS User ID 제거
              .replace(/님과의 대화/, '') // "님과의 대화" 제거
              .trim();
            
            if (cleanSubject.length > 5) {
              rawContent += cleanSubject + ' ';
              console.log(`✅ 제목에서 내용 추출: ${cleanSubject}`);
            }
          }
          
          // 설명에서 문의 내용 추출 (매니저/BOT 내용 제외)
          if (ticket.description) {
            const cleanDescription = ticket.description
              .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원|관리자|운영자/g, '')
              .replace(/문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요|처리해드리겠습니다/g, '')
              .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요|매니져연결|매니자연결/g, '')
              .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
              .replace(/운영시간|평일|주말|공휴일|점심시간/g, '')
              .replace(/이름\(name\):|휴대전화번호\(country\s*code\s*is\s*required\):|구매\s*목록\(D\):/g, '')
              .replace(/name:|country\s*code\s*is\s*required/g, '')
              .replace(/[가-힣]{2,4}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // 이메일 제거
              .replace(/010\d{8}|010-\d{4}-\d{4}/g, '') // 전화번호 제거
              .replace(/https?:\/\/[^\s]+/g, '') // URL 제거
              .trim();
            
            if (cleanDescription.length > 10) {
              rawContent += cleanDescription + ' ';
              console.log(`✅ 설명에서 내용 추출: ${cleanDescription.substring(0, 50)}...`);
            }
          }
          
          // 댓글에서 문의 내용 추출 (매니저/BOT 내용 제외)
          if (ticket.comments && Array.isArray(ticket.comments)) {
            ticket.comments.forEach((comment, index) => {
              if (comment && comment.body && comment.body.length > 10) {
                const cleanComment = comment.body
                  .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원|관리자|운영자/g, '')
                  .replace(/문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요|처리해드리겠습니다/g, '')
                  .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요|매니져연결|매니자연결/g, '')
                  .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
                  .replace(/운영시간|평일|주말|공휴일|점심시간/g, '')
                  .replace(/이름\(name\):|휴대전화번호\(country\s*code\s*is\s*required\):|구매\s*목록\(D\):/g, '')
                  .replace(/name:|country\s*code\s*is\s*required/g, '')
                  .replace(/[가-힣]{2,4}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // 이메일 제거
                  .replace(/010\d{8}|010-\d{4}-\d{4}/g, '') // 전화번호 제거
                  .replace(/https?:\/\/[^\s]+/g, '') // URL 제거
                  .trim();
                
                if (cleanComment.length > 10) {
                  rawContent += cleanComment + ' ';
                  console.log(`✅ 댓글 ${index + 1}에서 내용 추출: ${cleanComment.substring(0, 50)}...`);
                }
              }
            });
          }
          
          // 선택된 태그와 관련된 내용인지 확인하고 문의 내용으로 사용
          if (rawContent.trim().length > 20) {
            const tagKeywords = [tagName.toLowerCase(), originalTagName.toLowerCase().replace('고객_', '')];
            const contentLower = rawContent.toLowerCase();
            
            // 태그 키워드가 포함되어 있거나, 해당 태그를 가진 티켓이므로 관련성 있다고 판단
            const isRelevant = tagKeywords.some(keyword => contentLower.includes(keyword)) || 
                             ticket.tags.includes(originalTagName);
            
            if (isRelevant) {
              ticketInquiry = rawContent.trim();
              console.log(`✅ Raw content 사용: ${ticketInquiry.substring(0, 50)}...`);
            } else {
              console.log(`⚠️ 태그 관련성 부족: ${tagKeywords.join(', ')} vs ${contentLower.substring(0, 50)}...`);
            }
          } else {
            console.log(`⚠️ 원본 내용 부족: ${rawContent.trim().length}글자`);
          }
          
          // 3순위: "고객 문의 내용:" 패턴 찾기 (TicketList와 동일한 로직)
          if (!ticketInquiry || ticketInquiry.length < 10) {
            const allContent = rawContent + ' ' + (ticket.subject || '') + ' ' + (ticket.description || '');
            const customerInquiryMatch = allContent.match(/고객\s*문의\s*내용:\s*(.+?)(?=\n|$)/s);
            if (customerInquiryMatch && customerInquiryMatch[1].trim().length > 2) {
              console.log(`✅ "고객 문의 내용:" 패턴 발견`);
              ticketInquiry = customerInquiryMatch[1].trim();
              console.log(`✅ 고객 문의 내용 추출: ${ticketInquiry.substring(0, 50)}...`);
            }
          }
          
          // 4순위: TicketList와 동일한 getUserComments 로직 사용
          if (!ticketInquiry || ticketInquiry.length < 10) {
            console.log(`🔄 TicketList 방식으로 문의 내용 추출 시도...`);
            
            // 모든 comment를 수집 (중첩 구조 고려) - TicketList.jsx와 동일한 로직
            let allComments = [];
            
            const findComments = (obj) => {
              if (!obj) return;
              
              if (Array.isArray(obj)) {
                obj.forEach(item => findComments(item));
              } else if (typeof obj === 'object') {
                // comments 배열이 있으면 추가
                if (obj.comments && Array.isArray(obj.comments)) {
                  allComments = allComments.concat(obj.comments);
                  // 중첩된 comments도 재귀 처리
                  obj.comments.forEach(comment => findComments(comment));
                }
                
                // 단일 comment 객체인 경우 (author_id 체크 추가)
                if ((obj.body || obj.plain_body) && obj.hasOwnProperty('author_id')) {
                  allComments.push(obj);
                }
                
                // 다른 속성들도 재귀 검사
                Object.values(obj).forEach(value => {
                  if (typeof value === 'object') {
                    findComments(value);
                  }
                });
              }
            };
            
            // ticket 전체에서 comments 찾기
            findComments(ticket);
            
            console.log(`📝 발견된 댓글 수: ${allComments.length}개`);
            
            // 모든 body 내용을 수집
            let allContent = '';
            allComments.forEach(comment => {
              if (comment.body) {
                allContent += comment.body + ' ';
              }
              if (comment.plain_body && comment.plain_body !== comment.body) {
                allContent += comment.plain_body + ' ';
              }
            });
            
            // description과 subject도 확인
            if (ticket.description) {
              allContent += ticket.description + ' ';
            }
            if (ticket.subject && !ticket.subject.includes('님과의 대화')) {
              allContent += ticket.subject + ' ';
            }
            
            allContent = allContent.trim();
            console.log(`📄 전체 내용 길이: ${allContent.length}자`);
            
            if (allContent) {
              // 1순위: "고객 문의 내용:" 패턴 찾기
              const customerInquiryMatch = allContent.match(/고객\s*문의\s*내용:\s*(.+?)(?=\n|$)/s);
              if (customerInquiryMatch && customerInquiryMatch[1].trim().length > 2) {
                ticketInquiry = customerInquiryMatch[1].trim();
                console.log(`✅ "고객 문의 내용:" 패턴으로 추출: ${ticketInquiry.substring(0, 50)}...`);
              } else {
                // 2순위: 전체 내용에서 매니저/BOT 내용 제외하고 추출
                const cleanedContent = allContent
                  .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원|관리자|운영자/g, '')
                  .replace(/문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요|처리해드리겠습니다/g, '')
                  .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요|매니져연결|매니자연결/g, '')
                  .replace(/빠른\s*시일\s*내|답변\s*드리겠습니다|처리해드리겠습니다|확인\s*후\s*연락/g, '')
                  .trim();
                
                if (cleanedContent.length > 15) {
                  ticketInquiry = cleanedContent.substring(0, 200); // 최대 200자까지
                  console.log(`✅ 정제된 내용으로 추출: ${ticketInquiry.substring(0, 50)}...`);
                }
              }
            }
          }
        }
        
        // 최종적으로 문의 내용이 있는 경우만 추가 (기준 완화)
        if (ticketInquiry && ticketInquiry.trim().length > 5) {
          inquiries.push(ticketInquiry.trim());
          inquiryCount++;
          console.log(`📝 문의 내용 추가됨 (${inquiryCount}번째): ${ticketInquiry.substring(0, 50)}...`);
        } else {
          console.log(`⚠️ 티켓 ${ticket.id}: 유효한 문의 내용 없음`);
          
          // 문의 내용이 없을 때 더 적극적으로 추출 시도
          let fallbackContent = '';
          
          // 제목에서라도 내용 추출
          if (ticket.subject && !ticket.subject.includes('님과의 대화')) {
            fallbackContent = ticket.subject;
          }
          
          // 설명에서라도 내용 추출
          if (!fallbackContent && ticket.description) {
            fallbackContent = ticket.description.substring(0, 100);
          }
          
          // 댓글에서라도 내용 추출
          if (!fallbackContent && ticket.comments && ticket.comments.length > 0) {
            for (const comment of ticket.comments) {
              if (comment.body && comment.body.length > 10) {
                fallbackContent = comment.body.substring(0, 100);
                break;
              }
            }
          }
          
          if (fallbackContent && fallbackContent.trim().length > 5) {
            inquiries.push(fallbackContent.trim());
            inquiryCount++;
            console.log(`📝 대체 내용 추가됨 (${inquiryCount}번째): ${fallbackContent.substring(0, 50)}...`);
          } else {
            console.log(`❌ 티켓 ${ticket.id}: 어떤 내용도 추출할 수 없음`);
          }
        }
      }

      if (inquiries.length === 0) {
        console.log(`⚠️ ${tagName} 태그에서 분석할 문의 내용을 찾을 수 없습니다.`);
        console.log(`🔍 디버깅 정보:`);
        console.log(`- 태그가 일치하는 티켓 수: ${taggedTickets.length}개`);
        console.log(`- 선택된 태그: ${originalTagName}`);
        console.log(`- 첫 번째 티켓 예시:`, taggedTickets[0] ? {
          id: taggedTickets[0].id,
          subject: taggedTickets[0].subject,
          tags: taggedTickets[0].tags,
          hasGptAnalysis: !!taggedTickets[0].gptAnalysis,
          hasComments: !!(taggedTickets[0].comments && taggedTickets[0].comments.length > 0),
          hasDescription: !!taggedTickets[0].description
        } : '없음');
        
        // 문의 내용이 없어도 결과에 포함하여 사용자에게 알림
        results[originalTagName] = {
          tagName: tagName,
          originalTagName: originalTagName,
          inquiryCount: 0,
          ticketCount: taggedTickets.length,
          naturalLanguageAnalysis: `**"${tagName}" 태그 분석 결과:**

⚠️ **문의 내용 수집 실패**

📊 **상세 정보:**
- 태그가 일치하는 티켓: ${taggedTickets.length}개 발견
- 추출된 문의 내용: 0개

🔍 **가능한 원인:**
1. 해당 태그의 티켓들이 아직 GPT 분석을 거치지 않았음
2. 티켓 내용이 매니저/BOT 메시지만 포함하고 실제 고객 문의가 없음
3. 문의 내용이 시스템에서 인식할 수 있는 형태로 저장되지 않았음

💡 **해결 방법:**
1. 먼저 "🚀 분석하기" 버튼으로 전체 티켓을 GPT 분석한 후 태그별 분석을 시도해보세요
2. 검색 결과에서 해당 태그의 문의 내용을 직접 확인해보세요`,
          keywordAnalysis: `**분석 불가:** 추출된 문의 내용이 없어 키워드 분석을 수행할 수 없습니다.`,
          processedAt: new Date().toISOString(),
          error: '문의 내용 추출 실패'
        };
        continue;
      }

      totalInquiries += inquiries.length;
      const inquiryText = inquiries.join('\n\n');
      
      // 자연어 분석 프롬프트 (개선된 버전 - 검색 결과 기반 학습 및 빈도 분석)
      const naturalLanguagePrompt = `
당신은 고객 문의 분석 전문가입니다. 선택된 "${tagName}" 태그에 해당하는 검색 결과에서 추출된 모든 문의 내용을 학습하고 분석해주세요.

**🎯 분석 목표:**
1. 제공된 문의 내용들을 모두 학습합니다
2. 자주 문의하는 내용이 무엇인지 빈도 기반으로 분석합니다
3. 고객이 실제 사용한 문의 톤을 그대로 보존하여 출력합니다

**📊 학습 데이터:**
- 총 ${inquiries.length}개의 문의 내용
- "${tagName}" 태그와 일치하는 검색 결과에서 추출
- 모든 문의 내용을 학습 대상으로 포함

**🔍 분석 방법:**
1. **전체 문의 내용 스캔**: 아래 제공된 ${inquiries.length}개 문의를 모두 읽고 학습
2. **패턴 식별**: 유사한 문의 내용끼리 그룹화하여 패턴 발견
3. **빈도 계산**: 각 패턴이 얼마나 자주 나타나는지 계산
4. **우선순위 정렬**: 가장 자주 나타나는 패턴부터 순서대로 정리
5. **톤 보존**: 고객이 실제 사용한 표현과 어투를 그대로 유지

**💬 고객 톤 보존 원칙:**
- 존댓말/반말/구어체 그대로 유지
- 감정 표현 ("급해요", "불편해요", "궁금해요" 등) 원문 보존
- 특수 표현, 줄임말, 방언도 그대로 보존
- 고객의 어투와 문체 변경 금지

**📝 출력 형식:**
**"${tagName}" 태그 관련 자주 문의하는 내용 분석 결과:**

**🥇 가장 많이 문의하는 내용 (빈도: X회/${inquiries.length}건):**
- 고객 원문 표현 그대로 1
- 고객 원문 표현 그대로 2
- 고객 원문 표현 그대로 3

**🥈 두 번째로 많이 문의하는 내용 (빈도: X회/${inquiries.length}건):**
- 고객 원문 표현 그대로 1
- 고객 원문 표현 그대로 2

**🥉 세 번째로 많이 문의하는 내용 (빈도: X회/${inquiries.length}건):**
- 고객 원문 표현 그대로 1
- 고객 원문 표현 그대로 2

(더 많은 패턴이 있다면 계속 추가)

**⚠️ 중요한 제약사항:**
- 반드시 아래 제공된 문의 내용에서만 분석
- 가상의 예시나 추측 내용 추가 금지
- 고객 표현을 분석자 스타일로 변경 금지
- 인사말, 감사 표현 등 불용어는 분석에서 제외

**📋 학습할 실제 문의 내용들 (총 ${inquiries.length}건):**
${inquiryText}

위 문의 내용들을 모두 학습하여 자주 문의하는 패턴을 찾고, 고객의 원래 톤을 보존하여 분석 결과를 출력해주세요.
`;

      // 키워드 분석 프롬프트 (선택된 태그에 집중 + 불용어 제외)
      const keywordPrompt = `
다음은 "${tagName}" 태그에 해당하는 티켓에서 추출된 실제 고객 문의 내용들입니다.
이 문의들은 모두 "${tagName}" 태그와 직접적으로 연관된 내용들이므로, "${tagName}"와 관련된 키워드를 중심으로 분석해주세요.

**핵심 분석 목표:**
1. **선택한 태그에 해당하는 문의 내용 전체를 검토**하여 자주 언급되는 키워드 분석
2. **"안녕하세요" 등 인사말과 문의 내용과 관련 없는 불용어는 분석에서 제외**
3. **"${tagName}" 태그와 관련된 의미있는 키워드만 추출**

**키워드 추출 기준 (엄격 적용):**
✅ **포함할 키워드:**
- 서비스/제품 관련 핵심 용어 (기능명, 메뉴명, 버튼명 등)
- 문제 상황을 나타내는 구체적 단어 (오류, 실패, 안됨, 느림 등)
- 고객 행동/의도를 나타내는 동작어 (결제, 로그인, 가입, 취소 등)
- 감정이나 만족도를 나타내는 형용사 (불편, 만족, 어려움 등)
- 기술적/업무적 전문 용어

❌ **완전 제외할 키워드 (불용어/인사말 완전 제거):**
- **인사말**: "안녕하세요", "안녕히계세요", "수고하세요", "좋은하루", "안녕", "반갑습니다"
- **감사/정중 표현**: "감사합니다", "고맙습니다", "죄송합니다", "미안합니다", "실례합니다"
- **접속사/부사**: "그런데", "그래서", "그리고", "하지만", "그러나", "또한", "그런", "이런"
- **대명사/지시어**: "저는", "제가", "이것", "그것", "여기", "거기", "이거", "그거"
- **단순 응답**: "네", "예", "아니오", "맞습니다", "알겠습니다", "좋습니다"
- **일반 조사/어미**: "은", "는", "이", "가", "을", "를", "에서", "으로", "에게"
- **일반적 단어**: "것", "거", "뭐", "그냥", "좀", "많이", "조금", "정말", "문의", "질문", "요청"
- **시간/날짜**: "오늘", "어제", "내일", "지금", "현재", "이전", "이후", "언제"
- **일반 동사**: "하다", "되다", "있다", "없다", "주다", "받다", "보다", "듣다"
- **1-2글자 의미없는 단어** 및 모든 조사 완전 제외

**응답 형식:**
상위 10개 키워드를 빈도순으로 나열하되, 다음 형식으로 응답:

**🔑 핵심 키워드 TOP 10:**
1. **[키워드]** - 빈도 X회 (X%) | [분류] | [간단한 설명/맥락]
2. **[키워드]** - 빈도 X회 (X%) | [분류] | [간단한 설명/맥락]
...

**📈 키워드 트렌드 요약:**
- 가장 빈번한 키워드 카테고리: [분석]
- 주요 문제 키워드: [나열]
- 고객 감정 키워드: [분석]

**문의 내용:**
${inquiryText}
`;

      try {
        // 자연어 분석
        const naturalResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system", 
              content: "당신은 고객 문의 분석 전문가입니다. 주어진 문의 내용들을 분석하여 명확하고 실용적인 인사이트를 제공해주세요."
            },
            {
              role: "user",
              content: naturalLanguagePrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        });

        // 키워드 분석
        const keywordResponse = await openai.chat.completions.create({
          model: "gpt-4o", 
          messages: [
            {
              role: "system",
              content: "당신은 텍스트 키워드 추출 전문가입니다. 의미있는 키워드만 정확히 추출하고 빈도를 분석해주세요."
            },
            {
              role: "user", 
              content: keywordPrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 800
        });

        results[originalTagName] = {
          tagName: tagName,
          originalTagName: originalTagName,
          inquiryCount: inquiries.length,
          ticketCount: taggedTickets.length,
          naturalLanguageAnalysis: naturalResponse.choices[0].message.content.trim(),
          keywordAnalysis: keywordResponse.choices[0].message.content.trim(),
          processedAt: new Date().toISOString()
        };

        // API 호출 제한을 위한 지연
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`${tagName} 태그 분석 실패:`, error);
        results[originalTagName] = {
          tagName: tagName,
          originalTagName: originalTagName,
          inquiryCount: inquiries.length,
          ticketCount: taggedTickets.length,
          naturalLanguageAnalysis: '분석 실패 - API 오류가 발생했습니다.',
          keywordAnalysis: '분석 실패 - API 오류가 발생했습니다.',
          error: error.message,
          processedAt: new Date().toISOString()
        };
      }
    }

    return {
      tagAnalysis: results,
      summary: {
        totalTags: selectedTags.length,
        analyzedTags: Object.keys(results).length,
        totalInquiries: totalInquiries
      }
    };

  } catch (error) {
    console.error('선택된 태그별 분석 오류:', error);
    return {
      tagAnalysis: {},
      summary: { totalTags: 0, analyzedTags: 0, totalInquiries: 0 },
      error: error.message
    };
  }
};

// 모의 선택된 태그별 분석 (API 키가 없을 때)
export const mockAnalyzeSelectedTags = async (tickets, selectedTags) => {
  const results = {};
  let totalInquiries = 0;

  for (const selectedTag of selectedTags) {
    const tagName = selectedTag.displayName;
    const originalTagName = selectedTag.originalName;
    
    // 모의 지연
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 해당 태그를 가진 모든 티켓들 찾기 (검색 결과와 일치)
    console.log(`🔍 [모의] 전체 티켓 수: ${tickets.length}개`);
    console.log(`🎯 [모의] 찾을 태그: "${originalTagName}"`);
    
    const taggedTickets = tickets.filter(ticket => {
      if (!ticket.tags || !Array.isArray(ticket.tags)) {
        return false;
      }
      
      // 정확한 매칭 시도
      const hasExactMatch = ticket.tags.includes(originalTagName);
      
      // 부분 매칭도 시도 (고객_ 접두사 제거)
      const tagWithoutPrefix = originalTagName.replace('고객_', '');
      const hasPartialMatch = ticket.tags.some(tag => 
        tag.includes(tagWithoutPrefix) || 
        tag.replace('고객_', '') === tagWithoutPrefix
      );
      
      return hasExactMatch || hasPartialMatch;
    });
    
    console.log(`📊 [모의] 태그 매칭 결과: ${taggedTickets.length}개 티켓 발견`);

    if (taggedTickets.length === 0) {
      console.log(`⚠️ ${tagName} 태그에 해당하는 티켓이 없습니다.`);
      continue;
    }

    // 실제 태그 관련 문의 내용 수집 (모의 분석에서도 필터링 적용)
    const inquiries = [];
    taggedTickets.forEach(ticket => {
      let content = '';
      
      // GPT 분석 결과가 있으면 우선 사용
      if (ticket.gptAnalysis?.extractedInquiry && 
          !ticket.gptAnalysis.extractedInquiry.includes('구체적인 문의 내용 없음') &&
          !ticket.gptAnalysis.extractedInquiry.includes('분석 실패')) {
        
        const extractedContent = ticket.gptAnalysis.extractedInquiry;
        const tagKeywords = [tagName.toLowerCase(), originalTagName.toLowerCase().replace('고객_', '')];
        const contentLower = extractedContent.toLowerCase();
        
        const isRelevant = tagKeywords.some(keyword => contentLower.includes(keyword)) || 
                         ticket.tags.includes(originalTagName);
        
        if (isRelevant) {
          content = extractedContent;
        }
      }
      
      // GPT 분석 결과가 없으면 원본에서 추출 (필터링 적용)
      if (!content || content.trim().length < 10) {
        let rawContent = '';
        
        if (ticket.subject && 
            !ticket.subject.includes('수신전화') && 
            !ticket.subject.includes('발신전화') &&
            !ticket.subject.includes('님과의 대화')) {
          rawContent += ticket.subject + ' ';
        }
        
        if (ticket.description) {
          const cleanDescription = ticket.description
            .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원|관리자|운영자/g, '')
            .replace(/문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요|처리해드리겠습니다/g, '')
            .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요|매니져연결|매니자연결/g, '')
            .trim();
          
          if (cleanDescription.length > 10) {
            rawContent += cleanDescription + ' ';
          }
        }
        
        // 댓글에서도 내용 추출
        if (ticket.comments && Array.isArray(ticket.comments)) {
          ticket.comments.forEach(comment => {
            if (comment && comment.body && comment.body.length > 10) {
              const cleanComment = comment.body
                .replace(/여신BOT|매니저L|매니저B|매니저D|Matrix_bot|Caller|상담원|직원|관리자|운영자/g, '')
                .replace(/문의해주셔서\s*감사합니다|확인해드리겠습니다|도움이\s*되셨나요|처리해드리겠습니다/g, '')
                .replace(/해결되었어요|해결되지\s*않았어요|더\s*궁금해요|매니져연결|매니자연결/g, '')
                .trim();
              
              if (cleanComment.length > 10) {
                rawContent += cleanComment + ' ';
              }
            }
          });
        }
        
        if (rawContent.trim().length > 10) {
          const tagKeywords = [tagName.toLowerCase(), originalTagName.toLowerCase().replace('고객_', '')];
          const contentLower = rawContent.toLowerCase();
          
          const isRelevant = tagKeywords.some(keyword => contentLower.includes(keyword)) || 
                           ticket.tags.includes(originalTagName);
          
          if (isRelevant) {
            content = rawContent.trim();
          }
        }
        
        // "고객 문의 내용:" 패턴 찾기 (TicketList와 동일한 로직)
        if (!content || content.trim().length < 10) {
          const customerInquiryMatch = rawContent.match(/고객\s*문의\s*내용:\s*(.+?)(?=\n|$)/s);
          if (customerInquiryMatch && customerInquiryMatch[1].trim().length > 2) {
            content = customerInquiryMatch[1].trim();
          }
        }
      }
      
      if (content && content.trim().length > 10) {
        inquiries.push(content.trim());
      }
    });

    const inquiryCount = inquiries.length > 0 ? inquiries.length : Math.min(taggedTickets.length, Math.floor(Math.random() * 10) + 3);
    totalInquiries += inquiryCount;

    results[originalTagName] = {
      tagName: tagName,
      originalTagName: originalTagName,
      inquiryCount: inquiryCount,
      ticketCount: taggedTickets.length,
      naturalLanguageAnalysis: `**"${tagName}" 태그 관련 자주 문의하는 내용 분석 결과:**

📊 **학습 데이터:** 총 ${inquiryCount}개의 문의 내용 (검색 결과에서 추출)

${inquiries.length > 0 ? 
  (() => {
    // 실제 문의 내용을 패턴별로 빈도 기반 분석 (모의)
    const sampleInquiries = inquiries.slice(0, Math.min(8, inquiries.length));
    let result = '';
    
    if (sampleInquiries.length >= 4) {
      const pattern1Count = Math.ceil(sampleInquiries.length * 0.4);
      const pattern2Count = Math.ceil(sampleInquiries.length * 0.3);
      const pattern3Count = sampleInquiries.length - pattern1Count - pattern2Count;
      
      result += `**🥇 가장 많이 문의하는 내용 (빈도: ${pattern1Count}회/${inquiryCount}건):**\n`;
      result += sampleInquiries.slice(0, 2).map(inquiry => {
        let customerTone = inquiry.length > 60 ? inquiry.substring(0, 60) + '...' : inquiry;
        return `- ${customerTone}`;
      }).join('\n') + '\n\n';
      
      result += `**🥈 두 번째로 많이 문의하는 내용 (빈도: ${pattern2Count}회/${inquiryCount}건):**\n`;
      result += sampleInquiries.slice(2, 4).map(inquiry => {
        let customerTone = inquiry.length > 60 ? inquiry.substring(0, 60) + '...' : inquiry;
        return `- ${customerTone}`;
      }).join('\n');
      
      if (sampleInquiries.length > 4) {
        result += `\n\n**🥉 세 번째로 많이 문의하는 내용 (빈도: ${pattern3Count}회/${inquiryCount}건):**\n`;
        result += sampleInquiries.slice(4).map(inquiry => {
          let customerTone = inquiry.length > 60 ? inquiry.substring(0, 60) + '...' : inquiry;
          return `- ${customerTone}`;
        }).join('\n');
      }
    } else {
      result += `**🥇 가장 많이 문의하는 내용 (빈도: ${sampleInquiries.length}회/${inquiryCount}건):**\n`;
      result += sampleInquiries.map(inquiry => {
        let customerTone = inquiry.length > 60 ? inquiry.substring(0, 60) + '...' : inquiry;
        return `- ${customerTone}`;
      }).join('\n');
    }
    
    result += `\n\n💬 **고객 문의 톤 특징:**\n- 실제 고객이 사용한 표현과 어투를 그대로 보존\n- 존댓말/반말, 감정 표현 등 원문 톤 유지`;
    
    return result;
  })() : 
  `**🥇 가장 많이 문의하는 내용 (빈도: 추정 ${Math.ceil(inquiryCount * 0.5)}회/${inquiryCount}건):**
- ${tagName} 어떻게 사용하는 건가요?
- ${tagName} 설정 방법 알려주세요

**🥈 두 번째로 많이 문의하는 내용 (빈도: 추정 ${Math.ceil(inquiryCount * 0.3)}회/${inquiryCount}건):**  
- ${tagName} 관련해서 문제가 있어요
- ${tagName} 오류 해결해주세요

💬 **고객 문의 톤 특징:**
- 실제 고객이 사용한 표현과 어투를 그대로 보존
- 존댓말/반말, 감정 표현 등 원문 톤 유지`
}

*위 내용은 "${tagName}" 태그와 일치하는 검색 결과에서 추출된 ${inquiryCount}개 문의 내용을 학습하여 빈도 기반으로 분석한 결과입니다.*`,
      
      keywordAnalysis: `**🔑 핵심 키워드 TOP 10:**
1. **${tagName}** - 빈도 ${inquiryCount}회 (${Math.floor((inquiryCount / inquiryCount) * 100)}%) | 핵심 기능어 | 주요 서비스 태그
2. **문의** - 빈도 ${Math.floor(inquiryCount * 0.8)}회 (${Math.floor(0.8 * 100)}%) | 일반 업무어 | 고객 문의 행동
3. **사용법** - 빈도 ${Math.floor(inquiryCount * 0.6)}회 (${Math.floor(0.6 * 100)}%) | 핵심 기능어 | 사용 방법 질문
4. **오류** - 빈도 ${Math.floor(inquiryCount * 0.4)}회 (${Math.floor(0.4 * 100)}%) | 문제 지시어 | 시스템 에러 관련
5. **설정** - 빈도 ${Math.floor(inquiryCount * 0.35)}회 (${Math.floor(0.35 * 100)}%) | 핵심 기능어 | 환경 설정 관련
6. **해결** - 빈도 ${Math.floor(inquiryCount * 0.3)}회 (${Math.floor(0.3 * 100)}%) | 일반 업무어 | 문제 해결 요청
7. **로그인** - 빈도 ${Math.floor(inquiryCount * 0.25)}회 (${Math.floor(0.25 * 100)}%) | 핵심 기능어 | 접속 관련 문제
8. **변경** - 빈도 ${Math.floor(inquiryCount * 0.2)}회 (${Math.floor(0.2 * 100)}%) | 일반 업무어 | 정보 수정 요청
9. **확인** - 빈도 ${Math.floor(inquiryCount * 0.2)}회 (${Math.floor(0.2 * 100)}%) | 일반 업무어 | 상태 확인 요청
10. **불편** - 빈도 ${Math.floor(inquiryCount * 0.15)}회 (${Math.floor(0.15 * 100)}%) | 감정/만족도어 | 고객 불만 표현
10. **불편** - 빈도 ${Math.floor(inquiryCount * 0.15)}회 (${Math.floor(0.15 * 100)}%) | 감정/만족도어 | 고객 불만 표현

**📈 키워드 트렌드 요약:**
- 가장 빈번한 키워드 카테고리: 핵심 기능어 (${Math.floor(0.6 * 100)}%), 문제 지시어 (${Math.floor(0.3 * 100)}%)
- 주요 문제 키워드: 오류, 문제, 안됨, 어려움
- 고객 감정 키워드: 불편, 어려움, 빠른 (해결 요구)`,
      
      processedAt: new Date().toISOString(),
      isMock: true
    };
  }

  return {
    tagAnalysis: results,
    summary: {
      totalTags: selectedTags.length,
      analyzedTags: Object.keys(results).length,
      totalInquiries: totalInquiries,
      isMock: true
    }
  };
};

// 태그별 문의 내용 분석 (기존 버전 - 호환성 유지)
export const analyzeTagInquiries = async (analyzedTickets) => {
  try {
    // OpenAI 클라이언트 초기화 확인
    if (!openai) {
      const initialized = initializeOpenAI();
      if (!initialized) {
        throw new Error('OpenAI API 키가 설정되지 않았거나 올바르지 않습니다.');
      }
    }

    // 태그별로 문의 내용 그룹화
    const tagGroups = {};
    
    analyzedTickets.forEach(ticket => {
      if (ticket.tags && Array.isArray(ticket.tags) && ticket.gptAnalysis?.extractedInquiry) {
        const customerTags = ticket.tags.filter(tag => tag && tag.startsWith('고객_'));
        const inquiry = ticket.gptAnalysis.extractedInquiry;
        
        // "구체적인 문의 내용 없음" 등은 제외
        if (inquiry && 
            !inquiry.includes('구체적인 문의 내용 없음') && 
            !inquiry.includes('분석 실패') &&
            inquiry.length > 10) {
          
          customerTags.forEach(tag => {
            if (!tagGroups[tag]) {
              tagGroups[tag] = [];
            }
            tagGroups[tag].push(inquiry);
          });
        }
      }
    });

    const results = {};
    
    // 각 태그별로 분석 수행
    for (const [tag, inquiries] of Object.entries(tagGroups)) {
      if (inquiries.length < 3) continue; // 최소 3개 이상의 문의가 있어야 분석
      
      const tagName = tag.replace('고객_', '');
      const inquiryText = inquiries.join('\n\n');
      
      console.log(`🔍 ${tagName} 태그 분석 중... (${inquiries.length}개 문의)`);
      
      // 자연어 분석 프롬프트 (실제 문의 내용만 기반 + 고객 톤 보존 + 엄격한 제한)
      const naturalLanguagePrompt = `
다음은 "${tagName}" 태그와 관련된 **실제 고객 문의 내용들**입니다.

**🚨 핵심 원칙 (절대 지켜야 함):**
1. **오직 아래 제공된 문의 내용에서만** 패턴을 찾아 분석하세요
2. **문의 내용에 없는 내용은 절대 추가하지 마세요** - 가상의 예시, 추측, 일반적인 내용 모두 금지
3. **고객이 실제로 사용한 표현과 톤을 그대로 보존**하여 출력하세요
4. **"안녕하세요" 등 인사말과 문의 내용과 관련 없는 불용어는 분석에서 제외**하세요

**📋 분석 방법 (엄격한 제한):**
1. **실제 문의 내용만 스캔**: 아래 제공된 문의 내용들을 읽고 공통적으로 나타나는 주제나 키워드 식별
2. **빈도 기반 그룹화**: 비슷한 내용이나 의도의 문의들을 빈도에 따라 그룹화
3. **패턴 우선순위**: 가장 자주 나타나는 패턴부터 순서대로 정리
4. **원문 표현 보존**: 각 패턴에서 고객이 실제로 사용한 표현 그대로 사용
5. **불용어 필터링**: 인사말, 감사인사, 일반적 조사 등은 제외하고 핵심 문의 내용만 분석

**❌ 불용어 제외 대상 (분석에서 완전 제외):**
- **인사말**: "안녕하세요", "안녕히계세요", "수고하세요", "좋은하루", "안녕", "반갑습니다"
- **감사/정중 표현**: "감사합니다", "고맙습니다", "죄송합니다", "미안합니다", "실례합니다"
- **일반 조사/어미**: "은", "는", "이", "가", "을", "를", "에서", "으로", "에게"
- **단순 응답**: "네", "예", "아니오", "맞습니다", "알겠습니다", "좋습니다"
- **일반적 단어**: "것", "거", "뭐", "그냥", "좀", "많이", "조금", "정말"

**🎯 고객 톤 보존 지침:**
- **존댓말/반말** 구분하여 그대로 유지
- **감정 표현** (급함, 불편함, 궁금함, 답답함 등) 원문 그대로 반영
- **구어체 표현** ("~해주세요", "~인가요?", "~하고 싶어요" 등) 그대로 보존
- **고객의 어투와 문체** 변경하지 말고 원문 그대로 사용
- **줄임말이나 특수 표현**도 고객이 사용한 그대로 보존

**📝 분석 결과 출력 형식:**
아래 **실제 문의 내용에서만** 발견된 **자주 문의하는 패턴**을 **고객이 실제 사용한 톤**으로 정리:

**"${tagName}" 관련 자주 문의하는 내용:**

**가장 많이 문의하는 내용 (패턴 1):**
- [고객 원문 표현 그대로 1]
- [고객 원문 표현 그대로 2]

**두 번째로 많이 문의하는 내용 (패턴 2):**
- [고객 원문 표현 그대로 1]
- [고객 원문 표현 그대로 2]

**세 번째로 많이 문의하는 내용 (패턴 3):**
- [고객 원문 표현 그대로 1]
- [고객 원문 표현 그대로 2]

(패턴이 더 있다면 계속 추가)

**🚫 엄격한 금지사항 (위반 시 분석 무효):**
- **문의 내용에 없는 가상의 예시나 추측 내용 추가 절대 금지**
- **일반적인 예상 문의나 상식적인 내용 추가 금지**
- **고객 표현을 분석자 스타일로 정제하거나 공식적으로 바꾸는 것 금지**
- **고객의 톤, 어조, 말투를 변경하는 것 금지**
- **불용어나 인사말을 포함한 분석 결과 출력 금지**
- **"~할 수 있나요?", "~방법 좀 알려주세요" 등 문의 내용에 없는 일반적 표현 추가 금지**

**📊 분석 대상 실제 문의 내용 (이 내용만 사용):**
${inquiryText}

**⚠️ 최종 확인:**
위 문의 내용에 없는 내용은 절대 출력하지 마세요. 모든 분석 결과는 반드시 위 문의 내용에서만 도출되어야 합니다.
`;

      // 키워드 분석 프롬프트 (개선된 버전 + 불용어 제외)
      const keywordPrompt = `
다음은 "${tagName}" 태그와 관련된 고객 문의 내용들입니다.
이 문의들에서 의미있는 키워드를 정교하게 추출하여 빈도 분석을 해주세요.

**핵심 분석 목표:**
1. **선택한 태그에 해당하는 문의 내용 전체를 검토**하여 자주 언급되는 키워드 분석
2. **"안녕하세요" 등 인사말과 문의 내용과 관련 없는 불용어는 분석에서 제외**
3. **"${tagName}" 태그와 관련된 의미있는 키워드만 추출**

**키워드 추출 기준 (엄격 적용):**
✅ **포함할 키워드:**
- 서비스/제품 관련 핵심 용어 (기능명, 메뉴명, 버튼명 등)
- 문제 상황을 나타내는 구체적 단어 (오류, 실패, 안됨, 느림 등)
- 고객 행동/의도를 나타내는 동작어 (결제, 로그인, 가입, 취소 등)
- 감정이나 만족도를 나타내는 형용사 (불편, 만족, 어려움 등)
- 기술적/업무적 전문 용어

❌ **완전 제외할 키워드 (불용어/인사말 완전 제거):**
- **인사말**: "안녕하세요", "안녕히계세요", "수고하세요", "좋은하루", "안녕", "반갑습니다"
- **감사/정중 표현**: "감사합니다", "고맙습니다", "죄송합니다", "미안합니다", "실례합니다"
- **접속사/부사**: "그런데", "그래서", "그리고", "하지만", "그러나", "또한", "그런", "이런"
- **대명사/지시어**: "저는", "제가", "이것", "그것", "여기", "거기", "이거", "그거"
- **단순 응답**: "네", "예", "아니오", "맞습니다", "알겠습니다", "좋습니다"
- **일반 조사/어미**: "은", "는", "이", "가", "을", "를", "에서", "으로", "에게"
- **일반적 단어**: "것", "거", "뭐", "그냥", "좀", "많이", "조금", "정말", "문의", "질문", "요청"
- **시간/날짜**: "오늘", "어제", "내일", "지금", "현재", "이전", "이후", "언제"
- **일반 동사**: "하다", "되다", "있다", "없다", "주다", "받다", "보다", "듣다"
- **1-2글자 의미없는 단어** 및 모든 조사 완전 제외

**키워드 분류 및 우선순위:**
1. **핵심 기능어** (가중치 높음): 서비스의 핵심 기능과 직결
2. **문제 지시어** (가중치 높음): 구체적인 문제 상황 표현
3. **감정/만족도어** (가중치 중간): 고객 경험과 감정 상태
4. **일반 업무어** (가중치 낮음): 일반적인 업무 관련 용어

**응답 형식:**
상위 10개 키워드를 빈도순으로 나열하되, 다음 형식으로 응답:

**🔑 핵심 키워드 TOP 10:**
1. **[키워드]** - 빈도 X회 (X%) | [분류] | [간단한 설명/맥락]
2. **[키워드]** - 빈도 X회 (X%) | [분류] | [간단한 설명/맥락]
...

**📈 키워드 트렌드 요약:**
- 가장 빈번한 키워드 카테고리: [분석]
- 주요 문제 키워드: [나열]
- 고객 감정 키워드: [분석]

**문의 내용:**
${inquiryText}
`;

      try {
        // 자연어 분석
        const naturalResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system", 
              content: "당신은 고객 문의 분석 전문가입니다. 주어진 문의 내용들을 분석하여 명확하고 실용적인 인사이트를 제공해주세요."
            },
            {
              role: "user",
              content: naturalLanguagePrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        });

        // 키워드 분석
        const keywordResponse = await openai.chat.completions.create({
          model: "gpt-4o", 
          messages: [
            {
              role: "system",
              content: "당신은 텍스트 키워드 추출 전문가입니다. 의미있는 키워드만 정확히 추출하고 빈도를 분석해주세요."
            },
            {
              role: "user", 
              content: keywordPrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 800
        });

        results[tag] = {
          tagName: tagName,
          inquiryCount: inquiries.length,
          naturalLanguageAnalysis: naturalResponse.choices[0].message.content.trim(),
          keywordAnalysis: keywordResponse.choices[0].message.content.trim(),
          processedAt: new Date().toISOString()
        };

        // API 호출 제한을 위한 지연
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`${tagName} 태그 분석 실패:`, error);
        results[tag] = {
          tagName: tagName,
          inquiryCount: inquiries.length,
          naturalLanguageAnalysis: '분석 실패 - API 오류가 발생했습니다.',
          keywordAnalysis: '분석 실패 - API 오류가 발생했습니다.',
          error: error.message,
          processedAt: new Date().toISOString()
        };
      }
    }

    return {
      tagAnalysis: results,
      summary: {
        totalTags: Object.keys(tagGroups).length,
        analyzedTags: Object.keys(results).length,
        totalInquiries: Object.values(tagGroups).reduce((sum, arr) => sum + arr.length, 0)
      }
    };

  } catch (error) {
    console.error('태그별 분석 오류:', error);
    return {
      tagAnalysis: {},
      summary: { totalTags: 0, analyzedTags: 0, totalInquiries: 0 },
      error: error.message
    };
  }
};

// 모의 태그별 분석 (API 키가 없을 때)
export const mockAnalyzeTagInquiries = async (analyzedTickets) => {
  // 태그별로 문의 내용 그룹화
  const tagGroups = {};
  
  analyzedTickets.forEach(ticket => {
    if (ticket.tags && Array.isArray(ticket.tags) && ticket.gptAnalysis?.extractedInquiry) {
      const customerTags = ticket.tags.filter(tag => tag && tag.startsWith('고객_'));
      const inquiry = ticket.gptAnalysis.extractedInquiry;
      
      if (inquiry && 
          !inquiry.includes('구체적인 문의 내용 없음') && 
          !inquiry.includes('분석 실패') &&
          inquiry.length > 10) {
        
        customerTags.forEach(tag => {
          if (!tagGroups[tag]) {
            tagGroups[tag] = [];
          }
          tagGroups[tag].push(inquiry);
        });
      }
    }
  });

  const results = {};
  
  // 모의 분석 결과 생성
  for (const [tag, inquiries] of Object.entries(tagGroups)) {
    if (inquiries.length < 3) continue;
    
    const tagName = tag.replace('고객_', '');
    
    // 모의 지연
    await new Promise(resolve => setTimeout(resolve, 200));
    
    results[tag] = {
      tagName: tagName,
      inquiryCount: inquiries.length,
      naturalLanguageAnalysis: `**"${tagName}" 관련 자주 문의하는 내용 (고객 원문 톤 유지):**
${inquiries.length > 0 ? 
  inquiries.slice(0, Math.min(12, inquiries.length)).map((inquiry, index) => 
    `- "${inquiry.length > 60 ? inquiry.substring(0, 60) + '...' : inquiry}"`
  ).join('\n') : 
  `- "${tagName} 관련 구체적인 문의 내용이 수집되지 않았습니다"`
}

*위 내용은 실제 "${tagName}" 태그 티켓에서 추출된 고객 문의의 톤과 표현을 그대로 반영한 것입니다.*`,
      
      keywordAnalysis: `**🔑 핵심 키워드 TOP 10:**
1. **${tagName}** - 빈도 ${inquiries.length}회 (${Math.floor((inquiries.length / inquiries.length) * 100)}%) | 핵심 기능어 | 주요 서비스 태그
2. **문의** - 빈도 ${Math.floor(inquiries.length * 0.8)}회 (${Math.floor(0.8 * 100)}%) | 일반 업무어 | 고객 문의 행동
3. **사용법** - 빈도 ${Math.floor(inquiries.length * 0.6)}회 (${Math.floor(0.6 * 100)}%) | 핵심 기능어 | 사용 방법 질문
4. **오류** - 빈도 ${Math.floor(inquiries.length * 0.4)}회 (${Math.floor(0.4 * 100)}%) | 문제 지시어 | 시스템 에러 관련
5. **설정** - 빈도 ${Math.floor(inquiries.length * 0.35)}회 (${Math.floor(0.35 * 100)}%) | 핵심 기능어 | 환경 설정 관련
6. **해결** - 빈도 ${Math.floor(inquiries.length * 0.3)}회 (${Math.floor(0.3 * 100)}%) | 일반 업무어 | 문제 해결 요청
7. **로그인** - 빈도 ${Math.floor(inquiries.length * 0.25)}회 (${Math.floor(0.25 * 100)}%) | 핵심 기능어 | 접속 관련 문제
8. **변경** - 빈도 ${Math.floor(inquiries.length * 0.2)}회 (${Math.floor(0.2 * 100)}%) | 일반 업무어 | 정보 수정 요청
9. **확인** - 빈도 ${Math.floor(inquiries.length * 0.2)}회 (${Math.floor(0.2 * 100)}%) | 일반 업무어 | 상태 확인 요청
10. **불편** - 빈도 ${Math.floor(inquiries.length * 0.15)}회 (${Math.floor(0.15 * 100)}%) | 감정/만족도어 | 고객 불만 표현
11. **도움** - 빈도 ${Math.floor(inquiries.length * 0.15)}회 (${Math.floor(0.15 * 100)}%) | 일반 업무어 | 지원 요청
12. **문제** - 빈도 ${Math.floor(inquiries.length * 0.12)}회 (${Math.floor(0.12 * 100)}%) | 문제 지시어 | 이슈 발생 표현
13. **안됨** - 빈도 ${Math.floor(inquiries.length * 0.1)}회 (${Math.floor(0.1 * 100)}%) | 문제 지시어 | 기능 작동 실패
14. **어려움** - 빈도 ${Math.floor(inquiries.length * 0.08)}회 (${Math.floor(0.08 * 100)}%) | 감정/만족도어 | 사용 난이도 표현
15. **빠른** - 빈도 ${Math.floor(inquiries.length * 0.05)}회 (${Math.floor(0.05 * 100)}%) | 감정/만족도어 | 신속한 처리 요구

**📈 키워드 트렌드 요약:**
- 가장 빈번한 키워드 카테고리: 핵심 기능어 (${Math.floor(0.6 * 100)}%), 문제 지시어 (${Math.floor(0.3 * 100)}%)
- 주요 문제 키워드: 오류, 문제, 안됨, 어려움
- 고객 감정 키워드: 불편, 어려움, 빠른 (해결 요구)`,
      
      processedAt: new Date().toISOString(),
      isMock: true
    };
  }

  return {
    tagAnalysis: results,
    summary: {
      totalTags: Object.keys(tagGroups).length,
      analyzedTags: Object.keys(results).length,
      totalInquiries: Object.values(tagGroups).reduce((sum, arr) => sum + arr.length, 0),
      isMock: true
    }
  };
}; 