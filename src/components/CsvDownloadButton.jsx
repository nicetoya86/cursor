import React, { useState } from 'react';
import Papa from 'papaparse';
import { format } from 'date-fns';

const CsvDownloadButton = ({ tickets, disabled = false }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!tickets || tickets.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    setIsDownloading(true);

    try {
      // CSV 데이터 준비
      const csvData = tickets.map(ticket => ({
        '티켓 번호': ticket.id,
        '생성일': ticket.created_at,
        '수정일': ticket.updated_at || '',
        '제목': ticket.subject || '',
        '내용': cleanText(ticket.description || ''),
        '상태': ticket.status || '',
        '우선순위': ticket.priority || '',
        '태그': Array.isArray(ticket.tags) ? ticket.tags.join(', ') : '',
        '요청자 ID': ticket.requester_id || '',
        '담당자 ID': ticket.assignee_id || '',
        '조직 ID': ticket.organization_id || '',
        '타입': ticket.type || '',
        'URL': ticket.url || ''
      }));

      // CSV 변환
      const csv = Papa.unparse(csvData, {
        header: true,
        encoding: 'utf-8'
      });

      // BOM 추가 (한글 깨짐 방지)
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csv;
      
      // 다운로드
      const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      const filename = `zendesk_tickets_${timestamp}.csv`;
      
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('CSV 다운로드 오류:', error);
      alert(`CSV 다운로드 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // HTML 태그 제거 및 텍스트 정리
  const cleanText = (text) => {
    if (!text) return '';
    
    // HTML 태그 제거
    const withoutHtml = text.replace(/<[^>]*>/g, '');
    
    // 연속된 공백 및 줄바꿈 정리
    const cleaned = withoutHtml
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    return cleaned;
  };

  const isDisabled = disabled || isDownloading || !tickets || tickets.length === 0;

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        onClick={handleDownload}
        disabled={isDisabled}
        className="btn btn-secondary"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: isDisabled ? 0.6 : 1
        }}
        title={
          !tickets || tickets.length === 0 
            ? '다운로드할 데이터가 없습니다' 
            : `${tickets.length}개 티켓을 CSV로 다운로드`
        }
      >
        {isDownloading ? (
          <>
            <span>⏳</span>
            다운로드 중...
          </>
        ) : (
          <>
            <span>📥</span>
            CSV 다운로드
            {tickets && tickets.length > 0 && (
              <span style={{ 
                fontSize: '12px', 
                backgroundColor: '#007bff', 
                color: 'white', 
                borderRadius: '10px', 
                padding: '2px 6px',
                marginLeft: '4px'
              }}>
                {tickets.length}
              </span>
            )}
          </>
        )}
      </button>
      
    </div>
  );
};

export default CsvDownloadButton; 