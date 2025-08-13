import React, { useState, useMemo } from 'react';

const PreviewKeywords = ({ analyzedData, settings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  // 태그 목록 추출
  const tags = useMemo(() => {
    if (!analyzedData?.keywordData) return [];
    return Object.keys(analyzedData.keywordData).sort();
  }, [analyzedData]);

  // 필터링된 키워드 데이터 - 단순화된 로직
  const filteredKeywordData = useMemo(() => {
    console.log('🔍 키워드 데이터 처리 시작');
    console.log('🔍 analyzedData:', analyzedData);
    console.log('🔍 keywordData:', analyzedData?.keywordData);
    
    if (!analyzedData?.keywordData) {
      console.log('❌ 키워드 데이터 없음');
      return [];
    }
    
      let data = [];
      
    // 각 태그별로 키워드 처리
      Object.entries(analyzedData.keywordData).forEach(([tag, keywordInfo]) => {
      console.log(`🏷️ 태그 ${tag} 처리 시작:`, keywordInfo);
        
        if (!keywordInfo) {
        console.log(`❌ ${tag}: 키워드 정보 없음`);
        return;
        }
        
      // GPT 키워드 처리
        if (keywordInfo.type === 'gpt') {
        console.log(`🤖 ${tag}: GPT 키워드 처리`);
        
        // keywords 배열에서 키워드 추출
        if (Array.isArray(keywordInfo.keywords) && keywordInfo.keywords.length > 0) {
          console.log(`✅ ${tag}: GPT 키워드 발견`, keywordInfo.keywords);
            data.push({
              tag,
              type: 'gpt',
            keywords: keywordInfo.keywords,
            itemCount: keywordInfo.itemCount || 0,
            rawResponse: keywordInfo.rawResponse || ''
          });
        } else {
          console.log(`❌ ${tag}: GPT 키워드 배열이 비어있음`);
        }
      }
      // 기본 키워드 처리
      else if (keywordInfo.type === 'basic' || keywordInfo.content) {
        console.log(`📊 ${tag}: 기본 키워드 처리`);
        
        const content = keywordInfo.content || [];
        if (Array.isArray(content) && content.length > 0) {
          console.log(`✅ ${tag}: 기본 키워드 발견`, content);
          
          content.forEach((item, index) => {
            if (item && item.keyword) {
              data.push({
                tag,
                type: 'basic',
                keyword: item.keyword,
                count: item.count || 0,
                chatIds: item.chatIds || [],
                isGPT: item.isGPT || false,
                id: `${tag}-${index}`
              });
            }
          });
        } else {
          console.log(`❌ ${tag}: 기본 키워드 배열이 비어있음`);
        }
              } else {
        console.log(`❓ ${tag}: 알 수 없는 키워드 구조`, keywordInfo);
      }
      });
      
      console.log('🔍 처리된 키워드 데이터:', data);
      
      // 태그 필터링
      if (selectedTag) {
      data = data.filter(item => item.tag === selectedTag);
      console.log(`🔍 태그 필터링 후 (${selectedTag}):`, data);
    }

    // 검색어 필터링
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        data = data.filter(item => {
            if (item.type === 'gpt') {
          return item.tag.toLowerCase().includes(term) ||
                 item.keywords.some(k => k.toLowerCase().includes(term));
            } else {
          return item.tag.toLowerCase().includes(term) ||
                 item.keyword.toLowerCase().includes(term);
        }
      });
      console.log(`🔍 검색 필터링 후 (${searchTerm}):`, data);
    }

    // 정렬
      data.sort((a, b) => {
          // GPT 결과를 먼저 표시
          if (a.type === 'gpt' && b.type !== 'gpt') return -1;
          if (a.type !== 'gpt' && b.type === 'gpt') return 1;
          
      // 기본 분석인 경우 빈도 순 정렬
          if (a.type === 'basic' && b.type === 'basic') {
        return (b.count || 0) - (a.count || 0);
          }
          
          return 0;
      });
      
      console.log('🔍 최종 키워드 데이터:', data);
      return data;
  }, [analyzedData, selectedTag, searchTerm]);

  // CSV 복사 함수
  const copyToCSV = () => {
    const csvData = filteredKeywordData.map(item => {
      if (item.type === 'gpt') {
        return `"${item.tag}","GPT 분석","${item.keywords.join(', ')}","${item.itemCount}"`;
      } else {
        return `"${item.tag}","기본 분석","${item.keyword}","${item.count}"`;
      }
    });
    
    const csvContent = [
      '"태그","분석 타입","키워드","빈도"',
      ...csvData
    ].join('\n');
    
    navigator.clipboard.writeText(csvContent).then(() => {
      alert('CSV 데이터가 클립보드에 복사되었습니다.');
    });
  };

  if (!analyzedData || !analyzedData.keywordData) {
    return (
      <div style={{ 
        textAlign: 'center', 
        color: '#6c757d', 
        marginTop: '50px',
        fontSize: '16px'
      }}>
        분석 데이터가 없습니다. 먼저 데이터를 분석해주세요.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 컨트롤 패널 */}
      <div style={{
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {/* 필터 및 검색 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '12px',
              minWidth: '120px'
            }}
          >
            <option value="">전체 태그</option>
            {tags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder="키워드 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '12px',
              minWidth: '200px'
            }}
          />
          
          <div style={{
            padding: '8px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '12px',
            backgroundColor: '#f8f9fa',
            color: '#6c757d'
          }}>
            빈도 높은 순 정렬
          </div>
          
          <button
            onClick={copyToCSV}
            disabled={filteredKeywordData.length === 0}
            style={{
              padding: '8px 12px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: filteredKeywordData.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredKeywordData.length === 0 ? 0.6 : 1
            }}
          >
            📋 CSV 복사
          </button>
        </div>
        
        {/* 통계 */}
        <div style={{
          fontSize: '12px',
          color: '#6c757d'
        }}>
          전체 태그: {tags.length}개 | 
          전체 키워드: {Object.values(analyzedData.keywordData).reduce((sum, data) => {
            if (data.type === 'gpt') {
              return sum + (data.keywords?.length || 0);
            }
            return sum + (data.content?.length || 0);
          }, 0)}개 | 
          필터링 결과: {filteredKeywordData.length}개 |
          {analyzedData.summary?.hasGPTAnalysis && <span style={{color: '#007bff'}}> 🤖 GPT 분석 활용</span>}
        </div>
      </div>

      {/* 키워드 리스트 영역 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '15px' }}>
        {filteredKeywordData.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#6c757d',
            marginTop: '50px'
          }}>
            <div>검색 조건에 맞는 키워드가 없습니다.</div>
            <div style={{ fontSize: '11px', marginTop: '10px', color: '#dc3545' }}>
              디버그: 전체 태그 {tags.length}개, 키워드 데이터 존재: {analyzedData?.keywordData ? 'Yes' : 'No'}
            </div>
            {analyzedData?.keywordData && (
              <div style={{ fontSize: '10px', marginTop: '5px', color: '#6c757d' }}>
                키워드 데이터 키들: {Object.keys(analyzedData.keywordData).join(', ')}
              </div>
            )}
            <div style={{ fontSize: '10px', marginTop: '5px', color: '#dc3545' }}>
              필터: 선택된태그={selectedTag || '없음'}, 검색어={searchTerm || '없음'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* 태그별 그룹화 */}
            {selectedTag ? (
              // 특정 태그 선택 시
              <div>
                <h3 style={{
                  margin: '0 0 10px 0',
                  fontSize: '16px',
                  color: '#343a40',
                  padding: '10px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '4px'
                }}>
                  🏷️ {selectedTag}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredKeywordData.map((item, index) => (
                    <KeywordItem key={item.id || `${item.tag}-${index}`} item={item} />
                  ))}
                </div>
              </div>
            ) : (
              // 전체 태그 표시
              tags
                .filter(tag => {
                  const tagKeywords = filteredKeywordData.filter(item => item.tag === tag);
                  return tagKeywords.length > 0;
                })
                .map(tag => {
                  const tagKeywords = filteredKeywordData.filter(item => item.tag === tag);
                  return (
                    <div key={tag}>
                      <h3 style={{
                        margin: '0 0 10px 0',
                        fontSize: '16px',
                        color: '#343a40',
                        padding: '10px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>🏷️ {tag}</span>
                        <span style={{
                          fontSize: '12px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px'
                        }}>
                          {tagKeywords.length}개 키워드
                        </span>
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                        {tagKeywords.map((item, index) => (
                          <KeywordItem key={item.id || `${item.tag}-${index}`} item={item} />
                        ))}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// 키워드 아이템 컴포넌트
const KeywordItem = ({ item }) => {
                            if (item.type === 'gpt') {
                              return (
      <div style={{
                                    border: '2px solid #007bff',
                                    borderRadius: '8px',
                                    padding: '15px',
                                    backgroundColor: '#f8f9ff'
      }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginBottom: '10px'
                                  }}>
                                    <span style={{
                                      backgroundColor: '#007bff',
                                      color: 'white',
                                      padding: '4px 8px',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: 'bold',
                                      marginRight: '8px'
                                    }}>
                                      🤖 GPT 키워드 분석
                                    </span>
                                    <span style={{
                                      color: '#6c757d',
                                      fontSize: '12px'
                                    }}>
                                      {item.itemCount || 0}개 문의 분석
                                    </span>
                                  </div>
                                  <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '8px'
                                  }}>
          {item.keywords && item.keywords.length > 0 ? item.keywords.map((keyword, keyIndex) => (
                                      <span
              key={keyIndex}
                                        style={{
                                          backgroundColor: '#007bff',
                                          color: 'white',
                                          padding: '6px 12px',
                                          borderRadius: '20px',
                                          fontSize: '13px',
                                          fontWeight: 'bold',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}
                                      >
              <span>{keyword}</span>
                                        <span style={{
                                          backgroundColor: 'rgba(255,255,255,0.2)',
                                          padding: '2px 6px',
                                          borderRadius: '10px',
                                          fontSize: '11px'
                                        }}>
                                          {keyIndex + 1}순위
                                        </span>
                                      </span>
                                    )) : (
                                      <span style={{ color: '#6c757d', fontSize: '12px' }}>
                                        키워드가 없습니다.
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            
  // 기본 분석 결과
                            return (
    <div style={{
                                  border: '1px solid #e9ecef',
                                  borderRadius: '6px',
                                  padding: '12px',
                                  backgroundColor: '#ffffff',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
    }}>
                                <div style={{
                                  fontSize: '14px',
                                  color: '#343a40',
                                  fontWeight: 'bold'
                                }}>
                                  • {item.keyword || '키워드 없음'}
                                </div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}>
                                  <span style={{
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 'bold'
                                  }}>
                                    {item.count || 0}개 채팅
                                  </span>
      </div>
    </div>
  );
};

export default PreviewKeywords;