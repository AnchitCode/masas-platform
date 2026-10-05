import { useState, useEffect } from 'react';
import {
  Download,
  Activity,
  ShieldCheck,
  Package,
  TrendingUp,
  Eye,
  Heart,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import TrendBadge from '../../components/analytics/TrendBadge';
import SparklineChart from '../../components/analytics/SparklineChart';
import HealthScoreChart from '../../components/analytics/HealthScoreChart';
import StockCompositionChart from '../../components/analytics/StockCompositionChart';
import SearchVisibilityPanel from '../../components/analytics/SearchVisibilityPanel';
import InventoryHealthGrid from '../../components/analytics/InventoryHealthGrid';
import { Button } from '../../components/ui/Button';
import analyticsService from '../../services/analyticsService';
import type {
  AnalyticsOverview,
  TrendSnapshot,
  SearchVisibility,
  InventoryHealthItem,
} from '../../services/analyticsService';

type TrendPeriod = '7d' | '30d' | '90d';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<TrendSnapshot[]>([]);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('30d');
  const [searchVis, setSearchVis] = useState<SearchVisibility | null>(null);
  const [searchVisLoading, setSearchVisLoading] = useState(true);
  const [healthItems, setHealthItems] = useState<InventoryHealthItem[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Load overview on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await analyticsService.getOverview();
        setOverview(res.data.data);
      } catch (err) {
        console.error('Failed to load analytics overview:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load trends when period changes
  useEffect(() => {
    const loadTrends = async () => {
      try {
        const res = await analyticsService.getTrends(trendPeriod);
        setTrends(res.data.data.snapshots);
      } catch (err) {
        console.error('Failed to load trends:', err);
      }
    };
    loadTrends();
  }, [trendPeriod]);

  // Load search visibility
  useEffect(() => {
    const load = async () => {
      setSearchVisLoading(true);
      try {
        const res = await analyticsService.getSearchVisibility('7d');
        setSearchVis(res.data.data);
      } catch (err) {
        console.error('Failed to load search visibility:', err);
      } finally {
        setSearchVisLoading(false);
      }
    };
    load();
  }, []);

  // Load inventory health
  useEffect(() => {
    const load = async () => {
      setHealthLoading(true);
      try {
        const res = await analyticsService.getInventoryHealth();
        setHealthItems(res.data.data.items);
      } catch (err) {
        console.error('Failed to load inventory health:', err);
      } finally {
        setHealthLoading(false);
      }
    };
    load();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await analyticsService.exportCsv();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <LoadingSpinner />
      </div>
    );
  }

  const c = overview?.current;
  const t = overview?.trends;
  const spark = overview?.sparklines;

  return (
    <div className="analytics-page">
      <div className="analytics-page-header">
        <PageHeader
          title="Analytics"
          description="Track your pharmacy's performance, search visibility, and inventory health"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          style={{ gap: 6 }}
        >
          <Download style={{ width: 14, height: 14 }} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {/* KPI Overview Row */}
      <div className="analytics-kpi-grid">
        <div className="kpi-tile">
          <div className="kpi-header">
            <div>
              <p className="kpi-label">Health Score</p>
              <p className="kpi-value">{c?.healthScore ?? 0}</p>
            </div>
            <span className={`kpi-icon-wrap kpi-${c?.healthTier === 'excellent' || c?.healthTier === 'strong' ? 'success' : c?.healthTier === 'watch' ? 'warning' : 'danger'}`}>
              <ShieldCheck style={{ width: 20, height: 20 }} strokeWidth={2} />
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {t && <TrendBadge delta={t.healthScoreDelta} />}
            <span className="kpi-hint" style={{ margin: 0 }}>{c?.healthTier}</span>
          </div>
          {spark && <SparklineChart data={spark.healthScore} color="#22c55e" />}
        </div>

        <div className="kpi-tile">
          <div className="kpi-header">
            <div>
              <p className="kpi-label">Total SKUs</p>
              <p className="kpi-value">{c?.totalSkus ?? 0}</p>
            </div>
            <span className="kpi-icon-wrap kpi-info">
              <Package style={{ width: 20, height: 20 }} strokeWidth={2} />
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {t && <TrendBadge delta={t.totalSkusDelta} />}
            <span className="kpi-hint" style={{ margin: 0 }}>{c?.inStockSkus ?? 0} in stock</span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-header">
            <div>
              <p className="kpi-label">Search Impressions</p>
              <p className="kpi-value">{c?.searchImpressions ?? 0}</p>
            </div>
            <span className="kpi-icon-wrap kpi-info">
              <Eye style={{ width: 20, height: 20 }} strokeWidth={2} />
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {t && <TrendBadge delta={t.searchImpressionsDelta} />}
            <span className="kpi-hint" style={{ margin: 0 }}>last 7 days</span>
          </div>
          {spark && <SparklineChart data={spark.searchImpressions} color="var(--accent)" />}
        </div>

        <div className="kpi-tile">
          <div className="kpi-header">
            <div>
              <p className="kpi-label">Out of Stock</p>
              <p className="kpi-value">{c?.outOfStockSkus ?? 0}</p>
            </div>
            <span className={`kpi-icon-wrap ${(c?.outOfStockSkus ?? 0) > 0 ? 'kpi-danger' : 'kpi-success'}`}>
              <Activity style={{ width: 20, height: 20 }} strokeWidth={2} />
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {t && <TrendBadge delta={t.outOfStockSkusDelta} inverted />}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="analytics-charts-grid">
        {/* Health Score Trend */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3><Heart style={{ width: 16, height: 16 }} /> Health Score Trend</h3>
            <div className="analytics-period-selector">
              {(['7d', '30d', '90d'] as TrendPeriod[]).map((p) => (
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
          <HealthScoreChart data={trends} />
        </div>

        {/* Stock Composition */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3><TrendingUp style={{ width: 16, height: 16 }} /> Stock Composition</h3>
          </div>
          <StockCompositionChart data={trends} />
        </div>
      </div>

      {/* Search Visibility */}
      <SearchVisibilityPanel data={searchVis} loading={searchVisLoading} />

      {/* Inventory Health */}
      <div className="analytics-card" style={{ marginTop: 20 }}>
        <div className="analytics-card-header">
          <h3><Package style={{ width: 16, height: 16 }} /> Inventory Health</h3>
        </div>
        <InventoryHealthGrid items={healthItems} loading={healthLoading} />
      </div>
    </div>
  );
}
