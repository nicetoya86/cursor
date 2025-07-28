import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import CreatableSelect from 'react-select/creatable';
import 'react-datepicker/dist/react-datepicker.css';

const FilterForm = ({ tickets, onFilter, suggestions }) => {
  // Props 검증 및 기본값 설정
  const safeTickets = tickets || [];
  const safeSuggestions = suggestions || { tags: [], statuses: [], priorities: [] };
  const safeOnFilter = onFilter || (() => {});

  console.log('🔧 FilterForm 렌더링:', {
    ticketsCount: safeTickets.length,
    suggestionsKeys: Object.keys(safeSuggestions),
    hasOnFilter: !!onFilter
  });

  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    tags: [],
    searchText: ''
  });

  // 필터 변경 시 자동으로 필터링 적용
  useEffect(() => {
    try {
      console.log('🔧 FilterForm - 필터 변경됨:', filters);
      const safeOnFilterCallback = onFilter || (() => {});
      safeOnFilterCallback(filters);
    } catch (error) {
      console.error('❌ FilterForm onFilter 오류:', error);
    }
  }, [filters, onFilter]);

  const handleFilterChange = (key, value) => {
    console.log(`🔧 필터 변경: ${key} =`, value);
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleReset = () => {
    const resetFilters = {
      startDate: null,
      endDate: null,
      tags: [],
      searchText: ''
    };
    setFilters(resetFilters);
  };

  // 빠른 날짜 선택
  const setQuickDate = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setFilters(prev => ({
      ...prev,
      startDate: start,
      endDate: end
    }));
  };

  // 태그 생성 핸들러
  const handleTagCreate = (inputValue) => {
    const newTag = { value: inputValue, label: inputValue };
    handleFilterChange('tags', [...filters.tags, newTag]);
    return newTag;
  };

  // 활성 필터 개수 계산
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.startDate || filters.endDate) count++;
    if (filters.tags.length > 0) count++;
    if (filters.searchText.trim()) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0 }}>🔍 필터 및 검색</h2>
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span className="filter-count">
              {activeFilterCount}개 필터 활성
            </span>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleReset}
              style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}
            >
              초기화
            </button>
          </div>
        )}
      </div>

      <div className="filter-grid">
        {/* 텍스트 검색 */}
        <div className="form-group">
          <label className="form-label">텍스트 검색</label>
          <input
            type="text"
            className="form-control"
            placeholder="제목이나 내용에서 검색..."
            value={filters.searchText}
            onChange={(e) => handleFilterChange('searchText', e.target.value)}
          />
        </div>

        {/* 날짜 범위 */}
        <div className="form-group">
          <label className="form-label">생성일 범위</label>
          <div className="date-range-container">
            <div className="date-input">
              <DatePicker
                selected={filters.startDate}
                onChange={(date) => handleFilterChange('startDate', date)}
                selectsStart
                startDate={filters.startDate}
                endDate={filters.endDate}
                placeholderText="시작 날짜"
                dateFormat="yyyy-MM-dd"
                className="form-control"
              />
            </div>
            <div className="date-input">
              <DatePicker
                selected={filters.endDate}
                onChange={(date) => handleFilterChange('endDate', date)}
                selectsEnd
                startDate={filters.startDate}
                endDate={filters.endDate}
                minDate={filters.startDate}
                placeholderText="종료 날짜"
                dateFormat="yyyy-MM-dd"
                className="form-control"
              />
            </div>
          </div>
          
          {/* 빠른 날짜 선택 */}
          <div className="quick-dates">
            <button type="button" className="quick-date-btn" onClick={() => setQuickDate(7)}>
              최근 7일
            </button>
            <button type="button" className="quick-date-btn" onClick={() => setQuickDate(30)}>
              최근 30일
            </button>
            <button type="button" className="quick-date-btn" onClick={() => setQuickDate(90)}>
              최근 90일
            </button>
          </div>
        </div>

        {/* 태그 필터 */}
        <div className="form-group">
          <label className="form-label">태그</label>
          <CreatableSelect
            isMulti
            value={filters.tags}
            onChange={(value) => handleFilterChange('tags', value || [])}
            options={safeSuggestions.tags || []}
            onCreateOption={handleTagCreate}
            placeholder="태그 선택 또는 입력..."
            noOptionsMessage={() => "새 태그를 입력하려면 Enter를 누르세요"}
            formatCreateLabel={(inputValue) => `"${inputValue}" 태그 생성`}
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>
      </div>


    </div>
  );
};

export default FilterForm; 