import React, { useState, useCallback } from 'react';

const JsonUploader = ({ onDataLoaded, onError }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [filePreview, setFilePreview] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // JSON 자동 수정 함수
  const attemptJsonFix = (jsonString) => {
    const originalString = jsonString.trim();
    console.log('원본 길이:', originalString.length);
    
    // 1. 잘린 JSON 수정 (가장 일반적인 문제)
    if (originalString.startsWith('{') && !originalString.endsWith('}')) {
      console.log('잘린 JSON 객체 감지됨, 단일 객체를 배열로 변환 시도...');
      
      // 마지막 완전한 필드까지만 추출하여 객체 완성
      let fixed = originalString;
      
      // 마지막 불완전한 부분 제거
      const lastCommaIndex = fixed.lastIndexOf(',');
      const lastBraceIndex = fixed.lastIndexOf('{');
      const lastBracketIndex = fixed.lastIndexOf('[');
      
      // 마지막 쉼표 이후가 불완전하면 쉼표까지만 사용
      if (lastCommaIndex > lastBraceIndex && lastCommaIndex > lastBracketIndex) {
        fixed = fixed.substring(0, lastCommaIndex);
      }
      
      // 객체를 닫고 배열로 감싸기
      if (!fixed.endsWith('}')) {
        fixed += '}';
      }
      fixed = '[' + fixed + ']';
      
      try {
        return JSON.parse(fixed);
      } catch (e) {
        console.warn('잘린 JSON 수정 실패:', e.message);
      }
    }
    
    // 2. JSONL (JSON Lines) 형식 감지 및 수정
    if (originalString.includes('\n') && !originalString.startsWith('[')) {
      console.log('JSONL 형식으로 감지됨, 배열로 변환 시도...');
      const lines = originalString.split('\n').filter(line => line.trim());
      const objects = [];
      
      for (const line of lines) {
        try {
          objects.push(JSON.parse(line.trim()));
        } catch (e) {
          console.warn('라인 파싱 실패:', line);
        }
      }
      
      if (objects.length > 0) {
        return objects;
      }
    }
    
    // 3. 연결된 JSON 객체들 수정 (}{를 },{로 변경)
    if (originalString.includes('}{')) {
      console.log('연결된 JSON 객체 감지됨, 배열로 변환 시도...');
      let fixed = originalString.replace(/}\s*{/g, '},{');
      fixed = '[' + fixed + ']';
      try {
        return JSON.parse(fixed);
      } catch (e) {
        console.warn('연결된 객체 수정 실패');
      }
    }
    
    // 4. 마지막 쉼표 제거
    let fixed = originalString;
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1'); // 객체나 배열 끝의 쉼표 제거
    
    try {
      return JSON.parse(fixed);
    } catch (e) {
      console.warn('쉼표 제거 수정 실패');
    }
    
    // 5. 단일 완전한 객체를 배열로 감싸기
    if (originalString.startsWith('{') && originalString.endsWith('}')) {
      try {
        const obj = JSON.parse(originalString);
        return [obj]; // 단일 객체를 배열로 감싸기
      } catch (e) {
        console.warn('단일 객체 배열 변환 실패');
      }
    }
    
    // 6. 따옴표 수정 시도
    fixed = originalString
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // 키에 따옴표 추가
      .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}])/g, ':"$1"$2'); // 문자열 값에 따옴표 추가
    
    try {
      return JSON.parse(fixed);
    } catch (e) {
      console.warn('따옴표 수정 실패');
    }
    
    throw new Error('자동 수정 실패');
  };

  // JSON 데이터 파싱 및 검증 (더 유연하게)
  const parseJsonData = useCallback((jsonData) => {
    try {
      console.log('JSON 파싱 시작, 데이터 타입:', typeof jsonData);
      
      // 빈 문자열 체크
      if (!jsonData || (typeof jsonData === 'string' && jsonData.trim() === '')) {
        throw new Error('파일이 비어있습니다.');
      }

      // JSON 문자열인 경우 파싱 (자동 수정 기능 포함)
      let data;
      if (typeof jsonData === 'string') {
        console.log('문자열을 JSON으로 파싱 중...');
        try {
          data = JSON.parse(jsonData);
        } catch (parseError) {
          console.error('JSON 파싱 실패:', parseError);
          console.log('자동 수정을 시도합니다...');
          
          // 자동 수정 시도
          try {
            data = attemptJsonFix(jsonData);
            console.log('자동 수정 성공!');
          } catch (fixError) {
            console.error('자동 수정도 실패:', fixError);
            throw new Error(`JSON 형식이 올바르지 않습니다: ${parseError.message}

자동 수정 시도했지만 실패했습니다.
일반적인 해결 방법:
1. 여러 객체가 연결된 경우 → 배열로 감싸기: [객체1, 객체2, ...]
2. 각 줄마다 객체가 있는 경우 → JSONL 형식을 JSON 배열로 변환
3. 마지막 쉼표 제거하기
4. 따옴표 누락 확인하기

원본 오류: ${parseError.message}`);
          }
        }
      } else {
        data = jsonData;
      }
      
      console.log('파싱된 데이터 구조:', {
        type: typeof data,
        isArray: Array.isArray(data),
        keys: typeof data === 'object' && data ? Object.keys(data) : 'N/A'
      });

      // Zendesk 티켓 데이터 구조 검증
      if (!data || typeof data !== 'object') {
        throw new Error('유효하지 않은 JSON 형식입니다. 객체 또는 배열이어야 합니다.');
      }

      // 티켓 배열 찾기 (매우 유연하게)
      let tickets = [];
      let foundArrayKey = '';
      
      if (Array.isArray(data)) {
        console.log('루트가 배열입니다.');
        tickets = data;
        foundArrayKey = 'root';
      } else {
        // 가능한 모든 배열 키 탐색
        const possibleKeys = [
          'tickets', 'results', 'data', 'items', 'records', 'list', 'entries',
          'ticket_list', 'ticket_data', 'zendesk_tickets', 'support_tickets'
        ];
        
        // 먼저 일반적인 키들 확인
        for (const key of possibleKeys) {
          if (data[key] && Array.isArray(data[key])) {
            console.log(`${key} 배열을 발견했습니다.`);
            tickets = data[key];
            foundArrayKey = key;
            break;
          }
        }
        
        // 일반적인 키에서 찾지 못했다면 모든 배열 키 탐색
        if (tickets.length === 0) {
          const allArrayKeys = Object.keys(data).filter(key => Array.isArray(data[key]));
          console.log('가능한 배열 키들:', allArrayKeys);
          
          if (allArrayKeys.length > 0) {
            foundArrayKey = allArrayKeys[0];
            tickets = data[foundArrayKey];
            console.log(`${foundArrayKey} 배열을 사용합니다.`);
          }
        }
      }

      console.log(`발견된 티켓 수: ${tickets.length} (키: ${foundArrayKey})`);

      if (tickets.length === 0) {
        // 데이터 구조 분석 정보 제공
        const dataInfo = typeof data === 'object' ? {
          keys: Object.keys(data),
          arrayKeys: Object.keys(data).filter(key => Array.isArray(data[key])),
          objectKeys: Object.keys(data).filter(key => typeof data[key] === 'object' && !Array.isArray(data[key]))
        } : {};
        
        throw new Error(`티켓 데이터를 찾을 수 없습니다.

현재 파일 구조:
- 전체 키: ${dataInfo.keys?.join(', ') || '없음'}
- 배열 키: ${dataInfo.arrayKeys?.join(', ') || '없음'}
- 객체 키: ${dataInfo.objectKeys?.join(', ') || '없음'}

지원되는 구조:
1. 루트 배열: [{"id": 1, ...}, ...]
2. 객체 내 배열: {"tickets": [...], "results": [...] 등}

파일 구조를 확인하고 다시 시도해주세요.`);
      }

      // 첫 번째 티켓 구조 분석
      if (tickets.length > 0) {
        const firstTicket = tickets[0];
        console.log('첫 번째 티켓 구조:', Object.keys(firstTicket || {}));
        
        // 티켓 같은 객체인지 간단히 확인
        if (typeof firstTicket !== 'object') {
          throw new Error('배열의 요소가 객체가 아닙니다. 각 티켓은 객체 형태여야 합니다.');
        }
      }

      // 티켓 데이터 정규화 (매우 유연하게)
      const normalizedTickets = tickets.map((ticket, index) => {
        if (!ticket || typeof ticket !== 'object') {
          console.warn(`티켓 ${index}번이 유효하지 않습니다:`, ticket);
          return null;
        }

        // 가능한 모든 필드명 변형 확인
        const getId = () => {
          const idFields = ['id', 'ticket_id', 'ticketId', 'ID', 'Id', 'number', 'ticket_number'];
          for (const field of idFields) {
            if (ticket[field] !== undefined) return ticket[field];
          }
          return `generated-${index}`;
        };

        const getCreatedAt = () => {
          const dateFields = ['created_at', 'createdAt', 'created', 'date_created', 'creation_date', 'timestamp'];
          for (const field of dateFields) {
            if (ticket[field]) return ticket[field];
          }
          return new Date().toISOString();
        };

        const getSubject = () => {
          const subjectFields = ['subject', 'title', 'summary', 'headline', 'topic', 'issue'];
          for (const field of subjectFields) {
            if (ticket[field]) return ticket[field];
          }
          return '제목 없음';
        };

        const getDescription = () => {
          const descFields = ['description', 'body', 'content', 'comment', 'message', 'text', 'details'];
          for (const field of descFields) {
            if (ticket[field]) return ticket[field];
          }
          return '내용 없음';
        };

        const getTags = () => {
          const tagFields = ['tags', 'labels', 'categories', 'keywords'];
          for (const field of tagFields) {
            if (ticket[field]) {
              if (Array.isArray(ticket[field])) return ticket[field];
              if (typeof ticket[field] === 'string') return ticket[field].split(',').map(t => t.trim());
            }
          }
          return [];
        };

        const normalized = {
          id: getId(),
          created_at: getCreatedAt(),
          updated_at: ticket.updated_at || ticket.updatedAt || ticket.updated || ticket.modified || null,
          subject: getSubject(),
          description: getDescription(),
          status: ticket.status || ticket.state || 'unknown',
          priority: ticket.priority || ticket.importance || 'normal',
          tags: getTags(),
          requester_id: ticket.requester_id || ticket.requesterId || ticket.requester || ticket.customer_id || null,
          assignee_id: ticket.assignee_id || ticket.assigneeId || ticket.assignee || ticket.agent_id || null,
          organization_id: ticket.organization_id || ticket.organizationId || ticket.organization || ticket.company_id || null,
          type: ticket.type || ticket.category || 'ticket',
          url: ticket.url || ticket.link || null,
          // 추가 필드들
          custom_fields: ticket.custom_fields || ticket.customFields || [],
          via: ticket.via || ticket.channel || null,
          satisfaction_rating: ticket.satisfaction_rating || ticket.satisfactionRating || ticket.rating || null,
          // 원본 데이터도 보존
          _raw: ticket
        };

        return normalized;
      }).filter(ticket => ticket !== null);

      console.log(`${normalizedTickets.length}개의 티켓 데이터를 성공적으로 파싱했습니다.`);
      
      // 샘플 데이터 로그
      if (normalizedTickets.length > 0) {
        console.log('정규화된 첫 번째 티켓 샘플:', normalizedTickets[0]);
      }
      
      return normalizedTickets;

    } catch (error) {
      console.error('JSON 파싱 오류 상세:', error);
      throw error; // 원본 오류 그대로 전달
    }
  }, []); // parseJsonData는 외부 의존성이 없음

  // 파일 처리 함수
  const processFile = useCallback(async (file) => {
    console.log('파일 처리 시작:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

    setIsLoading(true);
    setFileName(file.name);

    try {
      // 파일 크기 체크 (100MB로 증가)
      if (file.size > 100 * 1024 * 1024) {
        throw new Error('파일 크기가 너무 큽니다. 100MB 이하의 파일을 업로드해주세요.');
      }

      console.log('파일 읽기 시작...');
      
      // 파일 읽기
      const text = await file.text();
      
      // 파일 미리보기 설정 (처음 1000자)
      setFilePreview(text.substring(0, 1000));
      
      console.log('파일 내용 미리보기:', text.substring(0, 200) + '...');
      console.log('파일 전체 길이:', text.length);
      
      // JSON 파싱 및 데이터 검증
      console.log('JSON 파싱 시작...');
      const tickets = parseJsonData(text);
      
      console.log('파싱 성공:', tickets.length, '개 티켓');
      
      // 성공적으로 파싱된 데이터 전달
      onDataLoaded(tickets, file.name);

    } catch (error) {
      console.error('파일 처리 오류 상세:', {
        message: error.message,
        stack: error.stack,
        fileName: file.name,
        fileSize: file.size
      });
      
      // 파일 미리보기 표시
      setShowPreview(true);
      
      // 사용자에게 더 자세한 오류 메시지 제공
      let userMessage = error.message;
      if (error.message.includes('JSON')) {
        userMessage += '\n\n아래 "파일 미리보기"를 확인하여 JSON 형식을 검토해주세요.';
      }
      
      onError(userMessage);
      setFileName('');
    } finally {
      setIsLoading(false);
    }
  }, [onDataLoaded, onError, parseJsonData]);

  // 드래그 앤 드롭 이벤트 핸들러
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    console.log('드롭 이벤트 발생');
    const files = Array.from(e.dataTransfer.files);
    console.log('드롭된 파일들:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    if (files.length === 0) {
      console.warn('드롭된 파일이 없습니다.');
      return;
    }
    
    if (files.length > 1) {
      console.warn('여러 파일이 드롭되었습니다. 첫 번째 파일만 처리합니다.');
    }
    
    processFile(files[0]);
  }, [processFile]);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e) => {
    console.log('파일 선택 이벤트 발생');
    const files = Array.from(e.target.files || []);
    console.log('선택된 파일들:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    if (files.length === 0) {
      console.warn('선택된 파일이 없습니다.');
      return;
    }
    
    if (files.length > 1) {
      console.warn('여러 파일이 선택되었습니다. 첫 번째 파일만 처리합니다.');
    }
    
    processFile(files[0]);
    
    // 입력 필드 초기화 (같은 파일을 다시 선택할 수 있도록)
    e.target.value = '';
  }, [processFile]);

  // 수동 JSON 수정 시도
  const tryJsonFix = useCallback((method) => {
    if (!filePreview) return;
    
    console.log(`수동 수정 시도: ${method}`);
    let fixed;
    
    try {
      switch (method) {
        case 'truncated':
          // 잘린 JSON 수정
          let truncatedFixed = filePreview.trim();
          if (truncatedFixed.startsWith('{') && !truncatedFixed.endsWith('}')) {
            // 마지막 불완전한 부분 제거
            const lastCommaIndex = truncatedFixed.lastIndexOf(',');
            const lastBraceIndex = truncatedFixed.lastIndexOf('{');
            const lastBracketIndex = truncatedFixed.lastIndexOf('[');
            
            if (lastCommaIndex > lastBraceIndex && lastCommaIndex > lastBracketIndex) {
              truncatedFixed = truncatedFixed.substring(0, lastCommaIndex);
            }
            
            // 객체를 닫고 배열로 감싸기
            if (!truncatedFixed.endsWith('}')) {
              truncatedFixed += '}';
            }
            truncatedFixed = '[' + truncatedFixed + ']';
            fixed = JSON.parse(truncatedFixed);
          } else {
            throw new Error('잘린 JSON이 아닙니다.');
          }
          break;
          
        case 'jsonl':
          // JSONL 형식을 배열로 변환
          const lines = filePreview.split('\n').filter(line => line.trim());
          const objects = [];
          for (const line of lines) {
            try {
              objects.push(JSON.parse(line.trim()));
            } catch (e) {
              console.warn('라인 파싱 실패:', line);
            }
          }
          fixed = objects;
          break;
          
        case 'connected':
          // 연결된 객체들을 배열로 변환
          let connectedFixed = filePreview.replace(/}\s*{/g, '},{');
          connectedFixed = '[' + connectedFixed + ']';
          fixed = JSON.parse(connectedFixed);
          break;
          
        case 'comma':
          // 마지막 쉼표 제거
          let commaFixed = filePreview.replace(/,(\s*[}\]])/g, '$1');
          fixed = JSON.parse(commaFixed);
          break;
          
        case 'wrap':
          // 배열로 감싸기
          if (filePreview.startsWith('{') && filePreview.endsWith('}')) {
            const obj = JSON.parse(filePreview);
            fixed = [obj];
          } else {
            throw new Error('배열로 감쌀 수 없는 형식입니다.');
          }
          break;
          
        default:
          throw new Error('알 수 없는 수정 방법입니다.');
      }
      
      console.log('수동 수정 성공:', method);
      
      // 수정된 데이터로 파싱 시도
      const tickets = parseJsonData(fixed);
      onDataLoaded(tickets, fileName + ' (수정됨)');
      setShowPreview(false);
      
    } catch (error) {
      console.error('수동 수정 실패:', error);
      alert(`${method} 방법으로 수정 실패: ${error.message}`);
    }
  }, [filePreview, fileName, onDataLoaded, parseJsonData]);

  return (
    <div className="card">
      <h2>📁 JSON 파일 업로드</h2>
      <p>Zendesk 티켓 데이터가 포함된 JSON 파일을 업로드하세요.</p>

      {/* 드래그 앤 드롭 영역 */}
      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''} ${isLoading ? 'loading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!isLoading) {
            console.log('업로드 영역 클릭됨');
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
              fileInput.click();
            } else {
              console.error('파일 입력 요소를 찾을 수 없습니다.');
            }
          }
        }}
      >
        {isLoading ? (
          <div className="upload-loading">
            <div className="spinner">⏳</div>
            <p>파일을 처리하는 중...</p>
            {fileName && <small>{fileName}</small>}
          </div>
        ) : (
          <div className="upload-content">
            <div className="upload-icon">📤</div>
            <h3>파일을 여기에 드래그하거나 클릭하여 선택하세요</h3>
            <p>JSON 파일 (.json, .txt) | 최대 100MB</p>
            {fileName && (
              <div className="current-file">
                <strong>현재 파일:</strong> {fileName}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 숨겨진 파일 입력 */}
      <input
        id="file-input"
        type="file"
        accept=".json,.txt,application/json,text/plain"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={isLoading}
      />

      {/* 파일 미리보기 */}
      {showPreview && filePreview && (
        <div className="file-preview">
          <h4>📄 파일 미리보기 (처음 1000자)</h4>
          <pre className="preview-content">{filePreview}</pre>
          
          {/* JSON 수정 도구 */}
          <div className="json-fix-tools">
            <h5>🔧 자동 수정 도구</h5>
                         <div className="fix-buttons">
               <button 
                 className="btn btn-secondary"
                 onClick={() => tryJsonFix('truncated')}
                 style={{ fontSize: '12px', marginRight: '5px' }}
               >
                 잘린 JSON 수정
               </button>
               <button 
                 className="btn btn-secondary"
                 onClick={() => tryJsonFix('jsonl')}
                 style={{ fontSize: '12px', marginRight: '5px' }}
               >
                 JSONL → 배열 변환
               </button>
               <button 
                 className="btn btn-secondary"
                 onClick={() => tryJsonFix('connected')}
                 style={{ fontSize: '12px', marginRight: '5px' }}
               >
                 연결된 객체 수정
               </button>
               <button 
                 className="btn btn-secondary"
                 onClick={() => tryJsonFix('comma')}
                 style={{ fontSize: '12px', marginRight: '5px' }}
               >
                 마지막 쉼표 제거
               </button>
               <button 
                 className="btn btn-secondary"
                 onClick={() => tryJsonFix('wrap')}
                 style={{ fontSize: '12px' }}
               >
                 배열로 감싸기
               </button>
             </div>
            <p style={{ fontSize: '11px', color: '#666', marginTop: '10px' }}>
              위 버튼을 클릭하면 해당 방법으로 JSON을 수정하여 다시 파싱을 시도합니다.
            </p>
          </div>
          
          <button 
            className="btn btn-secondary"
            onClick={() => setShowPreview(false)}
            style={{ marginTop: '10px' }}
          >
            미리보기 닫기
          </button>
        </div>
      )}

      {/* 도움말 */}
      <div className="upload-help">
        <details>
          <summary>📋 지원되는 JSON 형식 (매우 유연함)</summary>
          <div className="help-content">
            <h4>다음과 같은 다양한 구조를 지원합니다:</h4>
            <pre>{`// 방법 1: 루트 배열
[
  {"id": 1, "subject": "문의1", ...},
  {"id": 2, "subject": "문의2", ...}
]

// 방법 2: 다양한 키의 배열
{
  "tickets": [...],     // 또는
  "results": [...],     // 또는  
  "data": [...],        // 또는
  "items": [...],       // 등등
}

// 필드명도 유연하게 지원:
{
  "id" 또는 "ticket_id" 또는 "ID",
  "subject" 또는 "title" 또는 "summary",
  "description" 또는 "body" 또는 "content",
  "created_at" 또는 "created" 또는 "timestamp",
  "tags" 또는 "labels" 또는 "categories"
}`}</pre>
            <p><small>
              • 거의 모든 JSON 구조를 자동으로 인식합니다<br/>
              • 필드명이 달라도 자동으로 매핑됩니다<br/>
              • 오류 발생 시 상세한 구조 분석 정보를 제공합니다
            </small></p>
          </div>
        </details>
      </div>

      <style jsx>{`
        .upload-zone {
          border: 2px dashed #ddd;
          border-radius: 8px;
          padding: 40px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          margin: 20px 0;
          background-color: #fafafa;
        }

        .upload-zone:hover {
          border-color: #007bff;
          background-color: #f0f8ff;
        }

        .upload-zone.drag-over {
          border-color: #28a745;
          background-color: #f0fff4;
          transform: scale(1.02);
        }

        .upload-zone.loading {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .upload-content .upload-icon {
          font-size: 48px;
          margin-bottom: 15px;
        }

        .upload-content h3 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .upload-content p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .current-file {
          margin-top: 15px;
          padding: 10px;
          background-color: #e9ecef;
          border-radius: 4px;
          font-size: 14px;
        }

        .upload-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .spinner {
          font-size: 24px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .file-preview {
          margin-top: 20px;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }

        .file-preview h4 {
          margin-top: 0;
          color: #333;
        }

        .preview-content {
          background-color: #ffffff;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 15px;
          max-height: 300px;
          overflow-y: auto;
          font-size: 12px;
          line-height: 1.4;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .json-fix-tools {
          margin: 15px 0;
          padding: 15px;
          background-color: #f1f3f4;
          border-radius: 6px;
          border-left: 4px solid #007bff;
        }

        .json-fix-tools h5 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 14px;
        }

        .fix-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .fix-buttons .btn {
          flex: none;
        }

        .upload-help {
          margin-top: 20px;
        }

        .upload-help summary {
          cursor: pointer;
          font-weight: 500;
          color: #007bff;
          padding: 10px;
          border-radius: 4px;
          background-color: #f8f9fa;
        }

        .upload-help summary:hover {
          background-color: #e9ecef;
        }

        .help-content {
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 4px;
          margin-top: 10px;
        }

        .help-content h4 {
          margin-top: 0;
          color: #333;
        }

        .help-content pre {
          background-color: #f1f3f4;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 12px;
          line-height: 1.4;
        }

        @media (max-width: 768px) {
          .upload-zone {
            padding: 30px 15px;
          }
          
          .upload-content .upload-icon {
            font-size: 36px;
          }
          
          .upload-content h3 {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default JsonUploader; 