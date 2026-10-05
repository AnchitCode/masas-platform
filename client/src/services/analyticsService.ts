import api from './api';

/**
 * Phase 10.7 — Pharmacy Analytics API Client
 *
 * All endpoints scoped to the authenticated pharmacy via server-side auth chain.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface AnalyticsOverview {
  current: {
    totalSkus: number;
    inStockSkus: number;
    outOfStockSkus: number;
    lowStockSkus: number;
    expiredSkus: number;
    expiringSoonSkus: number;
    healthScore: number;
    healthTier: 'excellent' | 'strong' | 'watch' | 'critical';
    avgPrice: number;
    searchImpressions: number;
    alertsTriggered: number;
  };
  trends: {
    period: string;
    healthScoreDelta: number;
    searchImpressionsDelta: number;
    outOfStockSkusDelta: number;
    totalSkusDelta: number;
  };
  sparklines: {
    healthScore: number[];
    searchImpressions: number[];
  };
}

export interface TrendSnapshot {
  periodStart: string;
  healthScore: number;
  totalSkus: number;
  inStockSkus: number;
  outOfStockSkus: number;
  searchImpressions: number;
  alertsTriggered: number;
  avgPrice: number;
}

export interface TopQuery {
  query: string;
  impressions: number;
  avgPosition: number;
}

export interface DailyImpression {
  date: string;
  count: number;
}

export interface SearchVisibility {
  totalImpressions: number;
  topQueries: TopQuery[];
  dailyImpressions: DailyImpression[];
}

export interface InventoryHealthItem {
  id: string;
  medicineName: string;
  genericName: string | null;
  quantity: number;
  price: number;
  isAvailable: boolean;
  expiryDate: string | null;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  expiryStatus: 'ok' | 'expiring_soon' | 'expiring_critical' | 'expired' | null;
  updatedAt: string;
}

// ─── API Calls ──────────────────────────────────────────────────

const BASE = '/pharmacy/analytics';

const analyticsService = {
  getOverview: () =>
    api.get<{ data: AnalyticsOverview }>(`${BASE}/overview`),

  getTrends: (period: '7d' | '30d' | '90d' = '7d') =>
    api.get<{ data: { period: string; snapshots: TrendSnapshot[] } }>(`${BASE}/trends`, {
      params: { period },
    }),

  getSearchVisibility: (period: '7d' | '30d' = '7d') =>
    api.get<{ data: SearchVisibility }>(`${BASE}/search-visibility`, {
      params: { period },
    }),

  getInventoryHealth: () =>
    api.get<{ data: { items: InventoryHealthItem[] } }>(`${BASE}/inventory-health`),

  exportCsv: async () => {
    const res = await api.get(`${BASE}/export?format=csv`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data as BlobPart], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};

export default analyticsService;
