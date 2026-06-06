/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Search, Edit2, Trash2 } from 'lucide-react';
import inventoryService from '../../services/inventoryService';
import pharmacyService from '../../services/pharmacyService';
import MedicineModal from '../../components/inventory/MedicineModal';
import type { Pharmacy, InventoryItem } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import AlertBanner from '../../components/ui/AlertBanner';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/forms';
import { getErrorMessage, isHttpError } from '../../lib/utils';

const LOW_STOCK = 10;
const EXPIRY_WARN_DAYS = 90;

function daysUntilExpiry(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - start.getTime()) / 86400000);
}

function stockHealthVariant(item: InventoryItem) {
  const qty = typeof item.quantity === 'number' ? item.quantity : 0;
  if (!item.isAvailable || qty <= 0) return { variant: 'critical', label: 'Unavailable' };
  if (qty <= LOW_STOCK) return { variant: 'warning', label: 'Low stock' };
  return { variant: 'success', label: 'Healthy' };
}

function expiryBadge(days: number | null) {
  if (days === null) return { label: '—', variant: 'neutral', title: 'No expiry on record' };
  if (days < 0) return { label: 'Expired', variant: 'danger', title: 'Past expiry — remove from sale' };
  if (days <= 30) return { label: `${days}d`, variant: 'danger', title: 'Expiry within 30 days' };
  if (days <= EXPIRY_WARN_DAYS) return { label: `${days}d`, variant: 'warning', title: 'Expiry within 90 days' };
  return { label: `${days}d`, variant: 'success', title: 'Expiry horizon healthy' };
}

export default function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const profileRes = await pharmacyService.getOwnProfile();
      const p = profileRes?.data?.pharmacy ?? null;
      setPharmacy(p);

      if (p?.status === 'VERIFIED') {
        const invRes = await inventoryService.getInventory();
        setInventory(invRes?.data?.inventory ?? []);
      }
    } catch (err: unknown) {
      if (isHttpError(err, 404)) {
        setPharmacy(null);
      } else {
        setError('Failed to load inventory data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;
    try {
      await inventoryService.deleteMedicine(id);
      fetchData();
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to delete medicine'));
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '320px', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Loading inventory…" />
      </div>
    );
  }

  if (!pharmacy || pharmacy.status !== 'VERIFIED') {
    return (
      <div style={{ paddingBottom: '32px' }}>
        <PageHeader
          title="Inventory"
          description="List medicines, pricing, and stock so patients can find you in search."
        />
        <EmptyState
          icon={Package}
          title="Inventory locked"
          description={
            !pharmacy
              ? 'Complete your pharmacy profile first. After verification, you can publish stock to MASAS search.'
              : `Your pharmacy is ${pharmacy.status}. Inventory opens once your account is verified.`
          }
          action={
            <Button onClick={() => (window.location.href = '/dashboard/profile')} size="sm">
              Go to profile
            </Button>
          }
        />
      </div>
    );
  }

  const q = searchTerm.toLowerCase();
  const filteredInventory = (inventory || []).filter((item) => {
    const name = item.medicine?.name?.toLowerCase() ?? '';
    const generic = item.medicine?.genericName?.toLowerCase() ?? '';
    return name.includes(q) || generic.includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>Inventory</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Mission-critical stock operations — scan-friendly layout, expiry posture, and floor alerts.</p>
        </div>
        
        <Button onClick={handleOpenAdd} leftIcon={Plus} variant="primary">
          Add medicine
        </Button>
      </div>

      {error && (
        <AlertBanner variant="error" title="Could not load data">
          {error}
        </AlertBanner>
      )}

      <Card>
        <CardContent style={{ padding: '16px' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <label htmlFor="inventory-search" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
              Search inventory
            </label>
            <Search
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--muted)', pointerEvents: 'none' }}
              aria-hidden
            />
            <Input
              id="inventory-search"
              type="search"
              style={{ paddingLeft: '36px' }}
              placeholder="Search by medicine or generic name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
            />
          </div>
        </CardContent>
      </Card>

      <Card style={{ overflow: 'hidden', padding: 0 }}>
        <div className="masas-table-shell" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <table className="masas-table">
            <thead className="masas-thead">
              <tr>
                <th scope="col" className="masas-th">Medicine</th>
                <th scope="col" className="masas-th" style={{ display: 'none' }}>Generic</th>
                <th scope="col" className="masas-th">Price (₹)</th>
                <th scope="col" className="masas-th">Stock</th>
                <th scope="col" className="masas-th">Shelf health</th>
                <th scope="col" className="masas-th">Availability</th>
                <th scope="col" className="masas-th">Expiry</th>
                <th scope="col" className="masas-th" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="masas-td" style={{ textAlign: 'center', padding: '56px 0', color: 'var(--muted)' }}>
                    {inventory.length === 0 ? (
                      <EmptyState
                        icon={Package}
                        title="No medicines added yet"
                        description="Add a medicine to begin publishing your stock."
                      />
                    ) : 'No medicines match your search.'}
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const days = daysUntilExpiry(item.expiryDate);
                  const exp = expiryBadge(days);
                  const shelf = stockHealthVariant(item);
                  const inStock = item.isAvailable && (item.quantity ?? 0) > 0;

                  return (
                    <tr key={item.id} className="masas-tr">
                      <td className="masas-td">
                        <p style={{ fontWeight: '600', textTransform: 'capitalize', color: 'var(--text)' }}>{item.medicine?.name ?? '—'}</p>
                        <p style={{ marginTop: '2px', fontSize: '11px', textTransform: 'capitalize', color: 'var(--muted)' }}>
                          {item.medicine?.genericName || '—'}
                        </p>
                      </td>
                      <td className="masas-td" style={{ display: 'none' }}>
                        {item.medicine?.genericName || '—'}
                      </td>
                      <td className="masas-td" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        ₹{typeof item.price === 'number' ? item.price.toFixed(2) : '—'}
                      </td>
                      <td className="masas-td" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <span
                          style={{
                            fontWeight: '600',
                            color: (item.quantity ?? 0) > 0 && (item.quantity ?? 0) <= LOW_STOCK ? '#d97706' : 'var(--text)'
                          }}
                        >
                          {item.quantity ?? 0}
                        </span>
                      </td>
                      <td className="masas-td">
                        <StatusBadge variant={shelf.variant} withDot>
                          {shelf.label}
                        </StatusBadge>
                      </td>
                      <td className="masas-td">
                        {inStock ? (
                          <StatusBadge variant="success">In stock</StatusBadge>
                        ) : (
                          <StatusBadge variant="danger">Out of stock</StatusBadge>
                        )}
                      </td>
                      <td className="masas-td">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>
                            {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '—'}
                          </span>
                          {item.expiryDate && (
                            <StatusBadge variant={exp.variant}>
                              {exp.label}
                            </StatusBadge>
                          )}
                        </div>
                      </td>
                      <td className="masas-td" style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            title="Edit medicine"
                            style={{ padding: '8px', borderRadius: '8px', color: 'var(--slate-500)', transition: 'all var(--duration) var(--ease)' }}
                            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--green-600)'; e.currentTarget.style.background = 'var(--green-50)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--slate-500)'; e.currentTarget.style.background = 'transparent'; }}
                          >
                            <Edit2 style={{ width: '16px', height: '16px' }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            title="Delete medicine"
                            style={{ padding: '8px', borderRadius: '8px', color: 'var(--slate-500)', transition: 'all var(--duration) var(--ease)' }}
                            onMouseOver={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fef2f2'; }}
                            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--slate-500)'; e.currentTarget.style.background = 'transparent'; }}
                          >
                            <Trash2 style={{ width: '16px', height: '16px' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <MedicineModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchData} initialData={editingItem} />
    </div>
  );
}
