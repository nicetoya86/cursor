import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const DownloadPanel = ({ analyzedData, settings }) => {
  const [selectedSheets, setSelectedSheets] = useState({
    plainText: true,
    faq: true,
    keywords: true,
    representative: true
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // 엑셀 파일 생성 함수
  const generateExcelFile = () => {
    if (!analyzedData) {
      alert('분석 데이터가 없습니다.');
      return;
    }

    setIsGenerating(true);

    try {
      const workbook = XLSX.utils.book_new();
      const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

      // 1. 병원명·Tag·문의내용 시트
      if (selectedSheets.plainText && analyzedData.plainTextData) {
        const plainTextData = analyzedData.plainTextData.map(item => ({
          '병원명': item.name,
          'Tag': item.tag,
          '문의내용': item.plainText,
          'ChatID': item.chatId
        }));

        const ws1 = XLSX.utils.json_to_sheet(plainTextData);
        XLSX.utils.book_append_sheet(workbook, ws1, '1_문의내용');
      }

      // 2. FAQ 시트
      if (selectedSheets.faq && analyzedData.faqData) {
        const faqData = [];
        Object.entries(analyzedData.faqData).forEach(([tag, faqs]) => {
          faqs.forEach(faq => {
            faqData.push({
              'Tag': tag,
              '자주 물어보는 내용': faq.sentence,
              '등장 채팅수': faq.count,
              '채팅 ID 목록': faq.chatIds.join(', ')
            });
          });
        });

        if (faqData.length > 0) {
          const ws2 = XLSX.utils.json_to_sheet(faqData);
          XLSX.utils.book_append_sheet(workbook, ws2, '2_FAQ');
        }
      }

      // 3. 키워드 시트
      if (selectedSheets.keywords && analyzedData.keywordData) {
        const keywordData = [];
        Object.entries(analyzedData.keywordData).forEach(([tag, keywords]) => {
          const keywordTexts = keywords.map(k => `${k.keyword}(${k.count})`).join(', ');
          keywordData.push({
            'Tag': tag,
            '상위 키워드': keywordTexts,
            '총 키워드 수': keywords.length
          });
        });

        if (keywordData.length > 0) {
          const ws3 = XLSX.utils.json_to_sheet(keywordData);
          XLSX.utils.book_append_sheet(workbook, ws3, '3_키워드');
        }
      }

      // 4. 대표 메시지 시트
      if (selectedSheets.representative && analyzedData.representativeData) {
        const representativeData = analyzedData.representativeData.map(item => ({
          '병원명': item.name,
          'ChatID': item.chatId,
          '태그들': item.tags,
          '대표 문의내용': item.plainText
        }));

        const ws4 = XLSX.utils.json_to_sheet(representativeData);
        XLSX.utils.book_append_sheet(workbook, ws4, '4_대표메시지');
      }

      // 5. 분석 요약 시트
      const summaryData = [
        { '항목': '전체 채팅수', '값': analyzedData.summary.totalChats },
        { '항목': '전체 태그수', '값': analyzedData.summary.totalTags },
        { '항목': '전체 병원수', '값': analyzedData.summary.totalHospitals },
        { '항목': '전체 FAQ수', '값': analyzedData.summary.totalFAQs },
        { '항목': '전체 키워드수', '값': analyzedData.summary.totalKeywords },
        { '항목': '분석 일시', '값': new Date(analyzedData.summary.processedAt).toLocaleString('ko-KR') },
        { '항목': 'FAQ Top N', '값': settings.topN.faq },
        { '항목': '키워드 Top N', '값': settings.topN.keywords },
        { '항목': '최소 등장 채팅수', '값': settings.minChatCount },
        { '항목': '대표 메시지 규칙', '값': 
          settings.representativeMessageRule === 'longest' ? '최장 문장' :
          settings.representativeMessageRule === 'latest' ? '최신 메시지' :
          settings.representativeMessageRule === 'question_first' ? '질문 우선' :
          '최장 문장'
        }
      ];

      const ws5 = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, ws5, '0_분석요약');

      // 파일 다운로드
      const fileName = `channeltalk_analysis_${currentDate}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      console.log('✅ 엑셀 파일 생성 완료:', fileName);

    } catch (error) {
      console.error('❌ 엑셀 파일 생성 오류:', error);
      alert(`엑셀 파일 생성 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSheetToggle = (sheetType) => {
    setSelectedSheets(prev => ({
      ...prev,
      [sheetType]: !prev[sheetType]
    }));
  };

  const selectAllSheets = () => {
    setSelectedSheets({
      plainText: true,
      faq: true,
      keywords: true,
      representative: true
    });
  };

  const deselectAllSheets = () => {
    setSelectedSheets({
      plainText: false,
      faq: false,
      keywords: false,
      representative: false
    });
  };

  if (!analyzedData) {
    return null;
  }

  const selectedCount = Object.values(selectedSheets).filter(Boolean).length;

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#ffffff',
      borderTop: '1px solid #e9ecef'
    }}>
      <h3 style={{ 
        margin: '0 0 15px 0',
        fontSize: '16px',
        color: '#343a40'
      }}>
        📥 엑셀 다운로드
      </h3>

      {/* 시트 선택 */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <h4 style={{ 
            fontSize: '14px',
            margin: 0,
            color: '#343a40'
          }}>
            포함할 시트 선택:
          </h4>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={selectAllSheets}
              style={{
                padding: '2px 6px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              전체 선택
            </button>
            <button
              onClick={deselectAllSheets}
              style={{
                padding: '2px 6px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              전체 해제
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center',
            fontSize: '12px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={selectedSheets.plainText}
              onChange={() => handleSheetToggle('plainText')}
              style={{ marginRight: '8px' }}
            />
            📋 문의내용 ({analyzedData.plainTextData?.length || 0}개)
          </label>

          <label style={{ 
            display: 'flex', 
            alignItems: 'center',
            fontSize: '12px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={selectedSheets.faq}
              onChange={() => handleSheetToggle('faq')}
              style={{ marginRight: '8px' }}
            />
            ❓ FAQ ({Object.values(analyzedData.faqData || {}).reduce((sum, faqs) => sum + faqs.length, 0)}개)
          </label>

          <label style={{ 
            display: 'flex', 
            alignItems: 'center',
            fontSize: '12px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={selectedSheets.keywords}
              onChange={() => handleSheetToggle('keywords')}
              style={{ marginRight: '8px' }}
            />
            🔤 키워드 ({Object.keys(analyzedData.keywordData || {}).length}개 태그)
          </label>

          <label style={{ 
            display: 'flex', 
            alignItems: 'center',
            fontSize: '12px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={selectedSheets.representative}
              onChange={() => handleSheetToggle('representative')}
              style={{ marginRight: '8px' }}
            />
            💬 대표메시지 ({analyzedData.representativeData?.length || 0}개)
          </label>
        </div>
      </div>

      {/* 다운로드 정보 */}
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '4px',
        padding: '10px',
        marginBottom: '15px',
        fontSize: '12px',
        color: '#495057'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          📊 다운로드 정보:
        </div>
        <div>• 선택된 시트: {selectedCount}개</div>
        <div>• 파일명: channeltalk_analysis_{new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx</div>
        <div>• 포함 내용: 분석 요약 시트 + 선택한 데이터 시트들</div>
      </div>

      {/* 다운로드 버튼 */}
      <button
        onClick={generateExcelFile}
        disabled={isGenerating || selectedCount === 0}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: isGenerating ? '#6c757d' : selectedCount === 0 ? '#e9ecef' : '#007bff',
          color: selectedCount === 0 ? '#6c757d' : 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: isGenerating || selectedCount === 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        {isGenerating ? (
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
            엑셀 생성 중...
          </>
        ) : selectedCount === 0 ? (
          '시트를 선택해주세요'
        ) : (
          <>
            📥 엑셀 다운로드 ({selectedCount}개 시트)
          </>
        )}
      </button>

      {/* 주의사항 */}
      <div style={{
        marginTop: '10px',
        fontSize: '11px',
        color: '#6c757d',
        lineHeight: '1.4'
      }}>
        💡 <strong>참고:</strong> 브라우저에서 파일이 자동으로 다운로드됩니다. 
        대용량 데이터의 경우 생성에 시간이 걸릴 수 있습니다.
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DownloadPanel;
