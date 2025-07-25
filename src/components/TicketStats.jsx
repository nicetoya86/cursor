import React from 'react';
import { format } from 'date-fns';

const TicketStats = ({ stats, totalCount, filteredCount, fileName, isFiltered }) => {
  if (!stats || !stats.all) return null;

  const { all: allStats, filtered: filteredStats } = stats;
  const currentStats = isFiltered && filteredStats ? filteredStats : allStats;

  const formatDate = (date) => {
    if (!date) return '-';
    try {
      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      return '-';
    }
  };

  return (
    <div className="card stats-card">
      <div className="stats-header">
        <h3>📊 데이터 통계</h3>
        {fileName && (
          <div className="file-info">
            <span>📄 {fileName}</span>
          </div>
        )}
      </div>

      {/* 기본 통계 */}
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{totalCount.toLocaleString()}</div>
          <div className="stat-label">전체 티켓</div>
        </div>
        
        {isFiltered && (
          <div className="stat-item filtered">
            <div className="stat-value">{filteredCount.toLocaleString()}</div>
            <div className="stat-label">필터링된 티켓</div>
          </div>
        )}

        {currentStats.dateRange && (
          <>
            <div className="stat-item">
              <div className="stat-value">{formatDate(currentStats.dateRange.earliest)}</div>
              <div className="stat-label">최초 생성일</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{formatDate(currentStats.dateRange.latest)}</div>
              <div className="stat-label">최근 생성일</div>
            </div>
          </>
        )}
      </div>

      {/* 상태별 통계 */}
      {currentStats.byStatus && Object.keys(currentStats.byStatus).length > 0 && (
        <div className="stats-section">
          <h4>상태별 분포</h4>
          <div className="stats-breakdown">
            {Object.entries(currentStats.byStatus)
              .sort(([,a], [,b]) => b - a)
              .map(([status, count]) => (
                <div key={status} className="breakdown-item">
                  <span className="breakdown-label">{status}</span>
                  <div className="breakdown-bar">
                    <div 
                      className="breakdown-fill"
                      style={{ 
                        width: `${(count / currentStats.total) * 100}%`,
                        backgroundColor: getStatusColor(status)
                      }}
                    />
                    <span className="breakdown-count">{count}</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* 우선순위별 통계 */}
      {currentStats.byPriority && Object.keys(currentStats.byPriority).length > 0 && (
        <div className="stats-section">
          <h4>우선순위별 분포</h4>
          <div className="stats-breakdown">
            {Object.entries(currentStats.byPriority)
              .sort(([,a], [,b]) => b - a)
              .map(([priority, count]) => (
                <div key={priority} className="breakdown-item">
                  <span className="breakdown-label">{priority}</span>
                  <div className="breakdown-bar">
                    <div 
                      className="breakdown-fill"
                      style={{ 
                        width: `${(count / currentStats.total) * 100}%`,
                        backgroundColor: getPriorityColor(priority)
                      }}
                    />
                    <span className="breakdown-count">{count}</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* 상위 태그 */}
      {currentStats.byTags && Object.keys(currentStats.byTags).length > 0 && (
        <div className="stats-section">
          <h4>상위 태그 (Top 10)</h4>
          <div className="tag-stats">
            {Object.entries(currentStats.byTags)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 10)
              .map(([tag, count]) => (
                <div key={tag} className="tag-stat">
                  <span className="tag-name">{tag}</span>
                  <span className="tag-count">{count}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      <style jsx>{`
        .stats-card {
          margin-bottom: 20px;
        }

        .stats-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .stats-header h3 {
          margin: 0;
          color: #333;
        }

        .file-info {
          font-size: 12px;
          color: #666;
          background-color: #f8f9fa;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }

        .stat-item {
          text-align: center;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 8px;
          border: 2px solid transparent;
        }

        .stat-item.filtered {
          background-color: #e3f2fd;
          border-color: #2196f3;
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
          margin-bottom: 5px;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          font-weight: 500;
        }

        .stats-section {
          margin-bottom: 25px;
        }

        .stats-section h4 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 16px;
        }

        .stats-breakdown {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .breakdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .breakdown-label {
          min-width: 80px;
          font-size: 12px;
          color: #666;
          text-transform: capitalize;
        }

        .breakdown-bar {
          flex: 1;
          height: 20px;
          background-color: #e9ecef;
          border-radius: 10px;
          position: relative;
          overflow: hidden;
        }

        .breakdown-fill {
          height: 100%;
          border-radius: 10px;
          transition: width 0.3s ease;
        }

        .breakdown-count {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 11px;
          font-weight: bold;
          color: #333;
        }

        .tag-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tag-stat {
          display: flex;
          align-items: center;
          gap: 6px;
          background-color: #f8f9fa;
          padding: 6px 10px;
          border-radius: 15px;
          font-size: 12px;
        }

        .tag-name {
          color: #495057;
        }

        .tag-count {
          background-color: #007bff;
          color: white;
          padding: 2px 6px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 10px;
        }

        @media (max-width: 768px) {
          .stats-header {
            flex-direction: column;
            gap: 10px;
            align-items: flex-start;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .breakdown-item {
            flex-direction: column;
            align-items: stretch;
            gap: 4px;
          }

          .breakdown-label {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  );
};

// 상태별 색상
const getStatusColor = (status) => {
  const colors = {
    'new': '#28a745',
    'open': '#007bff',
    'pending': '#ffc107',
    'hold': '#6c757d',
    'solved': '#17a2b8',
    'closed': '#6c757d',
    'unknown': '#e9ecef'
  };
  return colors[status.toLowerCase()] || '#6c757d';
};

// 우선순위별 색상
const getPriorityColor = (priority) => {
  const colors = {
    'urgent': '#dc3545',
    'high': '#fd7e14',
    'normal': '#28a745',
    'low': '#6c757d'
  };
  return colors[priority.toLowerCase()] || '#28a745';
};

export default TicketStats; 