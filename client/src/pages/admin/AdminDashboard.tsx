/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import adminService from '../../services/adminService';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import AlertBanner from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import {
  Store,
  Clock,
  Package,
  ShoppingCart,
  ArrowRight,
  Users,
  RefreshCw,
} from 'lucide-react';
import { getErrorMessage } from '../../lib/utils';
import type { AdminStats, Pharmacy } from '../../types';
import KpiTile from '../../components/ui/KpiTile';

const statusVariantMap: Record<string, string> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
};

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await adminService.getStats();
      setStats(res?.data?.data?.stats ?? null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load statistics'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const greeting = greetingForHour();
  const adminName = user?.email?.split('@')[0] || 'Admin';

  if (loading) {
    return (
      <div className="admin-loading-stack">
        <PageHeader title="Admin Dashboard" description="Loading platform statistics…" />
        <div className="kpi-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton admin-skeleton-kpi" />
          ))}
        </div>
        <div className="skeleton admin-skeleton-card" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error-stack">
        <PageHeader title="Admin Dashboard" description="Platform overview and statistics" />
        <AlertBanner variant="error" title="Failed to load dashboard">
          {error}
        </AlertBanner>
        <Button variant="secondary" leftIcon={RefreshCw} onClick={fetchStats}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-layout">
      {/* Header */}
      <div className="admin-header-row">
        <div>
          <h1 className="admin-dashboard-title">
            {greeting}, {adminName}
          </h1>
          <div className="admin-header-subrow">
            <span className="admin-header-subtitle">MASAS Administration</span>
            <StatusBadge variant="neutral">Admin</StatusBadge>
          </div>
        </div>
        {(stats?.pendingPharmacies ?? 0) > 0 && (
          <Button
            onClick={() => navigate('/admin/pharmacies?status=PENDING')}
            leftIcon={Clock}
          >
            Review pending ({stats!.pendingPharmacies})
          </Button>
        )}
      </div>

      {/* KPI Grid */}
      <section>
        <div className="admin-section-header">
          <h2 className="admin-section-title">Platform overview</h2>
          <p className="admin-section-sub">
            Aggregate platform statistics across all registered pharmacies.
          </p>
        </div>
        <div className="kpi-grid">
          <KpiTile
            icon={Store}
            label="Total pharmacies"
            value={stats?.totalPharmacies ?? 0}
            hint={`${stats?.verifiedPharmacies ?? 0} verified, ${stats?.pendingPharmacies ?? 0} pending`}
            tone="success"
          />
          <KpiTile
            icon={Clock}
            label="Pending review"
            value={stats?.pendingPharmacies ?? 0}
            hint="Pharmacies awaiting verification"
            tone={(stats?.pendingPharmacies ?? 0) > 0 ? 'warning' : 'success'}
          />
          <KpiTile
            icon={Package}
            label="Medicine catalog"
            value={stats?.totalMedicines ?? 0}
            hint="Unique medicines in the global catalog"
            tone="info"
          />
          <KpiTile
            icon={ShoppingCart}
            label="Inventory items"
            value={stats?.totalInventoryItems ?? 0}
            hint="Total stock entries across all pharmacies"
            tone="success"
          />
        </div>
      </section>

      {/* Users stat */}
      <section>
        <div className="card admin-user-stat-card">
          <span className="kpi-icon-wrap kpi-info">
            <Users style={{ width: 20, height: 20 }} strokeWidth={2} aria-hidden />
          </span>
          <div className="admin-user-stat-info">
            <p className="admin-user-stat-title">
              {stats?.totalUsers ?? 0} registered users
            </p>
            <p className="admin-user-stat-sub">
              Pharmacy owners and administrators on the platform
            </p>
          </div>
        </div>
      </section>

      {/* Recent Pharmacies */}
      <section>
        <div className="admin-section-header-split">
          <div>
            <h2 className="admin-section-title">Recent registrations</h2>
            <p className="admin-section-sub">
              Latest pharmacy registrations on the platform
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            rightIcon={ArrowRight}
            onClick={() => navigate('/admin/pharmacies')}
          >
            View all
          </Button>
        </div>

        {stats?.recentPharmacies?.length === 0 ? (
          <div className="card admin-empty-card">
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>No pharmacies registered yet</p>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
              Pharmacies will appear here as they register on the platform.
            </p>
          </div>
        ) : (
          <div className="card admin-table-card">
            <div className="masas-table-shell">
              <table className="masas-table">
                <thead className="masas-thead">
                  <tr>
                    <th className="masas-th">Pharmacy</th>
                    <th className="masas-th">License</th>
                    <th className="masas-th">Status</th>
                    <th className="masas-th">Medicines</th>
                    <th className="masas-th">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentPharmacies?.map((p: Pharmacy) => (
                    <tr
                      key={p.id}
                      className="masas-tr admin-table-row"
                      onClick={() => navigate('/admin/pharmacies')}
                    >
                      <td className="masas-td">
                        <div>
                          <p className="admin-table-pharmacy-name">{p.name}</p>
                          <p className="admin-table-email">{p.user?.email}</p>
                        </div>
                      </td>
                      <td className="masas-td">
                        <span className="admin-table-mono">
                          {p.licenseNumber}
                        </span>
                      </td>
                      <td className="masas-td">
                        <StatusBadge variant={statusVariantMap[p.status] || 'neutral'}>
                          {p.status}
                        </StatusBadge>
                      </td>
                      <td className="masas-td">
                        <span className="admin-table-numeric">{p._count?.inventory ?? 0}</span>
                      </td>
                      <td className="masas-td">
                        <span className="admin-table-date">
                          {new Date(p.createdAt || '').toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
