import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendBadgeProps {
  delta: number;
  suffix?: string;
  inverted?: boolean; // true when negative delta is good (e.g., outOfStock going down)
}

/**
 * TrendBadge — "+3 ↑" indicator with semantic coloring.
 * Green for positive trends, red for negative. `inverted` flips the color logic.
 */
export default function TrendBadge({ delta, suffix = '', inverted = false }: TrendBadgeProps) {
  if (delta === 0) {
    return (
      <span className="trend-badge trend-badge--neutral">
        <Minus style={{ width: 12, height: 12 }} />
        <span>0{suffix}</span>
      </span>
    );
  }

  const isPositive = delta > 0;
  const isGood = inverted ? !isPositive : isPositive;

  return (
    <span className={`trend-badge ${isGood ? 'trend-badge--up' : 'trend-badge--down'}`}>
      {isPositive ? (
        <TrendingUp style={{ width: 12, height: 12 }} />
      ) : (
        <TrendingDown style={{ width: 12, height: 12 }} />
      )}
      <span>{isPositive ? '+' : ''}{delta}{suffix}</span>
    </span>
  );
}
