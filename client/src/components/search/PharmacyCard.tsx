import React from 'react';
import { useNavigate, useInRouterContext } from 'react-router-dom';
import { MapPin, Navigation, Store, CheckCircle, AlertTriangle, XCircle, Sparkles, ArrowRight } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import type { Pharmacy, Medicine, InventoryItem } from '../../types';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

function formatDistanceMeters(meters: number) {
  const m = Number(meters);
  if (!Number.isFinite(m)) return '—';
  if (m < 1000) return `${Math.round(m)} m away`;
  return `${(m / 1000).toFixed(1)} km away`;
}

function getStockInfo(qty: number) {
  if (qty > 10) return { label: 'In Stock', variant: 'success', icon: CheckCircle };
  if (qty > 0) return { label: 'Low Stock', variant: 'warning', icon: AlertTriangle };
  return { label: 'Out of Stock', variant: 'danger', icon: XCircle };
}

function RouterDetailButton({ to, ...props }: { to: string } & React.ComponentProps<typeof Button>) {
  const navigate = useNavigate();
  return (
    <Button
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) navigate(to);
      }}
    />
  );
}

function FallbackDetailButton({ to, ...props }: { to: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) window.location.href = to;
      }}
    />
  );
}

function DetailButton({ to, ...props }: { to: string } & React.ComponentProps<typeof Button>) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <RouterDetailButton to={to} {...props} />;
  }
  return <FallbackDetailButton to={to} {...props} />;
}

interface PharmacyCardProps {
  pharmacy: Pharmacy;
  distanceMeters: number;
  medicine?: Medicine;
  inventory?: InventoryItem;
  matchType?: 'exact' | 'partial' | 'generic' | 'semantic';
  className?: string;
}

export default function PharmacyCard({
  pharmacy,
  distanceMeters,
  medicine,
  inventory,
  matchType,
  className = '',
}: PharmacyCardProps) {
  if (!pharmacy) return null;

  const detailHref = `/pharmacy/${pharmacy.id}`;
  const stockInfo = inventory ? getStockInfo(inventory.quantity) : null;
  const isSemantic = matchType === 'semantic';

  return (
    <article
      className={cn(
        'pharmacy-card',
        isSemantic && 'pharmacy-card--semantic',
        className
      )}
    >
      {/* ── Top Header: Medicine Name, Subtitle, Match Badge & Stock Badge ── */}
      {medicine && (
        <div className="pharmacy-card__header">
          <div className="pharmacy-card__medicine-info">
            <h3 className="pharmacy-card__medicine-title">{medicine.name}</h3>
            <p className="pharmacy-card__medicine-meta">
              <span>{[medicine.genericName, medicine.dosageForm].filter(Boolean).join(' · ')}</span>
              {isSemantic ? (
                <span className="pharmacy-card__match-badge" data-testid="similar-match-label">
                  <Sparkles className="w-3 h-3" />
                  Similar match
                </span>
              ) : null}
            </p>
          </div>
          {stockInfo && (
            <div className="pharmacy-card__badge-wrap">
              <StatusBadge variant={stockInfo.variant}>
                {stockInfo.label}
              </StatusBadge>
            </div>
          )}
        </div>
      )}

      {/* ── Middle: Pharmacy Info ── */}
      <div className="pharmacy-card__store">
        <div className="pharmacy-card__store-icon" aria-hidden="true">
          <Store className="w-4 h-4" />
        </div>
        <div className="pharmacy-card__store-details">
          <h4 className="pharmacy-card__store-name">{pharmacy.name}</h4>
          <div className="pharmacy-card__store-address">
            <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{pharmacy.address}</span>
          </div>
        </div>
      </div>

      {/* ── Bottom: Price, Distance & View Details CTA ── */}
      <div className="pharmacy-card__footer">
        <div className="pharmacy-card__metrics">
          {inventory && (
            <div className="pharmacy-card__price">
              ₹{Number(inventory.price).toFixed(2)}
            </div>
          )}
          <div className="pharmacy-card__distance">
            <Navigation className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{formatDistanceMeters(distanceMeters)}</span>
          </div>
        </div>
        <DetailButton
          to={detailHref}
          variant="primary"
          size="sm"
          rightIcon={ArrowRight}
          className="pharmacy-card__action-btn"
        >
          View details
        </DetailButton>
      </div>
    </article>
  );
}

