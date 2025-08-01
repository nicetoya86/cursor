import React, { useCallback, useState, useEffect } from 'react';
import JsonUploader from './components/JsonUploader';
import FilterForm from './components/FilterForm';
import TicketList from './components/TicketList';
import CsvDownloadButton from './components/CsvDownloadButton';
import GptAnalyzer from './components/GptAnalyzer';
import { useJsonTickets } from './hooks/useJsonTickets';
import './App.css';

function App() {
  // 임시 테스트 화면 상태
  const [showFullApp, setShowFullApp] = useState(false);
  
  // GPT 분석 관련 상태 (useJsonTickets 이전에 정의)
  const [analyzedTickets, setAnalyzedTickets] = useState([]);
  const [showAnalyzedResults, setShowAnalyzedResults] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState(null);
  const [showFilterAndResults, setShowFilterAndResults] = useState(false);
  
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
    setAnalyzedTickets(analyzed);
    setAnalysisSummary(summary);
    setShowAnalyzedResults(true);
    console.log('✅ 분석 완료:', summary);
  }, []);

  // 분석 결과 토글
  const toggleAnalysisView = useCallback(() => {
    setShowAnalyzedResults(!showAnalyzedResults);
  }, [showAnalyzedResults]);

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

  // 임시 테스트 화면
  if (!showFullApp) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>🎫 Zendesk 티켓 분석기</h1>
        <p>배포 테스트 성공! 🎉</p>
        <button 
          onClick={() => setShowFullApp(true)}
          style={{ 
            padding: '10px 20px', 
            fontSize: '16px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px', 
            cursor: 'pointer' 
          }}
        >
          전체 앱 실행
        </button>
      </div>
    );
  }

  return (
    <div className="App">
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
    </div>
  );
}

export default App; 