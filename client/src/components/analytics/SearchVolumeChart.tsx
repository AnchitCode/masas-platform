import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface SearchTrendPoint {
  date: string;
  totalSearches: number;
  aiSearches: number;
  noResultSearches: number;
}

interface SearchVolumeChartProps {
  data: SearchTrendPoint[];
}

/**
 * SearchVolumeChart — Daily search volume with AI usage and zero-result overlay.
 */
export default function SearchVolumeChart({ data }: SearchVolumeChartProps) {
  if (data.length === 0) {
    return (
      <div className="analytics-empty-chart">
        <p>No search data yet. Searches will appear once customers start using the platform.</p>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <AreaChart data={formatted} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="searchGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
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
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Area
            type="monotone"
            dataKey="totalSearches"
            name="Total"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#searchGrad)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="aiSearches"
            name="AI-Powered"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            fill="url(#aiGrad)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="noResultSearches"
            name="No Results"
            stroke="#ef4444"
            strokeWidth={1.5}
            fill="none"
            strokeDasharray="4 4"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
