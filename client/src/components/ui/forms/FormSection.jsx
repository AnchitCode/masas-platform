import { cn } from '../../../lib/utils';

export function FormSection({ title, description, children, className = '' }) {
  return (
    <div className={cn('card', className)}>
      <div className="form-section-header">
        {title}
        {description ? (
          <p style={{ marginTop: 4, fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>{description}</p>
        ) : null}
      </div>
      <div className="form-section" style={{ marginBottom: 0 }}>
        {children}
      </div>
    </div>
  );
}
