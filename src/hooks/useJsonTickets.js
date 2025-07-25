import { useState, useCallback, useMemo } from 'react';
import { filterTickets, sortTickets, getTicketStats, getSearchSuggestions } from '../utils/ticketFilter';

export const useJsonTickets = () => {
  const [allTickets, setAllTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [currentFilters, setCurrentFilters] = useState(null);
  const [sortConfig, setSortConfig] = useState({ 
    sortBy: 'created_at', 
    sortOrder: 'desc' 
  });
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 데이터 로드
  const loadTickets = useCallback((tickets, filename) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!tickets || !Array.isArray(tickets)) {
        throw new Error('유효하지 않은 티켓 데이터입니다.');
      }

      console.log(`${tickets.length}개의 티켓을 로드했습니다.`);
      
      setAllTickets(tickets);
      setFilteredTickets(tickets);
      setFileName(filename || '');
      
      // 기본 정렬 적용
      const sorted = sortTickets(tickets, sortConfig.sortBy, sortConfig.sortOrder);
      setFilteredTickets(sorted);
      
    } catch (err) {
      console.error('티켓 로드 오류:', err);
      setError(err.message);
      setAllTickets([]);
      setFilteredTickets([]);
      setFileName('');
    } finally {
      setIsLoading(false);
    }
  }, [sortConfig]);

  // 필터링 적용
  const applyFilters = useCallback((filters) => {
    try {
      setCurrentFilters(filters);
      
      if (!allTickets.length) {
        setFilteredTickets([]);
        return;
      }

      // 필터링 적용
      const filtered = filterTickets(allTickets, filters);
      
      // 정렬 적용
      const sorted = sortTickets(filtered, sortConfig.sortBy, sortConfig.sortOrder);
      
      setFilteredTickets(sorted);
      
      console.log(`필터링 결과: ${filtered.length}/${allTickets.length}개 티켓`);
      
    } catch (err) {
      console.error('필터링 오류:', err);
      setError(`필터링 중 오류가 발생했습니다: ${err.message}`);
    }
  }, [allTickets, sortConfig]);

  // 정렬 변경
  const changeSorting = useCallback((sortBy, sortOrder = 'desc') => {
    setSortConfig({ sortBy, sortOrder });
    
    // 현재 필터링된 데이터에 새로운 정렬 적용
    const sorted = sortTickets(filteredTickets, sortBy, sortOrder);
    setFilteredTickets(sorted);
  }, [filteredTickets]);

  // 데이터 클리어
  const clearData = useCallback(() => {
    setAllTickets([]);
    setFilteredTickets([]);
    setCurrentFilters(null);
    setFileName('');
    setError(null);
    setSortConfig({ sortBy: 'created_at', sortOrder: 'desc' });
  }, []);

  // 에러 클리어
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 통계 정보 (메모화)
  const stats = useMemo(() => {
    return {
      all: getTicketStats(allTickets),
      filtered: getTicketStats(filteredTickets)
    };
  }, [allTickets, filteredTickets]);

  // 검색 제안 (메모화)
  const suggestions = useMemo(() => {
    return getSearchSuggestions(allTickets);
  }, [allTickets]);

  // 내보내기용 데이터 준비
  const getExportData = useCallback(() => {
    return filteredTickets.map(ticket => ({
      '티켓 번호': ticket.id,
      '생성일': ticket.created_at,
      '수정일': ticket.updated_at || '',
      '제목': ticket.subject || '',
      '내용': ticket.description || '',
      '상태': ticket.status || '',
      '우선순위': ticket.priority || '',
      '태그': Array.isArray(ticket.tags) ? ticket.tags.join(', ') : '',
      '요청자 ID': ticket.requester_id || '',
      '담당자 ID': ticket.assignee_id || '',
      '조직 ID': ticket.organization_id || '',
      '타입': ticket.type || '',
      'URL': ticket.url || ''
    }));
  }, [filteredTickets]);

  return {
    // 데이터
    allTickets,
    filteredTickets,
    fileName,
    stats,
    suggestions,
    
    // 상태
    isLoading,
    error,
    currentFilters,
    sortConfig,
    
    // 액션
    loadTickets,
    applyFilters,
    changeSorting,
    clearData,
    clearError,
    getExportData,
    
    // 계산된 값
    hasData: allTickets.length > 0,
    totalCount: allTickets.length,
    filteredCount: filteredTickets.length,
    isFiltered: currentFilters && (
      currentFilters.startDate || 
      currentFilters.endDate || 
      (currentFilters.tags && currentFilters.tags.length > 0) ||
      (currentFilters.searchText && currentFilters.searchText.trim()) ||
      (currentFilters.status && currentFilters.status.length > 0) ||
      (currentFilters.priority && currentFilters.priority.length > 0)
    )
  };
}; 