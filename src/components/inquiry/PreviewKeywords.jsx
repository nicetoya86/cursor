import React, { useState, useMemo } from 'react';
import { analyzeKeywordsOnly } from '../../utils/channelTalkAnalyzer';

const PreviewKeywords = ({ analyzedData, settings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [keywordData, setKeywordData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ step: '', message: '', progress: 0 });

  // 디버깅을 위한 로그
  console.log('🎯 PreviewKeywords 렌더링 시작');
  console.log('🎯 analyzedData:', analyzedData);
  console.log('🎯 keywordData:', analyzedData?.keywordData);

  // 키워드 분석 실행 함수
  const handleAnalyzeKeywords = async () => {
    if (!analyzedData?.plainTextData || analyzedData.plainTextData.length === 0) {
      alert('분석할 데이터가 없습니다. 먼저 고속 분석을 실행해주세요.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress({ step: '시작', message: '키워드 분석을 시작합니다...', progress: 0 });

    try {
      console.log('🔍 키워드 분석 시작:', analyzedData.plainTextData.length, '개 데이터');
      
      const result = await analyzeKeywordsOnly(
        analyzedData.plainTextData,
        settings,
        (progress) => {
          setAnalysisProgress(progress);
        }
      );

      console.log('✅ 키워드 분석 완료:', result);
      setKeywordData(result.keywordData);
      
    } catch (error) {
      console.error('❌ 키워드 분석 오류:', error);
      alert(`키워드 분석 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress({ step: '', message: '', progress: 0 });
    }
  };

  // 태그 목록 추출 (키워드 데이터 또는 원본 데이터에서)
  const availableTags = useMemo(() => {
    // 키워드 분석 완료된 경우
    if (keywordData) {
      const tags = Object.keys(keywordData);
      console.log('🎯 키워드 분석 완료된 태그들:', tags);
      return tags.sort();
    }
    
    // 원본 데이터에서 태그 추출
    if (analyzedData?.plainTextData) {
      const tags = [...new Set(analyzedData.plainTextData.map(item => item.tag))];
      console.log('🎯 원본 데이터의 태그들:', tags);
      return tags.sort();
    }
    
    console.log('🎯 사용 가능한 태그 없음');
    return [];
  }, [keywordData, analyzedData]);

    // 키워드 데이터 변환 및 필터링
  const keywordItems = useMemo(() => {
    console.log('🎯 키워드 아이템 처리 시작');
    
    // 키워드 분석이 완료된 경우 keywordData 사용
    const dataSource = keywordData || analyzedData?.keywordData;
    
    if (!dataSource) {
      console.log('🎯 키워드 데이터 없음');
      return [];
    }

    const items = [];

    // 각 태그의 키워드 데이터 처리
    Object.entries(dataSource).forEach(([tag, data]) => {
      console.log(`🎯 태그 "${tag}" 처리 중:`, data);

      if (!data) {
        console.log(`🎯 태그 "${tag}": 데이터 없음`);
        return;
      }

      // GPT 키워드 처리
      if (data.type === 'gpt' && data.keywords && Array.isArray(data.keywords)) {
        console.log(`🎯 태그 "${tag}": GPT 키워드 처리`, data.keywords);
        
        data.keywords.forEach((keyword, index) => {
          if (keyword && typeof keyword === 'string') {
            items.push({
              id: `gpt-${tag}-${index}`,
              tag: tag,
              type: 'gpt',
                keyword: keyword.trim(),
              count: data.itemCount || 0,
              rank: index + 1
            });
          }
        });
      }

      // 기본 키워드 처리
      if (data.type === 'basic' && data.content && Array.isArray(data.content)) {
        console.log(`🎯 태그 "${tag}": 기본 키워드 처리`, data.content);
        
        data.content.forEach((item, index) => {
          if (item && item.keyword && typeof item.keyword === 'string') {
            items.push({
              id: `basic-${tag}-${index}`,
              tag: tag,
                type: 'basic',
              keyword: item.keyword.trim(),
              count: item.count || 0,
              rank: index + 1
              });
            }
          });
        }
    });

    console.log('🎯 처리된 전체 키워드 아이템:', items);

    // 필터링 적용
    let filteredItems = items;

    // 태그 필터
      if (selectedTag) {
      filteredItems = filteredItems.filter(item => item.tag === selectedTag);
      console.log(`🎯 태그 필터 적용 후 (${selectedTag}):`, filteredItems);
    }

    // 검색 필터
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
      filteredItems = filteredItems.filter(item => 
        item.keyword.toLowerCase().includes(term) || 
        item.tag.toLowerCase().includes(term)
      );
      console.log(`🎯 검색 필터 적용 후 (${searchTerm}):`, filteredItems);
    }

    // 정렬: 빈도수 높은 순으로 정렬 (GPT와 기본 분석 통합)
    filteredItems.sort((a, b) => {
      // 빈도수 기준으로 정렬 (높은 순)
      return b.count - a.count;
    });

    // 최대 10개로 제한
    const limitedItems = filteredItems.slice(0, 10);

    console.log('🎯 최종 키워드 아이템 (최대 10개):', limitedItems);
    return limitedItems;
  }, [keywordData, analyzedData, selectedTag, searchTerm]);

  // CSV 다운로드 함수
  const handleDownloadCSV = () => {
    if (keywordItems.length === 0) {
      alert('다운로드할 키워드가 없습니다.');
      return;
    }

    const csvRows = [
      ['태그', '키워드', '타입', '빈도', '순위'].join(',')
    ];

    keywordItems.forEach(item => {
      csvRows.push([
        `"${item.tag}"`,
        `"${item.keyword}"`,
        `"${item.type === 'gpt' ? 'GPT 분석' : '기본 분석'}"`,
        item.count,
        item.rank
      ].join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `키워드_분석_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

    // 데이터가 없는 경우
  if (!analyzedData) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        color: '#6c757d'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
        <h3>데이터를 먼저 분석해주세요</h3>
        <p>좌측에서 채널톡 데이터를 업로드하고 고속 분석을 실행하세요.</p>
      </div>
    );
  }

  // 고속 분석은 완료되었지만 키워드 분석이 아직 안된 경우
  if (!keywordData && (!analyzedData.keywordData || Object.keys(analyzedData.keywordData).length === 0)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        color: '#6c757d'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔍</div>
        <h3>키워드 분석을 시작하세요</h3>
        <p>고속 분석이 완료되었습니다. 아래 버튼을 클릭하여 키워드 분석을 진행하세요.</p>
        
        {isAnalyzing ? (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 'bold', 
              color: '#007bff',
              marginBottom: '10px' 
            }}>
              {analysisProgress.step}: {analysisProgress.message}
            </div>
            <div style={{
              width: '300px',
              height: '20px',
              backgroundColor: '#e9ecef',
              borderRadius: '10px',
              overflow: 'hidden',
              margin: '10px auto'
            }}>
              <div style={{
                width: `${analysisProgress.progress}%`,
                height: '100%',
                backgroundColor: '#007bff',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>
              {analysisProgress.progress.toFixed(0)}% 완료
            </div>
          </div>
        ) : (
          <button
            onClick={handleAnalyzeKeywords}
            style={{
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            🔍 키워드 분석 시작
          </button>
        )}
        
        <div style={{ 
          fontSize: '12px', 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          maxWidth: '400px'
        }}>
          <strong>분석 조건:</strong><br/>
          • Tag별 문의 내용에서 자주 언급하는 키워드 추출<br/>
          • Tag별 최대 10개 키워드, 빈도 높은 순으로 정렬<br/>
          • 인사말, 숫자, 불용어는 분석에서 제외
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 및 컨트롤 */}
      <div style={{
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderBottom: '2px solid #e9ecef'
      }}>
                <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px'
        }}>
          <h2 style={{ margin: 0, color: '#343a40' }}>
            🔍 Tag별 상위 키워드
          </h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleAnalyzeKeywords}
              disabled={isAnalyzing || !analyzedData?.plainTextData}
              style={{
                padding: '8px 16px',
                backgroundColor: isAnalyzing ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isAnalyzing || !analyzedData?.plainTextData ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {isAnalyzing ? '🔄 분석 중...' : '🔍 키워드 분석'}
            </button>
            <button
              onClick={handleDownloadCSV}
              disabled={keywordItems.length === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: keywordItems.length === 0 ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: keywordItems.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              📥 CSV 다운로드
            </button>
          </div>
        </div>

        {/* 필터 컨트롤 */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#6c757d', marginRight: '5px' }}>태그 필터:</label>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            style={{
                padding: '6px 10px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
                fontSize: '14px'
            }}
          >
            <option value="">전체 태그</option>
              {availableTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          </div>
          
          <div>
            <label style={{ fontSize: '12px', color: '#6c757d', marginRight: '5px' }}>키워드 검색:</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="키워드 입력..."
            style={{
                padding: '6px 10px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
                fontSize: '14px',
                width: '200px'
            }}
          />
          </div>
          
                    <div style={{
            padding: '6px 12px',
            backgroundColor: '#e9ecef',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#6c757d'
          }}>
            상위 {keywordItems.length}개 키워드 (최대 10개)
          </div>
        </div>

        {/* 분석 진행 상황 표시 */}
        {isAnalyzing && (
          <div style={{
            marginTop: '15px',
            padding: '15px',
            backgroundColor: '#e7f3ff',
            borderRadius: '6px',
            border: '1px solid #007bff'
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 'bold', 
              color: '#007bff',
              marginBottom: '10px' 
            }}>
              {analysisProgress.step}: {analysisProgress.message}
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#ffffff',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${analysisProgress.progress}%`,
                height: '100%',
                backgroundColor: '#007bff',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#6c757d', 
              marginTop: '5px',
              textAlign: 'right'
            }}>
              {analysisProgress.progress.toFixed(0)}% 완료
            </div>
          </div>
        )}
      </div>

      {/* 키워드 리스트 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {keywordItems.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            color: '#6c757d'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '15px' }}>🔍</div>
            <h4>조건에 맞는 키워드가 없습니다</h4>
            <p style={{ fontSize: '14px' }}>필터 조건을 변경해보세요.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* 태그별 그룹화 표시 */}
            {selectedTag ? (
              // 선택된 태그의 키워드만 표시
              <div>
                            <div style={{
                  padding: '10px 15px',
                  backgroundColor: '#e7f3ff',
                  borderLeft: '4px solid #007bff',
                  marginBottom: '15px',
                  borderRadius: '0 4px 4px 0'
                }}>
                  <h3 style={{ margin: 0, color: '#0056b3' }}>🏷️ {selectedTag}</h3>
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#6c757d' }}>
                    {keywordItems.length}개 키워드
                  </p>
                          </div>
                
                <div style={{ display: 'grid', gap: '8px' }}>
                  {keywordItems.map(item => (
                    <KeywordCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ) : (
              // 전체 태그의 키워드를 태그별로 그룹화하여 표시
              availableTags
                .filter(tag => keywordItems.some(item => item.tag === tag))
                .map(tag => {
                  const tagItems = keywordItems.filter(item => item.tag === tag);
                  return (
                    <div key={tag} style={{ marginBottom: '30px' }}>
                                  <div style={{
                        padding: '10px 15px',
                        backgroundColor: '#f8f9fa',
                        borderLeft: '4px solid #28a745',
                        marginBottom: '15px',
                        borderRadius: '0 4px 4px 0'
                      }}>
                        <h3 style={{ margin: 0, color: '#155724' }}>🏷️ {tag}</h3>
                        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#6c757d' }}>
                          {tagItems.length}개 키워드
                        </p>
                                </div>
                      
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {tagItems.map(item => (
                          <KeywordCard key={item.id} item={item} />
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

// 키워드 카드 컴포넌트 - 좌측 정렬 및 빈도수 강조
const KeywordCard = ({ item }) => {
  const isGPT = item.type === 'gpt';
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start', // 좌측 정렬
      padding: '15px 20px',
      backgroundColor: '#ffffff',
      border: '1px solid #e9ecef',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      marginBottom: '8px'
    }}>
      {/* 순위 표시 */}
      <div style={{
        minWidth: '40px',
        height: '40px',
        backgroundColor: '#007bff',
        color: 'white',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: 'bold',
        marginRight: '15px'
      }}>
        {item.rank}
      </div>
      
      {/* 키워드 정보 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          backgroundColor: isGPT ? '#007bff' : '#28a745',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 'bold'
        }}>
          {isGPT ? '🤖 GPT' : '📊 기본'}
        </div>
        
        <div style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#343a40',
          flex: 1
        }}>
          {item.keyword}
        </div>
        
        {/* 빈도수 강조 표시 */}
        <div style={{
          backgroundColor: '#28a745',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 'bold',
          minWidth: '60px',
          textAlign: 'center'
        }}>
          {item.count}회
        </div>
      </div>
    </div>
  );
};

export default PreviewKeywords;
