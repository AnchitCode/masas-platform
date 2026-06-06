import { LoadingState } from '../ui/LoadingState';

/**
 * Legacy name — delegates to {@link LoadingState} for consistent visuals.
 */
export default function LoadingSpinner(props: { size?: string; label?: string; text?: string; className?: string }) {
  return <LoadingState {...props} />;
}
