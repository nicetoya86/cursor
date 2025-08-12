import OpenAI from 'openai';

let openai = null;

// OpenAI 클라이언트 초기화
const initializeOpenAI = () => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  console.log('🔑 API 키 확인:', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyStart: apiKey ? apiKey.substring(0, 7) + '...' : 'none',
    apiKeyEnd: apiKey ? '...' + apiKey.substring(apiKey.length - 4) : 'none'
  });
  
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your-api-key-here') {
    console.log('ℹ️ OpenAI API 키가 설정되지 않았습니다. 모의 분석 모드를 사용합니다.');
    return false;
  }
  
  try {
    console.log('🔧 OpenAI 클라이언트 생성 중...');
    openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
    
    console.log('✅ OpenAI 클라이언트가 성공적으로 초기화되었습니다.');
    return true;
  } catch (error) {
    console.error('❌ OpenAI 클라이언트 초기화 실패:', error);
    return false;
  }
};

// GPT 프롬프트 템플릿 (단순화된 문의 내용 추출)
const createExtractionPrompt = (ticketContent, tags) => {
  const tagList = Array.isArray(tags) ? tags.join(', ') : tags;
  
  return `다음 고객 서비스 티켓에서 고객의 실제 문의 내용을 찾아주세요.

**추출 방법:**
1. 티켓의 제목, 설명, 댓글에서 고객이 작성한 내용을 찾기
2. 상담원이나 시스템의 답변은 제외하고 고객의 질문이나 요청만 추출
3. 태그 정보를 참고하여 문의 맥락 파악

**간단한 제외 대상:**
- 상담원 답변 (확인해드리겠습니다, 처리해드리겠습니다 등)
- 시스템 메시지 (티켓 생성, 상태 변경 알림 등)
- 단순 인사말만 있는 경우

**태그 정보:** ${tagList || '없음'}

**출력 지침:**
- 고객의 실제 문의나 요청 내용이 있으면 그대로 출력
- 태그 정보로 문의 유형을 추정할 수 있으면 해당 내용 포함
- 구체적인 문의를 찾기 어려우면 태그를 바탕으로 추정되는 문의 유형 설명
- 예: "결제 관련 문의", "서비스 이용 문의", "계정 문제 해결 요청" 등

**분석할 티켓:**
${ticketContent}

**고객 문의 내용:**`;
};

// 단일 티켓 분석
export const analyzeSingleTicket = async (ticket) => {
  try {
    // 입력 검증
    if (!ticket || typeof ticket !== 'object') {
      throw new Error('유효하지 않은 티켓 데이터입니다.');
    }

    // 티켓 내용 구성 (개선된 버전)
    let content = '';
    
    // 기본 정보 추가
    content += `티켓 ID: ${ticket.id}\n`;
    content += `상태: ${ticket.status || '알 수 없음'}\n`;
    content += `생성일: ${ticket.created_at || '알 수 없음'}\n`;
    
    if (ticket.subject && !ticket.subject.includes('님과의 대화')) {
      content += `제목: ${ticket.subject}\n`;
    }
    
    if (ticket.description && !ticket.description.includes('님과의 대화')) {
      content += `설명: ${ticket.description}\n`;
    }
    
    // 태그 정보를 먼저 분석
    const tags = ticket && ticket.tags && Array.isArray(ticket.tags) ? ticket.tags : [];
    const customerTags = tags.filter(tag => tag && typeof tag === 'string' && tag.startsWith('고객_'));
    const allTags = tags.filter(tag => tag && typeof tag === 'string');
    
    if (allTags.length > 0) {
      content += `태그: ${allTags.join(', ')}\n`;
    }
    
    // 댓글 내용 추가 (의미있는 내용만)
    if (ticket.comments && Array.isArray(ticket.comments)) {
      const meaningfulComments = ticket.comments.filter(comment => 
        comment && comment.body && 
        !comment.body.includes('님과의 대화') &&
        comment.body.length > 5 &&
        !comment.body.includes('티켓이 생성되었습니다')
      );
      
      if (meaningfulComments.length > 0) {
        content += `댓글:\n`;
        meaningfulComments.forEach((comment, index) => {
          content += `${index + 1}. ${comment.body}\n`;
        });
      }
    }
    
    // 내용이 너무 적으면 티켓 메타데이터 활용
    if (content.length < 100 && customerTags.length > 0) {
      content += `\n고객 분류 태그를 통해 파악된 문의 유형: ${customerTags.join(', ')}\n`;
    }

    const prompt = createExtractionPrompt(content, customerTags);
    
    console.log('📤 티켓 분석 API 호출 시작:', {
      ticketId: ticket.id,
      model: 'gpt-4o-mini',
      promptLength: prompt.length,
      customerTagsCount: customerTags.length
    });
    
    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "당신은 고객 서비스 티켓 분석 전문가입니다. 고객의 문의 내용을 찾아서 도움이 되는 정보를 제공해주세요. 구체적인 문의가 없더라도 태그나 상황 정보를 활용하여 고객이 어떤 도움을 필요로 하는지 파악해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });
    
    console.log('📥 티켓 분석 API 응답 받음:', {
      ticketId: ticket.id,
      hasResponse: !!response,
      hasChoices: !!(response?.choices),
      choicesLength: response?.choices?.length || 0
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
    console.error('티켓 분석 오류:', error);
    
    let errorMessage = '분석 실패 - API 오류가 발생했습니다.';
    
    // 구체적인 오류 메시지 제공
    if (error.status === 401) {
      errorMessage = '분석 실패 - API 키가 유효하지 않습니다.';
    } else if (error.status === 429) {
      errorMessage = '분석 실패 - API 사용량 한도를 초과했습니다.';
    } else if (error.status === 400) {
      errorMessage = '분석 실패 - 잘못된 모델명 또는 요청입니다.';
    } else if (error.message?.includes('model')) {
      errorMessage = '분석 실패 - 지원하지 않는 모델입니다.';
    }
    
    return {
      ...ticket,
      gptAnalysis: {
        extractedInquiry: errorMessage,
        error: error.message,
        processedAt: new Date().toISOString()
      }
    };
  }
};

// 병렬 처리를 위한 배치 크기 설정
const BATCH_SIZE = 3; // 동시에 처리할 티켓 수

// 여러 티켓 배치 분석 (병렬 처리로 속도 향상)
export const analyzeTicketsWithGPT = async (tickets, progressCallback) => {
  // 입력 검증
  if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
    throw new Error('분석할 티켓 데이터가 없습니다.');
  }

  if (!openai) {
    const initialized = initializeOpenAI();
    if (!initialized) {
      throw new Error('OpenAI API 키가 설정되지 않았거나 올바르지 않습니다.');
    }
  }

  // 분석 대상 티켓 필터링
  const validTickets = [];
  let excludedCount = 0;

  for (const ticket of tickets) {
    const shouldExclude = () => {
      // 이미 분석된 티켓 제외
      if (ticket.gptAnalysis && ticket.gptAnalysis.extractedInquiry) {
        return true;
      }
      
      // 고객 태그가 없는 티켓 제외 (선택적)
      const customerTags = ticket && ticket.tags && Array.isArray(ticket.tags) 
        ? ticket.tags.filter(tag => tag && typeof tag === 'string' && tag.startsWith('고객_'))
        : [];
      if (customerTags.length === 0) return true;
      
      return false;
    };
    
    if (shouldExclude()) {
      excludedCount++;
    } else {
      validTickets.push(ticket);
    }
  }

  const results = [];
  let processedCount = 0;
  const totalTickets = tickets.length;
  const totalValidTickets = validTickets.length;

  console.log(`🚀 병렬 분석 시작: 전체 ${totalTickets}개 중 ${totalValidTickets}개 분석 대상`);

  // 배치별로 병렬 처리
  for (let i = 0; i < validTickets.length; i += BATCH_SIZE) {
    const batch = validTickets.slice(i, i + BATCH_SIZE);
    
    console.log(`📦 배치 ${Math.floor(i / BATCH_SIZE) + 1} 처리 중: ${batch.length}개 티켓`);
    
    // 배치 내 티켓들을 병렬로 처리
    const batchPromises = batch.map(async (ticket, batchIndex) => {
      try {
        const globalIndex = i + batchIndex + 1;
        console.log(`🔍 분석 중: 티켓 ${ticket.id} (${globalIndex}/${totalValidTickets})`);
        
        const analyzedTicket = await analyzeSingleTicket(ticket);
        return analyzedTicket;
      } catch (error) {
        console.error(`❌ 티켓 ${ticket.id} 분석 실패:`, error);
        return {
          ...ticket,
          gptAnalysis: {
            extractedInquiry: '분석 실패',
            error: error.message,
            processedAt: new Date().toISOString()
          }
        };
      }
    });

    // 배치 완료 대기
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    processedCount += batch.length;
    
    // 진행률 업데이트
    const currentProgress = ((excludedCount + processedCount) / totalTickets) * 100;
    if (progressCallback) {
      progressCallback(currentProgress);
    }
    
    // 배치 간 짧은 지연 (API 제한 고려)
    if (i + BATCH_SIZE < validTickets.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // 최종 진행률 100% 업데이트
  if (progressCallback) {
    progressCallback(100);
  }

  return {
    results,
    summary: {
      total: tickets.length,
      analyzed: results.length,
      excluded: excludedCount,
      successful: results.filter(r => !r.gptAnalysis.error).length,
      failed: results.filter(r => r.gptAnalysis.error).length
    }
  };
};

// API 키 검증 (실제 API 테스트 포함)
export const validateOpenAIKey = async () => {
  console.log('🔐 API 키 검증 시작...');
  
  try {
    const initialized = initializeOpenAI();
    
    if (!initialized) {
      console.log('❌ OpenAI 클라이언트 초기화 실패');
      throw new Error('OpenAI API 키가 설정되지 않았거나 올바르지 않습니다.');
    }
    
    // 실제 API 호출로 키 유효성 테스트
    console.log('🧪 API 키 유효성 테스트 중...');
    console.log('📋 사용할 모델: gpt-4o-mini');
    
    const testResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 5
    });
    
    console.log('📥 테스트 응답 받음:', {
      hasResponse: !!testResponse,
      hasChoices: !!(testResponse?.choices),
      choicesLength: testResponse?.choices?.length || 0
    });
    
    console.log('✅ API 키 검증 성공');
    return true;
  } catch (error) {
    console.error('❌ API 키 검증 실패:', error);
    console.error('❌ 오류 상세:', {
      status: error?.status || 'unknown',
      message: error?.message || 'unknown error',
      type: error?.type || 'unknown',
      name: error?.name || 'unknown'
    });
    
    // 네트워크 오류 처리
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('네트워크 연결 오류입니다. 인터넷 연결을 확인해주세요.');
    }
    
    // OpenAI API 오류 처리
    if (error.status === 401) {
      throw new Error('OpenAI API 키가 유효하지 않습니다. API 키를 확인해주세요.');
    } else if (error.status === 429) {
      throw new Error('OpenAI API 사용량 한도를 초과했습니다.');
    } else if (error.status === 403) {
      throw new Error('OpenAI API 접근 권한이 없습니다.');
    } else if (error.status >= 500) {
      throw new Error('OpenAI 서버 오류입니다. 잠시 후 다시 시도해주세요.');
    } else {
      throw new Error(`OpenAI API 오류 (${error.status || 'unknown'}): ${error.message || 'unknown error'}`);
    }
  }
};

// API 키 검증 (별칭)
export const validateApiKey = validateOpenAIKey;

// 개발용 모의 분석 (API 키가 없을 때 사용)
export const mockAnalyzeTickets = async (tickets, progressCallback) => {
  const results = [];
  let excludedCount = 0;
  let processedCount = 0;
  const totalTickets = tickets.length;

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    
    // 진행률 업데이트
    const currentProgress = (processedCount / totalTickets) * 100;
    if (progressCallback) {
      progressCallback(currentProgress);
    }
    // 분석 제외 조건 확인 (실제 분석과 동일)
    const shouldExclude = () => {
      if (ticket.gptAnalysis && ticket.gptAnalysis.extractedInquiry) {
        return true;
      }
      
      const customerTags = ticket && ticket.tags && Array.isArray(ticket.tags) 
        ? ticket.tags.filter(tag => tag && typeof tag === 'string' && tag.startsWith('고객_'))
        : [];
      if (customerTags.length === 0) return true;
      
      return false;
    };
    
    if (shouldExclude()) {
      excludedCount++;
      processedCount++;
      continue;
    }

    // 모의 분석 결과 생성
    let mockInquiry = '모의 분석 결과: ';
    
    if (ticket.subject) {
      mockInquiry += `${ticket.subject}에 대한 문의`;
    }
    
    if (ticket.description && ticket.description.length > 20) {
      const shortDesc = ticket.description.substring(0, 50) + '...';
      mockInquiry += ` - ${shortDesc}`;
    }
    
    if (!ticket.subject && !ticket.description) {
      mockInquiry += '구체적인 문의 내용을 확인하기 어려움';
    }
    
    results.push({
      ...ticket,
      gptAnalysis: {
        extractedInquiry: mockInquiry,
        originalContent: `모의 분석 - ${ticket.id}`,
        processedAt: new Date().toISOString(),
        isMock: true
      }
    });
    
    processedCount++;
    
    // 모의 지연 (속도 향상을 위해 25ms로 단축)
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  
  // 최종 진행률 100% 업데이트
  if (progressCallback) {
    progressCallback(100);
  }

  return {
    results,
    summary: {
      total: tickets.length,
      analyzed: results.length,
      excluded: excludedCount,
      successful: results.length,
      failed: 0,
      isMock: true
    }
  };
}; 

// 선택된 태그별 문의 내용 분석 (완전히 새로운 버전)
export const analyzeSelectedTags = async (tickets, selectedTags) => {
  console.log('🚀 analyzeSelectedTags 함수 시작:', {
    ticketsCount: tickets?.length || 0,
    selectedTagsCount: selectedTags?.length || 0
  });

  try {
    // 입력 검증
    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      throw new Error('분석할 티켓 데이터가 없습니다.');
    }
    
    if (!selectedTags || !Array.isArray(selectedTags) || selectedTags.length === 0) {
      throw new Error('선택된 태그가 없습니다.');
    }

    // 선택된 태그 구조 검증
    for (let i = 0; i < selectedTags.length; i++) {
      const tag = selectedTags[i];
      if (!tag || typeof tag !== 'object' || !tag.displayName || !tag.originalName) {
        console.error('❌ 잘못된 태그 구조:', tag);
        throw new Error(`선택된 태그 중 잘못된 데이터가 있습니다 (인덱스: ${i})`);
      }
    }

    // OpenAI 클라이언트 초기화 확인
    if (!openai) {
      console.log('🔧 OpenAI 클라이언트 초기화 시도...');
      const initialized = initializeOpenAI();
      if (!initialized) {
        throw new Error('OpenAI API 키가 설정되지 않았거나 올바르지 않습니다.');
      }
      console.log('✅ OpenAI 클라이언트 초기화 완료');
    }

    const results = {};
    let totalInquiries = 0;

    console.log(`📋 ${selectedTags.length}개 태그 분석 시작...`);

    // 각 선택된 태그별로 분석 수행
    for (let i = 0; i < selectedTags.length; i++) {
      const selectedTag = selectedTags[i];
      if (!selectedTag || !selectedTag.displayName || !selectedTag.originalName) {
        console.log(`⚠️ 잘못된 태그 데이터: ${JSON.stringify(selectedTag)}`);
        continue;
      }
      
      const tagName = selectedTag.displayName;
      const originalTagName = selectedTag.originalName;
      
      console.log(`🔍 [${i + 1}/${selectedTags.length}] "${tagName}" 태그 분석 시작...`);

      // 1단계: 검색 결과에서 동일한 태그를 가진 티켓들 찾기
      console.log(`📊 전체 티켓 수: ${tickets.length}개`);
      console.log(`🎯 찾을 태그: "${originalTagName}"`);
      
      const matchedTickets = tickets.filter(ticket => {
        if (!ticket || !ticket.tags || !Array.isArray(ticket.tags) || !originalTagName) {
          return false;
        }
        
        // 정확한 태그 매칭
        const hasExactMatch = ticket.tags.includes(originalTagName);
        
        // 부분 매칭 (고객_ 접두사 제거)
        const tagWithoutPrefix = originalTagName.replace('고객_', '');
        const hasPartialMatch = ticket.tags.some(tag => 
          tag && typeof tag === 'string' && tag.replace('고객_', '') === tagWithoutPrefix
        );
        
        return hasExactMatch || hasPartialMatch;
      });

      console.log(`✅ 매칭된 티켓: ${matchedTickets.length}개`);

      if (matchedTickets.length === 0) {
        console.log(`⚠️ "${tagName}" 태그에 해당하는 티켓이 없습니다.`);
        // 빈 결과라도 추가하여 사용자에게 알림
        results[tagName] = {
          naturalLanguageAnalysis: `**"${tagName}" 태그 분석 결과**\n\n⚠️ 해당 태그를 가진 티켓이 없습니다.`,
          keywordAnalysis: [],
          totalInquiries: 0,
          analyzedTags: 0
        };
        continue;
      }

      // 2단계: 매칭된 티켓들의 문의 내용 전체 수집
      const inquiryContents = [];
      
      console.log(`📝 ${matchedTickets.length}개 티켓의 문의 내용 수집 중...`);
      
      for (const ticket of matchedTickets) {
        console.log(`📋 티켓 ${ticket.id} 처리 중...`);
        
        let content = '';
        
        // 제목 추가 (대화 제목 제외)
        if (ticket.subject && !ticket.subject.includes('님과의 대화')) {
          content += ticket.subject + '\n';
        }
        
        // 설명 추가
          if (ticket.description) {
          content += ticket.description + '\n';
        }
        
        // 댓글에서 고객 문의 내용 추출
          if (ticket.comments && Array.isArray(ticket.comments)) {
          for (const comment of ticket.comments) {
            if (comment && comment.body) {
              // 시스템/매니저 댓글 제외
              const isSystemComment = 
                comment.body.includes('고객센터') ||
                comment.body.includes('문의해주셔서') ||
                comment.body.includes('확인해드리겠습니다') ||
                comment.body.includes('처리해드리겠습니다') ||
                comment.body.includes('담당자');
              
              if (!isSystemComment) {
                content += comment.body + '\n';
              }
            }
          }
        }
        
        // GPT 분석 결과가 있으면 우선 사용
        if (ticket.gptAnalysis && ticket.gptAnalysis.extractedInquiry) {
          const gptContent = ticket.gptAnalysis.extractedInquiry;
          if (gptContent && 
              !gptContent.includes('구체적인 문의 내용 없음') && 
              !gptContent.includes('분석 실패')) {
            content = gptContent; // GPT 결과를 우선 사용
          }
        }
        
        if (content.trim()) {
          inquiryContents.push(content.trim());
          console.log(`✅ 티켓 ${ticket.id} 내용 수집: ${content.substring(0, 50)}...`);
        }
      }

      console.log(`📊 수집 완료: ${inquiryContents.length}개 문의 내용`);

      if (inquiryContents.length === 0) {
        console.log(`⚠️ "${tagName}" 태그에서 문의 내용을 찾을 수 없습니다.`);
        continue;
      }

      totalInquiries += inquiryContents.length;

      // 3단계: 수집한 문의 내용에서 자주 물어보는 내용 분석
      console.log(`🤖 "${tagName}" 태그의 자주 문의하는 내용 분석 시작...`);

      try {
        const analysisPrompt = `
다음은 "${tagName}" 태그와 관련된 실제 고객 문의 내용들입니다.

**분석 목표:** 이 문의 내용들을 분석해서 자주 물어보는 내용이 무엇인지 찾아주세요.

**분석 방법:**
1. 모든 문의 내용을 꼼꼼히 읽어보세요
2. 비슷한 주제나 패턴을 찾아서 그룹화하세요
3. 가장 자주 나타나는 패턴부터 순서대로 정리하세요
4. 고객이 실제로 사용한 표현을 그대로 보존해서 출력하세요

**출력 형식:**
**"${tagName}" 관련 자주 문의하는 내용:**

**🥇 가장 많이 문의하는 내용:**
- [고객 실제 표현 1]
- [고객 실제 표현 2]

**🥈 두 번째로 많이 문의하는 내용:**
- [고객 실제 표현 1]
- [고객 실제 표현 2]

**🥉 세 번째로 많이 문의하는 내용:**
- [고객 실제 표현 1]
- [고객 실제 표현 2]

**분석할 문의 내용들 (총 ${inquiryContents.length}건):**

${inquiryContents.map((content, index) => `${index + 1}. ${content}`).join('\n\n')}
`;

        console.log(`📤 OpenAI API 호출 시작...`);
        console.log(`📊 분석할 문의 내용 수: ${inquiryContents.length}건`);
        console.log(`📝 프롬프트 길이: ${analysisPrompt.length}자`);

        // OpenAI API 호출
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system", 
              content: "당신은 고객 서비스 분석 전문가입니다. 고객 문의 내용을 분석하여 자주 문의하는 패턴을 찾아주세요."
            },
            {
              role: "user",
              content: analysisPrompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.3
        });

        console.log(`📥 OpenAI API 응답 받음`);

        if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
          throw new Error('OpenAI API 응답이 올바르지 않습니다.');
        }

        const analysisResult = response.choices[0].message.content;
        
        if (!analysisResult || analysisResult.trim() === '') {
          throw new Error('OpenAI API에서 빈 응답을 받았습니다.');
        }
        
        console.log(`✅ "${tagName}" 분석 완료`);
        console.log(`📄 분석 결과 길이: ${analysisResult.length}자`);
        console.log(`📄 분석 결과 미리보기:`, analysisResult.substring(0, 100) + '...');

        // 결과 저장
        results[tagName] = {
          naturalLanguageAnalysis: analysisResult,
          keywordAnalysis: [
            {keyword: tagName.replace('_', ' '), frequency: inquiryContents.length, importance: 'high'}
          ],
          totalInquiries: inquiryContents.length,
          analyzedTags: 1
        };

      } catch (apiError) {
        console.error(`❌ "${tagName}" OpenAI API 호출 실패:`, apiError);
        
        // API 호출 실패시 대체 결과 제공
        results[tagName] = {
          naturalLanguageAnalysis: `**"${tagName}" 태그 분석 결과**\n\n❌ **API 분석 실패**\n\n오류: ${apiError.message}\n\n수집된 문의 내용 (${inquiryContents.length}건):\n${inquiryContents.slice(0, 3).map((content, index) => `${index + 1}. ${content.substring(0, 100)}...`).join('\n')}`,
          keywordAnalysis: [
            {keyword: tagName.replace('_', ' '), frequency: inquiryContents.length, importance: 'high'}
          ],
          totalInquiries: inquiryContents.length,
          analyzedTags: 0,
          error: apiError.message
        };
      }
    }

    console.log('🎉 전체 분석 완료!');
    console.log(`📊 최종 결과:`, {
        totalTags: selectedTags.length,
      totalInquiries,
        analyzedTags: Object.keys(results).length,
      successfulTags: Object.values(results).filter(r => !r.error).length
    });

    const finalResult = {
      success: true,
      results,
      summary: {
        totalTags: selectedTags.length,
        totalInquiries,
        analyzedTags: Object.keys(results).length
      },
      isMock: false
    };

    console.log('✅ analyzeSelectedTags 함수 완료, 결과 반환');
    return finalResult;

  } catch (error) {
    console.error('❌ 태그별 분석 치명적 오류:', error);
    console.error('❌ 오류 스택:', error.stack);
    
    const errorResult = {
      success: false,
      error: error.message,
      results: {},
      summary: {
        totalTags: selectedTags?.length || 0,
        totalInquiries: 0,
        analyzedTags: 0
      },
      isMock: false
    };

    console.log('❌ analyzeSelectedTags 함수 오류로 종료, 오류 결과 반환');
    return errorResult;
  }
};

// 모의 선택된 태그별 분석 (API 키가 없을 때)
export const mockAnalyzeSelectedTags = async (tickets, selectedTags) => {
  const results = {};
  let totalInquiries = 0;

  // 각 선택된 태그별로 모의 분석 수행
  for (const selectedTag of selectedTags) {
    const tagName = selectedTag.displayName;
    const originalTagName = selectedTag.originalName;
    
    console.log(`🔍 [모의] "${tagName}" 태그 분석 시작...`);

    // 동일한 태그 매칭 로직
    const matchedTickets = tickets.filter(ticket => {
      if (!ticket || !ticket.tags || !Array.isArray(ticket.tags) || !originalTagName) {
        return false;
      }
      
      const hasExactMatch = ticket.tags.includes(originalTagName);
      const tagWithoutPrefix = originalTagName.replace('고객_', '');
      const hasPartialMatch = ticket.tags.some(tag => 
        tag && typeof tag === 'string' && tag.replace('고객_', '') === tagWithoutPrefix
      );
      
      return hasExactMatch || hasPartialMatch;
    });

    console.log(`✅ [모의] 매칭된 티켓: ${matchedTickets.length}개`);

    if (matchedTickets.length === 0) {
      continue;
    }

    totalInquiries += matchedTickets.length;

    // 모의 분석 결과 생성
    const mockAnalysis = `
**"${tagName}" 관련 자주 문의하는 내용:**

**🥇 가장 많이 문의하는 내용:**
- ${tagName}와 관련된 처리 방법 문의
- ${tagName} 진행 상황 확인 요청

**🥈 두 번째로 많이 문의하는 내용:**
- ${tagName} 관련 수수료나 조건 문의
- ${tagName} 소요 시간 관련 질문

**🥉 세 번째로 많이 문의하는 내용:**
- ${tagName} 처리 중 발생한 문제 신고
- ${tagName} 관련 추가 도움 요청

*※ 이것은 모의 분석 결과입니다. 실제 분석을 위해서는 OpenAI API 키가 필요합니다.*
`;

    results[tagName] = {
      naturalLanguageAnalysis: mockAnalysis,
      keywordAnalysis: [
        {keyword: tagName.replace('_', ' '), frequency: matchedTickets.length, importance: 'high'}
      ],
      totalInquiries: matchedTickets.length,
      analyzedTags: 1
    };
    }

    return {
    success: true,
    results,
      summary: {
      totalTags: selectedTags.length,
      totalInquiries,
      analyzedTags: Object.keys(results).length
    },
      isMock: true
  };
}; 