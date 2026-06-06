import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AiInsightCardProps {
  title: string;
  confidence?: number;
  body: string;
  action?: string;
  href?: string;
  className?: string;
}

export default function AiInsightCard({ title, confidence, body, action, href, className }: AiInsightCardProps) {
  const pct = typeof confidence === 'number' ? Math.round(Math.min(1, Math.max(0, confidence)) * 100) : null;

  return (
    <article
      className={cn(className)}
      style={{
        display: 'flex',
        minHeight: '0',
        flexDirection: 'column',
        borderRadius: 'var(--radius-card)',
        border: '1px solid #e9d5ff', // intelligence border
        backgroundColor: 'var(--surface)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)',
        transition: 'border-color var(--duration) var(--ease), box-shadow var(--duration) var(--ease)'
      }}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = '#d8b4fe'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e9d5ff'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', minWidth: '0', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'flex', height: '32px', width: '32px', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '8px', backgroundColor: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}>
            <Sparkles style={{ height: '16px', width: '16px' }} strokeWidth={2} aria-hidden />
          </span>
          <h3 style={{ minWidth: '0', fontSize: '14px', fontWeight: '600', lineHeight: '1.3', color: 'var(--text)', margin: 0 }}>{title}</h3>
        </div>
        {pct !== null ? (
          <span style={{ flexShrink: 0, borderRadius: '9999px', backgroundColor: '#faf5ff', padding: '2px 8px', fontSize: '11px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', color: '#7c3aed', border: '1px solid #e9d5ff' }}>
            {pct}% conf.
          </span>
        ) : null}
      </div>
      <p style={{ marginTop: '12px', flex: '1 1 0%', fontSize: '12px', lineHeight: '1.6', color: 'var(--muted)', margin: '12px 0 0 0' }}>{body}</p>
      {action && href ? (
        <Link
          to={href}
          style={{ marginTop: '16px', display: 'inline-flex', width: 'fit-content', alignItems: 'center', fontSize: '12px', fontWeight: '600', color: '#7c3aed', textDecoration: 'none' }}
          onMouseOver={(e) => e.currentTarget.style.color = '#6d28d9'}
          onMouseOut={(e) => e.currentTarget.style.color = '#7c3aed'}
        >
          {action}
          <span className="sr-only"> — {title}</span>
        </Link>
      ) : null}
    </article>
  );
}
