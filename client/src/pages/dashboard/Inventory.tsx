/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Edit2, Trash2, X } from 'lucide-react';
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
import { Modal, ModalBody, ModalFooter } from '../../components/ui/Modal';
import { getErrorMessage, isHttpError, cn } from '../../lib/utils';

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
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await inventoryService.deleteMedicine(itemToDelete.id);
      setItemToDelete(null);
      fetchData();
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to delete medicine'));
    } finally {
      setIsDeleting(false);
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

  // Inventory Summary Stats
  const stats = useMemo(() => {
    let healthy = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let expiringSoon = 0;

    for (const item of inventory) {
      const qty = typeof item.quantity === 'number' ? item.quantity : 0;
      const days = daysUntilExpiry(item.expiryDate);

      if (!item.isAvailable || qty <= 0) {
        outOfStock++;
      } else if (qty <= LOW_STOCK) {
        lowStock++;
      } else {
        healthy++;
      }

      if (days !== null && days <= EXPIRY_WARN_DAYS) {
        expiringSoon++;
      }
    }

    return {
      total: inventory.length,
      healthy,
      lowStock,
      outOfStock,
      expiringSoon,
    };
  }, [inventory]);

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
            <Button onClick={() => navigate('/dashboard/profile')} size="sm">
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
            Inventory
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
            Mission-critical stock operations — scan-friendly layout, expiry posture, and floor alerts.
          </p>
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

      {/* Summary Stats Row */}
      <div className="inventory-stats-bar">
        <div className="inventory-stat-card">
          <span className="inventory-stat-card__label">Total Medicines</span>
          <span className="inventory-stat-card__value">{stats.total}</span>
        </div>
        <div className="inventory-stat-card">
          <span className="inventory-stat-card__label">Healthy Stock</span>
          <span className="inventory-stat-card__value inventory-stat-card__value--success">
            {stats.healthy}
          </span>
        </div>
        <div className="inventory-stat-card">
          <span className="inventory-stat-card__label">Low Stock (≤10)</span>
          <span className="inventory-stat-card__value inventory-stat-card__value--warning">
            {stats.lowStock}
          </span>
        </div>
        <div className="inventory-stat-card">
          <span className="inventory-stat-card__label">Expiring Soon (≤90d)</span>
          <span className="inventory-stat-card__value inventory-stat-card__value--danger">
            {stats.expiringSoon}
          </span>
        </div>
      </div>

      {/* Search Input */}
      <Card>
        <CardContent style={{ padding: '14px 16px' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <label
              htmlFor="inventory-search"
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              Search inventory
            </label>
            <Search
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                color: 'var(--muted)',
                pointerEvents: 'none',
              }}
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
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card style={{ overflow: 'hidden', padding: 0 }}>
        <div className="masas-table-shell" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <table className="masas-table">
            <thead className="masas-thead">
              <tr>
                <th scope="col" className="masas-th">
                  Medicine
                </th>
                <th scope="col" className="masas-th">
                  Price (₹)
                </th>
                <th scope="col" className="masas-th">
                  Stock
                </th>
                <th scope="col" className="masas-th">
                  Shelf health
                </th>
                <th scope="col" className="masas-th">
                  Availability
                </th>
                <th scope="col" className="masas-th">
                  Expiry
                </th>
                <th scope="col" className="masas-th" style={{ textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="masas-td"
                    style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}
                  >
                    {inventory.length === 0 ? (
                      <EmptyState
                        icon={Package}
                        title="No medicines added yet"
                        description="Add a medicine to begin publishing your stock to patients."
                      />
                    ) : (
                      <div className="inventory-search-empty">
                        <Search
                          style={{
                            width: '32px',
                            height: '32px',
                            color: 'var(--slate-400)',
                            margin: '0 auto 8px',
                          }}
                          aria-hidden="true"
                        />
                        <p style={{ fontWeight: '600', color: 'var(--text)', fontSize: '14px', margin: 0 }}>
                          No medicines match "{searchTerm}"
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                          Try a different medicine or generic name, or clear your search.
                        </p>
                        <Button
                          size="sm"
                          variant="secondary"
                          style={{ marginTop: '12px' }}
                          onClick={() => setSearchTerm('')}
                        >
                          Clear search
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const days = daysUntilExpiry(item.expiryDate);
                  const exp = expiryBadge(days);
                  const shelf = stockHealthVariant(item);
                  const inStock = item.isAvailable && (item.quantity ?? 0) > 0;

                  const isExpired = days !== null && days <= 0;
                  const isNearExpiry = days !== null && days > 0 && days <= 30;
                  const isLowStock = !inStock || (item.quantity ?? 0) <= LOW_STOCK;

                  let rowAlertClass = '';
                  if (isExpired) rowAlertClass = 'inventory-tr--expired';
                  else if (isNearExpiry) rowAlertClass = 'inventory-tr--near-expiry';
                  else if (isLowStock) rowAlertClass = 'inventory-tr--low-stock';

                  return (
                    <tr key={item.id} className={cn('masas-tr', rowAlertClass)}>
                      <td className="masas-td">
                        <p
                          style={{
                            fontWeight: '600',
                            textTransform: 'capitalize',
                            color: 'var(--text)',
                            margin: 0,
                          }}
                        >
                          {item.medicine?.name ?? '—'}
                        </p>
                        <p
                          style={{
                            marginTop: '2px',
                            fontSize: '11.5px',
                            textTransform: 'capitalize',
                            color: 'var(--muted)',
                            margin: '2px 0 0 0',
                          }}
                        >
                          {item.medicine?.genericName || '—'}
                        </p>
                      </td>
                      <td className="masas-td" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        ₹{typeof item.price === 'number' ? item.price.toFixed(2) : '—'}
                      </td>
                      <td className="masas-td" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <span
                          style={{
                            fontWeight: '600',
                            color:
                              (item.quantity ?? 0) > 0 && (item.quantity ?? 0) <= LOW_STOCK
                                ? '#d97706'
                                : 'var(--text)',
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
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontVariantNumeric: 'tabular-nums',
                              color: 'var(--muted)',
                            }}
                          >
                            {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '—'}
                          </span>
                          {item.expiryDate && <StatusBadge variant={exp.variant}>{exp.label}</StatusBadge>}
                        </div>
                      </td>
                      <td className="masas-td" style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            title="Edit medicine"
                            className="inventory-action-btn inventory-action-btn--edit"
                            aria-label={`Edit ${item.medicine?.name ?? 'medicine'}`}
                          >
                            <Edit2 style={{ width: '15px', height: '15px' }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            title="Delete medicine"
                            className="inventory-action-btn inventory-action-btn--danger"
                            aria-label={`Delete ${item.medicine?.name ?? 'medicine'}`}
                          >
                            <Trash2 style={{ width: '15px', height: '15px' }} />
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

      {/* Add/Edit Modal */}
      <MedicineModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        initialData={editingItem}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!itemToDelete}
        onClose={() => !isDeleting && setItemToDelete(null)}
        title="Delete Medicine"
        description="Remove this medicine from your inventory listing."
        size="sm"
      >
        <ModalBody>
          <p style={{ fontSize: '13.5px', color: 'var(--text)', margin: 0 }}>
            Are you sure you want to delete{' '}
            <strong style={{ textTransform: 'capitalize' }}>
              {itemToDelete?.medicine?.name}
            </strong>
            ?
          </p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px', margin: '6px 0 0 0' }}>
            This will immediately remove the medicine from public availability search results.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={isDeleting}
            onClick={() => setItemToDelete(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={isDeleting}
            onClick={confirmDelete}
          >
            Delete Medicine
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

