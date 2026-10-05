import { AlertTriangle } from 'lucide-react';

interface DemandGap {
  query: string;
  searchCount: number;
  notFoundCount: number;
  gapRate: number;
}

interface DemandGapsTableProps {
  data: DemandGap[];
  loading: boolean;
}

/**
 * DemandGapsTable — Queries where medicines were searched but not found.
 * High gap rate = market opportunity.
 */
export default function DemandGapsTable({ data, loading }: DemandGapsTableProps) {
  if (loading) {
    return <div className="analytics-loading">Loading demand gaps...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="analytics-empty-chart">
        <AlertTriangle style={{ width: 24, height: 24, opacity: 0.4, marginBottom: 8 }} />
        <p>No demand gaps detected. All targeted medicine searches found results.</p>
      </div>
    );
  }

  return (
    <div className="analytics-health-table-wrap">
      <table className="analytics-health-table">
        <thead>
          <tr>
            <th>Query</th>
            <th>Total Searches</th>
            <th>Not Found</th>
            <th>Gap Rate</th>
          </tr>
        </thead>
        <tbody>
          {data.map((gap) => (
            <tr key={gap.query}>
              <td>
                <span className="analytics-med-name">{gap.query}</span>
              </td>
              <td className="analytics-qty">{gap.searchCount}</td>
              <td className="analytics-qty" style={{ color: 'var(--danger)' }}>
                {gap.notFoundCount}
              </td>
              <td>
                <span
                  className={`analytics-status-badge ${
                    gap.gapRate >= 0.7
                      ? 'analytics-status--danger'
                      : gap.gapRate >= 0.4
                        ? 'analytics-status--warning'
                        : 'analytics-status--ok'
                  }`}
                >
                  {Math.round(gap.gapRate * 100)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
