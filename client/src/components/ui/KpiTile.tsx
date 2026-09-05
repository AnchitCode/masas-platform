import React from 'react';
import { cn } from '../../lib/utils';

export interface KpiTileProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | string;
  className?: string;
}

/**
 * KpiTile
 *
 * Shared KPI summary tile used across Dashboard and AdminDashboard.
 * Preserves existing layout, typography, icon wrapping, and tone colors.
 */
export default function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'success',
  className,
}: KpiTileProps) {
  return (
    <div className={cn('kpi-tile', className)}>
      <div className="kpi-header">
        <div>
          <p className="kpi-label">{label}</p>
          <p className="kpi-value">{value}</p>
        </div>
        <span className={cn('kpi-icon-wrap', `kpi-${tone}`)}>
          <Icon style={{ width: 20, height: 20 }} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
      {hint ? <p className="kpi-hint">{hint}</p> : null}
    </div>
  );
}
