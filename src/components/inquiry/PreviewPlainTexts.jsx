import React, { useState, useMemo } from 'react';

const PreviewPlainTexts = ({ analyzedData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [sortField, setSortField] = useState('name'); // 'name' | 'tag' | 'chatId'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [showChatId, setShowChatId] = useState(false);

  // 병원명, 태그 목록 추출
  const { hospitals, tags } = useMemo(() => {
    if (!analyzedData?.plainTextData) return { hospitals: [], tags: [] };
    
    const hospitalSet = new Set();
    const tagSet = new Set();
    
    analyzedData.plainTextData.forEach(item => {
      if (item.name) hospitalSet.add(item.name);
      if (item.tag) tagSet.add(item.tag);
    });
    
    return {
      hospitals: Array.from(hospitalSet).sort(),
      tags: Array.from(tagSet).sort()
    };
  }, [analyzedData]);

  // 필터링 및 정렬된 데이터
  const filteredAndSortedData = useMemo(() => {
    if (!analyzedData?.plainTextData) return [];
    
    let filtered = analyzedData.plainTextData;
    
    // 검색 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(term) ||
        item.tag.toLowerCase().includes(term) ||
        item.plainText.toLowerCase().includes(term) ||
        item.chatId.toLowerCase().includes(term)
      );
    }
    
    // 병원 필터
    if (selectedHospital) {
      filtered = filtered.filter(item => item.name === selectedHospital);
    }
    
    // 태그 필터
    if (selectedTag) {
      filtered = filtered.filter(item => item.tag === selectedTag);
    }
    
    // 정렬
    filtered.sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return filtered;
  }, [analyzedData, searchTerm, selectedHospital, selectedTag, sortField, sortOrder]);

  // 페이지네이션
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);

  // 정렬 핸들러
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 필터 초기화
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedHospital('');
    setSelectedTag('');
    setCurrentPage(1);
  };

  // CSV 복사
  const copyToCSV = () => {
    const headers = ['병원명', 'Tag', '문의내용'];
    if (showChatId) headers.push('ChatID');
    
    const csvData = [
      headers.join(','),
      ...filteredAndSortedData.map(item => {
        const row = [
          `"${item.name}"`,
          `"${item.tag}"`,
          `"${item.plainText.replace(/"/g, '""')}"`
        ];
        if (showChatId) row.push(`"${item.chatId}"`);
        return row.join(',');
      })
    ].join('\n');
    
    navigator.clipboard.writeText(csvData);
    alert('CSV 데이터가 클립보드에 복사되었습니다.');
  };

  if (!analyzedData?.plainTextData) {
    return <div style={{ padding: '20px' }}>데이터가 없습니다.</div>;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 필터 영역 */}
      <div style={{
        padding: '15px',
        borderBottom: '1px solid #e9ecef',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          {/* 검색 */}
          <input
            type="text"
            placeholder="검색 (병원명, 태그, 문의내용, ChatID)"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '6px 10px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '12px',
              minWidth: '250px'
            }}
          />
          
          {/* 병원 필터 */}
          <select
            value={selectedHospital}
            onChange={(e) => {
              setSelectedHospital(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '6px 10px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '12px',
              minWidth: '120px'
            }}
          >
            <option value="">모든 병원</option>
            {hospitals.map(hospital => (
              <option key={hospital} value={hospital}>{hospital}</option>
            ))}
          </select>
          
          {/* 태그 필터 */}
          <select
            value={selectedTag}
            onChange={(e) => {
              setSelectedTag(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '6px 10px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '12px',
              minWidth: '120px'
            }}
          >
            <option value="">모든 태그</option>
            {tags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          
          {/* 필터 초기화 */}
          <button
            onClick={clearFilters}
            style={{
              padding: '6px 12px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            초기화
          </button>
        </div>
        
        {/* 옵션 및 통계 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* ChatID 표시 토글 */}
            <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={showChatId}
                onChange={(e) => setShowChatId(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              ChatID 표시
            </label>
            
            {/* 페이지 크기 */}
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              <option value={50}>50개씩</option>
              <option value={100}>100개씩</option>
              <option value={200}>200개씩</option>
            </select>
            
            {/* CSV 복사 */}
            <button
              onClick={copyToCSV}
              style={{
                padding: '6px 12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📋 CSV 복사
            </button>
          </div>
          
          {/* 통계 */}
          <div style={{ fontSize: '12px', color: '#6c757d' }}>
            전체: {analyzedData.plainTextData.length}개 | 
            필터링: {filteredAndSortedData.length}개 | 
            현재 페이지: {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredAndSortedData.length)}
          </div>
        </div>
      </div>

      {/* 테이블 영역 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '13px'
        }}>
          <thead style={{ 
            position: 'sticky', 
            top: 0, 
            backgroundColor: '#ffffff',
            borderBottom: '2px solid #dee2e6'
          }}>
            <tr>
              <th
                onClick={() => handleSort('name')}
                style={{
                  padding: '10px 8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: '#f8f9fa',
                  fontWeight: 'bold',
                  minWidth: '120px',
                  position: 'relative'
                }}
              >
                병원명
                {sortField === 'name' && (
                  <span style={{ marginLeft: '5px' }}>
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th
                onClick={() => handleSort('tag')}
                style={{
                  padding: '10px 8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: '#f8f9fa',
                  fontWeight: 'bold',
                  minWidth: '100px',
                  position: 'relative'
                }}
              >
                Tag
                {sortField === 'tag' && (
                  <span style={{ marginLeft: '5px' }}>
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th style={{
                padding: '10px 8px',
                textAlign: 'left',
                backgroundColor: '#f8f9fa',
                fontWeight: 'bold'
              }}>
                문의내용
              </th>
              {showChatId && (
                <th
                  onClick={() => handleSort('chatId')}
                  style={{
                    padding: '10px 8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    backgroundColor: '#f8f9fa',
                    fontWeight: 'bold',
                    minWidth: '100px',
                    position: 'relative'
                  }}
                >
                  ChatID
                  {sortField === 'chatId' && (
                    <span style={{ marginLeft: '5px' }}>
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item, index) => (
              <tr 
                key={`${item.chatId}-${item.tag}-${index}`}
                style={{
                  borderBottom: '1px solid #e9ecef',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                }}
              >
                <td style={{ 
                  padding: '8px',
                  verticalAlign: 'top',
                  maxWidth: '150px',
                  wordBreak: 'break-word'
                }}>
                  {item.name}
                </td>
                <td style={{ 
                  padding: '8px',
                  verticalAlign: 'top',
                  maxWidth: '120px',
                  wordBreak: 'break-word'
                }}>
                  <span style={{
                    backgroundColor: '#e9ecef',
                    padding: '2px 6px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#495057'
                  }}>
                    {item.tag}
                  </span>
                </td>
                <td style={{ 
                  padding: '8px',
                  verticalAlign: 'top',
                  lineHeight: '1.4'
                }}>
                  {item.plainText}
                </td>
                {showChatId && (
                  <td style={{ 
                    padding: '8px',
                    verticalAlign: 'top',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#6c757d',
                    maxWidth: '120px',
                    wordBreak: 'break-all'
                  }}>
                    {item.chatId}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{
          padding: '10px',
          borderTop: '1px solid #e9ecef',
          backgroundColor: '#f8f9fa',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '5px'
        }}>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '5px 10px',
              border: '1px solid #ced4da',
              backgroundColor: currentPage === 1 ? '#e9ecef' : '#ffffff',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            이전
          </button>
          
          <span style={{ 
            fontSize: '12px', 
            color: '#495057',
            margin: '0 10px'
          }}>
            {currentPage} / {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '5px 10px',
              border: '1px solid #ced4da',
              backgroundColor: currentPage === totalPages ? '#e9ecef' : '#ffffff',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};

export default PreviewPlainTexts;
