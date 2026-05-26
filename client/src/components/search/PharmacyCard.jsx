import { MapPin, Navigation, Store, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

function formatDistanceMeters(meters) {
  const m = Number(meters);
  if (!Number.isFinite(m)) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function getStockInfo(qty) {
  if (qty > 10) return { label: 'In Stock', variant: 'success', icon: CheckCircle };
  if (qty > 0) return { label: 'Low Stock', variant: 'warning', icon: AlertTriangle };
  return { label: 'Out of Stock', variant: 'danger', icon: XCircle };
}

export default function PharmacyCard({
  pharmacy,
  distanceMeters,
  medicine,
  inventory,
  className = '',
}) {
  if (!pharmacy) return null;

  const detailHref = `/pharmacy/${pharmacy.id}`;
  const stockInfo = inventory ? getStockInfo(inventory.quantity) : null;
  const StockIcon = stockInfo?.icon;

  return (
    <Card className={className}>
      <CardContent className="p-5">
        {medicine && (
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-text capitalize">{medicine.name}</h3>
              <p className="text-sm text-muted">
                {[medicine.genericName, medicine.dosageForm].filter(Boolean).join(' · ')}
              </p>
            </div>
            {stockInfo && (
              <StatusBadge variant={stockInfo.variant}>
                {StockIcon && <StockIcon className="w-3 h-3" />}
                {stockInfo.label}
              </StatusBadge>
            )}
          </div>
        )}

        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-slate-50 border border-border rounded-lg shrink-0">
            <Store className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h4 className="font-semibold text-text">{pharmacy.name}</h4>
            <div className="flex items-start gap-1 text-sm text-muted mt-1">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{pharmacy.address}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-4">
            {inventory && (
              <div className="font-bold text-green-700 text-lg">
                ₹{Number(inventory.price).toFixed(2)}
              </div>
            )}
            <div className="flex items-center gap-1 text-sm text-muted">
              <Navigation className="w-4 h-4" />
              {formatDistanceMeters(distanceMeters)} away
            </div>
          </div>
          <Button
            variant="primary"
            onClick={() => window.location.href = detailHref}
          >
            View details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
