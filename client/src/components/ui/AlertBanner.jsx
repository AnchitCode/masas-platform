import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

const config = {
  error: {
    Icon: AlertCircle,
    cls: 'alert-error',
  },
  success: {
    Icon: CheckCircle,
    cls: 'alert-success',
  },
  warning: {
    Icon: AlertTriangle,
    cls: 'alert-warning',
  },
  info: {
    Icon: Info,
    cls: 'alert-info',
  },
};

/**
 * Inline operational alert (forms, search, dashboard).
 */
export default function AlertBanner({
  variant = 'info',
  title,
  children,
  className = '',
  role = 'alert',
}) {
  const c = config[variant] || config.info;
  const { Icon, cls } = c;

  return (
    <div
      role={role}
      className={cn('alert', cls, className)}
    >
      <Icon className="alert-icon" aria-hidden="true" />
      <div style={{ minWidth: 0, flex: 1 }}>
        {title ? <p className="alert-title">{title}</p> : null}
        {children ? (
          <div style={{ color: 'inherit', opacity: 0.9 }}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
