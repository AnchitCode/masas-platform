import { cn } from '../../lib/utils';

/**
 * Shimmer placeholder for loading layouts.
 */
export function Skeleton({ className, style, ...props }) {
  return (
    <div
      className={cn('skeleton', className)}
      role="presentation"
      aria-hidden="true"
      style={style}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div
      className={className}
      role="presentation"
      aria-hidden="true"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          style={{
            height: 14,
            width: i === lines - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCircle({ className, size = 40, ...props }) {
  return (
    <Skeleton
      className={className}
      style={{ width: size, height: size, borderRadius: '50%' }}
      {...props}
    />
  );
}
