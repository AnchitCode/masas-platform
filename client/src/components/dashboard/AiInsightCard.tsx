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
    <article className={cn('ai-insight-card', className)}>
      <div className="ai-insight-card-header">
        <div className="ai-insight-card-title-wrap">
          <span className="ai-insight-card-icon">
            <Sparkles style={{ height: '16px', width: '16px' }} strokeWidth={2} aria-hidden />
          </span>
          <h3 className="ai-insight-card-title">{title}</h3>
        </div>
        {pct !== null ? (
          <span className="ai-insight-card-confidence">
            {pct}% conf.
          </span>
        ) : null}
      </div>
      <p className="ai-insight-card-body">{body}</p>
      {action && href ? (
        <Link to={href} className="ai-insight-card-action">
          {action}
          <span className="sr-only"> — {title}</span>
        </Link>
      ) : null}
    </article>
  );
}

