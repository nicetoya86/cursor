import React, { useState, useMemo } from 'react';

const PreviewFAQ = ({ analyzedData, settings }) => {
  const [selectedTag, setSelectedTag] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showDetails, setShowDetails] = useState({});

  // 태그 목록 추출
  const tags = useMemo(() => {
    if (!analyzedData?.faqData) return [];
    return Object.keys(analyzedData.faqData).sort();
  }, [analyzedData]);

  // 필터링된 FAQ 데이터
  const filteredFAQData = useMemo(() => {
    if (!analyzedData?.faqData) return [];
    
    let data = [];
    
    // 태그별 FAQ를 하나의 배열로 변환 (GPT/기본 분석 구분)
    Object.entries(analyzedData.faqData).forEach(([tag, faqInfo]) => {
      if (faqInfo.type === 'gpt') {
        // GPT 분석 결과
        data.push({
          tag,
          type: 'gpt',
          content: faqInfo.content,
          itemCount: faqInfo.itemCount
        });
      } else if (faqInfo.content && Array.isArray(faqInfo.content)) {
        // 기본 분석 결과
        faqInfo.content.forEach(faq => {
          data.push({
            tag,
            type: 'basic',
            sentence: faq.sentence,
            count: faq.count,
            chatIds: faq.chatIds
          });
        });
      }
    });
    
    // 태그 필터링
    if (selectedTag) {
      data = data.filter(item => item.tag === selectedTag);
    }
    
    // 검색 필터링
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(item => {
        if (item.type === 'gpt') {
          return item.tag.toLowerCase().includes(term) ||
                 item.content.toLowerCase().includes(term);
        } else {
          return item.tag.toLowerCase().includes(term) ||
                 item.sentence.toLowerCase().includes(term);
        }
      });
    }
    
    // 정렬 (GPT 우선, 그 다음 빈도순)
    data.sort((a, b) => {
      // GPT 결과를 먼저 표시
      if (a.type === 'gpt' && b.type !== 'gpt') return -1;
      if (a.type !== 'gpt' && b.type === 'gpt') return 1;
      
      // 둘 다 기본 분석인 경우 빈도순
      if (a.type === 'basic' && b.type === 'basic') {
        if (sortOrder === 'desc') {
          return b.count - a.count;
        } else {
          return a.count - b.count;
        }
      }
      
      return 0;
    });
    
    return data;
  }, [analyzedData, selectedTag, searchTerm, sortOrder]);

  // 상세 정보 토글
  const toggleDetails = (key) => {
    setShowDetails(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // CSV 복사 함수
  const copyToCSV = () => {
    const csvData = filteredFAQData.map(faq => {
      if (faq.type === 'gpt') {
        return `"${faq.tag}","GPT 분석","${faq.content.replace(/"/g, '""')}","${faq.itemCount}"`;
      } else {
        return `"${faq.tag}","기본 분석","${faq.sentence}","${faq.count}"`;
      }
    });
    
    const csvContent = [
      '"태그","분석 타입","내용","빈도"',
      ...csvData
    ].join('\n');
    
    navigator.clipboard.writeText(csvContent).then(() => {
      alert('CSV 데이터가 클립보드에 복사되었습니다.');
    });
  };

  if (!analyzedData || !analyzedData.faqData) {
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
            placeholder="FAQ 검색..."
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
          
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            <option value="desc">빈도 높은 순</option>
            <option value="asc">빈도 낮은 순</option>
          </select>
          
          <button
            onClick={copyToCSV}
            disabled={filteredFAQData.length === 0}
            style={{
              padding: '8px 12px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: filteredFAQData.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredFAQData.length === 0 ? 0.6 : 1
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
          전체 FAQ: {Object.values(analyzedData.faqData).reduce((sum, data) => {
            if (data.type === 'gpt') return sum + 1;
            return sum + (data.content?.length || 0);
          }, 0)}개 | 
          필터링 결과: {filteredFAQData.length}개 |
          {analyzedData.summary?.hasGPTAnalysis && <span style={{color: '#007bff'}}> 🤖 GPT 분석 활용</span>}
        </div>
      </div>

      {/* FAQ 리스트 영역 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '15px' }}>
        {filteredFAQData.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#6c757d',
            marginTop: '50px'
          }}>
            검색 조건에 맞는 FAQ가 없습니다.
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
                  {filteredFAQData.map((faq, index) => {
                    const key = `${faq.tag}-${index}`;
                    
                    // GPT 분석 결과인 경우
                    if (faq.type === 'gpt') {
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
                              🤖 GPT 분석
                            </span>
                            <span style={{
                              color: '#6c757d',
                              fontSize: '12px'
                            }}>
                              {faq.itemCount}개 문의 분석
                            </span>
                          </div>
                          <div style={{
                            fontSize: '14px',
                            lineHeight: '1.6',
                            color: '#343a40',
                            whiteSpace: 'pre-line'
                          }}>
{(() => {
                              console.log('🔍 FAQ 카운트 처리 시작:', faq);
                              
                              // analyzedData에서 해당 태그의 faqData 찾기
                              const tagFaqData = analyzedData?.faqData?.[faq.tag];
                              console.log('🔍 tagFaqData:', tagFaqData);
                              
                              // basicAnalysis 데이터 찾기
                              const basicAnalysis = tagFaqData?.basicAnalysis;
                              console.log('🔍 basicAnalysis 존재:', !!basicAnalysis);
                              console.log('🔍 basicAnalysis 데이터:', basicAnalysis);
                              
                              // GPT 응답에 카운트 정보를 추가
                              if (basicAnalysis && basicAnalysis.length > 0) {
                                const sortedBasicAnalysis = basicAnalysis
                                  .sort((a, b) => (b.count || 0) - (a.count || 0));
                                
                                console.log('🔍 정렬된 basicAnalysis:', sortedBasicAnalysis);
                                
                                let modifiedContent = faq.content;
                                console.log('🔍 원본 FAQ 내용:', modifiedContent);
                                
                                // GPT 응답의 각 줄을 확인하여 질문과 매칭되는 카운트 추가
                                const lines = modifiedContent.split('\n');
                                const processedLines = lines.map((line, lineIndex) => {
                                  // 숫자로 시작하는 질문 라인 찾기 (예: "1. 질문내용")
                                  const questionMatch = line.match(/^(\d+\.\s*)(.+)$/);
                                  if (questionMatch) {
                                    const questionText = questionMatch[2].trim();
                                    console.log(`🔍 질문 ${questionMatch[1]} 처리:`, questionText);
                                    
                                    // 순서대로 매칭 (첫 번째 질문은 가장 빈도가 높은 것과 매칭)
                                    const questionIndex = parseInt(questionMatch[1]) - 1;
                                    const matchingAnalysis = sortedBasicAnalysis[questionIndex];
                                    
                                    if (matchingAnalysis) {
                                      console.log(`✅ 순서 매칭 성공 (${questionIndex}):`, matchingAnalysis);
                                      return `${questionMatch[1]}${questionText} (${matchingAnalysis.count}건)`;
                                    } else {
                                      console.log(`❌ 순서 매칭 실패 (${questionIndex}), 키워드 매칭 시도`);
                                      
                                      // 대체 매칭: 키워드 기반
                                      const fallbackMatch = sortedBasicAnalysis.find(analysis => {
                                        const sentence = analysis.sentence || '';
                                        const questionKeywords = questionText.toLowerCase().split(/\s+/).filter(w => w.length > 1);
                                        const sentenceKeywords = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 1);
                                        
                                        const commonKeywords = questionKeywords.filter(kw => 
                                          sentenceKeywords.some(sw => sw.includes(kw) || kw.includes(sw))
                                        );
                                        
                                        return commonKeywords.length > 0;
                                      });
                                      
                                      if (fallbackMatch) {
                                        console.log(`✅ 키워드 매칭 성공:`, fallbackMatch);
                                        return `${questionMatch[1]}${questionText} (${fallbackMatch.count}건)`;
                                      } else {
                                        console.log(`❌ 키워드 매칭도 실패`);
                                      }
                                    }
                                  }
                                  return line;
                                });
                                
                                const result = processedLines.join('\n');
                                console.log('🔍 최종 FAQ 내용:', result);
                                return result;
                              } else {
                                console.log('❌ basicAnalysis가 없거나 비어있음, 원본 내용 반환');
                                return faq.content;
                              }
                            })()}
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
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '8px'
                        }}>
                          <div style={{
                            flex: 1,
                            fontSize: '14px',
                            lineHeight: '1.5',
                            color: '#343a40'
                          }}>
                            {faq.sentence}
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginLeft: '10px'
                          }}>
                            <span style={{
                              backgroundColor: '#28a745',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>
                              {faq.count}개 채팅
                            </span>
                            <button
                              onClick={() => toggleDetails(key)}
                              style={{
                                padding: '2px 6px',
                                backgroundColor: 'transparent',
                                border: '1px solid #ced4da',
                                borderRadius: '4px',
                                fontSize: '10px',
                                cursor: 'pointer'
                              }}
                            >
                              {showDetails[key] ? '접기' : '상세'}
                            </button>
                          </div>
                        </div>
                        
                        {/* 상세 정보 */}
                        {showDetails[key] && (
                          <div style={{
                            marginTop: '8px',
                            padding: '8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: '#6c757d'
                          }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                              등장한 채팅 ID ({faq.chatIds?.length || 0}개):
                            </div>
                            <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                              {faq.chatIds?.join(', ') || '없음'}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // 전체 태그 표시
              tags
                .filter(tag => {
                  const tagFAQs = filteredFAQData.filter(faq => faq.tag === tag);
                  return tagFAQs.length > 0;
                })
                .map(tag => {
                  const tagFAQs = filteredFAQData.filter(faq => faq.tag === tag);
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
                          {tagFAQs.length}개 FAQ
                        </span>
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                        {tagFAQs.map((faq, index) => {
                          const key = `${faq.tag}-${index}`;
                          
                          // GPT 분석 결과인 경우
                          if (faq.type === 'gpt') {
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
                                    🤖 GPT 분석
                                  </span>
                                  <span style={{
                                    color: '#6c757d',
                                    fontSize: '12px'
                                  }}>
                                    {faq.itemCount}개 문의 분석
                                  </span>
                                </div>
                                <div style={{
                                  fontSize: '14px',
                                  lineHeight: '1.6',
                                  color: '#343a40',
                                  whiteSpace: 'pre-line'
                                }}>
{(() => {
                                    console.log('🔍 전체 태그 FAQ 카운트 처리 시작:', faq);
                                    
                                    // analyzedData에서 해당 태그의 faqData 찾기
                                    const tagFaqData = analyzedData?.faqData?.[faq.tag];
                                    console.log('🔍 전체 태그 tagFaqData:', tagFaqData);
                                    
                                    // basicAnalysis 데이터 찾기
                                    const basicAnalysis = tagFaqData?.basicAnalysis;
                                    console.log('🔍 전체 태그 basicAnalysis 존재:', !!basicAnalysis);
                                    console.log('🔍 전체 태그 basicAnalysis 데이터:', basicAnalysis);
                                    
                                    // GPT 응답에 카운트 정보를 추가
                                    if (basicAnalysis && basicAnalysis.length > 0) {
                                      const sortedBasicAnalysis = basicAnalysis
                                        .sort((a, b) => (b.count || 0) - (a.count || 0));
                                      
                                      console.log('🔍 전체 태그 정렬된 basicAnalysis:', sortedBasicAnalysis);
                                      
                                      let modifiedContent = faq.content;
                                      console.log('🔍 전체 태그 원본 FAQ 내용:', modifiedContent);
                                      
                                      // GPT 응답의 각 줄을 확인하여 질문과 매칭되는 카운트 추가
                                      const lines = modifiedContent.split('\n');
                                      const processedLines = lines.map((line, lineIndex) => {
                                        // 숫자로 시작하는 질문 라인 찾기 (예: "1. 질문내용")
                                        const questionMatch = line.match(/^(\d+\.\s*)(.+)$/);
                                        if (questionMatch) {
                                          const questionText = questionMatch[2].trim();
                                          console.log(`🔍 전체 태그 질문 ${questionMatch[1]} 처리:`, questionText);
                                          
                                          // 순서대로 매칭 (첫 번째 질문은 가장 빈도가 높은 것과 매칭)
                                          const questionIndex = parseInt(questionMatch[1]) - 1;
                                          const matchingAnalysis = sortedBasicAnalysis[questionIndex];
                                          
                                          if (matchingAnalysis) {
                                            console.log(`✅ 전체 태그 순서 매칭 성공 (${questionIndex}):`, matchingAnalysis);
                                            return `${questionMatch[1]}${questionText} (${matchingAnalysis.count}건)`;
                                          } else {
                                            console.log(`❌ 전체 태그 순서 매칭 실패 (${questionIndex}), 키워드 매칭 시도`);
                                            
                                            // 대체 매칭: 키워드 기반
                                            const fallbackMatch = sortedBasicAnalysis.find(analysis => {
                                              const sentence = analysis.sentence || '';
                                              const questionKeywords = questionText.toLowerCase().split(/\s+/).filter(w => w.length > 1);
                                              const sentenceKeywords = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 1);
                                              
                                              const commonKeywords = questionKeywords.filter(kw => 
                                                sentenceKeywords.some(sw => sw.includes(kw) || kw.includes(sw))
                                              );
                                              
                                              return commonKeywords.length > 0;
                                            });
                                            
                                            if (fallbackMatch) {
                                              console.log(`✅ 전체 태그 키워드 매칭 성공:`, fallbackMatch);
                                              return `${questionMatch[1]}${questionText} (${fallbackMatch.count}건)`;
                                            } else {
                                              console.log(`❌ 전체 태그 키워드 매칭도 실패`);
                                            }
                                          }
                                        }
                                        return line;
                                      });
                                      
                                      const result = processedLines.join('\n');
                                      console.log('🔍 전체 태그 최종 FAQ 내용:', result);
                                      return result;
                                    } else {
                                      console.log('❌ 전체 태그 basicAnalysis가 없거나 비어있음, 원본 내용 반환');
                                      return faq.content;
                                    }
                                  })()}
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
                                backgroundColor: '#ffffff'
                              }}
                            >
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: '8px'
                              }}>
                                <div style={{
                                  flex: 1,
                                  fontSize: '14px',
                                  lineHeight: '1.5',
                                  color: '#343a40'
                                }}>
                                  • {faq.sentence}
                                </div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginLeft: '10px'
                                }}>
                                  <span style={{
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 'bold'
                                  }}>
                                    {faq.count}개 채팅
                                  </span>
                                  <button
                                    onClick={() => toggleDetails(key)}
                                    style={{
                                      padding: '2px 6px',
                                      backgroundColor: 'transparent',
                                      border: '1px solid #ced4da',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {showDetails[key] ? '접기' : '상세'}
                                  </button>
                                </div>
                              </div>
                              
                              {/* 상세 정보 */}
                              {showDetails[key] && (
                                <div style={{
                                  marginTop: '8px',
                                  padding: '8px',
                                  backgroundColor: '#f8f9fa',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  color: '#6c757d'
                                }}>
                                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                    등장한 채팅 ID ({faq.chatIds?.length || 0}개):
                                  </div>
                                  <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                    {faq.chatIds?.join(', ') || '없음'}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
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

export default PreviewFAQ;