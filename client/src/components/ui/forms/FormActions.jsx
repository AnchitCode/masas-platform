import { cn } from '../../../lib/utils';

export function FormActions({ children, className = '' }) {
  return <div className={cn('form-actions', className)}>{children}</div>;
}
