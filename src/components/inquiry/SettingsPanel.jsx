import React, { useState } from 'react';

const SettingsPanel = ({ settings, onSettingsUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSettingChange = (path, value) => {
    const newSettings = { ...localSettings };
    
    // 중첩된 객체 경로 처리
    const keys = path.split('.');
    let current = newSettings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    
    setLocalSettings(newSettings);
    onSettingsUpdate(newSettings);
  };

  const handleArrayChange = (path, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    handleSettingChange(path, array);
  };

  const addStopWord = () => {
    const word = window.prompt('추가할 불용어를 입력하세요:');
    if (word && word.trim()) {
      const newStopWords = [...localSettings.stopWords, word.trim()];
      handleSettingChange('stopWords', newStopWords);
    }
  };

  const removeStopWord = (index) => {
    const newStopWords = localSettings.stopWords.filter((_, i) => i !== index);
    handleSettingChange('stopWords', newStopWords);
  };

  const addQuestionWord = () => {
    const word = window.prompt('추가할 질문어를 입력하세요:');
    if (word && word.trim()) {
      const newQuestionWords = [...localSettings.questionWords, word.trim()];
      handleSettingChange('questionWords', newQuestionWords);
    }
  };

  const removeQuestionWord = (index) => {
    const newQuestionWords = localSettings.questionWords.filter((_, i) => i !== index);
    handleSettingChange('questionWords', newQuestionWords);
  };

  return (
    <div style={{
      borderBottom: '1px solid #e9ecef',
      backgroundColor: '#ffffff'
    }}>
      {/* 헤더 */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '15px 20px',
          cursor: 'pointer',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h3 style={{ 
          margin: 0,
          fontSize: '16px',
          color: '#343a40'
        }}>
          ⚙️ 분석 설정
        </h3>
        <span style={{ 
          fontSize: '14px',
          color: '#6c757d'
        }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {/* 설정 내용 */}
      {isExpanded && (
        <div style={{ padding: '15px 20px' }}>
          {/* Top N 설정 */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ 
              fontSize: '14px',
              margin: '0 0 10px 0',
              color: '#343a40'
            }}>
              📊 Top N 설정
            </h4>
            
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <div>
                <label style={{ 
                  display: 'block',
                  fontSize: '12px',
                  marginBottom: '5px',
                  color: '#495057'
                }}>
                  FAQ 상위 개수:
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={localSettings.topN.faq}
                  onChange={(e) => handleSettingChange('topN.faq', parseInt(e.target.value))}
                  style={{
                    width: '60px',
                    padding: '4px 8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ 
                  display: 'block',
                  fontSize: '12px',
                  marginBottom: '5px',
                  color: '#495057'
                }}>
                  키워드 상위 개수:
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={localSettings.topN.keywords}
                  onChange={(e) => handleSettingChange('topN.keywords', parseInt(e.target.value))}
                  style={{
                    width: '60px',
                    padding: '4px 8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 최소 등장 채팅수 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block',
              fontSize: '14px',
              marginBottom: '5px',
              color: '#343a40'
            }}>
              🎯 최소 등장 채팅수:
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={localSettings.minChatCount}
              onChange={(e) => handleSettingChange('minChatCount', parseInt(e.target.value))}
              style={{
                width: '80px',
                padding: '6px 10px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            />
            <div style={{ 
              fontSize: '11px', 
              color: '#6c757d', 
              marginTop: '3px' 
            }}>
              이 수치 이상 등장한 FAQ/키워드만 표시
            </div>
          </div>



          {/* 불용어 설정 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <h4 style={{ 
                fontSize: '14px',
                margin: 0,
                color: '#343a40'
              }}>
                🚫 불용어 사전
              </h4>
              <button
                onClick={addStopWord}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                + 추가
              </button>
            </div>
            
            <div style={{
              maxHeight: '100px',
              overflowY: 'auto',
              border: '1px solid #e9ecef',
              borderRadius: '4px',
              padding: '8px'
            }}>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '4px' 
              }}>
                {localSettings.stopWords.map((word, index) => (
                  <span
                    key={index}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      backgroundColor: '#e9ecef',
                      padding: '2px 6px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: '#495057'
                    }}
                  >
                    {word}
                    <button
                      onClick={() => removeStopWord(index)}
                      style={{
                        marginLeft: '4px',
                        background: 'none',
                        border: 'none',
                        color: '#6c757d',
                        cursor: 'pointer',
                        fontSize: '10px',
                        padding: '0'
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 질문어 설정 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <h4 style={{ 
                fontSize: '14px',
                margin: 0,
                color: '#343a40'
              }}>
                ❓ 질문어 사전
              </h4>
              <button
                onClick={addQuestionWord}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                + 추가
              </button>
            </div>
            
            <div style={{
              maxHeight: '100px',
              overflowY: 'auto',
              border: '1px solid #e9ecef',
              borderRadius: '4px',
              padding: '8px'
            }}>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '4px' 
              }}>
                {localSettings.questionWords.map((word, index) => (
                  <span
                    key={index}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      backgroundColor: '#d1ecf1',
                      padding: '2px 6px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: '#0c5460'
                    }}
                  >
                    {word}
                    <button
                      onClick={() => removeQuestionWord(index)}
                      style={{
                        marginLeft: '4px',
                        background: 'none',
                        border: 'none',
                        color: '#0c5460',
                        cursor: 'pointer',
                        fontSize: '10px',
                        padding: '0'
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 설정 초기화 */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => {
                const defaultSettings = {
                  stopWords: ['안녕하세요', '감사합니다', '확인 부탁드립니다', '문의드립니다'],
                  questionWords: ['어떻게', '언제', '어디서', '무엇을', '왜', '가능한가요', '되나요', '인가요'],
                  topN: { faq: 5, keywords: 10 },
                  minChatCount: 2
                };
                setLocalSettings(defaultSettings);
                onSettingsUpdate(defaultSettings);
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: '#ffc107',
                color: '#212529',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🔄 기본값으로 초기화
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
