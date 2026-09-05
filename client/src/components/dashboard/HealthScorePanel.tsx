import { cn } from '../../lib/utils';
import { Activity } from 'lucide-react';

const tierCopy: Record<string, { label: string; hint: string }> = {
  excellent: { label: 'Excellent', hint: 'Strong compliance and shelf posture.' },
  strong: { label: 'Strong', hint: 'Minor watch items; stay ahead of expiries.' },
  watch: { label: 'Needs attention', hint: 'Prioritize expiries and replenishment.' },
  critical: { label: 'Critical risk', hint: 'Immediate operational review recommended.' },
};

const tierRing: Record<string, string> = {
  excellent: 'var(--success-text)',
  strong: 'var(--green-600)',
  watch: 'var(--warning-text)',
  critical: 'var(--danger-text)',
};

interface HealthScorePanelProps {
  score: number;
  tier: string;
  className?: string;
}

export default function HealthScorePanel({ score, tier, className }: HealthScorePanelProps) {
  const t = tierCopy[tier] ?? tierCopy.strong;
  const ringColor = tierRing[tier] ?? tierRing.strong;
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn('health-score-panel', className)}>
      <div className="health-score-main">
        <div className="health-score-chart" role="img" aria-label={`Pharmacy health score ${clamped} out of 100, ${t.label}`}>
          <svg className="health-score-svg" viewBox="0 0 120 120">
            <circle
              className="health-score-circle-bg"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              cx="60"
              cy="60"
              r={radius}
            />
            <circle
              className="health-score-circle-bar"
              style={{
                color: ringColor,
                strokeDasharray: circumference,
                strokeDashoffset: offset,
              }}
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
              cx="60"
              cy="60"
              r={radius}
            />
          </svg>
          <div className="health-score-center">
            <span className="health-score-value">{clamped}</span>
            <span className="health-score-sub">Health</span>
          </div>
        </div>
        <div className="health-score-info">
          <p className="health-score-eyebrow">Pharmacy health score</p>
          <p className="health-score-tier-label">{t.label}</p>
          <p className="health-score-tier-hint">{t.hint}</p>
        </div>
      </div>
      <div className="health-score-disclaimer">
        <Activity className="health-score-disclaimer-icon" aria-hidden />
        <p className="health-score-disclaimer-text">
          Score blends expiry exposure, stock-floor risk, and availability. It is descriptive — not a regulatory
          certification.
        </p>
      </div>
    </div>
  );
}
