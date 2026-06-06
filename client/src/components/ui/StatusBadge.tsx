import React from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const variantConfig: Record<string, { cls: string; icon: React.ElementType | null }> = {
  primary:      { cls: 'badge-info',    icon: null },
  success:      { cls: 'badge-success', icon: CheckCircle },
  warning:      { cls: 'badge-warning', icon: AlertTriangle },
  danger:       { cls: 'badge-danger',  icon: X },
  info:         { cls: 'badge-info',    icon: null },
  neutral:      { cls: 'badge-neutral', icon: null },
  error:        { cls: 'badge-danger',  icon: X },
  healthy:      { cls: 'badge-success', icon: CheckCircle },
  low_stock:    { cls: 'badge-warning', icon: AlertTriangle },
  critical:     { cls: 'badge-danger',  icon: X },
  expired:      { cls: 'badge-danger',  icon: X },
  pending:      { cls: 'badge-warning', icon: AlertTriangle },
  active:       { cls: 'badge-info',    icon: CheckCircle },
  inactive:     { cls: 'badge-neutral', icon: null },
};

interface StatusBadgeProps {
  variant?: string;
  children: React.ReactNode;
  className?: string;
  withDot?: boolean;
}

export default function StatusBadge({
  variant = 'neutral',
  children,
  className = '',
  withDot = false,
}: StatusBadgeProps) {
  const config = variantConfig[variant] || variantConfig.neutral;
  const IconComponent = config.icon;

  return (
    <span className={cn('badge', config.cls, className)}>
      {IconComponent && (
        <IconComponent className="badge-icon" aria-hidden="true" />
      )}
      {withDot && !IconComponent && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            flexShrink: 0,
            opacity: 0.7,
          }}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}
