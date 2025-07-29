import { isWithinInterval, parseISO, isValid } from 'date-fns';

// 날짜 파싱 및 검증 (개선된 버전)
const parseDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    // 다양한 날짜 형식 처리
    let dateToProcess = dateString;
    
    // 문자열이 아닌 경우 문자열로 변환
    if (typeof dateToProcess !== 'string') {
      dateToProcess = dateToProcess.toString();
    }
    
    console.log('📅 날짜 파싱 시도:', dateToProcess);
    
    // ISO 8601 형식 시도
    const isoDate = parseISO(dateToProcess);
    if (isValid(isoDate)) {
      console.log('✅ ISO 날짜 파싱 성공:', isoDate.toISOString());
      return isoDate;
    }
    
    // 일반적인 Date 생성자 시도
    const normalDate = new Date(dateToProcess);
    if (isValid(normalDate) && !isNaN(normalDate.getTime())) {
      console.log('✅ 일반 날짜 파싱 성공:', normalDate.toISOString());
      return normalDate;
    }
    
    // YYYY-MM-DD 형식 처리
    const dateMatch = dateToProcess.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      const manualDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (isValid(manualDate)) {
        console.log('✅ 수동 날짜 파싱 성공:', manualDate.toISOString());
        return manualDate;
      }
    }
    
    console.log('❌ 모든 날짜 파싱 방법 실패');
    return null;
  } catch (error) {
    console.warn('❌ 날짜 파싱 예외 발생:', dateString, error);
    return null;
  }
};

// 태그 매칭 검사 (고객_ 접두사 일관 처리)
const matchesTags = (ticketTags, searchTags) => {
  if (!searchTags || searchTags.length === 0) return true;
  if (!ticketTags || ticketTags.length === 0) return false;
  
  console.log('🏷️ 태그 매칭 검사:', {
    ticketTags,
    searchTags
  });
  
  // 고객 태그만 필터링하는 함수
  const filterCustomerTags = (tags) => {
    if (!tags || !Array.isArray(tags)) return [];
    return tags.filter(tag => tag && tag.startsWith('고객_'));
  };
  
  // 티켓의 고객 태그만 추출
  const customerTicketTags = filterCustomerTags(ticketTags);
  
  // 검색 태그 중 하나라도 티켓 태그에 포함되면 매칭
  return searchTags.some(searchTag => {
    // React Select에서 오는 객체 형태 또는 문자열 처리
    let searchValue = '';
    if (typeof searchTag === 'object' && searchTag !== null) {
      searchValue = (searchTag.value || searchTag.label || '').toString();
    } else {
      searchValue = (searchTag || '').toString();
    }
    
    if (!searchValue) return false;
    
    // 검색값이 "고객_"로 시작하지 않으면 추가
    if (!searchValue.startsWith('고객_')) {
      searchValue = '고객_' + searchValue;
    }
    
    console.log('🔍 검색 태그:', searchValue);
    
    return customerTicketTags.some(ticketTag => {
      const tagValue = (ticketTag || '').toString();
      console.log('📋 티켓 태그:', tagValue);
      
      // 정확한 매칭 또는 부분 매칭
      const exactMatch = tagValue === searchValue;
      const partialMatch = tagValue.includes(searchValue) || searchValue.includes(tagValue);
      
      if (exactMatch || partialMatch) {
        console.log('✅ 태그 매칭 성공:', tagValue, '←→', searchValue);
        return true;
      }
      
      return false;
    });
  });
};

// 날짜 범위 검사 (디버깅 로그 추가)
const matchesDateRange = (ticketDate, startDate, endDate) => {
  if (!startDate && !endDate) return true;
  
  const parsedTicketDate = parseDate(ticketDate);
  if (!parsedTicketDate) {
    console.log('❌ 날짜 파싱 실패:', ticketDate);
    return false;
  }
  
  console.log('📅 날짜 범위 검사:', {
    ticketDate: ticketDate,
    parsedTicketDate: parsedTicketDate.toISOString(),
    startDate: startDate,
    endDate: endDate
  });
  
  try {
    if (startDate && endDate) {
      // 시작일과 종료일 모두 있는 경우
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // 시작일의 시작시간으로 설정
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // 종료일의 끝시간으로 설정
      
      const result = isWithinInterval(parsedTicketDate, { start, end });
      console.log('📅 날짜 범위 결과:', result, `${start.toISOString()} ~ ${end.toISOString()}`);
      return result;
    } else if (startDate) {
      // 시작일만 있는 경우
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // 시작일의 시작시간으로 설정
      const result = parsedTicketDate >= start;
      console.log('📅 시작일 이후 결과:', result, `>= ${start.toISOString()}`);
      return result;
    } else if (endDate) {
      // 종료일만 있는 경우
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // 종료일의 끝시간으로 설정
      const result = parsedTicketDate <= end;
      console.log('📅 종료일 이전 결과:', result, `<= ${end.toISOString()}`);
      return result;
    }
  } catch (error) {
    console.error('❌ 날짜 범위 검사 오류:', error);
    return false;
  }
  
  return true;
};

// 텍스트 검색 (정확한 Like 검색, 문의 내용만) - 개선된 버전
const matchesText = (ticket, searchText) => {
  if (!searchText || searchText.trim() === '') return true;
  
  const searchLower = searchText.toLowerCase().trim();
  const ticketId = ticket.id || 'unknown';
  
  console.log(`🔍 티켓 ${ticketId} 정확한 텍스트 검색 시작: "${searchText}"`);
  
  let contentToSearch = '';
  
  // 1순위: GPT 분석 결과가 있으면 해당 내용만 사용 (가장 정확한 문의 내용)
  if (ticket.gptAnalysis && ticket.gptAnalysis.extractedInquiry) {
    contentToSearch = ticket.gptAnalysis.extractedInquiry;
    console.log(`🤖 티켓 ${ticketId} GPT 분석 결과 사용 (${contentToSearch.length}자)`);
  } else {
    // 2순위: GPT 분석 결과가 없으면 TicketList의 getUserComments와 동일한 로직 사용
    console.log(`ℹ️ 티켓 ${ticketId}: GPT 분석 결과 없음, 원본 댓글에서 추출`);
    
  try {
      // TicketList의 getUserComments와 동일한 로직
    let allComments = [];
    
    const findComments = (obj) => {
      if (!obj) return;
      
      if (Array.isArray(obj)) {
        obj.forEach(item => findComments(item));
      } else if (typeof obj === 'object') {
        if (obj.comments && Array.isArray(obj.comments)) {
          allComments = allComments.concat(obj.comments);
          obj.comments.forEach(comment => findComments(comment));
        }
        
        if ((obj.body || obj.plain_body) && obj.hasOwnProperty('author_id')) {
          allComments.push(obj);
        }
        
        Object.values(obj).forEach(value => {
          if (typeof value === 'object') {
            findComments(value);
          }
        });
      }
    };
    
    findComments(ticket);
    
      // 고객 문의 내용만 추출 (시스템 메시지, BOT 메시지 제외)
      const excludeAuthors = ['여신BOT', '매니저L', '매니저B', '매니저D', 'Matrix_bot'];
      let customerContent = '';
      
    allComments.forEach(comment => {
      if (comment.body) {
          // author_id 확인하여 고객 댓글만 포함
          const isSystemMessage = excludeAuthors.some(excludeAuthor => 
            comment.body.includes(excludeAuthor)
          );
          
          if (!isSystemMessage) {
            customerContent += comment.body + ' ';
          }
      }
      if (comment.plain_body && comment.plain_body !== comment.body) {
          const isSystemMessage = excludeAuthors.some(excludeAuthor => 
            comment.plain_body.includes(excludeAuthor)
          );
          
          if (!isSystemMessage) {
            customerContent += comment.plain_body + ' ';
          }
      }
    });
    
      // description은 고객 문의일 가능성이 높으므로 포함
      if (ticket.description && ticket.description.trim()) {
        customerContent += ticket.description + ' ';
      }
      
      contentToSearch = customerContent.trim();
      console.log(`📝 티켓 ${ticketId} 고객 문의 내용 추출 (${contentToSearch.length}자)`);
  } catch (error) {
      console.warn(`❌ 티켓 ${ticketId} 댓글 추출 실패:`, error);
      contentToSearch = '';
    }
  }
  
  if (!contentToSearch) {
    console.log(`❌ 티켓 ${ticketId}: 검색할 내용 없음`);
    return false;
  }
  
  // 정확한 Like 검색 수행
  const contentLower = contentToSearch.toLowerCase();
  
  // 단어 경계를 고려한 더 정확한 검색
  const searchWords = searchLower.split(/\s+/).filter(word => word.length > 0);
  
  // 모든 검색어가 포함되어야 매칭 (AND 조건)
  const allWordsFound = searchWords.every(word => {
    const found = contentLower.includes(word);
    console.log(`🔎 티켓 ${ticketId} 검색어 "${word}": ${found ? '발견' : '없음'}`);
    return found;
  });
  
  console.log(`${allWordsFound ? '✅' : '❌'} 티켓 ${ticketId} 텍스트 검색 ${allWordsFound ? '성공' : '실패'} (${searchWords.length}개 단어 중 ${searchWords.filter(word => contentLower.includes(word)).length}개 매칭)`);
  
  return allWordsFound;
};

// 상태 필터링
const matchesStatus = (ticketStatus, statusFilter) => {
  if (!statusFilter || statusFilter.length === 0) return true;
  
  return statusFilter.some(status => {
    const statusValue = (status.value || status).toLowerCase();
    return (ticketStatus || '').toLowerCase() === statusValue;
  });
};

// 우선순위 필터링
const matchesPriority = (ticketPriority, priorityFilter) => {
  if (!priorityFilter || priorityFilter.length === 0) return true;
  
  return priorityFilter.some(priority => {
    const priorityValue = (priority.value || priority).toLowerCase();
    return (ticketPriority || '').toLowerCase() === priorityValue;
  });
};

// 전화 관련 제목 검사 (제외할 제목들)
const isCallRelatedTitle = (subject) => {
  if (!subject) return false;
  
  const callKeywords = ['발신전화', '부재중', '수신전화'];
  const subjectLower = subject.toLowerCase();
  
  return callKeywords.some(keyword => subjectLower.includes(keyword.toLowerCase()));
};

// 메인 필터링 함수 (상세 디버깅 추가)
export const filterTickets = (tickets, filters) => {
  if (!tickets || !Array.isArray(tickets)) {
    console.warn('❌ 유효하지 않은 티켓 데이터:', tickets);
    return [];
  }

  const {
    startDate,
    endDate,
    tags,
    searchText,
    status,
    priority
  } = filters || {};

  console.log('🔍 ===== 필터링 실행 시작 =====');
  console.log('📊 입력 데이터:', {
    totalTickets: tickets.length,
    filters: filters
  });
  console.log('📋 각 필터 상세:', {
    startDate: startDate ? new Date(startDate).toISOString() : null,
    endDate: endDate ? new Date(endDate).toISOString() : null,
    tags: tags,
    tagsLength: tags?.length || 0,
    searchText: searchText?.trim() || '',
    searchTextLength: searchText?.trim()?.length || 0,
    status: status,
    statusLength: status?.length || 0,
    priority: priority,
    priorityLength: priority?.length || 0
  });

  // 필터가 하나도 없으면 모든 티켓 반환 (전화 관련 제외)
  const hasAnyFilter = startDate || endDate || (tags && tags.length > 0) || 
                      (searchText && searchText.trim()) || 
                      (status && status.length > 0) || 
                      (priority && priority.length > 0);
  
  console.log('🎯 필터 적용 여부:', hasAnyFilter);
  
  if (!hasAnyFilter) {
    // 필터가 없어도 전화 관련 제목은 제외
    const results = tickets.filter(ticket => {
      if (!ticket) return false;
      return !isCallRelatedTitle(ticket.subject);
    });
    console.log(`✅ 필터 없음 - 전화 관련 제외 후: ${results.length}/${tickets.length}개 티켓 반환`);
    return results;
  }

  const results = tickets.filter(ticket => {
    if (!ticket) return false;

    const ticketId = ticket.id || 'unknown';
    console.log(`🎫 티켓 ${ticketId} 필터링 시작`);

    // 전화 관련 제목 제외
    if (isCallRelatedTitle(ticket.subject)) {
      console.log(`❌ 티켓 ${ticketId}: 전화 관련 제목으로 제외`);
      return false;
    }

    // 날짜 범위 검사
    if (!matchesDateRange(ticket.created_at, startDate, endDate)) {
      console.log(`❌ 티켓 ${ticketId}: 날짜 범위 불일치`);
      return false;
    }

    // 태그 검사
    if (!matchesTags(ticket.tags, tags)) {
      console.log(`❌ 티켓 ${ticketId}: 태그 불일치`);
      return false;
    }

    // 텍스트 검색
    if (!matchesText(ticket, searchText)) {
      console.log(`❌ 티켓 ${ticketId}: 텍스트 검색 불일치`);
      return false;
    }

    // 상태 필터
    if (!matchesStatus(ticket.status, status)) {
      console.log(`❌ 티켓 ${ticketId}: 상태 불일치`);
      return false;
    }

    // 우선순위 필터
    if (!matchesPriority(ticket.priority, priority)) {
      console.log(`❌ 티켓 ${ticketId}: 우선순위 불일치`);
      return false;
    }

    console.log(`✅ 티켓 ${ticketId}: 모든 필터 통과`);
    return true;
  });

  console.log(`🎯 필터링 완료: ${results.length}/${tickets.length}개 티켓 반환`);
  return results;
};

// 티켓 정렬 함수
export const sortTickets = (tickets, sortBy = 'created_at', sortOrder = 'desc') => {
  if (!tickets || !Array.isArray(tickets)) return [];

  const sorted = [...tickets].sort((a, b) => {
    let valueA, valueB;

    switch (sortBy) {
      case 'created_at':
      case 'updated_at':
        valueA = parseDate(a[sortBy]);
        valueB = parseDate(b[sortBy]);
        if (!valueA && !valueB) return 0;
        if (!valueA) return 1;
        if (!valueB) return -1;
        break;
      
      case 'id':
        valueA = parseInt(a.id) || 0;
        valueB = parseInt(b.id) || 0;
        break;
      
      case 'subject':
      case 'status':
      case 'priority':
        valueA = (a[sortBy] || '').toLowerCase();
        valueB = (b[sortBy] || '').toLowerCase();
        break;
      
      default:
        valueA = a[sortBy] || '';
        valueB = b[sortBy] || '';
    }

    if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
    if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
};

// 통계 정보 생성
export const getTicketStats = (tickets) => {
  if (!tickets || !Array.isArray(tickets)) return null;

  const stats = {
    total: tickets.length,
    byStatus: {},
    byPriority: {},
    byTags: {},
    dateRange: {
      earliest: null,
      latest: null
    }
  };

  tickets.forEach(ticket => {
    // 상태별 통계
    const status = ticket.status || 'unknown';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

    // 우선순위별 통계
    const priority = ticket.priority || 'normal';
    stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

    // 태그별 통계
    if (ticket.tags && Array.isArray(ticket.tags)) {
      ticket.tags.forEach(tag => {
        stats.byTags[tag] = (stats.byTags[tag] || 0) + 1;
      });
    }

    // 날짜 범위
    const createdDate = parseDate(ticket.created_at);
    if (createdDate) {
      if (!stats.dateRange.earliest || createdDate < stats.dateRange.earliest) {
        stats.dateRange.earliest = createdDate;
      }
      if (!stats.dateRange.latest || createdDate > stats.dateRange.latest) {
        stats.dateRange.latest = createdDate;
      }
    }
  });

  return stats;
};

// 검색 제안 생성 (고객 태그만 추출하고 접두사 제거)
export const getSearchSuggestions = (tickets) => {
  if (!tickets || !Array.isArray(tickets)) return {};

  const suggestions = {
    tags: [],
    statuses: [],
    priorities: []
  };

  const tagSet = new Set();
  const statusSet = new Set();
  const prioritySet = new Set();

  tickets.forEach(ticket => {
    // 고객 태그만 수집하고 접두사 제거
    if (ticket.tags && Array.isArray(ticket.tags)) {
      ticket.tags.forEach(tag => {
        if (tag && tag.startsWith('고객_')) {
          // "고객_" 접두사 제거하여 저장
          const cleanTag = tag.replace('고객_', '');
          if (cleanTag.trim()) {
            tagSet.add(cleanTag);
          }
        }
      });
    }

    // 상태 수집
    if (ticket.status) {
      statusSet.add(ticket.status);
    }

    // 우선순위 수집
    if (ticket.priority) {
      prioritySet.add(ticket.priority);
    }
  });

  // 태그는 접두사가 제거된 형태로 제공 (필터링 시 자동으로 "고객_" 추가됨)
  suggestions.tags = Array.from(tagSet).map(tag => ({ value: tag, label: tag }));
  suggestions.statuses = Array.from(statusSet).map(status => ({ value: status, label: status }));
  suggestions.priorities = Array.from(prioritySet).map(priority => ({ value: priority, label: priority }));

  console.log('🔧 검색 제안 생성:', {
    tagsCount: suggestions.tags.length,
    statusesCount: suggestions.statuses.length,
    prioritiesCount: suggestions.priorities.length,
    sampleTags: suggestions.tags.slice(0, 5)
  });

  return suggestions;
}; 