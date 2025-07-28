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

// 태그 매칭 검사
const matchesTags = (ticketTags, searchTags) => {
  if (!searchTags || searchTags.length === 0) return true;
  if (!ticketTags || ticketTags.length === 0) return false;
  
  // 검색 태그 중 하나라도 티켓 태그에 포함되면 매칭
  return searchTags.some(searchTag => {
    // React Select에서 오는 객체 형태 또는 문자열 처리
    let searchValue = '';
    if (typeof searchTag === 'object' && searchTag !== null) {
      searchValue = (searchTag.value || searchTag.label || '').toString().toLowerCase();
    } else {
      searchValue = (searchTag || '').toString().toLowerCase();
    }
    
    if (!searchValue) return false;
    
    return ticketTags.some(ticketTag => {
      const tagValue = (ticketTag || '').toString().toLowerCase();
      return tagValue.includes(searchValue) || searchValue.includes(tagValue);
    });
  });
};

// 날짜 범위 검사
const matchesDateRange = (ticketDate, startDate, endDate) => {
  if (!startDate && !endDate) return true;
  
  const parsedTicketDate = parseDate(ticketDate);
  if (!parsedTicketDate) return false;
  
  try {
    if (startDate && endDate) {
      // 시작일과 종료일 모두 있는 경우
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // 시작일의 시작시간으로 설정
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // 종료일의 끝시간으로 설정
      
      return isWithinInterval(parsedTicketDate, { start, end });
    } else if (startDate) {
      // 시작일만 있는 경우
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // 시작일의 시작시간으로 설정
      return parsedTicketDate >= start;
    } else if (endDate) {
      // 종료일만 있는 경우
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // 종료일의 끝시간으로 설정
      return parsedTicketDate <= end;
    }
  } catch (error) {
    console.warn('날짜 범위 검사 실패:', error);
    return false;
  }
  
  return true;
};

// 텍스트 검색 (문의 내용에서만 검색)
const matchesText = (ticket, searchText) => {
  if (!searchText || searchText.trim() === '') return true;
  
  const searchLower = searchText.toLowerCase();
  
  // 오직 getUserComments 결과에서만 검색 (제목, 설명 제외)
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
    
    comments = comments.toLowerCase();
  } catch (error) {
    console.warn('댓글 추출 실패:', error);
    comments = '';
  }
  
  // 오직 문의 내용(comments)에서만 검색
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

    // 전화 관련 제목 제외
    if (isCallRelatedTitle(ticket.subject)) {
      return false;
    }

    // 날짜 범위 검사
    if (!matchesDateRange(ticket.created_at, startDate, endDate)) {
      return false;
    }

    // 태그 검사
    if (!matchesTags(ticket.tags, tags)) {
      return false;
    }

    // 텍스트 검색
    if (!matchesText(ticket, searchText)) {
      return false;
    }

    // 상태 필터
    if (!matchesStatus(ticket.status, status)) {
      return false;
    }

    // 우선순위 필터
    if (!matchesPriority(ticket.priority, priority)) {
      return false;
    }

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

// 검색 제안 생성
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
    // 태그 수집
    if (ticket.tags && Array.isArray(ticket.tags)) {
      ticket.tags.forEach(tag => tagSet.add(tag));
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

  suggestions.tags = Array.from(tagSet).map(tag => ({ value: tag, label: tag }));
  suggestions.statuses = Array.from(statusSet).map(status => ({ value: status, label: status }));
  suggestions.priorities = Array.from(prioritySet).map(priority => ({ value: priority, label: priority }));

  return suggestions;
}; 