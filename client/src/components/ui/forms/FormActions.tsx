import React from 'react';
import { cn } from '../../../lib/utils';

export function FormActions({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('form-actions', className)}>{children}</div>;
}
