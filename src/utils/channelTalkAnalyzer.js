// 채널톡 데이터 분석 유틸리티
import OpenAI from 'openai';

// OpenAI 클라이언트 초기화
let openai = null;
const initializeOpenAI = () => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your-api-key-here') {
    console.log('ℹ️ OpenAI API 키가 설정되지 않았습니다. 기본 분석 모드를 사용합니다.');
    return false;
  }
  
  try {
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

// 텍스트 정규화 함수
export const normalizeText = (text) => {
  if (!text || text === 'NaN' || text === 'None' || text === 'null' || text === 'undefined') {
    return '';
  }
  
  // 문자열로 변환 후 트림
  const normalized = String(text).trim();
  
  // 인사말/형식 문구 제거 (선두/말미)
  const greetingPatterns = [
    /^안녕하세요[.,\s]*/,
    /^안녕히[.,\s]*/,
    /^감사합니다[.,\s]*/,
    /^고맙습니다[.,\s]*/,
    /[.,\s]*감사합니다\.?$/,
    /[.,\s]*고맙습니다\.?$/,
    /[.,\s]*확인 부탁드립니다\.?$/,
    /[.,\s]*문의드립니다\.?$/,
    /[.,\s]*부탁드려요\.?$/
  ];
  
  let cleaned = normalized;
  greetingPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  return cleaned.trim();
};

// 태그 파싱 함수
export const parseTags = (tagsString) => {
  if (!tagsString || tagsString.trim() === '') return [];
  
  // 쉼표, 세미콜론, 파이프로 분할 (슬래시는 보존)
  const tags = tagsString
    .split(/[,;|]/)
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
  
  return tags;
};

// 질문 탐지 함수
export const isQuestion = (text, questionWords) => {
  if (!text) return false;
  
  // ? 포함
  if (text.includes('?')) return true;
  
  // 질문어 포함
  const hasQuestionWord = questionWords.some(word => text.includes(word));
  if (hasQuestionWord) return true;
  
  // 어말어미 패턴
  const questionEndings = [
    /까요\??$/,
    /나요\??$/,
    /습니까\??$/,
    /습니다\??$/,
    /인가요\??$/,
    /되나요\??$/,
    /가능한가요\??$/,
    /어떻게\s/,
    /언제\s/,
    /어디서\s/,
    /무엇을\s/,
    /왜\s/
  ];
  
  return questionEndings.some(pattern => pattern.test(text));
};

// 불용어 제거 및 토큰화
export const tokenizeText = (text, stopWords) => {
  if (!text) return [];
  
  // URL, 이메일 제거
  let cleaned = text
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/[^\s]+@[^\s]+\.[^\s]+/g, '');
  
  // 한글, 영문, 숫자만 추출하여 토큰화
  const tokens = cleaned
    .match(/[가-힣a-zA-Z0-9]+/g) || [];
  
  // 불용어 제거 및 한 글자 알파벳/단일 숫자 제거
  return tokens
    .filter(token => {
      if (stopWords.includes(token)) return false;
      if (/^[a-zA-Z]$/.test(token)) return false; // 한 글자 알파벳
      if (/^\d$/.test(token)) return false; // 단일 숫자
      return token.length > 0;
    })
    .map(token => token.toLowerCase());
};

// 문장 분할 함수
export const splitSentences = (text) => {
  if (!text) return [];
  
  return text
    .split(/[.!?~\n]+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0);
};

// 대표 메시지 선택 함수
export const selectRepresentativeMessage = (messages, rule = 'longest') => {
  if (!messages || messages.length === 0) return null;
  
  // 텍스트가 있는 메시지만 필터링
  const validMessages = messages.filter(msg => 
    msg.plainText && normalizeText(msg.plainText).length > 0
  );
  
  if (validMessages.length === 0) return null;
  
  switch (rule) {
    case 'latest':
      return validMessages[validMessages.length - 1];
    
    case 'question_first':
      const questionMsg = validMessages.find(msg => 
        isQuestion(msg.plainText, ['어떻게', '언제', '어디서', '무엇을', '왜'])
      );
      return questionMsg || validMessages[0];
    
    case 'longest':
    default:
      return validMessages.reduce((longest, current) => {
        const currentLength = normalizeText(current.plainText).length;
        const longestLength = normalizeText(longest.plainText).length;
        return currentLength > longestLength ? current : longest;
      });
  }
};

// 기본 FAQ 분석 함수 (최적화된 버전)
const performBasicFAQAnalysis = async (tag, items, settings) => {
  const sentenceCount = new Map();
  const processedSentences = new Set(); // 중복 방지용
  
  // 배치 처리로 성능 향상
  const batchSize = 100;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    for (const item of batch) {
      const sentences = splitSentences(item.plainText);
      
      for (const sentence of sentences) {
        if (isQuestion(sentence, settings.questionWords)) {
          const normalized = normalizeText(sentence);
          if (normalized.length < 3) continue; // 너무 짧은 문장 제외
          
          // 채팅 단위로 중복 카운트 최적화
          const key = `${normalized}|${item.chatId}`;
          if (!processedSentences.has(key)) {
            processedSentences.add(key);
            
            if (!sentenceCount.has(normalized)) {
              sentenceCount.set(normalized, new Set());
            }
            sentenceCount.get(normalized).add(item.chatId);
          }
        }
      }
    }
  }
  
  // Map을 사용한 더 효율적인 정렬
  const sortedQuestions = Array.from(sentenceCount.entries())
    .map(([sentence, chatIds]) => ({
      sentence,
      count: chatIds.size,
      chatIds: Array.from(chatIds)
    }))
    .filter(item => item.count >= settings.minChatCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, settings.topN.faq);
  
  return {
    type: 'basic',
    content: sortedQuestions,
    itemCount: items.length
  };
};

// 기본 키워드 분석 함수 (최적화된 버전)
const performBasicKeywordAnalysis = async (tag, items, settings) => {
  const keywordCount = new Map();
  
  // 배치 처리로 성능 향상
  const batchSize = 150;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    for (const item of batch) {
      const tokens = tokenizeText(item.plainText, settings.stopWords);
      const uniqueTokens = new Set(tokens); // 채팅 내 중복 제거
      
      for (const token of uniqueTokens) {
        if (!keywordCount.has(token)) {
          keywordCount.set(token, new Set());
        }
        keywordCount.get(token).add(item.chatId);
      }
    }
  }
  
  // Map을 사용한 더 효율적인 정렬
  const sortedKeywords = Array.from(keywordCount.entries())
    .map(([keyword, chatIds]) => ({
      keyword,
      count: chatIds.size,
      chatIds: Array.from(chatIds),
      isGPT: false
    }))
    .filter(item => item.count >= settings.minChatCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, settings.topN.keywords);
  
  return {
    type: 'basic',
    content: sortedKeywords,
    itemCount: items.length
  };
};

// GPT를 활용한 FAQ 분석
export const analyzeTagFAQWithGPT = async (tagItems, tagName) => {
  if (!openai) {
    console.log('🤖 OpenAI 미초기화, 기본 FAQ 분석 사용');
    return null;
  }

  try {
    // 태그별 문의 내용 수집
    const inquiries = tagItems.map(item => item.plainText).slice(0, 50); // 최대 50개
    
    if (inquiries.length === 0) return null;

    const prompt = `다음은 "${tagName}" 태그와 관련된 실제 고객 문의 내용들입니다.

이 문의들을 분석해서 자주 묻는 질문(FAQ)을 자연어로 정리해주세요.

**분석 방법:**
1. 비슷한 주제의 문의들을 그룹화
2. 각 그룹에서 가장 대표적인 질문 형태로 정리
3. 빈도가 높은 순서대로 정렬
4. 자연스러운 한국어로 표현

**출력 형식:**
**"${tagName}" 관련 자주 묻는 질문:**

1. [대표 질문 1]
2. [대표 질문 2]  
3. [대표 질문 3]
4. [대표 질문 4]
5. [대표 질문 5]

(숫자와 질문만 출력하고, 빈도나 건수는 표시하지 마세요)

**분석할 문의 내용 (${inquiries.length}건):**
${inquiries.map((inquiry, index) => `${index + 1}. ${inquiry}`).join('\n')}`;

    console.log(`🤖 GPT FAQ 분석 시작: ${tagName} (${inquiries.length}건)`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "당신은 고객 서비스 분석 전문가입니다. 고객 문의를 분석하여 자주 묻는 질문을 자연어로 정리해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    const result = response.choices[0].message.content;
    console.log(`✅ GPT FAQ 분석 완료: ${tagName}`);
    
    // 카운트 정보를 위해 기본 분석도 함께 실행 (임시 설정 사용)
    const tempSettings = {
      questionWords: ['?', '어떻게', '무엇', '언제', '어디서', '왜', '누가'],
      minChatCount: 1,
      topN: { faq: 10 }
    };
    
    console.log(`🔍 ${tagName} 기본 FAQ 분석 시작, 아이템 수:`, tagItems.length);
    const basicAnalysis = await performBasicFAQAnalysis(tagName, tagItems, tempSettings);
    console.log(`🔍 ${tagName} 기본 FAQ 분석 결과:`, basicAnalysis);
    
    const returnData = {
      gptContent: result,
      basicAnalysis: basicAnalysis.content,
      itemCount: tagItems.length
    };
    
    console.log(`🔍 ${tagName} 최종 GPT+기본 분석 결과:`, returnData);
    return returnData;

  } catch (error) {
    console.error(`❌ GPT FAQ 분석 실패 (${tagName}):`, error);
    return null;
  }
};

// GPT를 활용한 키워드 분석
export const analyzeTagKeywordsWithGPT = async (tagItems, tagName) => {
  if (!openai) {
    console.log('🤖 OpenAI 미초기화, 기본 키워드 분석 사용');
    return null;
  }

  try {
    // 태그별 문의 내용 수집
    const inquiries = tagItems.map(item => item.plainText).slice(0, 50); // 최대 50개
    
    if (inquiries.length === 0) return null;

    const prompt = `다음은 "${tagName}" 태그와 관련된 실제 고객 문의 내용들입니다.

이 문의들에서 핵심 키워드를 추출해주세요.

**추출 기준:**
1. 문의 내용과 직접 관련된 핵심 단어만 추출
2. 다음은 제외: 숫자, 인사말, 감사 표현, 형식적 표현
3. 제외 예시: "안녕하세요", "감사합니다", "부탁드립니다", "확인해주세요", 단순 숫자
4. 포함할 것: 서비스명, 기능명, 문제 상황, 요청 사항 등

**출력 형식:**
**"${tagName}" 관련 핵심 키워드:**
키워드1, 키워드2, 키워드3, 키워드4, 키워드5, 키워드6, 키워드7, 키워드8, 키워드9, 키워드10

(빈도 높은 순으로 최대 10개, 쉼표로 구분)

**분석할 문의 내용 (${inquiries.length}건):**
${inquiries.map((inquiry, index) => `${index + 1}. ${inquiry}`).join('\n')}`;

    console.log(`🤖 GPT 키워드 분석 시작: ${tagName} (${inquiries.length}건)`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "당신은 텍스트 분석 전문가입니다. 고객 문의에서 핵심 키워드만 정확히 추출해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.2
    });

    const result = response.choices[0].message.content;
    console.log(`✅ GPT 키워드 분석 완료: ${tagName}`);
    
    // 키워드 파싱 - 더 강력한 파싱 로직
    console.log(`🔍 GPT 응답 원문 (${tagName}):`, result);
    
    let keywords = [];
    
    // 1. 기본 키워드 패턴 매칭
    const keywordMatch = result.match(/키워드.*?:\s*(.+)/);
    if (keywordMatch) {
      keywords = keywordMatch[1]
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0 && k.length < 20);
    }
    
    // 2. 쉼표로 구분된 키워드 직접 추출 (백업 방법)
    if (keywords.length === 0) {
      const lines = result.split('\n');
      for (const line of lines) {
        if (line.includes(',') && !line.includes(':') && line.trim().length > 0) {
          const lineKeywords = line
            .split(',')
            .map(k => k.trim().replace(/[^\w가-힣\s]/g, ''))
            .filter(k => k.length > 0 && k.length < 20);
          if (lineKeywords.length >= 2) {
            keywords = lineKeywords;
            break;
          }
        }
      }
    }
    
    // 3. 숫자로 시작하는 목록에서 키워드 추출 (백업 방법 2)
    if (keywords.length === 0) {
      const lines = result.split('\n');
      for (const line of lines) {
        const match = line.match(/^\d+\.\s*(.+)/);
        if (match && match[1].trim().length > 0 && match[1].trim().length < 20) {
          keywords.push(match[1].trim().replace(/[^\w가-힣\s]/g, ''));
        }
      }
    }
    
    // 4. 모든 한글 단어 추출 (최후 수단)
    if (keywords.length === 0) {
      const koreanWords = result.match(/[가-힣]{2,}/g) || [];
      keywords = koreanWords
        .filter(word => 
          word.length >= 2 && 
          word.length < 20 &&
          !['안녕하세요', '감사합니다', '부탁드립니다', '확인해주세요'].includes(word)
        )
        .slice(0, 10);
    }
    
    // 최대 10개로 제한
    keywords = keywords.slice(0, 10);
    
    console.log(`🔍 추출된 키워드 (${tagName}):`, keywords);
    
    return {
      rawResponse: result,
      keywords: keywords
    };

  } catch (error) {
    console.error(`❌ GPT 키워드 분석 실패 (${tagName}):`, error);
    return null;
  }
};

// 메인 분석 함수 (성능 최적화 버전)
export const analyzeChannelTalkData = async (userChatData, messageData, settings, onProgress) => {
  const startTime = Date.now();
  console.log('🚀 채널톡 데이터 분석 시작 (최적화 버전):', {
    userChats: userChatData.length,
    messages: messageData.length,
    settings
  });

  // 진행률 업데이트 함수
  const updateProgress = (step, message, progress = 0) => {
    if (onProgress) {
      onProgress({ step, message, progress });
    }
    console.log(`📊 ${step}: ${message} (${progress}%)`);
  };

  updateProgress('초기화', '분석 엔진 초기화 중...', 5);

  // OpenAI 초기화 시도
  const hasGPT = initializeOpenAI();
  updateProgress('초기화', hasGPT ? 'GPT 분석 모드 활성화' : '기본 분석 모드', 10);

  // 1단계: 데이터 매칭 및 전처리
  updateProgress('매칭', '데이터 매칭 및 전처리 시작...', 15);
  
  const matchedData = [];
  const userMessages = messageData.filter(msg => msg.personType === 'user');
  
  // UserChat과 Message 매칭
  for (const userChat of userChatData) {
    const chatMessages = userMessages.filter(msg => msg.chatId === userChat.id);
    
    if (chatMessages.length === 0) continue;
    
    const tags = parseTags(userChat.tags);
    if (tags.length === 0) continue; // 태그 없는 채팅 제외
    
    // 각 태그별로 데이터 생성
    for (const tag of tags) {
      // 대표 메시지 선택
      const representativeMessage = selectRepresentativeMessage(
        chatMessages, 
        settings.representativeMessageRule
      );
      
      if (!representativeMessage) continue;
      
      const normalizedText = normalizeText(representativeMessage.plainText);
      if (!normalizedText) continue;
      
      matchedData.push({
        name: userChat.name || '',
        tag: tag.trim(),
        chatId: userChat.id,
        plainText: normalizedText,
        allMessages: chatMessages
      });
    }
  }
  
  console.log('✅ 매칭 완료:', matchedData.length, '개 데이터');
  updateProgress('매칭', `매칭 완료: ${matchedData.length}개 데이터`, 25);
  
  // 2단계: 최적화된 중복 제거 (병원명 + Tag + 문의내용)
  updateProgress('중복제거', '중복 데이터 제거 중...', 30);
  
  // 텍스트 정규화 함수 (중복 제거용) - 메모이제이션 적용
  const normalizeCache = new Map();
  const normalizeForDeduplication = (text) => {
    if (normalizeCache.has(text)) {
      return normalizeCache.get(text);
    }
    
    const normalized = text
      .toLowerCase()
      .replace(/\s+/g, ' ') // 공백 정규화
      .replace(/[.,!?;:]/g, '') // 구두점 제거
      .trim();
    
    normalizeCache.set(text, normalized);
    return normalized;
  };
  
  // Map을 사용한 더 효율적인 중복 제거
  const uniqueMap = new Map();
  const minTextLength = 5;
  
  for (const item of matchedData) {
    const normalizedText = normalizeForDeduplication(item.plainText);
    
    if (normalizedText.length > minTextLength) {
      const key = `${item.name.toLowerCase()}|${item.tag.toLowerCase()}|${normalizedText}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }
  }
  
  const uniqueData = Array.from(uniqueMap.values());
  const duplicateRate = Math.round((1 - uniqueData.length / matchedData.length) * 100);
  console.log('✅ 중복 제거 완료:', uniqueData.length, '개 데이터 (원본:', matchedData.length, '개, 중복률:', duplicateRate + '%)');
  updateProgress('중복제거', `중복 제거 완료: ${uniqueData.length}개 (중복률: ${duplicateRate}%)`, 35);
  
  // 3단계: FAQ 분석 (Tag별 자주 물어보는 내용)
  updateProgress('FAQ분석', 'FAQ 분석 시작...', 40);
  
  const faqData = {};
  const tagGroups = {};
  
  // 태그별 그룹화
  for (const item of uniqueData) {
    if (!tagGroups[item.tag]) {
      tagGroups[item.tag] = [];
    }
    tagGroups[item.tag].push(item);
  }
  
  // 병렬 FAQ 분석 (성능 최적화)
  console.log('🚀 병렬 FAQ 분석 시작...');
  const tagEntries = Object.entries(tagGroups);
  
  if (hasGPT) {
    // GPT 분석을 병렬로 실행 (최대 5개씩 배치 처리)
    const batchSize = 5;
    const gptPromises = [];
    
    for (let i = 0; i < tagEntries.length; i += batchSize) {
      const batch = tagEntries.slice(i, i + batchSize);
      const batchPromises = batch.map(async ([tag, items]) => {
        if (items.length === 0) return { tag, result: null };
        
        try {
          console.log(`🔍 ${tag} GPT FAQ 분석 시작 (${items.length}개 문의)`);
          const gptFAQ = await analyzeTagFAQWithGPT(items, tag);
          console.log(`✅ ${tag} GPT FAQ 분석 완료`);
          return { tag, result: gptFAQ, items };
        } catch (error) {
          console.error(`❌ ${tag} GPT FAQ 분석 실패:`, error);
          return { tag, result: null, items };
        }
      });
      
      gptPromises.push(...batchPromises);
    }
    
    // 모든 GPT 분석 결과 대기
    const gptResults = await Promise.all(gptPromises);
    
    // GPT 결과 처리
    for (const { tag, result, items } of gptResults) {
      console.log(`🔍 ${tag} GPT 결과 처리:`, result);
      
      if (result && result.gptContent) {
        const faqEntry = {
          type: 'gpt',
          content: result.gptContent,
          basicAnalysis: result.basicAnalysis || [],
          itemCount: result.itemCount || items.length
        };
        
        console.log(`✅ ${tag} GPT FAQ 데이터 저장:`, faqEntry);
        faqData[tag] = faqEntry;
      } else if (items) {
        console.log(`❌ ${tag} GPT 실패, 기본 분석으로 폴백`);
        // GPT 실패 시 기본 분석으로 폴백
        faqData[tag] = await performBasicFAQAnalysis(tag, items, settings);
      }
    }
    
    console.log('🔍 최종 faqData:', faqData);
  } else {
    // GPT 미사용 시 기본 분석을 병렬로 처리
    const basicPromises = tagEntries.map(async ([tag, items]) => {
      const result = await performBasicFAQAnalysis(tag, items, settings);
      return { tag, result };
    });
    
    const basicResults = await Promise.all(basicPromises);
    for (const { tag, result } of basicResults) {
      faqData[tag] = result;
    }
  }
  
  console.log('✅ FAQ 분석 완료:', Object.keys(faqData).length, '개 태그');
  updateProgress('FAQ분석', `FAQ 분석 완료: ${Object.keys(faqData).length}개 태그`, 65);
  
  // 4단계: 병렬 키워드 분석 (성능 최적화)
  updateProgress('키워드분석', '키워드 분석 시작...', 70);
  const keywordData = {};
  
  if (hasGPT) {
    // GPT 키워드 분석을 병렬로 실행 (최대 5개씩 배치 처리)
    const batchSize = 5;
    const gptKeywordPromises = [];
    
    for (let i = 0; i < tagEntries.length; i += batchSize) {
      const batch = tagEntries.slice(i, i + batchSize);
      const batchPromises = batch.map(async ([tag, items]) => {
        if (items.length === 0) return { tag, result: null };
        
        try {
          console.log(`🔍 ${tag} GPT 키워드 분석 시작 (${items.length}개 문의)`);
          const gptKeywords = await analyzeTagKeywordsWithGPT(items, tag);
          console.log(`✅ ${tag} GPT 키워드 분석 완료`);
          return { tag, result: gptKeywords, items };
        } catch (error) {
          console.error(`❌ ${tag} GPT 키워드 분석 실패:`, error);
          return { tag, result: null, items };
        }
      });
      
      gptKeywordPromises.push(...batchPromises);
    }
    
    // 모든 GPT 키워드 분석 결과 대기
    const gptKeywordResults = await Promise.all(gptKeywordPromises);
    
    // GPT 키워드 결과 처리
    for (const { tag, result, items } of gptKeywordResults) {
      console.log(`🔍 ${tag} GPT 키워드 결과 처리:`, result);
      
      if (result && result.keywords && result.keywords.length > 0) {
        console.log(`✅ ${tag} GPT 키워드 저장:`, result.keywords);
        keywordData[tag] = {
          type: 'gpt',
          keywords: result.keywords, // 키워드 배열을 직접 저장
          content: result.keywords.map((keyword, index) => ({
            keyword,
            count: items.length - index, // 순서 기반 가중치
            isGPT: true
          })),
          rawResponse: result.rawResponse,
          itemCount: items.length
        };
      } else if (items) {
        console.log(`❌ ${tag} GPT 키워드 실패, 기본 분석으로 폴백`);
        // GPT 실패 시 기본 분석으로 폴백
        keywordData[tag] = await performBasicKeywordAnalysis(tag, items, settings);
      } else {
        console.log(`❌ ${tag} 키워드 데이터 없음`);
      }
    }
  } else {
    // GPT 미사용 시 기본 키워드 분석을 병렬로 처리
    const basicKeywordPromises = tagEntries.map(async ([tag, items]) => {
      const result = await performBasicKeywordAnalysis(tag, items, settings);
      return { tag, result };
    });
    
    const basicKeywordResults = await Promise.all(basicKeywordPromises);
    for (const { tag, result } of basicKeywordResults) {
      keywordData[tag] = result;
    }
  }
  
  console.log('✅ 키워드 분석 완료:', Object.keys(keywordData).length, '개 태그');
  updateProgress('키워드분석', `키워드 분석 완료: ${Object.keys(keywordData).length}개 태그`, 85);
  
  // 5단계: 대표 메시지 데이터 (채팅별)
  updateProgress('대표메시지', '대표 메시지 정리 중...', 90);
  
  const representativeData = [];
  const processedChatIds = new Set();
  
  for (const item of uniqueData) {
    if (!processedChatIds.has(item.chatId)) {
      processedChatIds.add(item.chatId);
      
      // 해당 chatId의 모든 태그 수집
      const allTagsForChat = uniqueData
        .filter(d => d.chatId === item.chatId)
        .map(d => d.tag);
      
      representativeData.push({
        name: item.name,
        chatId: item.chatId,
        tags: [...new Set(allTagsForChat)].join(', '),
        plainText: item.plainText
      });
    }
  }
  
  console.log('✅ 대표 메시지 정리 완료:', representativeData.length, '개 채팅');
  
  // 결과 반환
  const result = {
    plainTextData: uniqueData,
    faqData,
    keywordData,
    representativeData,
    summary: {
      totalChats: uniqueData.length,
      totalTags: Object.keys(tagGroups).length,
      totalHospitals: new Set(uniqueData.map(item => item.name)).size,
      totalFAQs: Object.values(faqData).reduce((sum, data) => {
        if (data.type === 'gpt') return sum + 1; // GPT는 전체 응답으로 카운트
        return sum + (data.content?.length || 0);
      }, 0),
      totalKeywords: Object.values(keywordData).reduce((sum, data) => {
        return sum + (data.content?.length || 0);
      }, 0),
      hasGPTAnalysis: hasGPT,
      processedAt: new Date().toISOString()
    }
  };
  
  // 최종 성능 통계
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const speedImprovement = totalTime < 10000 ? '⚡ 고속 분석' : totalTime < 20000 ? '🚀 빠른 분석' : '📊 분석 완료';
  
  updateProgress('완료', `분석 완료! (${(totalTime / 1000).toFixed(1)}초)`, 100);
  
  console.log('🎉 분석 완료:', {
    ...result.summary,
    processingTime: `${(totalTime / 1000).toFixed(1)}초`,
    performance: speedImprovement
  });
  
  return {
    ...result,
    performance: {
      totalTime,
      speedImprovement,
      processedAt: new Date().toISOString()
    }
  };
};
