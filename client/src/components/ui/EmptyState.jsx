import { cn } from '../../lib/utils';

/**
 * Centered empty / locked / no-results state.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={cn('empty-state', className)}
      role="region"
      aria-label={title}
    >
      {Icon ? (
        <div className="empty-state-icon" aria-hidden="true">
          <Icon style={{ width: '100%', height: '100%' }} strokeWidth={1.75} />
        </div>
      ) : null}
      <h2 className="empty-state-title">{title}</h2>
      {description ? <p className="empty-state-description">{description}</p> : null}
      {action ? <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>{action}</div> : null}
    </div>
  );
}
