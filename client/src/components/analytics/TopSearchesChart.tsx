import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface TopSearch {
  query: string;
  searchCount: number;
  avgResultCount: number;
  aiUsageRate: number;
}

interface TopSearchesChartProps {
  data: TopSearch[];
}

/**
 * TopSearchesChart — Horizontal bar chart of most searched queries.
 */
export default function TopSearchesChart({ data }: TopSearchesChartProps) {
  if (data.length === 0) {
    return (
      <div className="analytics-empty-chart">
        <p>No searches recorded yet.</p>
      </div>
    );
  }

  const formatted = data.slice(0, 10).map((d) => ({
    ...d,
    // Truncate long queries
    label: d.query.length > 18 ? d.query.slice(0, 18) + '…' : d.query,
  }));

  return (
    <div style={{ width: '100%', height: Math.max(200, formatted.length * 36 + 40) }}>
      <ResponsiveContainer>
        <BarChart
          data={formatted}
          layout="vertical"
          margin={{ top: 4, right: 20, bottom: 4, left: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            dataKey="label"
            type="category"
            tick={{ fontSize: 12, fill: 'var(--foreground)' }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, _name: any, props: any) => {
              const item = props.payload;
              return [
                `${value} searches (avg ${item.avgResultCount} results, ${Math.round(item.aiUsageRate * 100)}% AI)`,
                'Count',
              ];
            }}
          />
          <Bar
            dataKey="searchCount"
            fill="var(--accent)"
            radius={[0, 6, 6, 0]}
            barSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
