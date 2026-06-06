import React from 'react';
import { cn } from '../../lib/utils';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, style, ...props }: SkeletonProps) {
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

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
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

export function SkeletonCircle({ className, size = 40, ...props }: { className?: string; size?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      className={className}
      style={{ width: size, height: size, borderRadius: '50%' }}
      {...props}
    />
  );
}

