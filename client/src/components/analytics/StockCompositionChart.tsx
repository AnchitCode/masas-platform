import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { TrendSnapshot } from '../../services/analyticsService';

interface StockCompositionChartProps {
  data: TrendSnapshot[];
}

/**
 * StockCompositionChart — Stacked bar chart showing in-stock vs out-of-stock SKU breakdown over time.
 */
export default function StockCompositionChart({ data }: StockCompositionChartProps) {
  if (data.length === 0) {
    return (
      <div className="analytics-empty-chart">
        <p>No inventory data yet.</p>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    date: new Date(d.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    inStock: d.inStockSkus,
    outOfStock: d.outOfStockSkus,
  }));

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <BarChart data={formatted} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
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
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
          />
          <Bar dataKey="inStock" name="In Stock" stackId="stock" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="outOfStock" name="Out of Stock" stackId="stock" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
