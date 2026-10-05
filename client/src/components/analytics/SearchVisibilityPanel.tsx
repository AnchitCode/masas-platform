import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Eye, Search } from 'lucide-react';
import type { SearchVisibility } from '../../services/analyticsService';

interface SearchVisibilityPanelProps {
  data: SearchVisibility | null;
  loading: boolean;
}

/**
 * SearchVisibilityPanel — line chart of daily impressions + top query list.
 */
export default function SearchVisibilityPanel({ data, loading }: SearchVisibilityPanelProps) {
  if (loading) {
    return (
      <div className="analytics-card">
        <div className="analytics-card-header">
          <h3><Eye style={{ width: 16, height: 16 }} /> Search Visibility</h3>
        </div>
        <div className="analytics-loading">Loading...</div>
      </div>
    );
  }

  if (!data || data.totalImpressions === 0) {
    return (
      <div className="analytics-card">
        <div className="analytics-card-header">
          <h3><Eye style={{ width: 16, height: 16 }} /> Search Visibility</h3>
        </div>
        <div className="analytics-empty-chart">
          <p>Your pharmacy hasn't appeared in any searches yet. Once customers search nearby, you'll see visibility metrics here.</p>
        </div>
      </div>
    );
  }

  const chartData = data.dailyImpressions.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    impressions: d.count,
  }));

  return (
    <div className="analytics-card">
      <div className="analytics-card-header">
        <h3><Eye style={{ width: 16, height: 16 }} /> Search Visibility</h3>
        <span className="analytics-badge">{data.totalImpressions} total impressions</span>
      </div>

      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="impressions"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {data.topQueries.length > 0 && (
        <div className="analytics-top-queries">
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search style={{ width: 14, height: 14 }} /> Top Queries
          </h4>
          <div className="analytics-query-list">
            {data.topQueries.slice(0, 8).map((q, i) => (
              <div key={q.query} className="analytics-query-row">
                <span className="analytics-query-rank">{i + 1}</span>
                <span className="analytics-query-text">{q.query}</span>
                <span className="analytics-query-count">{q.impressions}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
