import React, { useState } from 'react';
import './TagAnalysis.css';

const TagAnalysis = ({ tagAnalysisData, isLoading }) => {
  const [selectedTag, setSelectedTag] = useState(null);
  const [activeTab, setActiveTab] = useState('natural'); // 'natural' 또는 'keyword'

  if (isLoading) {
    return (
      <div className="tag-analysis-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>태그별 문의 내용을 분석하고 있습니다...</p>
        </div>
      </div>
    );
  }

  console.log('🔍 TagAnalysis 데이터 확인:', tagAnalysisData);

  // 데이터 구조 확인 및 안전한 접근
  const results = tagAnalysisData?.results || {};
  const summary = tagAnalysisData?.summary || {};

  if (!tagAnalysisData || !results || Object.keys(results).length === 0) {
    return (
      <div className="tag-analysis-container">
        <div className="no-data">
          <h3>🏷️ 태그별 분석</h3>
          <p>분석할 태그별 문의 내용이 없습니다.</p>
          <small>선택한 태그에 해당하는 티켓이 없거나 분석에 실패했습니다.</small>
          {tagAnalysisData?.error && (
            <div className="error-message">
              <strong>오류:</strong> {tagAnalysisData.error}
            </div>
          )}
        </div>
      </div>
    );
  }

  const tagEntries = Object.entries(results);

  return (
    <div className="tag-analysis-container">
      <div className="tag-analysis-header">
        <h3>🏷️ 태그별 문의 분석</h3>
        <div className="analysis-summary">
          <span className="summary-item">
            📊 총 {summary.totalTags}개 태그 중 {summary.analyzedTags}개 분석
          </span>
          <span className="summary-item">
            📝 총 {summary.totalInquiries}개 문의 분석
          </span>
          {summary.isMock && (
            <span className="mock-badge">모의 분석 모드</span>
          )}
        </div>
      </div>

      <div className="tag-analysis-content">
        {/* 태그 목록 */}
        <div className="tag-list">
          <h4>분석된 태그 목록</h4>
          <div className="tag-buttons">
            {tagEntries.map(([tag, data]) => (
              <button
                key={tag}
                className={`tag-button ${selectedTag === tag ? 'active' : ''}`}
                onClick={() => setSelectedTag(tag)}
              >
                <span className="tag-name">{tag}</span>
                <span className="tag-count">({data.totalInquiries || 0}건)</span>
              </button>
            ))}
          </div>
        </div>

        {/* 선택된 태그의 상세 분석 */}
        {selectedTag && results[selectedTag] && (
          <div className="tag-detail">
            <div className="tag-detail-header">
              <h4>
                {selectedTag} 태그 분석
                <span className="inquiry-count">
                  ({results[selectedTag].totalInquiries || 0}건 문의)
                </span>
              </h4>
              
              <div className="tab-buttons">
                <button 
                  className={`tab-button ${activeTab === 'natural' ? 'active' : ''}`}
                  onClick={() => setActiveTab('natural')}
                >
                  📝 자연어 분석
                </button>
                <button 
                  className={`tab-button ${activeTab === 'keyword' ? 'active' : ''}`}
                  onClick={() => setActiveTab('keyword')}
                >
                  🔍 키워드 분석
                </button>
              </div>
            </div>

            <div className="tab-content">
              {activeTab === 'natural' && (
                <div className="natural-analysis">
                  <div className="analysis-content">
                    {(results[selectedTag].naturalLanguageAnalysis || '분석 결과가 없습니다.')
                      .split('\n')
                      .map((line, index) => {
                        // 빈 줄 처리
                        if (!line.trim()) {
                          return <br key={index} />;
                        }
                        
                        // 이모지가 포함된 헤더 라인 처리
                        if (line.includes('📊') || line.includes('🔍') || line.includes('💡') || line.includes('🎯')) {
                          return (
                            <div key={index} className="analysis-section-header">
                              {line}
                            </div>
                          );
                        }
                        
                        // 일반 헤더 처리 (** 로 시작하는 라인)
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return (
                            <div key={index} className="analysis-header">
                              {line.replace(/\*\*/g, '')}
                            </div>
                          );
                        }
                        
                        // 리스트 아이템 처리
                        if (line.match(/^\d+\.\s/) || line.startsWith('- ')) {
                          return (
                            <div key={index} className="analysis-list-item">
                              {line}
                            </div>
                          );
                        }
                        
                        // 일반 텍스트
                        return (
                          <div key={index} className="analysis-text">
                            {line}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {activeTab === 'keyword' && (
                <div className="keyword-analysis">
                  <div className="keyword-content">
                    {Array.isArray(results[selectedTag].keywordAnalysis) ? (
                      results[selectedTag].keywordAnalysis.map((keyword, index) => (
                        <div key={index} className="keyword-item">
                          <span className="keyword-text">{keyword.keyword}</span>
                          <span className="keyword-frequency">빈도: {keyword.frequency}</span>
                          <span className={`keyword-importance ${keyword.importance}`}>
                            {keyword.importance === 'high' ? '높음' : 
                             keyword.importance === 'medium' ? '보통' : '낮음'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div>키워드 분석 결과가 없습니다.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="analysis-meta">
              <small>
                분석 완료: {new Date().toLocaleString()}
                {results[selectedTag].error && (
                  <span className="error-info"> | 오류: {results[selectedTag].error}</span>
                )}
                {summary.isMock && (
                  <span className="mock-info"> | 모의 분석 모드</span>
                )}
              </small>
            </div>
          </div>
        )}

        {/* 기본 안내 메시지 */}
        {!selectedTag && (
          <div className="default-message">
            <p>👆 위의 태그를 클릭하여 상세 분석 결과를 확인하세요.</p>
            <div className="analysis-info">
              <h5>📋 분석 내용:</h5>
              <ul>
                <li><strong>자연어 분석:</strong> 태그별 주요 문의 유형, 공통 패턴, 고객 니즈 요약</li>
                <li><strong>키워드 분석:</strong> 빈도 기반 핵심 키워드 추출 (불용어 제외)</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TagAnalysis; 