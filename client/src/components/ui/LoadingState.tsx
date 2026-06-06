import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const iconSizes: Record<string, number> = {
  sm: 20,
  md: 32,
  lg: 40,
};

interface LoadingStateProps {
  size?: string;
  label?: string;
  text?: string;
  className?: string;
}

export function LoadingState({ size = 'md', label, text, className = '' }: LoadingStateProps) {
  const message = label ?? text ?? '';
  const iconSize = iconSizes[size] ?? iconSizes.md;

  return (
    <div
      className={cn('loading-state', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className="animate-spin"
        style={{ width: iconSize, height: iconSize, color: 'var(--green-600)' }}
        aria-hidden="true"
      />
      {message ? <p className="loading-state-text">{message}</p> : null}
    </div>
  );
}
