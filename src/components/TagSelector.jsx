import React, { useState, useEffect } from 'react';
import './TagSelector.css';

const TagSelector = ({ tickets, onTagSelect, onAnalyze, isAnalyzing, suggestions }) => {
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // FilterForm과 동일한 태그 목록 사용 (1개 이상의 문의가 있는 모든 태그 포함)
  useEffect(() => {
    if (!suggestions || !suggestions.tags || suggestions.tags.length === 0) {
      setAvailableTags([]);
      return;
    }

    // suggestions.tags에서 태그 정보 추출 (FilterForm과 동일한 형식)
    const tagOptions = suggestions.tags.map(tagOption => {
      const displayName = tagOption.label || tagOption.value;
      const originalName = '고객_' + displayName; // 고객_ 접두사 추가
      
      // 해당 태그를 가진 티켓 수 계산
      const count = tickets.filter(ticket => 
        ticket.tags && Array.isArray(ticket.tags) && 
        ticket.tags.includes(originalName)
      ).length;
      
      return {
        displayName: displayName,
        originalName: originalName,
        count: count
      };
    });

    // 1개 이상의 문의가 있는 태그만 필터링하고 빈도순 정렬
    const filteredTags = tagOptions
      .filter(tag => tag.count >= 1) // 최소 1개 이상
      .sort((a, b) => b.count - a.count);

    setAvailableTags(filteredTags);
  }, [tickets, suggestions]);

  // 태그 선택/해제
  const handleTagToggle = (tag) => {
    const isSelected = selectedTags.some(selected => selected.originalName === tag.originalName);
    
    if (isSelected) {
      const newSelectedTags = selectedTags.filter(selected => selected.originalName !== tag.originalName);
      setSelectedTags(newSelectedTags);
      onTagSelect(newSelectedTags);
    } else {
      const newSelectedTags = [...selectedTags, tag];
      setSelectedTags(newSelectedTags);
      onTagSelect(newSelectedTags);
    }
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedTags.length === availableTags.length) {
      // 전체 해제
      setSelectedTags([]);
      onTagSelect([]);
    } else {
      // 전체 선택
      setSelectedTags(availableTags);
      onTagSelect(availableTags);
    }
  };

  // 분석 시작
  const handleAnalyze = () => {
    if (selectedTags.length === 0) {
      alert('분석할 태그를 선택해주세요.');
      return;
    }
    onAnalyze(selectedTags);
    setIsDropdownOpen(false);
  };

  return (
    <div className="tag-selector-container">
      <div className="tag-selector-header">
        <h4>🏷️ 태그별 분석</h4>
        <p>분석할 태그를 선택하고 문의 내용을 분석해보세요.</p>
      </div>

      <div className="tag-selector-content">
        {/* 태그 선택 드롭다운 */}
        <div className="dropdown-container">
          <button 
            className="dropdown-toggle"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={availableTags.length === 0}
          >
            <span className="dropdown-text">
              {selectedTags.length === 0 
                ? '태그를 선택하세요' 
                : `${selectedTags.length}개 태그 선택됨`
              }
            </span>
            <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
          </button>

          {isDropdownOpen && (
            <div className="dropdown-menu">
              {/* 전체 선택 옵션 */}
              <div className="dropdown-item select-all">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedTags.length === availableTags.length && availableTags.length > 0}
                    onChange={handleSelectAll}
                  />
                  <span className="checkmark"></span>
                  <span className="tag-text">
                    전체 선택 ({availableTags.length}개)
                  </span>
                </label>
              </div>

              <div className="dropdown-divider"></div>

              {/* 개별 태그 옵션들 */}
              {availableTags.map((tag, index) => (
                <div key={index} className="dropdown-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedTags.some(selected => selected.originalName === tag.originalName)}
                      onChange={() => handleTagToggle(tag)}
                    />
                    <span className="checkmark"></span>
                    <span className="tag-text">
                      {tag.displayName}
                      <span className="tag-count">({tag.count}건)</span>
                    </span>
                  </label>
                </div>
              ))}

              {availableTags.length === 0 && (
                <div className="dropdown-item no-tags">
                  분석 가능한 태그가 없습니다.
                </div>
              )}
            </div>
          )}
        </div>

        {/* 선택된 태그들 표시 */}
        {selectedTags.length > 0 && (
          <div className="selected-tags">
            <h5>선택된 태그:</h5>
            <div className="selected-tags-list">
              {selectedTags.map((tag, index) => (
                <span key={index} className="selected-tag">
                  {tag.displayName}
                  <span className="tag-count">({tag.count}건)</span>
                  <button 
                    className="remove-tag"
                    onClick={() => handleTagToggle(tag)}
                    title="태그 제거"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 분석 버튼 */}
        <div className="analyze-section">
          <button 
            className="analyze-button"
            onClick={handleAnalyze}
            disabled={selectedTags.length === 0 || isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <div className="spinner"></div>
                분석 중...
              </>
            ) : (
              <>
                📊 분석하기 ({selectedTags.length}개 태그)
              </>
            )}
          </button>
          
          {selectedTags.length > 0 && (
            <p className="analyze-info">
              선택된 태그의 총 {selectedTags.reduce((sum, tag) => sum + tag.count, 0)}건의 문의를 분석합니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TagSelector;
