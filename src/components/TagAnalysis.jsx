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

  if (!tagAnalysisData || !tagAnalysisData.tagAnalysis || Object.keys(tagAnalysisData.tagAnalysis).length === 0) {
    return (
      <div className="tag-analysis-container">
        <div className="no-data">
          <h3>🏷️ 태그별 분석</h3>
          <p>분석할 태그별 문의 내용이 없습니다.</p>
          <small>최소 3개 이상의 문의가 있는 태그만 분석됩니다.</small>
        </div>
      </div>
    );
  }

  const tagEntries = Object.entries(tagAnalysisData.tagAnalysis);
  const summary = tagAnalysisData.summary;

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
                <span className="tag-name">{data.tagName}</span>
                <span className="tag-count">({data.inquiryCount}건)</span>
              </button>
            ))}
          </div>
        </div>

        {/* 선택된 태그의 상세 분석 */}
        {selectedTag && tagAnalysisData.tagAnalysis[selectedTag] && (
          <div className="tag-detail">
            <div className="tag-detail-header">
              <h4>
                {tagAnalysisData.tagAnalysis[selectedTag].tagName} 태그 분석
                <span className="inquiry-count">
                  ({tagAnalysisData.tagAnalysis[selectedTag].inquiryCount}건 문의
                  {tagAnalysisData.tagAnalysis[selectedTag].ticketCount && 
                    ` / ${tagAnalysisData.tagAnalysis[selectedTag].ticketCount}개 티켓`
                  })
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
                    {tagAnalysisData.tagAnalysis[selectedTag].naturalLanguageAnalysis
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
                    {tagAnalysisData.tagAnalysis[selectedTag].keywordAnalysis
                      .split('\n')
                      .filter(line => line.trim())
                      .map((line, index) => {
                        // 이모지가 포함된 섹션 헤더 처리
                        if (line.includes('🔑') || line.includes('📈')) {
                          return (
                            <div key={index} className="keyword-section-header">
                              {line}
                            </div>
                          );
                        }
                        
                        // 키워드 리스트 아이템 처리 (번호가 있는 경우)
                        if (line.match(/^\d+\.\s\*\*.*\*\*/)) {
                          const parts = line.split(' | ');
                          const keywordPart = parts[0]; // "1. **키워드** - 빈도 X회 (X%)"
                          const category = parts[1] || ''; // 분류
                          const description = parts[2] || ''; // 설명
                          
                          return (
                            <div key={index} className="keyword-list-item">
                              <div className="keyword-main">
                                {keywordPart}
                              </div>
                              {category && (
                                <div className="keyword-category">
                                  <span className="category-badge">{category}</span>
                                </div>
                              )}
                              {description && (
                                <div className="keyword-description">
                                  {description}
                                </div>
                              )}
                            </div>
                          );
                        }
                        
                        // 일반 리스트 아이템
                        if (line.startsWith('- ')) {
                          return (
                            <div key={index} className="keyword-trend-item">
                              {line}
                            </div>
                          );
                        }
                        
                        // 일반 텍스트
                        return (
                          <div key={index} className="keyword-text">
                            {line}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="analysis-meta">
              <small>
                분석 완료: {new Date(tagAnalysisData.tagAnalysis[selectedTag].processedAt).toLocaleString()}
                {tagAnalysisData.tagAnalysis[selectedTag].error && (
                  <span className="error-info"> | 오류: {tagAnalysisData.tagAnalysis[selectedTag].error}</span>
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