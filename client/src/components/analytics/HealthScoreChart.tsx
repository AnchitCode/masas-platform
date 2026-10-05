import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { TrendSnapshot } from '../../services/analyticsService';

interface HealthScoreChartProps {
  data: TrendSnapshot[];
}

/**
 * HealthScoreChart — 30-day area chart of health score trend.
 * Color-coded: green (≥88), amber (≥72), orange (≥55), red (<55).
 */
export default function HealthScoreChart({ data }: HealthScoreChartProps) {
  if (data.length === 0) {
    return (
      <div className="analytics-empty-chart">
        <p>No trend data yet. Data will appear after the first aggregation cycle.</p>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const lastScore = formatted[formatted.length - 1]?.healthScore ?? 0;
  const color =
    lastScore >= 88 ? '#22c55e' :
    lastScore >= 72 ? '#eab308' :
    lastScore >= 55 ? '#f97316' :
    '#ef4444';

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={formatted} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [`${value}`, 'Health Score']}
          />
          <Area
            type="monotone"
            dataKey="healthScore"
            stroke={color}
            strokeWidth={2}
            fill="url(#healthGrad)"
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
