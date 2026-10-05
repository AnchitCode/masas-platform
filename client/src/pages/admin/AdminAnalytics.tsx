import { useState, useEffect } from 'react';
import {
  Users,
  Store,
  Search,
  AlertTriangle,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import KpiTile from '../../components/ui/KpiTile';
import SearchVolumeChart from '../../components/analytics/SearchVolumeChart';
import TopSearchesChart from '../../components/analytics/TopSearchesChart';
import DemandGapsTable from '../../components/analytics/DemandGapsTable';
import PharmacyLeaderboard from '../../components/analytics/PharmacyLeaderboard';
import adminService from '../../services/adminService';

type Period = '7d' | '30d';

interface PlatformOverview {
  platform: {
    totalUsers: number;
    totalPharmacies: number;
    verifiedPharmacies: number;
    totalMedicines: number;
    totalSearches: number;
    avgResultCount: number;
    searchesWithNoResults: number;
    alertsTriggered: number;
  };
  trends7d: {
    usersDelta: number;
    searchesDelta: number;
    noResultSearchesDelta: number;
    alertsTriggeredDelta: number;
  };
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);

  // Search trends
  const [trendPeriod, setTrendPeriod] = useState<Period>('7d');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [searchTrends, setSearchTrends] = useState<any[]>([]);

  // Top searches
  const [topPeriod, setTopPeriod] = useState<Period>('7d');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [topSearches, setTopSearches] = useState<any[]>([]);

  // Demand gaps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [demandGaps, setDemandGaps] = useState<any[]>([]);
  const [gapsLoading, setGapsLoading] = useState(true);

  // Leaderboard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lbLoading, setLbLoading] = useState(true);

  // Load overview on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminService.getAnalyticsOverview();
        setOverview(res.data.data);
      } catch (err) {
        console.error('Failed to load admin analytics overview:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Search trends
  useEffect(() => {
    const loadTrends = async () => {
      try {
        const res = await adminService.getSearchTrends(trendPeriod);
        setSearchTrends(res.data.data.trends);
      } catch (err) {
        console.error('Failed to load search trends:', err);
      }
    };
    loadTrends();
  }, [trendPeriod]);

  // Top searches
  useEffect(() => {
    const loadTop = async () => {
      try {
        const res = await adminService.getTopSearches(topPeriod, 10);
        setTopSearches(res.data.data.searches);
      } catch (err) {
        console.error('Failed to load top searches:', err);
      }
    };
    loadTop();
  }, [topPeriod]);

  // Demand gaps
  useEffect(() => {
    const load = async () => {
      setGapsLoading(true);
      try {
        const res = await adminService.getDemandGaps('30d', 20);
        setDemandGaps(res.data.data.gaps);
      } catch (err) {
        console.error('Failed to load demand gaps:', err);
      } finally {
        setGapsLoading(false);
      }
    };
    load();
  }, []);

  // Leaderboard
  useEffect(() => {
    const load = async () => {
      setLbLoading(true);
      try {
        const res = await adminService.getPharmacyLeaderboard(20);
        setLeaderboard(res.data.data.leaderboard);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      } finally {
        setLbLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <LoadingSpinner />
      </div>
    );
  }

  const p = overview?.platform;
  const t7 = overview?.trends7d;

  return (
    <div className="analytics-page">
      <PageHeader
        title="Platform Analytics"
        description="Monitor search activity, demand gaps, and pharmacy performance across the platform"
      />

      {/* KPI Overview Row */}
      <div className="analytics-kpi-grid">
        <KpiTile
          icon={Users}
          label="Total Users"
          value={p?.totalUsers ?? 0}
          tone="info"
          hint={t7 ? `${t7.usersDelta >= 0 ? '+' : ''}${t7.usersDelta} this week` : undefined}
        />
        <KpiTile
          icon={Store}
          label="Verified Pharmacies"
          value={`${p?.verifiedPharmacies ?? 0} / ${p?.totalPharmacies ?? 0}`}
          tone="success"
        />
        <KpiTile
          icon={Search}
          label="Total Searches"
          value={p?.totalSearches ?? 0}
          hint={`Avg ${p?.avgResultCount ?? 0} results`}
          tone="info"
        />
        <KpiTile
          icon={AlertTriangle}
          label="No-Result Searches"
          value={p?.searchesWithNoResults ?? 0}
          tone={p && p.searchesWithNoResults > 0 ? 'warning' : 'success'}
          hint={t7 ? `${t7.noResultSearchesDelta >= 0 ? '+' : ''}${t7.noResultSearchesDelta} vs last week` : undefined}
        />
      </div>

      {/* Search Volume Chart */}
      <div className="analytics-card" style={{ marginTop: 20 }}>
        <div className="analytics-card-header">
          <h3><TrendingUp style={{ width: 16, height: 16 }} /> Search Volume</h3>
          <div className="analytics-period-selector">
            {(['7d', '30d'] as Period[]).map((p) => (
              <button
                key={p}
                className={`analytics-period-btn ${trendPeriod === p ? 'analytics-period-btn--active' : ''}`}
                onClick={() => setTrendPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <SearchVolumeChart data={searchTrends} />
      </div>

      {/* Top Searches + Demand Gaps */}
      <div className="analytics-charts-grid" style={{ marginTop: 20 }}>
        <div className="analytics-card" style={{ marginTop: 0 }}>
          <div className="analytics-card-header">
            <h3><Search style={{ width: 16, height: 16 }} /> Top Searches</h3>
            <div className="analytics-period-selector">
              {(['7d', '30d'] as Period[]).map((p) => (
                <button
                  key={p}
                  className={`analytics-period-btn ${topPeriod === p ? 'analytics-period-btn--active' : ''}`}
                  onClick={() => setTopPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <TopSearchesChart data={topSearches} />
        </div>

        <div className="analytics-card" style={{ marginTop: 0 }}>
          <div className="analytics-card-header">
            <h3><AlertTriangle style={{ width: 16, height: 16 }} /> Demand Gaps (30d)</h3>
          </div>
          <DemandGapsTable data={demandGaps} loading={gapsLoading} />
        </div>
      </div>

      {/* Pharmacy Leaderboard */}
      <div className="analytics-card" style={{ marginTop: 20 }}>
        <div className="analytics-card-header">
          <h3><Trophy style={{ width: 16, height: 16 }} /> Pharmacy Leaderboard</h3>
        </div>
        <PharmacyLeaderboard data={leaderboard} loading={lbLoading} />
      </div>
    </div>
  );
}
