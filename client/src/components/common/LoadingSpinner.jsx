import { LoadingState } from '../ui/LoadingState';

/**
 * Legacy name — delegates to {@link LoadingState} for consistent visuals.
 */
export default function LoadingSpinner(props) {
  return <LoadingState {...props} />;
}
