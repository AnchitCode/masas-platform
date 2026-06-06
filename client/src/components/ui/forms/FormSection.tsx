import React from 'react';
import { cn } from '../../../lib/utils';

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className = '' }: FormSectionProps) {
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
