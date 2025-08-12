import React, { useState } from 'react';
import { analyzeTicketsWithGPT, mockAnalyzeTickets, validateApiKey } from '../api/gptService';

const GptAnalyzer = ({ tickets, onAnalysisStart, onAnalysisComplete }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [analysisMode, setAnalysisMode] = useState('real'); // 'real', 'mock'

  const handleAnalyze = async () => {
    if (!tickets || tickets.length === 0) {
      alert('JSON 파일을 첨부해주세요.');
      setError('분석할 티켓이 없습니다. JSON 파일을 먼저 업로드해주세요.');
      return;
    }

    console.log('🚀 분석 시작:', {
      ticketCount: tickets.length,
      analysisMode,
      onAnalysisStart: !!onAnalysisStart
    });

    // 분석 시작 시 부모 컴포넌트에 알림 (필터 영역 표시)
    if (onAnalysisStart) {
      try {
        onAnalysisStart();
        console.log('✅ onAnalysisStart 호출 완료');
      } catch (error) {
        console.error('❌ onAnalysisStart 호출 오류:', error);
      }
    }

    setIsAnalyzing(true);
    setProgress(0);
    setError(null);

    try {
      let result;
      
      if (analysisMode === 'real') {
        // 실제 GPT API 모드 - API 키 검증 후 실제 분석 실행
        try {
          console.log('🔐 API 키 검증 중...');
          await validateApiKey();
          console.log('✅ API 키 검증 성공');
          
          console.log('🤖 실제 GPT API로 분석을 시작합니다...');
          result = await analyzeTicketsWithGPT(tickets, setProgress);
          
        } catch (apiError) {
          console.error('❌ GPT API 분석 실패:', apiError.message);
          
          // API 키 관련 오류인지 확인
          if (apiError.message.includes('API 키') || 
              apiError.message.includes('401') || 
              apiError.message.includes('Unauthorized')) {
            throw new Error('OpenAI API 키가 올바르지 않습니다. API 키를 확인해주세요.');
          } else if (apiError.message.includes('모델') || 
                     apiError.message.includes('o3') ||
                     apiError.message.includes('model')) {
            throw new Error('GPT o3 모델에 접근할 수 없습니다. API 키 권한을 확인해주세요.');
          } else if (apiError.message.includes('시간이 초과')) {
            throw new Error('API 요청 시간이 초과되었습니다. 다시 시도해주세요.');
          } else {
            throw new Error(`GPT API 분석 실패: ${apiError.message}`);
          }
        }
      } else {
        // 모의 분석 모드
        console.log('🎭 모의 분석 모드로 실행합니다...');
        result = await mockAnalyzeTickets(tickets, setProgress);
      }

      console.log('✅ 분석 완료:', result.summary);
      
      if (onAnalysisComplete) {
        try {
          onAnalysisComplete(result.results, result.summary);
          console.log('✅ onAnalysisComplete 호출 완료');
        } catch (error) {
          console.error('❌ onAnalysisComplete 호출 오류:', error);
          throw new Error(`분석 완료 처리 중 오류: ${error.message}`);
        }
      }
      

    } catch (error) {
      console.error('❌ 분석 오류 상세:', {
        message: error.message,
        stack: error.stack,
        analysisMode,
        ticketCount: tickets?.length || 0
      });
      
      let userMessage = '분석 중 오류가 발생했습니다.';
      if (error.message.includes('API 키')) {
        userMessage = error.message; // 구체적인 API 키 오류 메시지 사용
      } else if (error.message.includes('GPT o3 모델')) {
        userMessage = error.message; // 구체적인 모델 오류 메시지 사용
      } else if (error.message.includes('시간이 초과')) {
        userMessage = error.message; // 구체적인 타임아웃 오류 메시지 사용
      } else if (error.message.includes('네트워크')) {
        userMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
      } else {
        userMessage = `분석 오류: ${error.message}`;
      }
      
      setError(userMessage);
      alert(userMessage);
    } finally {
      setIsAnalyzing(false);
      setProgress(0);
      console.log('🔄 분석 프로세스 종료');
    }
  };

  const getAnalysisModeText = () => {
    switch (analysisMode) {
      case 'real': return '🤖 실제 GPT API';
      case 'mock': return '🎭 모의 분석 모드';
      default: return '🤖 실제 GPT API';
    }
  };

  return (
    <div className="gpt-analyzer">
      <div style={{ 
        padding: '20px', 
        border: '2px solid #007bff', 
        borderRadius: '8px',
        backgroundColor: '#f8f9ff',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#007bff', marginBottom: '15px' }}>
          🤖 GPT 기반 티켓 분석
        </h3>
        
        <p style={{ color: '#666', marginBottom: '15px' }}>
          AI가 고객 문의 내용을 정확하게 추출하고 분석합니다.
        </p>

        <div style={{ marginBottom: '15px' }}>
          <strong>분석 대상:</strong> {tickets?.length || 0}개 티켓
        </div>

        {/* 분석 모드 선택 */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            분석 모드:
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>

            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="real"
                checked={analysisMode === 'real'}
                onChange={(e) => setAnalysisMode(e.target.value)}
                disabled={isAnalyzing}
                style={{ marginRight: '5px' }}
              />
              🤖 실제 GPT API
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="mock"
                checked={analysisMode === 'mock'}
                onChange={(e) => setAnalysisMode(e.target.value)}
                disabled={isAnalyzing}
                style={{ marginRight: '5px' }}
              />
              🎭 모의 분석 (데모)
            </label>
          </div>
        </div>

        {error && (
          <div style={{ 
            color: '#dc3545', 
            backgroundColor: '#f8d7da', 
            padding: '10px', 
            borderRadius: '4px',
            marginBottom: '15px',
            border: '1px solid #f5c6cb'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>❌ 오류 발생:</strong>
                <div style={{ marginTop: '5px', fontSize: '14px' }}>
                  {error}
                </div>
                {error.includes('API 키') && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#856404' }}>
                    💡 <strong>해결 방법:</strong> 프로젝트 루트에 <code>.env</code> 파일을 생성하고 
                    <code>REACT_APP_OPENAI_API_KEY=your_api_key</code>를 추가하거나, 
                    "모의 분석" 모드를 선택해주세요.
                  </div>
                )}
              </div>
              <button 
                onClick={() => setError(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#721c24',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '0 5px'
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {isAnalyzing && (
          <div style={{ marginBottom: '15px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              marginBottom: '5px'
            }}>
              <span>분석 진행중... ({getAnalysisModeText()})</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div style={{ 
              width: '100%', 
              height: '8px', 
              backgroundColor: '#e9ecef',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${progress}%`, 
                height: '100%', 
                backgroundColor: '#007bff',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#6c757d', 
              marginTop: '5px' 
            }}>
              {analysisMode === 'real' 
                ? '실제 GPT API를 사용하여 정확한 분석을 수행중입니다...'
                : '데모용 모의 분석을 수행중입니다...'
              }
            </div>
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !tickets || tickets.length === 0}
          style={{
            backgroundColor: isAnalyzing ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {isAnalyzing ? (
            <>
              <span style={{ 
                display: 'inline-block',
                width: '16px',
                height: '16px',
                border: '2px solid #ffffff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              분석중...
            </>
          ) : (
            <>
              🚀 분석하기
            </>
          )}
        </button>

        {/* API 키 안내 */}
        {analysisMode === 'real' && (
          <div style={{ 
            marginTop: '15px',
            padding: '10px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#856404'
          }}>
            <strong>💡 실제 GPT API 사용 시:</strong>
            <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
              <li>OpenAI API 키가 필요합니다</li>
              <li>API 호출 비용이 발생할 수 있습니다 (티켓당 약 $0.01-0.02)</li>
              <li>더 정확한 고객 문의 내용 추출이 가능합니다</li>
            </ul>
          </div>
        )}

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default GptAnalyzer; 