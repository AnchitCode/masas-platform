import { Package, AlertTriangle, XCircle, Clock } from 'lucide-react';
import type { InventoryHealthItem } from '../../services/analyticsService';

interface InventoryHealthGridProps {
  items: InventoryHealthItem[];
  loading: boolean;
}

function stockStatusBadge(status: string) {
  switch (status) {
    case 'in_stock':
      return <span className="analytics-status-badge analytics-status--ok">In Stock</span>;
    case 'low_stock':
      return <span className="analytics-status-badge analytics-status--warning">Low Stock</span>;
    case 'out_of_stock':
      return <span className="analytics-status-badge analytics-status--danger">Out of Stock</span>;
    default:
      return null;
  }
}

function expiryStatusBadge(status: string | null) {
  switch (status) {
    case 'expired':
      return <span className="analytics-status-badge analytics-status--danger">Expired</span>;
    case 'expiring_critical':
      return <span className="analytics-status-badge analytics-status--danger">Exp. &lt;7d</span>;
    case 'expiring_soon':
      return <span className="analytics-status-badge analytics-status--warning">Exp. &lt;30d</span>;
    case 'ok':
      return null;
    default:
      return null;
  }
}

/**
 * InventoryHealthGrid — per-medicine breakdown table with stock & expiry status.
 */
export default function InventoryHealthGrid({ items, loading }: InventoryHealthGridProps) {
  if (loading) {
    return <div className="analytics-loading">Loading inventory health...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="analytics-empty-chart">
        <Package style={{ width: 24, height: 24, opacity: 0.4, marginBottom: 8 }} />
        <p>No inventory items to display.</p>
      </div>
    );
  }

  // Sort: out_of_stock first, then low_stock, then in_stock
  const sorted = [...items].sort((a, b) => {
    const order: Record<string, number> = { out_of_stock: 0, low_stock: 1, in_stock: 2 };
    return (order[a.stockStatus] ?? 3) - (order[b.stockStatus] ?? 3);
  });

  return (
    <div className="analytics-health-table-wrap">
      <table className="analytics-health-table">
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Stock Status</th>
            <th>Expiry</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.id} className={item.stockStatus === 'out_of_stock' ? 'analytics-row--danger' : ''}>
              <td>
                <div className="analytics-med-name">{item.medicineName}</div>
                {item.genericName && (
                  <div className="analytics-med-generic">{item.genericName}</div>
                )}
              </td>
              <td className="analytics-qty">
                {item.stockStatus === 'out_of_stock' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}>
                    <XCircle style={{ width: 14, height: 14 }} /> 0
                  </span>
                ) : item.stockStatus === 'low_stock' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warning)' }}>
                    <AlertTriangle style={{ width: 14, height: 14 }} /> {item.quantity}
                  </span>
                ) : (
                  item.quantity
                )}
              </td>
              <td>₹{item.price.toFixed(2)}</td>
              <td>{stockStatusBadge(item.stockStatus)}</td>
              <td>
                {expiryStatusBadge(item.expiryStatus)}
                {item.expiryDate && item.expiryStatus === 'ok' && (
                  <span className="analytics-expiry-date">
                    <Clock style={{ width: 12, height: 12 }} />
                    {new Date(item.expiryDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
