import { useEffect, useState } from 'react';
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

const statusVariantMap = {
  VERIFIED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
};

function KpiTile({ icon: Icon, label, value, hint, tone = 'success' }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-header">
        <div>
          <p className="kpi-label">{label}</p>
          <p className="kpi-value">{value}</p>
        </div>
        <span className={`kpi-icon-wrap kpi-${tone}`}>
          <Icon style={{ width: 20, height: 20 }} strokeWidth={2} aria-hidden />
        </span>
      </div>
      {hint && <p className="kpi-hint">{hint}</p>}
    </div>
  );
}

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await adminService.getStats();
      setStats(res?.data?.data?.stats ?? null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load statistics');
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <PageHeader title="Admin Dashboard" description="Loading platform statistics…" />
        <div className="kpi-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 132, borderRadius: 'var(--radius-card)' }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 280, borderRadius: 'var(--radius-card)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {greeting}, {adminName}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>MASAS Administration</span>
            <StatusBadge variant="neutral">Admin</StatusBadge>
          </div>
        </div>
        {stats?.pendingPharmacies > 0 && (
          <Button
            onClick={() => navigate('/admin/pharmacies?status=PENDING')}
            leftIcon={Clock}
          >
            Review pending ({stats.pendingPharmacies})
          </Button>
        )}
      </div>

      {/* KPI Grid */}
      <section>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Platform overview</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
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
            tone={stats?.pendingPharmacies > 0 ? 'warning' : 'success'}
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
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20 }}>
          <span className="kpi-icon-wrap kpi-info">
            <Users style={{ width: 20, height: 20 }} strokeWidth={2} aria-hidden />
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              {stats?.totalUsers ?? 0} registered users
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Pharmacy owners and administrators on the platform
            </p>
          </div>
        </div>
      </section>

      {/* Recent Pharmacies */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Recent registrations</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
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
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>No pharmacies registered yet</p>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
              Pharmacies will appear here as they register on the platform.
            </p>
          </div>
        ) : (
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
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentPharmacies?.map((p) => (
                    <tr
                      key={p.id}
                      className="masas-tr"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/admin/pharmacies')}
                    >
                      <td className="masas-td">
                        <div>
                          <p style={{ fontWeight: 500, color: 'var(--text)' }}>{p.name}</p>
                          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.user?.email}</p>
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
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p._count?.inventory ?? 0}</span>
                      </td>
                      <td className="masas-td">
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {new Date(p.createdAt).toLocaleDateString('en-IN', {
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
