/**
 * LoadingSpinner — displayed during async operations.
 */
export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeClasses[size]} border-border border-t-primary rounded-full animate-spin`}
      ></div>
      {text && <p className="text-sm text-text-muted">{text}</p>}
    </div>
  );
}
