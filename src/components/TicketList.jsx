import React from 'react';
import { format } from 'date-fns';

const TicketList = ({ tickets, loading, error, isAnalyzed = false }) => {
  // Props 검증 및 기본값 설정
  const safeTickets = tickets || [];
  const safeLoading = loading || false;
  const safeError = error || null;

  console.log('📋 TicketList 렌더링:', {
    ticketsCount: safeTickets.length,
    loading: safeLoading,
    error: safeError,
    isAnalyzed
  });

  // 날짜 포맷팅
  const formatDate = (dateString) => {
    try {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return format(date, 'yyyy-MM-dd HH:mm');
    } catch (error) {
      console.warn('날짜 포맷팅 오류:', error);
      return dateString || '-';
    }
  };

  // 텍스트 길이 제한
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '내용 없음';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // 고객 태그만 필터링하는 함수
  const filterCustomerTags = (tags) => {
    if (!tags || !Array.isArray(tags)) return [];
    return tags.filter(tag => tag && tag.startsWith('고객_'));
  };

  // 실제 고객의 문의 내용만 추출하는 함수 (GPT 분석 결과 우선)
  const getUserComments = (ticket) => {
    // GPT 분석 결과가 있으면 우선 표시
    if (isAnalyzed && ticket.gptAnalysis && ticket.gptAnalysis.extractedInquiry) {
      const inquiry = ticket.gptAnalysis.extractedInquiry;
      
      // "분석 실패" 또는 오류 메시지인 경우 기존 방식으로 폴백
      if (inquiry.includes('분석 실패') || inquiry.includes('API 오류')) {
        console.log(`티켓 ${ticket.id}: GPT 분석 실패, 기존 방식으로 폴백`);
        // 기존 방식으로 계속 진행
      } else {
        console.log(`티켓 ${ticket.id}: GPT 분석 결과 사용`);
        return inquiry;
      }
    }

    // 모든 comment를 수집 (중첩 구조 고려)
    let allComments = [];
    
    // 재귀적으로 comments 찾기
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
    
    if (allComments.length === 0) {
      return '내용 없음';
    }

    console.log(`티켓 ${ticket.id}: 전체 댓글 ${allComments.length}개 발견`);
    
    // 모든 body 내용을 수집 (author_id 제한 없이)
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
    
    if (!allContent) {
      console.log(`티켓 ${ticket.id}: 전체 내용 없음`);
      return '내용 없음';
    }

    console.log(`티켓 ${ticket.id}: 원본 전체 내용 길이: ${allContent.length}자`);

    // 1순위: HTML div 패턴에서 고객 직접 입력 추출
    const endUserDivRegex = /<div[^>]*type="end-user"[^>]*data-test-id="omni-log-item-message"[^>]*>.*?<span><span>([^<]+)<\/span><\/span>.*?<\/div>/gs;
    const endUserMatches = [...allContent.matchAll(endUserDivRegex)];
    
    if (endUserMatches.length > 0) {
      console.log(`티켓 ${ticket.id}: end-user div 패턴 발견 (${endUserMatches.length}개)`);
      const directCustomerInputs = endUserMatches.map(match => match[1].trim()).filter(text => text.length > 2);
      
      if (directCustomerInputs.length > 0) {
        const finalContent = directCustomerInputs.join(' ').trim();
        console.log(`티켓 ${ticket.id}: 고객 직접 입력 내용 추출됨: ${finalContent.substring(0, 100)}...`);
        return finalContent;
      }
    }

    // 2순위: "고객 문의 내용:" 패턴 찾기
    const customerInquiryMatch = allContent.match(/고객\s*문의\s*내용:\s*(.+?)(?=\n|$)/s);
    if (customerInquiryMatch && customerInquiryMatch[1].trim().length > 2) {
      console.log(`티켓 ${ticket.id}: "고객 문의 내용:" 패턴 발견`);
      const inquiryContent = customerInquiryMatch[1].trim();
      console.log(`티켓 ${ticket.id}: 문의 내용 추출: ${inquiryContent.substring(0, 100)}...`);
      return inquiryContent;
    }

    // 3순위: 시간 스탬프 기반 고객 발언 추출
    const timeStampPattern = /\((\d{2}:\d{2}:\d{2})\)\s*([^:]+?):\s*([^(]*?)(?=\((\d{2}:\d{2}:\d{2})\)|$)/gs;
    const excludeAuthors = ['여신BOT', '매니저L', '매니저B', '매니저D', 'Matrix_bot'];
    
    let customerOnlyContent = '';
    let match;
    
    while ((match = timeStampPattern.exec(allContent)) !== null) {
      const [, , author, content] = match;
      const cleanAuthor = author.trim();
      const cleanContent = content.trim();
      
      // 제외 대상 주체가 아닌 경우만 추출
      const isExcluded = excludeAuthors.some(excludeAuthor => 
        cleanAuthor.includes(excludeAuthor)
      );
      
      if (!isExcluded && cleanContent && cleanContent.length > 2) {
        console.log(`티켓 ${ticket.id}: 고객 발언 추출: ${cleanAuthor} - ${cleanContent.substring(0, 50)}...`);
        customerOnlyContent += cleanContent + ' ';
      }
    }
    
    if (customerOnlyContent.trim().length > 2) {
      console.log(`티켓 ${ticket.id}: 시간 스탬프 기반 추출 성공`);
      return cleanupContent(customerOnlyContent.trim());
    }

    // 4순위: 제목에서 "님과의 대화" 패턴 확인하여 해당 사용자 이름으로 필터링
    if (ticket.subject && ticket.subject.includes('님과의 대화')) {
      const nameMatch = ticket.subject.match(/(.+?)님과의\s*대화/);
      if (nameMatch) {
        const customerName = nameMatch[1].trim();
        console.log(`티켓 ${ticket.id}: 고객명 "${customerName}" 기반 필터링 시도`);
        
        // 해당 고객명이 포함된 발언 찾기
        const customerLines = allContent.split(/\n+/).filter(line => {
          const trimmedLine = line.trim();
          return trimmedLine.includes(customerName) && 
                 !excludeAuthors.some(excludeAuthor => trimmedLine.includes(excludeAuthor)) &&
                 trimmedLine.length > 5;
        });
        
                 if (customerLines.length > 0) {
           const nameBasedContent = customerLines.join(' ').trim();
           console.log(`티켓 ${ticket.id}: 고객명 기반 추출 성공: ${nameBasedContent.substring(0, 100)}...`);
           return cleanupContent(nameBasedContent);
         }
      }
    }

    // 5순위: 일반적인 필터링 (BOT/매니저 제외)
    const lines = allContent.split(/\n+/);
    const filteredLines = lines.filter(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.length < 3) return false;
      
      // 제외 패턴들
      const excludePatterns = [
        ...excludeAuthors,
        '해결되었어요', '해결되지 않았어요', '문제가 해결되었어요',
        '도움이 되었어요', '도움이 되지 않았어요', '더 궁금해요',
        '선택해 주세요', '확인해 주세요', '클릭해 주세요', '눌러 주세요',
        '본인확인', '인증번호', '구매 ID',
        'zendesk.com', '업로드함', 'URL:', '유형:',
        '[Web발신]', 'Web발신', '발신전화', '부재중', '수신전화',
        'LMS 전송', 'SMS 전송', 'MMS 전송', 'image png', 'img_',
        '파일 업로드', '첨부파일', 'attachment', 'upload', 'download',
        '.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx',
        '파일명:', '크기:', '용량:',
        // 자동 응답 메시지
        '안녕하세요', '여신티켓입니다', '문의 주셔서 감사합니다', 
        '빠른 시일 내', '답변 드리겠습니다', '운영시간 안내',
        '평일', '주말 공휴일 휴무', '점심시간', '순차적으로 처리',
        '양해 부탁', '감사합니다', '고객님 안녕하세요',
        '문의 접수 완료', '담당자 확인 후 연락',
        // 시나리오 기반 안내
        '아래 옵션', '선택해 주세요', '해당 사항 선택', '진행해 주세요',
        '더 자세한 안내', '추가 문의 사항', '다음 단계 진행',
        '확인 버튼', '아래 링크', '관련 문서 확인', 'FAQ 참고',
        '도움말 페이지', '고객센터 문의', '1:1 문의',
        // 문서 관련
        '[도움말]', '[FAQ]', '[가이드]', '[매뉴얼]', '[안내]', '[문서]',
        '관련 문서:', '참고 문서:', '도움말 문서', '사용법 안내',
        '자주 묻는 질문', '문서 내용:', 'articles/', 'help.',
        '운영시간', '순차적으로 안내',
        '피부 시술, 일상', '여신티켓', '마이페이지',
        'http://', 'https://', 'www.', '.com', '.co.kr',
        // 인증번호 및 연락처 관련
        '인증번호', '휴대전화', '연락처', '전화번호',
        '010-', '02-', '031-', '032-', '033-', '041-', '042-', '043-',
        '044-', '051-', '052-', '053-', '054-', '055-', '061-', '062-',
        '063-', '064-', '070-',
        // WEB 발신 관련 (강화)
        'WEB 발신', '웹 발신', 'WEB발신', '웹발신',
        '[WEB 발신]', '[웹 발신]', 'WEB', '웹',
        // URL 유형 관련
        'URL 유형', '유형: image', '유형 image',
        // 복잡한 시스템 메시지 패턴 (hcaptcha, Screenshot 등)
        'hcaptcha', 'Screenshot_', 'play play',
        // 해시값과 반복 패턴은 별도 처리
      ];
      
      const hasExcludePattern = excludePatterns.some(pattern => 
        trimmedLine.toLowerCase().includes(pattern.toLowerCase())
      );
      
      // URL 패턴 추가 확인
      const urlPatterns = [
        /https?:\/\/[^\s]+/gi,
        /www\.[^\s]+/gi,
        /[a-zA-Z0-9.-]+\.(com|co\.kr|net|org|kr|io|app)/gi
      ];
      
      // WEB 발신 패턴 추가 확인
      const webPatterns = [
        /WEB.*발신|웹.*발신/gi,
        /\[WEB.*발신\]|\[웹.*발신\]/gi
      ];
      
      // 인증번호 및 연락처 패턴 추가 확인
      const personalInfoPatterns = [
        /\b\d{6}\b/gi,                              // 6자리 숫자
        /\b\d{2,3}-?\d{3,4}-?\d{4}\b/gi,           // 전화번호 패턴
        /인증번호|휴대전화|연락처|전화번호/gi        // 관련 키워드
      ];
      
      const hasUrlPattern = urlPatterns.some(pattern => pattern.test(trimmedLine));
      const hasWebPattern = webPatterns.some(pattern => pattern.test(trimmedLine));
      const hasPersonalInfoPattern = personalInfoPatterns.some(pattern => pattern.test(trimmedLine));
      
      return !hasExcludePattern && !hasUrlPattern && !hasWebPattern && !hasPersonalInfoPattern;
    });
    
    if (filteredLines.length > 0) {
      const generalFiltered = filteredLines.join(' ').trim();
             if (generalFiltered.length > 5) {
         console.log(`티켓 ${ticket.id}: 일반 필터링 추출 성공: ${generalFiltered.substring(0, 100)}...`);
         return cleanupContent(generalFiltered);
       }
    }

    console.log(`티켓 ${ticket.id}: 모든 추출 방법 실패`);
    return '문의 내용 없음';
  };

  // 내용 정리 헬퍼 함수
  const cleanupContent = (content) => {
    let cleaned = content;
    
    // "Web발신" 관련 내용 제거
    cleaned = cleaned.replace(/\[Web발신\]/gi, '');
    cleaned = cleaned.replace(/Web발신[^.]*\.?/gi, '');
    cleaned = cleaned.replace(/발신[^.]*\.?/gi, '');
    
    // 시스템 메시지 제거
    const systemMessagePatterns = [
      /img_\d+/gi,                    // img_2996 등
      /image\s*png/gi,                // image png
      /image\s*jpg/gi,                // image jpg
      /image\s*jpeg/gi,               // image jpeg
      /LMS\s*전송/gi,                 // LMS 전송
      /SMS\s*전송/gi,                 // SMS 전송
      /MMS\s*전송/gi,                 // MMS 전송
      /파일\s*업로드/gi,              // 파일 업로드
      /첨부파일/gi,                   // 첨부파일
      /attachment/gi,                 // attachment
      /upload/gi,                     // upload
      /download/gi,                   // download
      /\.png/gi,                      // .png 확장자
      /\.jpg/gi,                      // .jpg 확장자
      /\.jpeg/gi,                     // .jpeg 확장자
      /\.pdf/gi,                      // .pdf 확장자
      /\.doc/gi,                      // .doc 확장자
      /\.docx/gi,                     // .docx 확장자
      /파일명:/gi,                    // 파일명:
      /크기:/gi,                      // 크기:
      /용량:/gi,                      // 용량:
      // 인증번호 6자리 제거
      /\b\d{6}\b/gi,                  // 483729 형식의 6자리 숫자
      /인증번호.*\d{6}/gi,            // 인증번호 483729
      /\d{6}.*인증번호/gi,            // 483729 인증번호
      // 연락처 제거
      /\b01[0-9]-?\d{3,4}-?\d{4}\b/gi,    // 010-1234-5678, 01012345678
      /\b\d{2,3}-?\d{3,4}-?\d{4}\b/gi,    // 02-123-4567, 031-123-4567
      /휴대전화.*\d{3}-?\d{3,4}-?\d{4}/gi, // 휴대전화: 010-1234-5678
      /연락처.*\d{3}-?\d{3,4}-?\d{4}/gi,   // 연락처: 010-1234-5678
      /전화번호.*\d{3}-?\d{3,4}-?\d{4}/gi, // 전화번호: 010-1234-5678
      // WEB 발신 관련 (강화)
      /WEB\s*발신/gi,                 // WEB 발신
      /웹\s*발신/gi,                  // 웹 발신
      /WEB발신/gi,                    // WEB발신
      /웹발신/gi,                     // 웹발신
      /\[WEB\s*발신\]/gi,             // [WEB 발신]
      /\[웹\s*발신\]/gi,              // [웹 발신]
      /.*WEB.*발신.*/gi,              // WEB 관련 발신 포함된 전체 문장
      /.*웹.*발신.*/gi,               // 웹 관련 발신 포함된 전체 문장
      // URL 유형 관련
      /URL\s*유형/gi,                 // URL 유형
      /유형\s*:\s*image/gi,           // 유형: image
      /유형\s*image/gi,               // 유형 image
      // 복잡한 시스템 메시지 패턴 (hcaptcha, Screenshot 등)
      /hcaptcha/gi,                   // hcaptcha
      /Screenshot_\d+_\d+_\d+_\d+_\d+_\w+/gi, // Screenshot_2025_06_26_09_39_36_54_1fbfb7388ac0d063c800708dbcee1746
      /play\s+play/gi,                // play play (반복)
      /\w{32,}/gi,                    // 32자 이상의 긴 해시값 (1fbfb7388ac0d063c800708dbcee1746)
      // 반복되는 패턴 제거
      /(.{10,}?)\s*\1{2,}/gi,         // 동일한 10자 이상 패턴이 3번 이상 반복
      /\s{5,}/gi                      // 5개 이상 연속 공백
    ];
    
    // 자동 응답 메시지 패턴
    const autoResponsePatterns = [
      /안녕하세요.*여신티켓.*입니다/gi,
      /문의.*주셔서.*감사합니다/gi,
      /빠른.*시일.*내.*답변.*드리겠습니다/gi,
      /운영시간.*안내.*드립니다/gi,
      /평일.*\d{1,2}:\d{2}.*\d{1,2}:\d{2}/gi,
      /주말.*공휴일.*휴무/gi,
      /점심시간.*\d{1,2}:\d{2}.*\d{1,2}:\d{2}/gi,
      /순차적으로.*처리.*해드리겠습니다/gi,
      /양해.*부탁.*드립니다/gi,
      /감사합니다/gi,
      /고객님.*안녕하세요/gi,
      /문의.*접수.*완료.*되었습니다/gi,
      /담당자.*확인.*후.*연락.*드리겠습니다/gi
    ];
    
    // 시나리오 기반 안내 문구 패턴
    const scenarioPatterns = [
      /아래.*옵션.*중.*선택해.*주세요/gi,
      /해당.*사항.*선택.*후.*진행해.*주세요/gi,
      /더.*자세한.*안내.*원하시면/gi,
      /추가.*문의.*사항.*있으시면/gi,
      /다음.*단계.*진행하시겠습니까/gi,
      /확인.*버튼.*눌러.*주세요/gi,
      /아래.*링크.*참고해.*주세요/gi,
      /관련.*문서.*확인해.*주세요/gi,
      /FAQ.*참고.*부탁드립니다/gi,
      /도움말.*페이지.*방문해.*주세요/gi,
      /고객센터.*문의.*부탁드립니다/gi,
      /1:1.*문의.*이용해.*주세요/gi
    ];
    
    // 버튼명 패턴 (확장)
    const buttonPatterns = [
      /해결되었어요/gi,
      /해결되지\s*않았어요/gi,
      /문제가\s*해결되었어요/gi,
      /아직\s*해결되지\s*않았어요/gi,
      /도움이\s*되었어요/gi,
      /도움이\s*되지\s*않았어요/gi,
      /더\s*궁금해요/gi,
      /선택해\s*주세요/gi,
      /확인해\s*주세요/gi,
      /클릭해\s*주세요/gi,
      /눌러\s*주세요/gi,
      /버튼을\s*눌러/gi,
      /아래\s*버튼/gi,
      /예/gi,
      /아니오/gi,
      /네/gi,
      /취소/gi,
      /확인/gi,
      /다음/gi,
      /이전/gi,
      /완료/gi,
      /종료/gi
    ];
    
    // 문서 관련 패턴
    const documentPatterns = [
      /https?:\/\/.*help\..*\..*\/.*/gi,        // 도움말 URL
      /https?:\/\/.*support\..*\..*\/.*/gi,     // 지원 URL  
      /https?:\/\/.*faq\..*\..*\/.*/gi,         // FAQ URL
      /https?:\/\/.*guide\..*\..*\/.*/gi,       // 가이드 URL
      /https?:\/\/.*manual\..*\..*\/.*/gi,      // 매뉴얼 URL
      /\[.*도움말.*\]/gi,                       // [도움말] 링크
      /\[.*FAQ.*\]/gi,                          // [FAQ] 링크
      /\[.*가이드.*\]/gi,                       // [가이드] 링크
      /\[.*매뉴얼.*\]/gi,                       // [매뉴얼] 링크
      /\[.*안내.*\]/gi,                         // [안내] 링크
      /\[.*문서.*\]/gi,                         // [문서] 링크
      /관련.*문서.*:.*제목/gi,                  // 관련 문서: 제목
      /참고.*문서.*:.*제목/gi,                  // 참고 문서: 제목
      /도움말.*문서.*제목/gi,                   // 도움말 문서 제목
      /사용법.*안내.*문서/gi,                   // 사용법 안내 문서
      /자주.*묻는.*질문/gi,                     // 자주 묻는 질문
      /문서.*내용.*:.*요약/gi,                  // 문서 내용: 요약
      /.*articles\/\d+.*/gi,                    // articles/숫자 패턴
      /.*hc\/.*\/articles\/.*/gi                // help center articles 패턴
    ];
    
    // 모든 시스템 패턴 적용 (텍스트 유실 방지를 위해 순서대로 처리)
    const allSystemPatterns = [
      ...systemMessagePatterns,
      ...autoResponsePatterns, 
      ...scenarioPatterns,
      ...buttonPatterns,
      ...documentPatterns
    ];
    
    // 안전한 패턴 적용 (텍스트 유실 방지)
    allSystemPatterns.forEach(pattern => {
      try {
        const before = cleaned.length;
        cleaned = cleaned.replace(pattern, ' '); // 빈 문자열 대신 공백으로 교체
        const after = cleaned.length;
        if (before !== after) {
          // 패턴 매칭 로그 (필요시)
          console.log(`패턴 적용: ${pattern}`);
        }
      } catch (error) {
        console.warn(`정규식 처리 오류: ${pattern}`, error);
      }
    });
    
    // 연속된 공백을 하나로 정리
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // URL 제거 (http, https, www로 시작하는 모든 URL)
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '');
    cleaned = cleaned.replace(/www\.[^\s]+/gi, '');
    cleaned = cleaned.replace(/[a-zA-Z0-9.-]+\.(com|co\.kr|net|org|kr|io|app)[^\s]*/gi, '');
    
    // 기본 정리 및 문장 분리
    cleaned = cleaned
      .replace(/\s+/g, ' ')           // 여러 공백을 하나로
      .replace(/[^\w\s가-힣.,!?()]/g, ' ')  // 특수문자 정리
      .trim();
    
    // 문장별로 분리하여 중복 제거 및 줄바꿈 적용
    const sentences = cleaned
      .split(/[.!?]/)                 // 문장 구분자로 분리
      .map(sentence => sentence.trim())
      .filter(sentence => {
        // 빈 문장 제외
        if (!sentence || sentence.length < 3) return false;
        
        // WEB 발신이 포함된 문장은 완전히 제거
        if (/WEB.*발신|웹.*발신/gi.test(sentence)) {
          return false;
        }
        // 인증번호가 포함된 문장도 제거
        if (/\d{6}|인증번호/gi.test(sentence)) {
          return false;
        }
        // 연락처가 포함된 문장도 제거
        if (/\d{2,3}-?\d{3,4}-?\d{4}|휴대전화|연락처|전화번호/gi.test(sentence)) {
          return false;
        }
        // URL 유형이 포함된 문장 제거
        if (/URL.*유형|유형.*image|hcaptcha|Screenshot_|play.*play/gi.test(sentence)) {
          return false;
        }
        // 32자 이상의 해시값이 포함된 문장 제거
        if (/\w{32,}/gi.test(sentence)) {
          return false;
        }
        // 과도하게 반복되는 패턴이 있는 문장 제거
        if (/(.{5,}?)\1{3,}/gi.test(sentence)) {
          return false;
        }
        
        return true;
      });
    
    // 문장 중복 제거 (대소문자 구분 없이)
    const uniqueSentences = [];
    const seenSentences = new Set();
    
    sentences.forEach(sentence => {
      const normalized = sentence.toLowerCase().replace(/\s+/g, '');
      if (!seenSentences.has(normalized) && sentence.length > 3) {
        seenSentences.add(normalized);
        uniqueSentences.push(sentence);
      }
    });
    
         // 단어 레벨 중복 제거 (추가 처리) - 텍스트 유실 방지
    const finalSentences = [];
    const seenWords = new Set();
    
    uniqueSentences.forEach(sentence => {
      const words = sentence.split(/\s+/);
      const uniqueWords = [];
      
      words.forEach(word => {
        // 단어 정리 (특수문자 제거하여 비교용)
        const cleanWord = word.toLowerCase().replace(/[^\w가-힣]/g, '');
        
        // 의미있는 단어만 중복 체크 (2자 이상)
        if (cleanWord.length > 1) {
          if (!seenWords.has(cleanWord)) {
            seenWords.add(cleanWord);
            uniqueWords.push(word); // 원본 단어 유지
          }
          // 이미 본 단어는 건너뛰기
        } else {
          // 조사, 접속사, 구두점 등은 항상 유지
          uniqueWords.push(word);
        }
      });
      
      const reconstructedSentence = uniqueWords.join(' ').trim();
      // 재구성된 문장이 의미있는 길이를 가진 경우만 추가
      if (reconstructedSentence.length > 5) {
        finalSentences.push(reconstructedSentence);
      }
    });
    
    // 넘버링 처리하여 반환
    if (finalSentences.length > 0) {
      return finalSentences
        .map((sentence, index) => `${index + 1}. ${sentence}`)
        .join('\n');
    }
    
    return cleaned;
  };

  // 상태별 색상 및 우선순위별 색상 함수는 현재 사용되지 않으므로 제거됨

  if (safeLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-8">
          <div className="text-lg mb-3">🔍 검색 중...</div>
          <div className="text-gray-600">티켓을 검색하고 있습니다. 잠시만 기다려주세요.</div>
        </div>
      </div>
    );
  }

  if (safeError) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">
            <strong>오류가 발생했습니다:</strong><br />
            {safeError}
          </div>
        </div>
      </div>
    );
  }

  if (!safeTickets || safeTickets.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-12">
          <div className="text-5xl mb-5">📋</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">검색 결과가 없습니다</h3>
          <p className="text-gray-600">다른 검색 조건으로 다시 시도해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results-container">
      <div className="results-header">
        <h3 className="results-title">검색 결과 ({safeTickets.length}개)</h3>
      </div>

      {/* 개선된 테이블 뷰 */}
      <div className="table-container">
        <table className="results-table">
          <thead>
            <tr>
              <th className="col-ticket-id">티켓번호</th>
              <th className="col-date">생성일</th>
              <th className="col-title">제목</th>
              <th className="col-tags">태그</th>
              <th className="col-content">문의 내용</th>
            </tr>
          </thead>
          <tbody>
            {safeTickets.map((ticket, index) => (
              <tr key={ticket.id} className="table-row">
                <td className="cell-ticket-id">
                  <span className="ticket-badge">
                    #{ticket.id}
                  </span>
                </td>
                <td className="cell-date">
                  {formatDate(ticket.created_at)}
                </td>
                <td className="cell-title">
                  <div className="title-content" title={ticket.subject}>
                    {truncateText(ticket.subject, 80)}
                  </div>
                </td>
                <td className="cell-tags">
                  <div className="tags-container">
                    {(() => {
                      const customerTags = filterCustomerTags(ticket.tags);
                      if (customerTags.length === 0) {
                        return (
                          <span className="tag-empty">
                            태그 없음
                          </span>
                        );
                      }
                      
                      const displayTags = customerTags.slice(0, 3);
                      const remainingCount = customerTags.length - 3;
                      
                      return (
                        <>
                          {displayTags.map((tag, tagIndex) => (
                            <span 
                              key={tagIndex}
                              className="tag-item"
                            >
                              {tag.replace('고객_', '')}
                            </span>
                          ))}
                          {remainingCount > 0 && (
                            <span className="tag-more">
                              +{remainingCount}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </td>
                <td className="cell-content">
                  <div className="content-box">
                    <div className="content-text">
                      {truncateText(getUserComments(ticket), 200)}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 반응형 카드 뷰 */}
      <div className="lg:hidden space-y-4">
        {safeTickets.map((ticket, index) => (
          <div key={ticket.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
            {/* 헤더 */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                  🎫 #{ticket.id}
                </span>
              </div>
              <span className="text-xs text-gray-500 font-mono">
                📅 {formatDate(ticket.created_at)}
              </span>
            </div>
            
            {/* 제목 */}
            <div className="mb-4">
              <div className="flex items-start space-x-2">
                <span className="text-gray-400 mt-0.5">📋</span>
                <div className="text-sm font-medium text-gray-900 leading-5">
                  {ticket.subject}
                </div>
              </div>
            </div>
            
            {/* 태그 */}
            <div className="mb-4">
              <div className="flex items-start space-x-2">
                <span className="text-gray-400 mt-0.5">🏷️</span>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const customerTags = filterCustomerTags(ticket.tags);
                      if (customerTags.length === 0) {
                        return (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500">
                            태그 없음
                          </span>
                        );
                      }
                      
                      // 모바일에서도 최대 3개까지만 표시
                      const displayTags = customerTags.slice(0, 3);
                      const remainingCount = customerTags.length - 3;
                      
                      return (
                        <>
                          {displayTags.map((tag, tagIndex) => (
                            <span 
                              key={tagIndex}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"
                            >
                              {tag.replace('고객_', '')}
                            </span>
                          ))}
                          {remainingCount > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                              +{remainingCount}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
            
            {/* 문의 내용 */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-start space-x-2">
                <span className="text-gray-400 mt-0.5">💬</span>
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-600 mb-2">문의 내용</div>
                  <div className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto shadow-sm">
                    <div className="whitespace-pre-wrap break-words leading-relaxed">
                      {getUserComments(ticket)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 추가 스타일링 */}
      <style jsx>{`
        /* 스크롤바 스타일링 */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #a1a1a1;
        }
        
        /* 테이블 행 호버 효과 개선 */
        tbody tr:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        /* 반응형 숨김/표시 */
        @media (max-width: 1024px) {
          .overflow-x-auto table {
            display: none;
          }
        }
        
        @media (min-width: 1025px) {
          .lg\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TicketList; 