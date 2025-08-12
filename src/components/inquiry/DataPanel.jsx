import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

const DataPanel = ({ 
  onDataUpload, 
  isDataLoaded, 
  onAnalyze, 
  isAnalyzing, 
  userChatCount, 
  messageCount 
}) => {
  const [uploadStatus, setUploadStatus] = useState('');
  const [mappingResult, setMappingResult] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const excelFileRef = useRef(null);

  // 특정 시트 읽기 함수
  const readSheetFromWorkbook = (workbook, sheetName) => {
    try {
      if (!workbook.Sheets[sheetName]) {
        throw new Error(`시트 '${sheetName}'를 찾을 수 없습니다.`);
      }
      
      const worksheet = workbook.Sheets[sheetName];
      console.log(`📊 ${sheetName} 시트 범위:`, worksheet['!ref']);
      
      // 원시 데이터 먼저 확인
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      console.log(`📊 ${sheetName} 원시 데이터:`, rawData.slice(0, 5));
      
      // 빈 행 제거 및 헤더 찾기
      const nonEmptyRows = rawData.filter(row => 
        row && row.length > 0 && row.some(cell => 
          cell !== null && cell !== undefined && String(cell).trim() !== ''
        )
      );
      
      console.log(`📊 ${sheetName} 비어있지 않은 행:`, nonEmptyRows.length);
      
      if (nonEmptyRows.length === 0) {
        throw new Error(`${sheetName} 시트에 데이터가 없습니다.`);
      }
      
      // 첫 번째 비어있지 않은 행을 헤더로 사용
      const headers = nonEmptyRows[0].map(header => 
        String(header || '').trim()
      ).filter(header => header !== '');
      
      console.log(`📊 ${sheetName} 추출된 헤더:`, headers);
      
      if (headers.length === 0) {
        throw new Error(`${sheetName} 시트에서 헤더를 찾을 수 없습니다.`);
      }
      
      // 헤더 다음 행부터 데이터로 처리
      const dataRows = nonEmptyRows.slice(1);
      const objects = dataRows.map((row, rowIndex) => {
        const obj = {};
        headers.forEach((header, colIndex) => {
          const cellValue = row[colIndex];
          obj[header] = cellValue !== null && cellValue !== undefined 
            ? String(cellValue).trim() 
            : '';
        });
        return obj;
      }).filter(obj => 
        // 완전히 빈 객체 제외
        Object.values(obj).some(value => value && value.trim() !== '')
      );
      
      console.log(`📊 ${sheetName} 변환된 객체 샘플:`, objects.slice(0, 3));
      
      return { headers, data: objects };
    } catch (error) {
      console.error(`❌ ${sheetName} 시트 읽기 오류:`, error);
      throw error;
    }
  };

  // 엑셀 파일 전체 읽기 함수
  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          console.log('📊 전체 시트명:', workbook.SheetNames);
          setSheetNames(workbook.SheetNames);
          
          // UserChat과 Message 시트 찾기
          const userChatSheetName = workbook.SheetNames.find(name => 
            name.toLowerCase().includes('userchat') || 
            name.toLowerCase().includes('user_chat') ||
            name.toLowerCase().includes('user chat') ||
            name.toLowerCase() === 'userchat'
          );
          
          const messageSheetName = workbook.SheetNames.find(name => 
            name.toLowerCase().includes('message') || 
            name.toLowerCase().includes('msg') ||
            name.toLowerCase() === 'message'
          );
          
          console.log('🔍 찾은 시트:', { userChatSheetName, messageSheetName });
          
          if (!userChatSheetName && !messageSheetName) {
            throw new Error(
              `UserChat과 Message 시트를 찾을 수 없습니다.\n` +
              `현재 시트: ${workbook.SheetNames.join(', ')}\n` +
              `시트명에 'UserChat' 또는 'Message'가 포함되어야 합니다.`
            );
          }
          
          let userChatData = null;
          let messageData = null;
          
          // UserChat 시트 읽기
          if (userChatSheetName) {
            try {
              userChatData = readSheetFromWorkbook(workbook, userChatSheetName);
              console.log(`✅ UserChat 시트 읽기 완료: ${userChatData.data.length}개 행`);
            } catch (error) {
              console.error('❌ UserChat 시트 읽기 실패:', error);
              throw new Error(`UserChat 시트 읽기 실패: ${error.message}`);
            }
          }
          
          // Message 시트 읽기
          if (messageSheetName) {
            try {
              messageData = readSheetFromWorkbook(workbook, messageSheetName);
              console.log(`✅ Message 시트 읽기 완료: ${messageData.data.length}개 행`);
            } catch (error) {
              console.error('❌ Message 시트 읽기 실패:', error);
              throw new Error(`Message 시트 읽기 실패: ${error.message}`);
            }
          }
          
          resolve({ 
            userChatData, 
            messageData,
            sheetNames: workbook.SheetNames
          });
          
        } catch (error) {
          console.error('❌ 엑셀 파일 읽기 상세 오류:', error);
          reject(new Error(`파일 읽기 오류: ${error.message}`));
        }
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsArrayBuffer(file);
    });
  };

  // 엑셀 파일 업로드 (UserChat + Message 시트)
  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadStatus('엑셀 파일을 읽는 중...');
    
    try {
      const result = await readExcelFile(file);
      console.log('📊 엑셀 파일 읽기 결과:', result);
      
      let userChatResult = null;
      let messageResult = null;
      
      // UserChat 시트 검증
      if (result.userChatData) {
        const requiredColumns = ['id', 'name', 'tags'];
        const normalizedHeaders = result.userChatData.headers.map(h => h.toLowerCase().replace(/\s+/g, ''));
        
        console.log('📊 UserChat 정규화된 헤더:', normalizedHeaders);
        
        const missingColumns = requiredColumns.filter(col => {
          const normalizedCol = col.toLowerCase().replace(/\s+/g, '');
          return !normalizedHeaders.includes(normalizedCol);
        });
        
        if (missingColumns.length > 0) {
          throw new Error(`UserChat 시트 필수 컬럼이 누락되었습니다: ${missingColumns.join(', ')}\n현재 헤더: ${result.userChatData.headers.join(', ')}`);
        }
        
        userChatResult = {
          fileName: file.name,
          headers: result.userChatData.headers,
          data: result.userChatData.data,
          count: result.userChatData.data.length,
          validCount: result.userChatData.data.filter(row => row.id && row.name).length
        };
      }
      
      // Message 시트 검증
      if (result.messageData) {
        const requiredColumns = ['chatId', 'plainText', 'personType'];
        const normalizedHeaders = result.messageData.headers.map(h => h.toLowerCase().replace(/\s+/g, ''));
        
        console.log('📊 Message 정규화된 헤더:', normalizedHeaders);
        
        const missingColumns = requiredColumns.filter(col => {
          const normalizedCol = col.toLowerCase().replace(/\s+/g, '');
          return !normalizedHeaders.includes(normalizedCol);
        });
        
        if (missingColumns.length > 0) {
          throw new Error(`Message 시트 필수 컬럼이 누락되었습니다: ${missingColumns.join(', ')}\n현재 헤더: ${result.messageData.headers.join(', ')}`);
        }
        
        messageResult = {
          fileName: file.name,
          headers: result.messageData.headers,
          data: result.messageData.data,
          count: result.messageData.data.length,
          userMessageCount: result.messageData.data.filter(row => row.personType === 'user').length
        };
      }
      
      setMappingResult({
        userChat: userChatResult,
        message: messageResult,
        sheetNames: result.sheetNames
      });
      
      const statusParts = [];
      if (userChatResult) {
        statusParts.push(`UserChat: ${userChatResult.count}개 (${userChatResult.headers.join(', ')})`);
      }
      if (messageResult) {
        statusParts.push(`Message: ${messageResult.count}개 (${messageResult.headers.join(', ')})`);
      }
      
      setUploadStatus(`엑셀 파일 업로드 완료\n${statusParts.join('\n')}`);
      
    } catch (error) {
      console.error('❌ 엑셀 업로드 오류:', error);
      setUploadStatus(`오류: ${error.message}`);
      alert(error.message);
    }
  };

  // 매핑 확인 및 데이터 전달
  const handleConfirmMapping = () => {
    if (!mappingResult?.userChat || !mappingResult?.message) {
      alert('UserChat과 Message 시트가 모두 필요합니다. 엑셀 파일을 확인해주세요.');
      return;
    }

    // 데이터 매핑 확인
    const userChatIds = new Set(mappingResult.userChat.data.map(row => row.id));
    const messageChatIds = new Set(mappingResult.message.data.map(row => row.chatId));
    
    // 매칭되는 ID 개수 확인
    const matchedIds = [...userChatIds].filter(id => messageChatIds.has(id));
    const matchRate = (matchedIds.length / userChatIds.size * 100).toFixed(1);
    
    console.log('🔗 매핑 결과:', {
      userChatIds: userChatIds.size,
      messageChatIds: messageChatIds.size,
      matchedIds: matchedIds.length,
      matchRate: `${matchRate}%`
    });

    if (matchedIds.length === 0) {
      alert('UserChat의 id와 Message의 chatId가 매칭되지 않습니다. 데이터를 확인해주세요.');
      return;
    }

    if (matchedIds.length < userChatIds.size * 0.5) {
      const proceed = window.confirm(
        `매칭률이 ${matchRate}%로 낮습니다. 계속 진행하시겠습니까?\n\n` +
        `UserChat ID: ${userChatIds.size}개\n` +
        `Message chatId: ${messageChatIds.size}개\n` +
        `매칭된 ID: ${matchedIds.length}개`
      );
      if (!proceed) return;
    }

    // 부모 컴포넌트에 데이터 전달
    onDataUpload(mappingResult.userChat.data, mappingResult.message.data);
    setUploadStatus(`매핑 완료 (매칭률: ${matchRate}%)`);
  };

  return (
    <div style={{
      padding: '20px',
      borderBottom: '1px solid #e9ecef'
    }}>
      <h3 style={{ 
        margin: '0 0 15px 0',
        fontSize: '16px',
        color: '#343a40'
      }}>
        📁 데이터 업로드
      </h3>

      {/* 엑셀 파일 업로드 */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ 
          display: 'block',
          marginBottom: '5px',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#495057'
        }}>
          채널톡 엑셀 데이터:
        </label>
        <input
          ref={excelFileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleExcelUpload}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        />
        <div style={{ 
          fontSize: '11px', 
          color: '#6c757d', 
          marginTop: '3px',
          lineHeight: '1.4'
        }}>
          <strong>필수 시트:</strong><br/>
          • UserChat 시트: id, name, tags<br/>
          • Message 시트: chatId, plainText, personType<br/>
          <em>시트명에 'UserChat'과 'Message'가 포함되어야 합니다.</em>
        </div>
      </div>

      {/* 시트 정보 표시 */}
      {sheetNames.length > 0 && (
        <div style={{
          marginBottom: '15px',
          padding: '8px',
          backgroundColor: '#e9ecef',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <strong>📋 발견된 시트:</strong> {sheetNames.join(', ')}
        </div>
      )}

      {/* 업로드 상태 */}
      {uploadStatus && (
        <div style={{
          padding: '8px',
          backgroundColor: uploadStatus.includes('오류') ? '#f8d7da' : '#d1ecf1',
          border: `1px solid ${uploadStatus.includes('오류') ? '#f5c6cb' : '#bee5eb'}`,
          borderRadius: '4px',
          fontSize: '12px',
          color: uploadStatus.includes('오류') ? '#721c24' : '#0c5460',
          marginBottom: '15px'
        }}>
          {uploadStatus}
        </div>
      )}

      {/* 매핑 결과 */}
      {mappingResult && (
        <div style={{ marginBottom: '15px' }}>
          <h4 style={{ 
            fontSize: '14px', 
            margin: '0 0 8px 0',
            color: '#343a40'
          }}>
            📊 매핑 결과:
          </h4>
          
          {mappingResult.userChat && (
            <div style={{ 
              fontSize: '12px', 
              color: '#495057',
              marginBottom: '5px'
            }}>
              UserChat: {mappingResult.userChat.count}개 
              (유효: {mappingResult.userChat.validCount}개)
            </div>
          )}
          
          {mappingResult.message && (
            <div style={{ 
              fontSize: '12px', 
              color: '#495057',
              marginBottom: '10px'
            }}>
              Message: {mappingResult.message.count}개 
              (사용자: {mappingResult.message.userMessageCount}개)
            </div>
          )}

          <button
            onClick={handleConfirmMapping}
            disabled={!mappingResult.userChat || !mappingResult.message}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              opacity: (!mappingResult.userChat || !mappingResult.message) ? 0.6 : 1
            }}
          >
            ✅ 매핑 확인
          </button>
        </div>
      )}

      {/* 진행률 표시 */}
      {analysisProgress && (
        <div style={{
          marginBottom: '15px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
            📊 {analysisProgress.step}: {analysisProgress.message}
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e9ecef',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${analysisProgress.progress}%`,
              height: '100%',
              backgroundColor: analysisProgress.progress === 100 ? '#28a745' : '#007bff',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ 
            marginTop: '5px', 
            fontSize: '12px', 
            color: '#6c757d',
            textAlign: 'right'
          }}>
            {analysisProgress.progress}%
          </div>
        </div>
      )}

      {/* 분석 실행 버튼 */}
      <button
        onClick={() => {
          setAnalysisProgress({ step: '시작', message: '분석 준비 중...', progress: 0 });
          onAnalyze((progress) => setAnalysisProgress(progress));
        }}
        disabled={!isDataLoaded || isAnalyzing}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: isAnalyzing ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: isAnalyzing ? 'not-allowed' : 'pointer',
          opacity: (!isDataLoaded || isAnalyzing) ? 0.6 : 1
        }}
      >
        {isAnalyzing ? '🔄 분석 중...' : '⚡ 고속 분석 시작'}
      </button>

      {/* 데이터 상태 표시 */}
      {isDataLoaded && (
        <div style={{
          marginTop: '10px',
          padding: '8px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#155724'
        }}>
          ✅ 데이터 로드 완료<br/>
          UserChat: {userChatCount}개<br/>
          Message: {messageCount}개
        </div>
      )}
    </div>
  );
};

export default DataPanel;
