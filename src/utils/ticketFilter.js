import { isWithinInterval, parseISO, isValid } from 'date-fns';

// 날짜 파싱 및 검증
const parseDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    // ISO 8601 형식 시도
    const isoDate = parseISO(dateString);
    if (isValid(isoDate)) return isoDate;
    
    // 일반적인 Date 생성자 시도
    const normalDate = new Date(dateString);
    if (isValid(normalDate)) return normalDate;
    
    return null;
  } catch (error) {
    console.warn('날짜 파싱 실패:', dateString, error);
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

// 텍스트 검색 (문의 내용에서만 검색, GPT 분석 결과 포함)
const matchesText = (ticket, searchText) => {
  if (!searchText || searchText.trim() === '') return true;
  
  const searchLower = searchText.toLowerCase();
  
  // 1순위: GPT 분석 결과가 있으면 해당 내용에서 검색
  if (ticket.gptAnalysis && ticket.gptAnalysis.extractedInquiry) {
    const gptContent = ticket.gptAnalysis.extractedInquiry.toLowerCase();
    if (gptContent.includes(searchLower)) {
      console.log(`티켓 ${ticket.id}: GPT 분석 결과에서 텍스트 매칭`);
      return true;
    }
  }
  
  // 2순위: 기존 방식으로 댓글에서 검색
  let comments = '';
  try {
    // getUserComments 로직을 간단하게 구현
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
    
    allComments.forEach(comment => {
      if (comment.body) {
        comments += comment.body + ' ';
      }
      if (comment.plain_body && comment.plain_body !== comment.body) {
        comments += comment.plain_body + ' ';
      }
    });
    
    // description과 subject도 포함 (기존 로직 유지)
    if (ticket.description) {
      comments += ticket.description + ' ';
    }
    if (ticket.subject && !ticket.subject.includes('님과의 대화')) {
      comments += ticket.subject + ' ';
    }
    
    comments = comments.toLowerCase();
  } catch (error) {
    console.warn('댓글 추출 실패:', error);
    comments = '';
  }
  
  // 댓글 내용에서 검색
  return comments.includes(searchLower);
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

// 메인 필터링 함수
export const filterTickets = (tickets, filters) => {
  if (!tickets || !Array.isArray(tickets)) {
    console.warn('유효하지 않은 티켓 데이터:', tickets);
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

  console.log('🔍 필터링 실행:', {
    totalTickets: tickets.length,
    startDate,
    endDate,
    tags: tags?.length || 0,
    searchText: searchText?.trim() || '',
    status: status?.length || 0,
    priority: priority?.length || 0
  });

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