import React, { useState, useMemo } from 'react';

const PreviewKeywords = ({ analyzedData, settings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // 태그 목록 추출
  const tags = useMemo(() => {
    if (!analyzedData?.keywordData) return [];
    return Object.keys(analyzedData.keywordData).sort();
  }, [analyzedData]);

  // 필터링된 키워드 데이터
  const filteredKeywordData = useMemo(() => {
    console.log('🔍 PreviewKeywords - analyzedData 전체:', analyzedData);
    console.log('🔍 PreviewKeywords - keywordData 존재 여부:', !!analyzedData?.keywordData);
    
    if (!analyzedData?.keywordData) {
      console.log('🔍 키워드 데이터 없음 - analyzedData:', analyzedData);
      return [];
    }
    
    console.log('🔍 키워드 데이터 구조:', analyzedData.keywordData);
    console.log('🔍 키워드 데이터 키들:', Object.keys(analyzedData.keywordData));
    console.log('🔍 키워드 데이터 값들:', Object.values(analyzedData.keywordData));
    
    try {
      let data = [];
      
      // 태그별 키워드를 하나의 배열로 변환 (모든 가능한 구조 처리)
      Object.entries(analyzedData.keywordData).forEach(([tag, keywordInfo]) => {
        console.log(`🔍 태그 ${tag} 키워드 정보:`, keywordInfo);
        console.log(`🔍 태그 ${tag} 키워드 정보 타입:`, typeof keywordInfo);
        console.log(`🔍 태그 ${tag} 키워드 정보 키들:`, keywordInfo ? Object.keys(keywordInfo) : 'null');
        
        if (!keywordInfo) {
          console.log(`❌ ${tag} 키워드 정보가 null/undefined`);
          return; // null/undefined 체크
        }
        
        // 1. GPT 분석 결과 처리
        if (keywordInfo.type === 'gpt') {
          console.log(`🤖 GPT 키워드 처리 시작 (${tag})`);
          const keywords = Array.isArray(keywordInfo.content) ? keywordInfo.content : [];
          console.log(`🤖 GPT 키워드 배열 (${tag}):`, keywords);
          
          if (keywords.length > 0) {
            const processedKeywords = keywords.map(k => {
              if (typeof k === 'object' && k.keyword) return k.keyword;
              return String(k);
            }).filter(Boolean);
            
            console.log(`🤖 처리된 GPT 키워드 (${tag}):`, processedKeywords);
            
            data.push({
              tag,
              type: 'gpt',
              keywords: processedKeywords,
              rawResponse: keywordInfo.rawResponse || '',
              itemCount: keywordInfo.itemCount || 0
            });
          }
        }
        // 2. 새로운 기본 분석 결과 처리 (type: 'basic')
        else if (keywordInfo.type === 'basic' && keywordInfo.content && Array.isArray(keywordInfo.content)) {
          console.log(`📊 기본 키워드 처리 시작 (${tag}):`, keywordInfo.content);
          console.log(`📊 키워드 배열 길이: ${keywordInfo.content.length}`);
          
          keywordInfo.content.forEach((keyword, index) => {
            console.log(`📊 키워드 ${index} 전체 구조:`, keyword);
            console.log(`📊 키워드 ${index} 타입:`, typeof keyword);
            console.log(`📊 키워드 ${index} 키들:`, keyword ? Object.keys(keyword) : 'null');
            
            // 다양한 키워드 구조에 대응
            if (keyword && typeof keyword === 'object') {
              // keyword 속성이 있는 경우
              if (keyword.keyword && typeof keyword.keyword === 'string') {
                console.log(`✅ 기본 키워드 추가: ${keyword.keyword} (${keyword.count || 0}개)`);
                data.push({
                  tag,
                  type: 'basic',
                  keyword: keyword.keyword,
                  count: keyword.count || 0,
                  chatIds: keyword.chatIds || [],
                  isGPT: keyword.isGPT || false,
                  id: `${tag}-${index}`
                });
              }
              // 다른 속성명을 가진 경우 (예: name, text, word 등)
              else if (keyword.name || keyword.text || keyword.word) {
                const keywordText = keyword.name || keyword.text || keyword.word;
                console.log(`✅ 대체 속성 키워드 추가: ${keywordText} (${keyword.count || 0}개)`);
                data.push({
                  tag,
                  type: 'basic',
                  keyword: keywordText,
                  count: keyword.count || 0,
                  chatIds: keyword.chatIds || [],
                  isGPT: keyword.isGPT || false,
                  id: `${tag}-${index}`
                });
              }
              // 객체의 첫 번째 문자열 값을 키워드로 사용
              else {
                const firstStringValue = Object.values(keyword).find(v => typeof v === 'string' && v.trim());
                if (firstStringValue) {
                  console.log(`✅ 첫 번째 문자열 값 키워드 추가: ${firstStringValue} (${keyword.count || 0}개)`);
                  data.push({
                    tag,
                    type: 'basic',
                    keyword: firstStringValue,
                    count: keyword.count || 0,
                    chatIds: keyword.chatIds || [],
                    isGPT: keyword.isGPT || false,
                    id: `${tag}-${index}`
                  });
                } else {
                  console.log(`❌ 키워드 객체에서 문자열 값을 찾을 수 없음:`, keyword);
                }
              }
            }
            // 문자열인 경우
            else if (typeof keyword === 'string' && keyword.trim()) {
              console.log(`✅ 문자열 키워드 추가: ${keyword}`);
              data.push({
                tag,
                type: 'basic',
                keyword: keyword.trim(),
                count: 1,
                chatIds: [],
                isGPT: false,
                id: `${tag}-${index}`
              });
            }
            else {
              console.log(`❌ 키워드 객체가 올바르지 않음:`, keyword);
            }
          });
        }
        // 3. 기존 구조 (content 직접 배열) - type이 없는 경우도 처리
        else if (keywordInfo.content && Array.isArray(keywordInfo.content)) {
          console.log(`📊 기본 키워드 처리 (기존 구조, ${tag}):`, keywordInfo.content);
          keywordInfo.content.forEach((keyword, index) => {
            console.log(`📊 기존 구조 키워드 ${index} 처리:`, keyword);
            if (keyword && keyword.keyword) {
              console.log(`✅ 기존 구조 키워드 추가: ${keyword.keyword} (${keyword.count}개)`);
              data.push({
                tag,
                type: 'basic',
                keyword: keyword.keyword,
                count: keyword.count || 0,
                chatIds: keyword.chatIds || [],
                isGPT: keyword.isGPT || false,
                id: `${tag}-${index}`
              });
            } else {
              console.log(`❌ 기존 구조 키워드 객체가 올바르지 않음:`, keyword);
            }
          });
        }
        // 4. 직접 배열인 경우 (최고 호환성)
        else if (Array.isArray(keywordInfo)) {
          console.log(`📋 직접 배열 키워드 처리 (${tag}):`, keywordInfo);
          keywordInfo.forEach((keyword, index) => {
            console.log(`📋 직접 배열 키워드 ${index} 처리:`, keyword);
            if (keyword && typeof keyword === 'object' && keyword.keyword) {
              data.push({
                tag,
                type: 'basic',
                keyword: keyword.keyword,
                count: keyword.count || 0,
                chatIds: keyword.chatIds || [],
                isGPT: keyword.isGPT || false,
                id: `${tag}-${index}`
              });
            }
          });
        }
        // 5. 알 수 없는 구조 강제 처리 (더 강력한 파싱)
        else {
          console.log(`❓ 알 수 없는 키워드 구조 처리 시작 (${tag}):`, keywordInfo);
          
          // 재귀적으로 모든 객체를 탐색하여 키워드 추출
          const extractKeywordsRecursively = (obj, path = '') => {
            console.log(`🔍 재귀적 키워드 추출: path=${path}, obj=`, obj);
            if (!obj) return;
            
            if (typeof obj === 'string' && obj.trim()) {
              // 문자열인 경우 키워드로 처리
              console.log(`✅ 문자열 키워드 추가: ${obj.trim()}`);
              data.push({
                tag,
                type: 'basic',
                keyword: obj.trim(),
                count: 1,
                chatIds: [],
                isGPT: false,
                id: `${tag}-${path}`
              });
            } else if (Array.isArray(obj)) {
              // 배열인 경우 각 요소 처리
              console.log(`🔍 배열 처리: 길이=${obj.length}`);
              obj.forEach((item, idx) => {
                extractKeywordsRecursively(item, `${path}-arr${idx}`);
              });
            } else if (typeof obj === 'object' && obj !== null) {
              // 키워드 객체 형태인지 확인
              if (obj.keyword && typeof obj.keyword === 'string') {
                console.log(`✅ 키워드 객체 추가: ${obj.keyword}`);
                data.push({
                  tag,
                  type: 'basic',
                  keyword: obj.keyword,
                  count: obj.count || 0,
                  chatIds: obj.chatIds || [],
                  isGPT: obj.isGPT || false,
                  id: `${tag}-${path}`
                });
              } else {
                // 객체의 모든 속성을 재귀적으로 탐색
                console.log(`🔍 객체 속성 탐색: 키들=${Object.keys(obj).join(', ')}`);
                Object.entries(obj).forEach(([key, value]) => {
                  extractKeywordsRecursively(value, `${path}-${key}`);
                });
              }
            }
          };
          
          extractKeywordsRecursively(keywordInfo, 'unknown');
        }
        
        console.log(`🔍 ${tag} 처리 후 현재 data 길이:`, data.length);
      });
      
      console.log('🔍 처리된 키워드 데이터:', data);
      console.log('🔍 처리된 키워드 데이터 개수:', data.length);
      
      // 태그 필터링
      if (selectedTag) {
        const beforeFilter = data.length;
        data = data.filter(item => item.tag === selectedTag);
        console.log(`🔍 태그 필터링: ${beforeFilter} -> ${data.length} (태그: ${selectedTag})`);
      }
      
      // 검색 필터링
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const beforeSearch = data.length;
        data = data.filter(item => {
          try {
            if (item.type === 'gpt') {
              return item.tag.toLowerCase().includes(term) ||
                     (Array.isArray(item.keywords) && item.keywords.some(k => 
                       typeof k === 'string' && k.toLowerCase().includes(term)
                     ));
            } else {
              return item.tag.toLowerCase().includes(term) ||
                     (item.keyword && item.keyword.toLowerCase().includes(term));
            }
          } catch (error) {
            console.warn('검색 필터링 중 오류:', error);
            return false;
          }
        });
        console.log(`🔍 검색 필터링: ${beforeSearch} -> ${data.length} (검색어: ${term})`);
      }
      
      // 정렬 (빈도가 높은 순 우선, GPT는 별도 표시)
      data.sort((a, b) => {
        try {
          // GPT 결과를 먼저 표시
          if (a.type === 'gpt' && b.type !== 'gpt') return -1;
          if (a.type !== 'gpt' && b.type === 'gpt') return 1;
          
          // 둘 다 기본 분석인 경우 빈도 높은 순으로 정렬 (항상 높은 순)
          if (a.type === 'basic' && b.type === 'basic') {
            const aCount = a.count || 0;
            const bCount = b.count || 0;
            // 빈도가 높은 순으로 고정 정렬
            return bCount - aCount;
          }
          
          return 0;
        } catch (error) {
          console.warn('정렬 중 오류:', error);
          return 0;
        }
      });
      
      console.log('🔍 정렬 후 키워드 데이터:', data.slice(0, 5)); // 처음 5개만 로그
      
      console.log('🔍 최종 키워드 데이터:', data);
      console.log('🔍 최종 키워드 데이터 개수:', data.length);
      return data;
    } catch (error) {
      console.error('키워드 데이터 처리 중 오류:', error);
      return [];
    }
  }, [analyzedData, selectedTag, searchTerm, sortOrder]);

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
            return sum + (data.content?.length || 0);
          }, 0)}개 | 
          필터링 결과: {filteredKeywordData.length}개 |
          {analyzedData.summary?.hasGPTAnalysis && <span style={{color: '#007bff'}}> 🤖 GPT 분석 활용</span>}
        </div>
      </div>

      {/* 키워드 리스트 영역 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '15px' }}>
        {(() => {
          console.log('🔍 키워드 렌더링 시작');
          console.log('🔍 filteredKeywordData.length:', filteredKeywordData.length);
          console.log('🔍 filteredKeywordData:', filteredKeywordData);
          console.log('🔍 analyzedData.keywordData:', analyzedData?.keywordData);
          console.log('🔍 selectedTag:', selectedTag);
          console.log('🔍 searchTerm:', searchTerm);
          
          return filteredKeywordData.length === 0;
        })() ? (
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
            {analyzedData?.keywordData && Object.keys(analyzedData.keywordData).length > 0 && (
              <div style={{ fontSize: '9px', marginTop: '10px', color: '#6c757d', textAlign: 'left', maxHeight: '200px', overflow: 'auto' }}>
                <strong>원본 키워드 데이터 구조:</strong>
                <pre style={{ fontSize: '8px', textAlign: 'left' }}>
                  {JSON.stringify(analyzedData.keywordData, null, 2)}
                </pre>
              </div>
            )}
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
                  {filteredKeywordData.map((item, index) => {
                    if (!item) return null;
                    
                    const key = item.id || `${item.tag}-${index}`;
                    
                    try {
                      // GPT 분석 결과인 경우
                      if (item.type === 'gpt') {
                        const keywords = Array.isArray(item.keywords) ? item.keywords : [];
                        return (
                          <div
                            key={key}
                            style={{
                              border: '2px solid #007bff',
                              borderRadius: '8px',
                              padding: '15px',
                              backgroundColor: '#f8f9ff'
                            }}
                          >
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
                              {keywords.length > 0 ? keywords.map((keyword, keyIndex) => (
                                <span
                                  key={`${key}-keyword-${keyIndex}`}
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
                                  <span>{keyword || '키워드 없음'}</span>
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
                      
                      // 기본 분석 결과인 경우
                      return (
                        <div
                          key={key}
                          style={{
                            border: '1px solid #e9ecef',
                            borderRadius: '6px',
                            padding: '12px',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{
                            fontSize: '14px',
                            color: '#343a40',
                            fontWeight: 'bold'
                          }}>
                            {item.keyword || '키워드 없음'}
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
                    } catch (renderError) {
                      console.error('키워드 렌더링 오류:', renderError, item);
                      return (
                        <div key={key} style={{
                          padding: '10px',
                          backgroundColor: '#f8d7da',
                          color: '#721c24',
                          border: '1px solid #f5c6cb',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          키워드 표시 중 오류가 발생했습니다.
                        </div>
                      );
                    }
                  }).filter(Boolean)}
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
                        {tagKeywords.map((item, index) => {
                          if (!item) return null;
                          
                          const key = item.id || `${item.tag}-${index}`;
                          
                          try {
                            // GPT 분석 결과인 경우
                            if (item.type === 'gpt') {
                              const keywords = Array.isArray(item.keywords) ? item.keywords : [];
                              return (
                                <div
                                  key={key}
                                  style={{
                                    border: '2px solid #007bff',
                                    borderRadius: '8px',
                                    padding: '15px',
                                    backgroundColor: '#f8f9ff'
                                  }}
                                >
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
                                    {keywords.length > 0 ? keywords.map((keyword, keyIndex) => (
                                      <span
                                        key={`${key}-keyword-${keyIndex}`}
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
                                        <span>{keyword || '키워드 없음'}</span>
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
                            
                            // 기본 분석 결과인 경우
                            return (
                              <div
                                key={key}
                                style={{
                                  border: '1px solid #e9ecef',
                                  borderRadius: '6px',
                                  padding: '12px',
                                  backgroundColor: '#ffffff',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}
                              >
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
                          } catch (renderError) {
                            console.error('키워드 렌더링 오류:', renderError, item);
                            return (
                              <div key={key} style={{
                                padding: '10px',
                                backgroundColor: '#f8d7da',
                                color: '#721c24',
                                border: '1px solid #f5c6cb',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                키워드 표시 중 오류가 발생했습니다.
                              </div>
                            );
                          }
                        }).filter(Boolean)}
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

export default PreviewKeywords;