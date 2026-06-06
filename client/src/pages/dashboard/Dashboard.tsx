import { useAuth } from '../../context/AuthContext';
import React, { useEffect, useMemo, useState } from 'react';
import pharmacyService from '../../services/pharmacyService';
import inventoryService from '../../services/inventoryService';
import type { Pharmacy, InventoryItem } from '../../types';
import {
  Store,
  Package,
  Clock,
  ArrowRight,
  Plus,
  CalendarClock,
  AlertTriangle,
  ShoppingCart,
  History,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import {
  computeOperationalMetrics,
  buildOperationalTimeline,
  buildAiInsights,
} from '../../lib/dashboardMetrics';
import AiInsightCard from '../../components/dashboard/AiInsightCard';
import HealthScorePanel from '../../components/dashboard/HealthScorePanel';

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

interface KpiTileProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  hint?: string;
  tone?: string;
}

function KpiTile({ icon: Icon, label, value, hint, tone = 'success' }: KpiTileProps) {
  return (
    <div className="kpi-tile">
      <div className="kpi-header">
        <div>
          <p className="kpi-label">{label}</p>
          <p className="kpi-value">{value}</p>
        </div>
        <span className={`kpi-icon-wrap kpi-${tone}`}>
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
      </div>
      {hint && <p className="kpi-hint">{hint}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await pharmacyService.getOwnProfile();
        const p = response?.data?.pharmacy ?? null;
        setPharmacy(p);
        setHasProfile(!!p);
      } catch {
        setPharmacy(null);
        setHasProfile(false);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    if (!pharmacy || pharmacy.status !== 'VERIFIED') {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const invRes = await inventoryService.getInventory();
        if (cancelled) return;
        setInventory(invRes?.data?.inventory ?? []);
      } catch {
        if (!cancelled) setInventory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pharmacy]);

  const workspaceInventory = useMemo(
    () => (pharmacy?.status === 'VERIFIED' ? inventory : []),
    [pharmacy?.status, inventory]
  );

  const metrics = useMemo(() => computeOperationalMetrics(workspaceInventory), [workspaceInventory]);
  const timeline = useMemo(() => buildOperationalTimeline(workspaceInventory, pharmacy ?? undefined), [workspaceInventory, pharmacy]);
  const aiInsights = useMemo(() => buildAiInsights(metrics), [metrics]);

  const greetingName = user?.email?.split('@')[0] || 'there';
  const greeting = greetingForHour();
  const totalMedicines = pharmacy?._count?.inventory ?? metrics.total;

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '320px', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Loading your workspace…" />
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div style={{ paddingBottom: '32px' }}>
        <PageHeader
          title={`${greeting}, ${greetingName}`}
          description="Set up your pharmacy profile to unlock inventory, verification, and public discovery."
        />
        <EmptyState
          icon={Store}
          title="Welcome to MASAS"
          description="Your account is ready. Complete your pharmacy profile so we can verify your business—then you can list medicines and appear in public search."
          action={
            <Button onClick={() => (window.location.href = '/dashboard/profile')} rightIcon={ArrowRight}>
              Complete pharmacy profile
            </Button>
          }
        />
      </div>
    );
  }

  if (!pharmacy) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '32px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>
            {greeting}, {greetingName}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--slate-700)' }}>{pharmacy.name}</span>
            <StatusBadge variant={pharmacy.status === 'VERIFIED' ? 'success' : pharmacy.status === 'PENDING' ? 'warning' : 'danger'}>
              {pharmacy.status}
            </StatusBadge>
          </div>
        </div>
        
        {pharmacy.status === 'VERIFIED' && (
          <Button
            onClick={() => (window.location.href = '/dashboard/inventory')}
            leftIcon={Plus}
          >
            Add medicine
          </Button>
        )}
      </div>

      {/* Pending Banner */}
      {pharmacy.status === 'PENDING' && (
        <div className="dash-banner dash-banner-warning">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div className="kpi-icon-wrap kpi-warning">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>Verification in progress</h2>
              <p style={{ marginTop: '4px', fontSize: '13px', color: 'var(--slate-700)' }}>
                Your pharmacy profile is pending review. This usually takes 1-2 business days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Health Score */}
      {pharmacy.status === 'VERIFIED' && (
        <section>
          <HealthScorePanel score={metrics.healthScore} tier={metrics.healthTier} />
        </section>
      )}

      {/* Metrics Grid */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Operations snapshot</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>Live inventory signals power expiries, stock floors, and AI recommendations.</p>
          </div>
          {pharmacy.status === 'VERIFIED' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '9999px', padding: '4px 10px' }}>
              <TrendingUp style={{ width: '14px', height: '14px', color: 'var(--green-600)' }} />
              Live workspace
            </span>
          )}
        </div>

        <div className="kpi-grid">
          <KpiTile
            icon={Package}
            label="Total medicines"
            value={pharmacy.status === 'VERIFIED' ? metrics.total : totalMedicines}
            hint="SKUs currently modeled in inventory."
            tone="success"
          />
          <KpiTile
            icon={AlertTriangle}
            label="Low stock"
            value={pharmacy.status === 'VERIFIED' ? metrics.lowStock : '—'}
            hint="SKUs at or below the operational floor (10 units)."
            tone="warning"
          />
          <KpiTile
            icon={ShoppingCart}
            label="Out of stock"
            value={pharmacy.status === 'VERIFIED' ? metrics.outOfStock : '—'}
            hint="SKUs unavailable or at zero on-hand quantity."
            tone="danger"
          />
          <KpiTile
            icon={CalendarClock}
            label="Expiring soon"
            value={pharmacy.status === 'VERIFIED' ? metrics.expiringSoon + metrics.expiringCritical + metrics.expired : '—'}
            hint="Combined near-term and expired lots (90-day horizon)."
            tone="info"
          />
        </div>
      </section>

      {/* AI Insights & Timeline Grid */}
      <div className="dashboard-grid">
        <div className="dashboard-col-5" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History style={{ width: '16px', height: '16px', color: 'var(--slate-500)' }} />
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Operational timeline</h2>
          </div>
          
          <div className="timeline-list">
            {timeline.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>No operational events yet</p>
                <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)' }}>As you verify, stock, and rotate inventory, MASAS will assemble an audit trail here.</p>
              </div>
            ) : (
              timeline.map(ev => (
                <div key={ev.id} className={`timeline-item timeline-item-${ev.tone || 'neutral'}`}>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{ev.title}</p>
                  <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--slate-600)' }}>{ev.detail}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {pharmacy.status === 'VERIFIED' && (
          <div className="dashboard-col-7" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck style={{ width: '16px', height: '16px', color: 'var(--slate-500)' }} />
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Operational intelligence</h2>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--slate-600)', border: '1px solid var(--border)', borderRadius: '9999px', padding: '4px 10px', background: 'var(--slate-50)' }}>
                MASAS AI
              </span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              {aiInsights.map((insight) => (
                <AiInsightCard
                  key={insight.id}
                  title={insight.title}
                  confidence={insight.confidence}
                  body={insight.body}
                  action={insight.action}
                  href={insight.href}
                />
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
