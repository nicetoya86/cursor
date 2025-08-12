import OpenAI from 'openai';

let openai = null;

// OpenAI 클라이언트 초기화
const initializeOpenAI = () => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  console.log('🔑 API 키 확인:', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyStart: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
    apiKeyEnd: apiKey ? '...' + apiKey.substring(apiKey.length - 10) : 'none'
  });
  
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your-api-key-here') {
    console.log('ℹ️ OpenAI API 키가 설정되지 않았습니다. 모의 분석 모드를 사용합니다.');
    return false;
  }
  
  // API 키 형식 검증
  if (!apiKey.startsWith('sk-')) {
    console.error('❌ API 키 형식이 올바르지 않습니다. OpenAI API 키는 "sk-"로 시작해야 합니다.');
    return false;
  }
  
  try {
    openai = new OpenAI({
      apiKey: apiKey.trim(),
      dangerouslyAllowBrowser: true
    });
    
    console.log('✅ OpenAI 클라이언트가 성공적으로 초기화되었습니다.');
    return true;
  } catch (error) {
    console.error('❌ OpenAI 클라이언트 초기화 실패:', error);
    return false;
  }
};

// GPT 프롬프트 템플릿 (태그 기반 문의 내용 추출 - 넓은 범위)
const createExtractionPrompt = (ticketContent, tags) => {
  const tagList = Array.isArray(tags) ? tags.join(', ') : tags;
  
  return `다음 티켓에서 **실제 고객이 작성한 문의 내용만** 추출해주세요.

**추출 원칙:**
1. **고객이 직접 작성한 문의 내용만** 추출 (상담원, 매니저, 시스템 메시지 제외)
2. **구체적인 문제나 요청사항**이 포함된 내용만 선별
3. **인사말, 감사인사, 단순 응답**은 제외
4. **개인정보 (전화번호, 주민번호, 카드번호 등)**는 [개인정보]로 대체

**제외 대상:**
- 상담원/매니저 답변: "확인해드리겠습니다", "처리해드리겠습니다" 등
- 시스템 메시지: "티켓이 생성되었습니다", "상태가 변경되었습니다" 등
- 단순 인사: "안녕하세요", "감사합니다", "수고하세요" 등
- BOT 메시지: 자동 응답, 템플릿 메시지 등

**추출 결과:**
고객의 실제 문의 내용이 있으면 그대로 출력하고, 없으면 "구체적인 문의 내용 없음"이라고 답변하세요.

**분석할 티켓:**
${ticketContent}

**태그 관련 고객 내용 (넓은 범위):**`;
};

// 단일 티켓 분석
export const analyzeSingleTicket = async (ticket) => {
  try {
    // 티켓 내용 구성
    let content = '';
    
    if (ticket.subject) {
      content += `제목: ${ticket.subject}\n`;
    }
    
    if (ticket.description) {
      content += `설명: ${ticket.description}\n`;
    }
    
    if (ticket.comments && Array.isArray(ticket.comments)) {
      content += `댓글:\n`;
      ticket.comments.forEach((comment, index) => {
        if (comment && comment.body) {
          content += `${index + 1}. ${comment.body}\n`;
        }
      });
    }
    
    // 태그 정보 포함
    const tags = ticket && ticket.tags && Array.isArray(ticket.tags) ? ticket.tags : [];
    const customerTags = tags.filter(tag => tag && typeof tag === 'string' && tag.startsWith('고객_'));

    const prompt = createExtractionPrompt(content, customerTags);
    
    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // 더 저렴하고 빠른 모델 사용
      messages: [
        {
          role: "system",
          content: "당신은 고객 서비스 티켓 분석 전문가입니다. 티켓에서 실제 고객의 문의 내용만을 정확히 추출해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
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
export const analyzeTicketsWithGPT = async (tickets) => {
  if (!openai) {
    const initialized = initializeOpenAI();
    if (!initialized) {
      throw new Error('OpenAI API 키가 설정되지 않았거나 올바르지 않습니다.');
    }
  }

  const results = [];
  let excludedCount = 0;

  for (const ticket of tickets) {
    // 분석 제외 조건 확인
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
      continue;
    }

    try {
      console.log(`분석 중: 티켓 ${ticket.id}`);
      const analyzedTicket = await analyzeSingleTicket(ticket);
      results.push(analyzedTicket);
      
      // API 호출 제한을 위한 지연
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`티켓 ${ticket.id} 분석 실패:`, error);
      results.push({
        ...ticket,
        gptAnalysis: {
          extractedInquiry: '분석 실패',
          error: error.message,
          processedAt: new Date().toISOString()
        }
      });
    }
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
  
  const initialized = initializeOpenAI();
  
  if (!initialized) {
    console.log('❌ OpenAI 클라이언트 초기화 실패');
    throw new Error('OpenAI API 키가 설정되지 않았거나 올바르지 않습니다.');
  }
  
  // 실제 API 호출로 키 유효성 테스트
  try {
    console.log('🧪 API 키 유효성 테스트 중...');
    const testResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini", // 더 저렴한 모델 사용
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 1
    });
    
    console.log('✅ API 키 검증 성공', testResponse.id);
    return true;
  } catch (error) {
    console.error('❌ API 키 검증 실패:', error);
    
    // 더 상세한 오류 로깅
    const errorDetails = {
      status: error.status || 'unknown',
      code: error.code || 'unknown',
      message: error.message || 'unknown',
      type: error.type || 'unknown',
      param: error.param || 'none'
    };
    console.error('❌ 오류 상세:', errorDetails);
    
    // OpenAI 특정 오류 처리
    if (error.status === 401) {
      throw new Error('OpenAI API 키가 유효하지 않습니다. 새로운 API 키를 발급받아 주세요.');
    } else if (error.status === 429) {
      throw new Error('OpenAI API 사용량 한도를 초과했습니다. 요금제를 확인해주세요.');
    } else if (error.status === 403) {
      throw new Error('OpenAI API 접근 권한이 없습니다. 계정 상태를 확인해주세요.');
    } else if (error.status === 404) {
      throw new Error('요청한 모델을 찾을 수 없습니다. 모델명을 확인해주세요.');
    } else if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API 크레딧이 부족합니다. 결제 정보를 확인해주세요.');
    } else if (error.message && error.message.includes('network')) {
      throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    } else {
      throw new Error(`OpenAI API 오류 (${errorDetails.status}): ${errorDetails.message}`);
    }
  }
};

// API 키 검증 (별칭)
export const validateApiKey = validateOpenAIKey;

// 개발용 모의 분석 (API 키가 없을 때 사용)
export const mockAnalyzeTickets = async (tickets) => {
  const results = [];
  let excludedCount = 0;

  for (const ticket of tickets) {
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
    
    // 모의 지연
    await new Promise(resolve => setTimeout(resolve, 50));
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
    if (!tickets || !Array.isArray(tickets)) {
      throw new Error('유효하지 않은 티켓 데이터입니다.');
    }
    
    if (!selectedTags || !Array.isArray(selectedTags) || selectedTags.length === 0) {
      throw new Error('선택된 태그가 없습니다.');
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
          model: "gpt-4o-mini", // 더 저렴하고 빠른 모델 사용
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