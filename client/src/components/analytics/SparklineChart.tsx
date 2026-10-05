import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
}

/**
 * SparklineChart — Inline mini area chart for KPI tiles.
 * No axes, no labels — just the trend shape.
 */
export default function SparklineChart({
  data,
  color = 'var(--accent)',
  height = 32,
}: SparklineChartProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, '')})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
