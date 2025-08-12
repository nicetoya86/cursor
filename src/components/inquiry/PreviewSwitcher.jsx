import React from 'react';
import PreviewPlainTexts from './PreviewPlainTexts';
import PreviewFAQ from './PreviewFAQ';
import PreviewKeywords from './PreviewKeywords';
import PreviewRepresentative from './PreviewRepresentative';

const PreviewSwitcher = ({ analyzedData, settings, activeTab, onTabChange }) => {
  const tabs = [
    { id: 'plain', label: '📋 병원명·Tag·문의내용', component: PreviewPlainTexts },
    { id: 'faq', label: '❓ Tag별 자주 물어보는 내용', component: PreviewFAQ },
    { id: 'keywords', label: '🔤 Tag별 상위 키워드', component: PreviewKeywords }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 탭 헤더 */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e9ecef',
        backgroundColor: '#f8f9fa'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '12px 16px',
              border: 'none',
              backgroundColor: activeTab === tab.id ? '#007bff' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#495057',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              borderRadius: activeTab === tab.id ? '4px 4px 0 0' : '0',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.target.style.backgroundColor = '#e9ecef';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {ActiveComponent && (
          <ActiveComponent
            analyzedData={analyzedData}
            settings={settings}
          />
        )}
      </div>
    </div>
  );
};

export default PreviewSwitcher;
