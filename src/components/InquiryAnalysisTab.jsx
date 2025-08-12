import React, { useState, useMemo } from 'react';
import DataPanel from './inquiry/DataPanel';
import PreviewSwitcher from './inquiry/PreviewSwitcher';
import SettingsPanel from './inquiry/SettingsPanel';
import DownloadPanel from './inquiry/DownloadPanel';
import { analyzeChannelTalkData } from '../utils/channelTalkAnalyzer';

const InquiryAnalysisTab = () => {
  // 데이터 상태
  const [userChatData, setUserChatData] = useState([]);
  const [messageData, setMessageData] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // 분석 결과 상태
  const [analyzedData, setAnalyzedData] = useState(null);
  
  // 설정 상태
  const [settings, setSettings] = useState({
    stopWords: ['안녕하세요', '감사합니다', '확인 부탁드립니다', '문의드립니다'],
    questionWords: ['어떻게', '언제', '어디서', '무엇을', '왜', '가능한가요', '되나요', '인가요'],
    topN: {
      faq: 5,
      keywords: 10
    },
    minChatCount: 2
  });
  
  // 미리보기 탭 상태
  const [activePreviewTab, setActivePreviewTab] = useState('plain'); // 'plain' | 'faq' | 'keywords' | 'representative'
  
  // 데이터 업로드 핸들러
  const handleDataUpload = (userChats, messages) => {
    console.log('📊 데이터 업로드:', {
      userChats: userChats.length,
      messages: messages.length
    });
    
    setUserChatData(userChats);
    setMessageData(messages);
    setIsDataLoaded(true);
    setAnalyzedData(null); // 새 데이터 업로드 시 기존 분석 결과 초기화
  };
  
  // 분석 실행 핸들러
  const handleAnalyze = async (onProgress) => {
    if (!isDataLoaded || userChatData.length === 0 || messageData.length === 0) {
      alert('분석할 데이터를 먼저 업로드해주세요.');
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      console.log('⚡ 고속 채널톡 데이터 분석 시작...');
      
      const result = await analyzeChannelTalkData(
        userChatData,
        messageData,
        settings,
        onProgress
      );
      
      console.log('✅ 고속 분석 완료:', result.summary);
      console.log('🔍 분석 결과 전체 구조:', result);
      console.log('🔍 키워드 데이터 존재:', !!result.keywordData);
      console.log('🔍 키워드 데이터 키들:', result.keywordData ? Object.keys(result.keywordData) : 'null');
      console.log('🔍 키워드 데이터 내용:', result.keywordData);
      if (result.performance) {
        console.log('🚀 성능 정보:', result.performance);
      }
      setAnalyzedData(result);
      
    } catch (error) {
      console.error('❌ 분석 오류:', error);
      alert(`분석 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // 설정 업데이트 핸들러
  const handleSettingsUpdate = (newSettings) => {
    setSettings(newSettings);
    // 설정 변경 시 재분석 필요 알림
    if (analyzedData) {
      console.log('⚠️ 설정이 변경되었습니다. 재분석이 필요합니다.');
    }
  };
  
  // 통계 정보 계산
  const stats = useMemo(() => {
    if (!analyzedData) return null;
    
    return {
      totalHospitals: analyzedData.plainTextData ? 
        new Set(analyzedData.plainTextData.map(item => item.name)).size : 0,
      totalTags: analyzedData.plainTextData ? 
        new Set(analyzedData.plainTextData.map(item => item.tag)).size : 0,
      totalChats: analyzedData.plainTextData ? analyzedData.plainTextData.length : 0,
      totalFAQs: analyzedData.faqData ? 
        Object.values(analyzedData.faqData).reduce((sum, data) => {
          if (data.type === 'gpt') return sum + 1; // GPT는 전체 응답으로 카운트
          return sum + (data.content?.length || 0);
        }, 0) : 0
    };
  }, [analyzedData]);

  return (
    <div className="inquiry-analysis-tab">
      {/* 헤더 */}
      <div style={{ 
        padding: '20px',
        borderBottom: '2px solid #e9ecef',
        backgroundColor: '#f8f9fa'
      }}>
        <h2 style={{ 
          margin: 0,
          color: '#343a40',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          📊 문의 분석 (채널톡 데이터)
        </h2>
        <p style={{ 
          margin: '8px 0 0 0',
          color: '#6c757d',
          fontSize: '14px'
        }}>
          채널톡에서 추출한 UserChat/Message 데이터를 분석하여 병원별, 태그별 문의 인사이트를 제공합니다.
        </p>
        
        {/* 통계 정보 */}
        {stats && (
          <div style={{
            display: 'flex',
            gap: '20px',
            marginTop: '15px',
            flexWrap: 'wrap'
          }}>
            <div style={{ fontSize: '12px', color: '#495057' }}>
              🏥 병원: <strong>{stats.totalHospitals}개</strong>
            </div>
            <div style={{ fontSize: '12px', color: '#495057' }}>
              🏷️ 태그: <strong>{stats.totalTags}개</strong>
            </div>
            <div style={{ fontSize: '12px', color: '#495057' }}>
              💬 채팅: <strong>{stats.totalChats}개</strong>
            </div>
            <div style={{ fontSize: '12px', color: '#495057' }}>
              ❓ FAQ: <strong>{stats.totalFAQs}개</strong>
            </div>
          </div>
        )}
      </div>
      
      {/* 메인 컨텐츠 */}
      <div style={{ 
        display: 'flex',
        minHeight: 'calc(100vh - 140px)'
      }}>
        {/* 좌측 패널 */}
        <div style={{
          width: '300px',
          borderRight: '1px solid #e9ecef',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 데이터 패널 */}
          <DataPanel
            onDataUpload={handleDataUpload}
            isDataLoaded={isDataLoaded}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            userChatCount={userChatData.length}
            messageCount={messageData.length}
          />
          
          {/* 설정 패널 */}
          <SettingsPanel
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
          />
          
          {/* 다운로드 패널 */}
          {analyzedData && (
            <DownloadPanel
              analyzedData={analyzedData}
              settings={settings}
            />
          )}
        </div>
        
        {/* 우측 미리보기 영역 */}
        <div style={{ flex: 1, backgroundColor: '#ffffff' }}>
          {analyzedData ? (
            <PreviewSwitcher
              analyzedData={analyzedData}
              settings={settings}
              activeTab={activePreviewTab}
              onTabChange={setActivePreviewTab}
            />
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              color: '#6c757d'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
              <h3 style={{ margin: '0 0 10px 0' }}>데이터를 업로드하고 분석을 실행해주세요</h3>
              <p style={{ margin: 0, fontSize: '14px' }}>
                좌측에서 UserChat과 Message 데이터를 업로드한 후 분석 버튼을 클릭하세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InquiryAnalysisTab;
