/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import adminService from '../../services/adminService';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import AlertBanner from '../../components/ui/AlertBanner';
import EmptyState from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Modal, ModalBody, ModalFooter } from '../../components/ui/Modal';
import {
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Store,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { cn, getErrorMessage } from '../../lib/utils';
import type { Pharmacy } from '../../types';

const statusVariantMap: Record<string, string> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
};

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Verified', value: 'VERIFIED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const ITEMS_PER_PAGE = 10;

export default function AdminPharmacies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Confirmation modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<string | null>(null);
  const [modalPharmacy, setModalPharmacy] = useState<Pharmacy | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Ignore stale list responses when a newer fetch starts (avoids race after verify/reject)
  const fetchRequestId = useRef(0);

  const fetchPharmacies = useCallback(async (showLoading = true) => {
    const requestId = ++fetchRequestId.current;
    setError('');
    if (showLoading) setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: ITEMS_PER_PAGE };
      if (statusFilter) params.status = statusFilter;
      const res = await adminService.getPharmacies(params);
      if (requestId !== fetchRequestId.current) return;
      setPharmacies(res?.data?.data?.pharmacies ?? []);
      setTotal(res?.data?.data?.total ?? 0);
    } catch (err: unknown) {
      if (requestId !== fetchRequestId.current) return;
      setError(getErrorMessage(err, 'Failed to load pharmacies'));
    } finally {
      if (requestId === fetchRequestId.current && showLoading) {
        setLoading(false);
      }
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchPharmacies();
  }, [fetchPharmacies]);

  // Sync filter to URL
  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    if (value) {
      setSearchParams({ status: value });
    } else {
      setSearchParams({});
    }
  };

  // Open confirmation modal
  const openActionModal = (pharmacy: Pharmacy, action: string) => {
    setModalPharmacy(pharmacy);
    setModalAction(action);
    setRejectionReason('');
    setActionError('');
    setActionSuccess('');
    setModalOpen(true);
  };

  // Execute status update
  const handleStatusUpdate = async () => {
    if (!modalPharmacy || !modalAction) return;
    setActionLoading(true);
    setActionError('');

    const pharmacyId = modalPharmacy.id;
    const pharmacyName = modalPharmacy.name;

    // Cancel any in-flight list fetch so it cannot overwrite the update
    fetchRequestId.current += 1;

    try {
      const data: { status: string; rejectionReason?: string } = { status: modalAction! };
      if (modalAction === 'REJECTED' && rejectionReason.trim()) {
        data.rejectionReason = rejectionReason.trim();
      }

      const res = await adminService.updatePharmacyStatus(pharmacyId, data);

      if (!res?.data?.success) {
        throw new Error(res?.data?.message || 'Failed to update pharmacy status');
      }

      const updatedPharmacy = res?.data?.data?.pharmacy;
      if (!updatedPharmacy?.status) {
        throw new Error('Server did not return an updated pharmacy status');
      }
      const newStatus = updatedPharmacy.status;

      setActionLoading(false);
      setModalOpen(false);
      setModalPharmacy(null);
      setModalAction(null);

      setActionSuccess(
        newStatus === 'VERIFIED'
          ? `${pharmacyName} has been verified successfully.`
          : `${pharmacyName} has been rejected.`
      );

      // When viewing a status tab, remove rows that no longer match the filter
      if (statusFilter && statusFilter !== newStatus) {
        setPharmacies((prev) => prev.filter((p) => p.id !== pharmacyId));
        setTotal((prev) => Math.max(0, prev - 1));
      } else {
        setPharmacies((prev) =>
          prev.map((p) =>
            p.id === pharmacyId
              ? { ...p, ...updatedPharmacy, status: newStatus }
              : p
          )
        );
      }

      await fetchPharmacies(false);

      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Failed to update pharmacy status');
      setActionError(msg);
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 32 }}>
      <PageHeader
        title="Pharmacy Management"
        description="Review, verify, and manage pharmacy registrations on the platform"
      />

      {/* Action feedback */}
      {actionSuccess && !modalOpen && (
        <AlertBanner variant="success" title="Status updated">
          {actionSuccess}
        </AlertBanner>
      )}

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            className={cn('filter-tab', statusFilter === value && 'active')}
            onClick={() => handleFilterChange(value)}
          >
            {label}
            {value === 'PENDING' && total > 0 && statusFilter === 'PENDING' && (
              <span style={{ marginLeft: 4, fontWeight: 600 }}>({total})</span>
            )}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div>
          <AlertBanner variant="error" title="Error loading pharmacies">
            {error}
          </AlertBanner>
          <div style={{ marginTop: 12 }}>
            <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={() => fetchPharmacies()}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 16,
                padding: '16px 20px',
                borderBottom: '1px solid var(--slate-100)',
              }}
            >
              <div className="skeleton" style={{ width: 180, height: 16 }} />
              <div className="skeleton" style={{ width: 100, height: 16 }} />
              <div className="skeleton" style={{ width: 72, height: 22, borderRadius: 20 }} />
              <div style={{ flex: 1 }} />
              <div className="skeleton" style={{ width: 80, height: 16 }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && pharmacies.length === 0 && (
        <EmptyState
          icon={Store}
          title={statusFilter ? `No ${statusFilter.toLowerCase()} pharmacies` : 'No pharmacies registered'}
          description={
            statusFilter
              ? `There are currently no pharmacies with status "${statusFilter}".`
              : 'Pharmacies will appear here as they register on the platform.'
          }
        />
      )}

      {/* Pharmacy table */}
      {!loading && !error && pharmacies.length > 0 && (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="masas-table-shell">
              <table className="masas-table">
                <thead className="masas-thead">
                  <tr>
                    <th className="masas-th">Pharmacy</th>
                    <th className="masas-th">License</th>
                    <th className="masas-th">Status</th>
                    <th className="masas-th">Medicines</th>
                    <th className="masas-th">Registered</th>
                    <th className="masas-th" style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pharmacies.map((p) => (
                    <tr key={p.id} className="masas-tr">
                      <td className="masas-td">
                        <div>
                          <p style={{ fontWeight: 500, color: 'var(--text)' }}>{p.name}</p>
                          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            {p.user?.email}
                          </p>
                        </div>
                      </td>
                      <td className="masas-td">
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--slate-600)' }}>
                          {p.licenseNumber}
                        </span>
                      </td>
                      <td className="masas-td">
                        <StatusBadge variant={statusVariantMap[p.status] || 'neutral'}>
                          {p.status}
                        </StatusBadge>
                      </td>
                      <td className="masas-td">
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {p._count?.inventory ?? 0}
                        </span>
                      </td>
                      <td className="masas-td">
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {new Date(p.createdAt || '').toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="masas-td" style={{ textAlign: 'right' }}>
                        <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                          {p.status !== 'VERIFIED' && (
                            <Button
                              size="sm"
                              variant="primary"
                              leftIcon={CheckCircle2}
                              onClick={() => openActionModal(p, 'VERIFIED')}
                            >
                              Verify
                            </Button>
                          )}
                          {p.status !== 'REJECTED' && (
                            <Button
                              size="sm"
                              variant="danger"
                              leftIcon={XCircle}
                              onClick={() => openActionModal(p, 'REJECTED')}
                            >
                              Reject
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <span className="pagination-info">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} of {total}
              </span>
              <div className="pagination-buttons">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={ChevronLeft}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  rightIcon={ChevronRight}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <Modal
        open={modalOpen}
        onClose={() => !actionLoading && setModalOpen(false)}
        title={
          modalAction === 'VERIFIED'
            ? 'Verify pharmacy'
            : 'Reject pharmacy'
        }
        description={
          modalAction === 'VERIFIED'
            ? `Confirm verification for "${modalPharmacy?.name}". This pharmacy will appear in public search results.`
            : `Confirm rejection for "${modalPharmacy?.name}". This pharmacy will be hidden from public search.`
        }
        size="md"
      >
        <ModalBody>
          {actionSuccess ? (
            <AlertBanner variant="success" title="Done">
              {actionSuccess}
            </AlertBanner>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Pharmacy summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', background: 'var(--slate-50)' }}>
                <span className={`kpi-icon-wrap ${modalAction === 'VERIFIED' ? 'kpi-success' : 'kpi-danger'}`}>
                  {modalAction === 'VERIFIED' ? (
                    <ShieldCheck style={{ width: 20, height: 20 }} />
                  ) : (
                    <ShieldX style={{ width: 20, height: 20 }} />
                  )}
                </span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                    {modalPharmacy?.name}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    License: {modalPharmacy?.licenseNumber} · {modalPharmacy?.user?.email}
                  </p>
                </div>
              </div>

              {/* Rejection reason (optional) */}
              {modalAction === 'REJECTED' && (
                <div>
                  <label
                    htmlFor="rejectionReason"
                    className="form-label"
                  >
                    Reason for rejection <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span>
                  </label>
                  <textarea
                    id="rejectionReason"
                    className="textarea-field"
                    rows={3}
                    placeholder="E.g. Invalid license number, incomplete documentation…"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    maxLength={500}
                  />
                </div>
              )}

              {actionError && (
                <AlertBanner variant="error" title="Action failed">
                  {actionError}
                </AlertBanner>
              )}
            </div>
          )}
        </ModalBody>

        {!actionSuccess && (
          <ModalFooter>
            <Button
              variant="ghost"
              onClick={() => setModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={modalAction === 'VERIFIED' ? 'primary' : 'danger'}
              isLoading={actionLoading}
              onClick={handleStatusUpdate}
            >
              {modalAction === 'VERIFIED' ? 'Confirm verification' : 'Confirm rejection'}
            </Button>
          </ModalFooter>
        )}
      </Modal>
    </div>
  );
}
