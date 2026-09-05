import React from 'react';
import { Skeleton } from './SkeletonLoader';

interface SearchResultSkeletonProps {
  count?: number;
}

/**
 * SearchResultSkeleton
 *
 * Matches the layout and dimensions of PharmacyCard to prevent
 * layout shift (CLS) and provide instant visual feedback while searching.
 */
export default function SearchResultSkeleton({ count = 3 }: SearchResultSkeletonProps) {
  return (
    <div
      className="search-results-list"
      role="status"
      aria-label="Searching verified stock"
      data-testid="search-results-skeleton"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="pharmacy-card pharmacy-card-skeleton">
          {/* Header row: Medicine name + status badge placeholder */}
          <div className="pharmacy-card__header">
            <div style={{ flex: 1 }}>
              <Skeleton style={{ height: 20, width: '48%', marginBottom: 6 }} />
              <Skeleton style={{ height: 13, width: '32%' }} />
            </div>
            <Skeleton style={{ height: 22, width: 84, borderRadius: 9999 }} />
          </div>

          {/* Store row: icon + pharmacy name + address */}
          <div className="pharmacy-card__store" style={{ margin: '14px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Skeleton style={{ height: 16, width: 16, borderRadius: '50%' }} />
              <Skeleton style={{ height: 15, width: '55%' }} />
            </div>
            <Skeleton style={{ height: 12, width: '75%', marginLeft: 22 }} />
          </div>

          {/* Footer row: price + distance metrics + details button */}
          <div className="pharmacy-card__footer">
            <div className="pharmacy-card__metrics">
              <Skeleton style={{ height: 22, width: 64 }} />
              <Skeleton style={{ height: 14, width: 56 }} />
            </div>
            <Skeleton style={{ height: 32, width: 104, borderRadius: 'var(--radius-input)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
