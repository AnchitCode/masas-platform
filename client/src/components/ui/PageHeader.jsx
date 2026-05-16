import { cn } from '../../lib/utils';

/**
 * Page title + description + optional actions (dashboard / public).
 */
export default function PageHeader({
  title,
  description,
  children,
  className = '',
  titleAs: TitleTag = 'h1',
}) {
  return (
    <header className={cn('page-header', className)}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <TitleTag className="page-header-title">{title}</TitleTag>
          {description ? (
            <p className="page-header-description">{description}</p>
          ) : null}
        </div>
        {children ? (
          <div style={{ display: 'flex', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>{children}</div>
        ) : null}
      </div>
    </header>
  );
}
