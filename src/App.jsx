import React, { useCallback, useState, useEffect } from 'react';
import JsonUploader from './components/JsonUploader';
import FilterForm from './components/FilterForm';
import TicketList from './components/TicketList';
import CsvDownloadButton from './components/CsvDownloadButton';
import GptAnalyzer from './components/GptAnalyzer';
import TagAnalysis from './components/TagAnalysis';
import TagSelector from './components/TagSelector';
import InquiryAnalysisTab from './components/InquiryAnalysisTab';
import { useJsonTickets } from './hooks/useJsonTickets';
import { 
  analyzeSelectedTags, 
  mockAnalyzeSelectedTags, 
  validateApiKey 
} from './api/gptService';
import './App.css';

function App() {
  // 메인 탭 상태 관리
  const [activeTab, setActiveTab] = useState('zendesk'); // 'zendesk' | 'inquiry'
  
  // 임시 테스트 화면 상태 제거 - 바로 메인 화면 표시
  
  // GPT 분석 관련 상태 (useJsonTickets 이전에 정의)
  const [analyzedTickets, setAnalyzedTickets] = useState([]);
  const [showAnalyzedResults, setShowAnalyzedResults] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState(null);
  const [showFilterAndResults, setShowFilterAndResults] = useState(false);
  
  // 태그별 분석 관련 상태
  const [tagAnalysisData, setTagAnalysisData] = useState(null);
  const [isTagAnalyzing, setIsTagAnalyzing] = useState(false);
  const [showTagAnalysis, setShowTagAnalysis] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  // const [selectedTags, setSelectedTags] = useState([]); // 현재 사용하지 않음
  
  // JSON 티켓 관리 훅 사용 (분석된 티켓 전달)
  const {
    allTickets,
    filteredTickets,
    fileName,
    suggestions,
    isLoading,
    error: jsonError,
    hasData,
    totalCount,
    filteredCount,
    isFiltered,
    loadTickets,
    applyFilters,
    clearError,
    clearData
  } = useJsonTickets(analyzedTickets);

  // JSON 데이터 로드 핸들러
  const handleDataLoaded = useCallback((tickets, filename) => {
    loadTickets(tickets, filename);
    // 새 데이터 로드시 분석 결과 초기화
    setAnalyzedTickets([]);
    setShowAnalyzedResults(false);
    setAnalysisSummary(null);
    setShowFilterAndResults(false); // 새 데이터 로드 시 필터 영역 숨기기
    // 태그별 분석 결과도 초기화
    setTagAnalysisData(null);
    setShowTagAnalysis(false);
    setIsTagAnalyzing(false);
    setShowTagSelector(false);
    // setSelectedTags([]); // 현재 사용하지 않음
  }, [loadTickets]);

  // 분석 시작 핸들러 (분석하기 버튼 클릭 시 호출)
  const handleAnalysisStart = useCallback(() => {
    try {
      console.log('🚀 App.jsx - 분석 시작 핸들러 호출:', {
        hasData,
        allTicketsCount: allTickets?.length || 0,
        showFilterAndResults
      });
      
      setShowFilterAndResults(true);
      console.log('✅ showFilterAndResults = true 설정 완료');
    } catch (error) {
      console.error('❌ handleAnalysisStart 오류:', error);
    }
  }, [hasData, allTickets, showFilterAndResults]);

  // GPT 분석 완료 핸들러
  const handleAnalysisComplete = useCallback((analyzed, summary) => {
    console.log('🎯 handleAnalysisComplete 호출됨:', {
      analyzedCount: analyzed?.length || 0,
      summary
    });
    
    if (!analyzed || !Array.isArray(analyzed)) {
      console.error('❌ 잘못된 분석 결과:', analyzed);
      alert('분석 결과가 올바르지 않습니다.');
      return;
    }
    
    setAnalyzedTickets(analyzed);
    setAnalysisSummary(summary);
    setShowAnalyzedResults(true);
    console.log('✅ 분석 완료 처리:', {
      analyzedTicketsSet: analyzed.length,
      summarySet: !!summary,
      showAnalyzedResultsSet: true
    });
  }, []);

  // 분석 결과 토글
  const toggleAnalysisView = useCallback(() => {
    setShowAnalyzedResults(!showAnalyzedResults);
  }, [showAnalyzedResults]);

  // 태그별 분석 시작 핸들러 (태그 선택기 표시)
  const handleTagAnalysisStart = useCallback(() => {
    if (allTickets.length === 0) {
      alert('먼저 데이터를 업로드해주세요.');
      return;
    }

    setShowTagSelector(true);
    setTagAnalysisData(null);
    setShowTagAnalysis(false);
  }, [allTickets]);

  // 태그 선택 핸들러
  const handleTagSelect = useCallback((tags) => {
    // setSelectedTags(tags); // 현재 TagSelector 내에서 관리
    console.log('선택된 태그:', tags);
  }, []);

  // 선택된 태그별 분석 실행 핸들러
  const handleSelectedTagAnalysis = useCallback(async (selectedTagsList) => {
    if (selectedTagsList.length === 0) {
      alert('분석할 태그를 선택해주세요.');
      return;
    }

    setIsTagAnalyzing(true);
    setShowTagAnalysis(true);

    try {
      console.log('🏷️ 선택된 태그별 분석 시작...', selectedTagsList.length, '개 태그');
      
      let result;
      try {
        // API 키 검증 후 실제 GPT 분석 시도
        console.log('🔐 API 키 검증 시도...');
        await validateApiKey();
        console.log('✅ API 키 검증 성공, 실제 GPT 분석 진행...');
        result = await analyzeSelectedTags(allTickets, selectedTagsList);
        console.log('✅ 실제 선택된 태그별 분석 완료:', result);
      } catch (apiError) {
        console.log('⚠️ API 오류 발생:', apiError.message);
        console.log('🔄 모의 분석 모드로 전환...');
        
        // 사용자에게 알림
        if (apiError.message.includes('API 키가 유효하지 않습니다')) {
          console.log('💡 API 키 문제로 모의 분석 모드 사용');
        }
        
        try {
          result = await mockAnalyzeSelectedTags(allTickets, selectedTagsList);
          console.log('✅ 모의 선택된 태그별 분석 완료:', result);
        } catch (mockError) {
          console.error('❌ 모의 분석도 실패:', mockError);
          throw new Error(`분석 실패: ${mockError.message}`);
        }
      }
      
      setTagAnalysisData(result);
    } catch (error) {
      console.error('❌ 선택된 태그별 분석 실패:', error);
      alert('태그별 분석 중 오류가 발생했습니다: ' + error.message);
      setShowTagAnalysis(false);
    } finally {
      setIsTagAnalyzing(false);
    }
  }, [allTickets]);

  // 기존 태그별 분석 실행 핸들러는 새로운 방식으로 대체됨

  // 태그별 분석 결과 토글
  const toggleTagAnalysisView = useCallback(() => {
    setShowTagAnalysis(!showTagAnalysis);
  }, [showTagAnalysis]);

  // 에러 핸들러
  const handleError = useCallback((errorMessage) => {
    console.error('파일 처리 오류:', errorMessage);
    
    // 더 사용자 친화적인 에러 메시지 표시
    let displayMessage = errorMessage;
    
    if (errorMessage.includes('JSON 형식이 올바르지 않습니다')) {
      displayMessage = `JSON 파일 형식 오류\n\n${errorMessage}\n\n파일이 올바른 JSON 형식인지 확인해주세요.`;
    } else if (errorMessage.includes('티켓 데이터를 찾을 수 없습니다')) {
      displayMessage = `데이터 구조 오류\n\n${errorMessage}`;
    }
    
    alert(displayMessage);
  }, []);

  // 필터 적용 핸들러
  const handleFilter = useCallback((filters) => {
    applyFilters(filters);
  }, [applyFilters]);

  // 디버그용 useEffect - 상태 변화 모니터링
  useEffect(() => {
    console.log('🔍 App 상태 변화:', {
      showFilterAndResults,
      hasData,
      allTicketsCount: allTickets?.length || 0,
      filteredTicketsCount: filteredTickets?.length || 0,
      analyzedTicketsCount: analyzedTickets?.length || 0,
      showAnalyzedResults
    });
  }, [showFilterAndResults, hasData, allTickets, filteredTickets, analyzedTickets, showAnalyzedResults]);

  // 바로 메인 애플리케이션 표시

  return (
    <div className="App">
      {/* 탭 네비게이션 */}
      <div style={{
        backgroundColor: '#f8f9fa',
        borderBottom: '2px solid #e9ecef',
        display: 'flex',
        justifyContent: 'center',
        padding: '10px 0'
      }}>
        <div style={{ display: 'flex' }}>
          <button
            onClick={() => setActiveTab('zendesk')}
            style={{
              padding: '15px 30px',
              border: 'none',
              backgroundColor: activeTab === 'zendesk' ? '#007bff' : 'transparent',
              color: activeTab === 'zendesk' ? 'white' : '#495057',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              borderRadius: activeTab === 'zendesk' ? '8px 8px 0 0' : '0',
              transition: 'all 0.2s'
            }}
          >
            🎫 Zendesk 티켓 분석
          </button>
          <button
            onClick={() => setActiveTab('inquiry')}
            style={{
              padding: '15px 30px',
              border: 'none',
              backgroundColor: activeTab === 'inquiry' ? '#007bff' : 'transparent',
              color: activeTab === 'inquiry' ? 'white' : '#495057',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              borderRadius: activeTab === 'inquiry' ? '8px 8px 0 0' : '0',
              transition: 'all 0.2s'
            }}
          >
            📊 문의 분석 (채널톡)
          </button>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'zendesk' ? (
        <div className="container">
        {/* 헤더 */}
        <header className="app-header">
          <h1>🎫 Zendesk 티켓 분석기</h1>
          <p>🤖 GPT AI 기반 고객 문의 내용 추출 및 분석 시스템</p>
        </header>

        {/* 에러 표시 */}
        {jsonError && (
          <div className="error">
            <strong>오류가 발생했습니다:</strong><br />
            {jsonError}
            <button 
              onClick={clearError}
              style={{ 
                marginLeft: '10px', 
                padding: '2px 8px', 
                fontSize: '12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              닫기
            </button>
          </div>
        )}

        {/* JSON 파일 업로드 */}
        {!hasData && (
          <JsonUploader 
            onDataLoaded={handleDataLoaded}
            onError={handleError}
          />
        )}

        {/* 데이터가 로드된 후의 UI */}
        {hasData && (
          <>
            {/* 데이터 관리 섹션 */}
            <div className="data-management">
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                  <div style={{ flex: '1', minWidth: '250px' }}>
                    <h3 style={{ margin: '0 0 8px 0' }}>📊 로드된 데이터</h3>
                    <p style={{ margin: 0 }}>
                      <strong>{fileName}</strong> - {totalCount.toLocaleString()}개 티켓
                      {isFiltered && (
                        <span> (필터링: {filteredCount.toLocaleString()}개)</span>
                      )}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                    {/* CSV 다운로드 버튼 */}
                    {(showAnalyzedResults ? analyzedTickets : filteredTickets).length > 0 && (
                      <CsvDownloadButton 
                        tickets={showAnalyzedResults ? analyzedTickets : filteredTickets} 
                        disabled={isLoading} 
                      />
                    )}
                    {/* 새 파일 업로드 버튼 */}
                    <button 
                      className="btn btn-secondary"
                      onClick={clearData}
                      disabled={isLoading}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      새 파일 업로드
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* GPT 분석 섹션 */}
            <GptAnalyzer 
              tickets={allTickets}
              onAnalysisStart={handleAnalysisStart}
              onAnalysisComplete={handleAnalysisComplete}
            />

            {/* 분석 결과 토글 */}
            {analyzedTickets.length > 0 && (
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={toggleAnalysisView}
                    style={{ 
                      backgroundColor: showAnalyzedResults ? '#28a745' : '#007bff',
                      borderColor: showAnalyzedResults ? '#28a745' : '#007bff'
                    }}
                  >
                    {showAnalyzedResults ? '📊 GPT 분석 결과 보기' : '📋 전체 티켓 보기'}
                  </button>
                  
                  <button 
                    className="btn btn-secondary"
                    onClick={handleTagAnalysisStart}
                    disabled={isTagAnalyzing}
                    style={{ 
                      backgroundColor: '#6f42c1',
                      borderColor: '#6f42c1',
                      color: 'white'
                    }}
                  >
                    {isTagAnalyzing ? '🔄 태그별 분석 중...' : '🏷️ 태그별 분석'}
                  </button>
                  
                  {tagAnalysisData && (
                    <button 
                      className="btn btn-info"
                      onClick={toggleTagAnalysisView}
                      style={{ 
                        backgroundColor: showTagAnalysis ? '#17a2b8' : '#6c757d',
                        borderColor: showTagAnalysis ? '#17a2b8' : '#6c757d'
                      }}
                    >
                      {showTagAnalysis ? '📈 태그 분석 숨기기' : '📈 태그 분석 보기'}
                    </button>
                  )}
                </div>
                
                {analysisSummary && (
                  <div style={{ 
                    marginTop: '15px', 
                    padding: '15px', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#495057'
                  }}>
                    <strong>📈 분석 요약:</strong> 
                    {typeof analysisSummary === 'object' && analysisSummary !== null ? (
                      <div style={{ marginTop: '8px' }}>
                        전체 {analysisSummary.total || 0}개 중 {analysisSummary.analyzed || 0}개 분석 완료
                        {(analysisSummary.excluded || 0) > 0 && ` (${analysisSummary.excluded}개 제외)`}
                        {analysisSummary.isMock && ' (모의 분석 모드)'}
                      </div>
                    ) : (
                      ` ${analysisSummary || '분석 정보 없음'}`
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 필터링 폼 - 분석하기 버튼 클릭 후에만 표시 */}
        {showFilterAndResults && hasData && (
          <FilterForm 
            tickets={allTickets}
            onFilter={handleFilter}
            suggestions={suggestions}
          />
        )}

        {/* 태그 선택기 */}
        {showTagSelector && (
          <TagSelector 
            tickets={allTickets}
            suggestions={suggestions}
            onTagSelect={handleTagSelect}
            onAnalyze={handleSelectedTagAnalysis}
            isAnalyzing={isTagAnalyzing}
          />
        )}

        {/* 태그별 분석 결과 */}
        {showTagAnalysis && tagAnalysisData && (
          <TagAnalysis 
            tagAnalysisData={tagAnalysisData}
            isLoading={isTagAnalyzing}
          />
        )}

        {/* 티켓 목록 - 분석하기 버튼 클릭 후에만 표시 */}
        {showFilterAndResults && hasData && (
          <TicketList 
            tickets={filteredTickets}
            loading={isLoading}
            error={null}
            isAnalyzed={analyzedTickets.length > 0}
          />
        )}
        </div>
      ) : (
        <InquiryAnalysisTab />
      )}
    </div>
  );
}

export default App; 