import { cn } from '../../lib/utils';
import { Activity } from 'lucide-react';

const tierCopy = {
  excellent: { label: 'Excellent', hint: 'Strong compliance and shelf posture.' },
  strong: { label: 'Strong', hint: 'Minor watch items; stay ahead of expiries.' },
  watch: { label: 'Needs attention', hint: 'Prioritize expiries and replenishment.' },
  critical: { label: 'Critical risk', hint: 'Immediate operational review recommended.' },
};

const tierRing = {
  excellent: 'var(--success-text)',
  strong: 'var(--green-600)',
  watch: 'var(--warning-text)',
  critical: 'var(--danger-text)',
};

/**
 * Radial health score — SVG stroke uses currentColor from tier token class.
 */
export default function HealthScorePanel({ score, tier, className }) {
  const t = tierCopy[tier] ?? tierCopy.strong;
  const ringColor = tierRing[tier] ?? tierRing.strong;
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn(className)}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ position: 'relative', height: '112px', width: '112px', flexShrink: 0 }} role="img" aria-label={`Pharmacy health score ${clamped} out of 100, ${t.label}`}>
          <svg style={{ height: '100%', width: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 120 120">
            <circle
              style={{ color: 'var(--border)' }}
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              cx="60"
              cy="60"
              r={radius}
            />
            <circle
              style={{
                color: ringColor,
                transition: 'stroke-dashoffset 500ms ease-out'
              }}
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
              cx="60"
              cy="60"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '24px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: 'var(--text)' }}>{clamped}</span>
            <span style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)' }}>Health</span>
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)' }}>Pharmacy health score</p>
          <p style={{ marginTop: '4px', fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>{t.label}</p>
          <p style={{ marginTop: '8px', maxWidth: '448px', fontSize: '14px', lineHeight: '1.6', color: 'var(--muted)' }}>{t.hint}</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--slate-50)', padding: '12px 16px', maxWidth: '320px' }}>
        <Activity style={{ marginTop: '2px', height: '16px', width: '16px', flexShrink: 0, color: 'var(--muted)' }} aria-hidden />
        <p style={{ fontSize: '12px', lineHeight: '1.6', color: 'var(--slate-600)' }}>
          Score blends expiry exposure, stock-floor risk, and availability. It is descriptive — not a regulatory
          certification.
        </p>
      </div>
    </div>
  );
}
