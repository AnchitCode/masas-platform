import prisma from '../../lib/prisma.js';
import { computeHealthScoreFromInventory } from '../../utils/healthScore.js';
import type { HealthTier } from '../../utils/healthScore.js';

/**
 * Phase 10.4 — Pharmacy Analytics Service
 *
 * All queries filter by pharmacyId (IDOR protection).
 * Empty states return zeroed data, not 404.
 */

// ─── Types ──────────────────────────────────────────────────────

interface OverviewCurrent {
  totalSkus: number;
  inStockSkus: number;
  outOfStockSkus: number;
  lowStockSkus: number;
  expiredSkus: number;
  expiringSoonSkus: number;
  healthScore: number;
  healthTier: HealthTier;
  avgPrice: number;
  searchImpressions: number;
  alertsTriggered: number;
}

interface OverviewTrends {
  period: string;
  healthScoreDelta: number;
  searchImpressionsDelta: number;
  outOfStockSkusDelta: number;
  totalSkusDelta: number;
}

interface OverviewSparklines {
  healthScore: number[];
  searchImpressions: number[];
}

interface OverviewResult {
  current: OverviewCurrent;
  trends: OverviewTrends;
  sparklines: OverviewSparklines;
}

// ─── Helper: period string to days ──────────────────────────────

function periodToDays(period: string): number {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    default: return 7;
  }
}

// ─── 1. Overview ────────────────────────────────────────────────

export async function getOverview(pharmacyId: string): Promise<OverviewResult> {
  // Current metrics from live inventory
  const inventory = await prisma.pharmacyInventory.findMany({
    where: { pharmacyId },
    select: {
      quantity: true,
      isAvailable: true,
      expiryDate: true,
      lowStockThreshold: true,
      price: true,
    },
  });

  const health = computeHealthScoreFromInventory(inventory);
  const totalSkus = health.total;
  const inStockSkus = totalSkus - health.outOfStock;
  const outOfStockSkus = health.outOfStock;
  const avgPrice = inventory.length > 0
    ? Math.round((inventory.reduce((sum, item) => sum + item.price, 0) / inventory.length) * 100) / 100
    : 0;

  // Current period counts (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const searchImpressions = await prisma.searchImpression.count({
    where: { pharmacyId, createdAt: { gte: sevenDaysAgo } },
  });

  const alertsTriggered = await prisma.analyticsEvent.count({
    where: { pharmacyId, type: 'AVAILABILITY_TRIGGERED', createdAt: { gte: sevenDaysAgo } },
  });

  const current: OverviewCurrent = {
    totalSkus,
    inStockSkus,
    outOfStockSkus,
    lowStockSkus: health.lowStock,
    expiredSkus: health.expired,
    expiringSoonSkus: health.expiringCritical + health.expiringSoon,
    healthScore: health.healthScore,
    healthTier: health.healthTier,
    avgPrice,
    searchImpressions,
    alertsTriggered,
  };

  // Trends: compare first vs last completed daily snapshot in 7d
  const dailySnapshots = await prisma.pharmacyMetricsSnapshot.findMany({
    where: { pharmacyId, period: 'daily', periodStart: { gte: sevenDaysAgo } },
    orderBy: { periodStart: 'asc' },
  });

  let trends: OverviewTrends = {
    period: '7d',
    healthScoreDelta: 0,
    searchImpressionsDelta: 0,
    outOfStockSkusDelta: 0,
    totalSkusDelta: 0,
  };

  if (dailySnapshots.length >= 2) {
    const first = dailySnapshots[0];
    const last = dailySnapshots[dailySnapshots.length - 1];
    trends = {
      period: '7d',
      healthScoreDelta: last.healthScore - first.healthScore,
      searchImpressionsDelta: last.searchImpressions - first.searchImpressions,
      outOfStockSkusDelta: last.outOfStockSkus - first.outOfStockSkus,
      totalSkusDelta: last.totalSkus - first.totalSkus,
    };
  }

  // Sparklines: last 7 completed daily snapshots, reversed to chronological
  const sparklineSnapshots = await prisma.pharmacyMetricsSnapshot.findMany({
    where: { pharmacyId, period: 'daily' },
    orderBy: { periodStart: 'desc' },
    take: 7,
  });
  sparklineSnapshots.reverse();

  const sparklines: OverviewSparklines = {
    healthScore: sparklineSnapshots.map((s) => s.healthScore),
    searchImpressions: sparklineSnapshots.map((s) => s.searchImpressions),
  };

  return { current, trends, sparklines };
}

// ─── 2. Trends ──────────────────────────────────────────────────

interface TrendPoint {
  periodStart: string;
  healthScore: number;
  totalSkus: number;
  inStockSkus: number;
  outOfStockSkus: number;
  searchImpressions: number;
  alertsTriggered: number;
  avgPrice: number;
}

export async function getTrends(pharmacyId: string, period: string): Promise<TrendPoint[]> {
  const days = periodToDays(period);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const snapshots = await prisma.pharmacyMetricsSnapshot.findMany({
    where: { pharmacyId, period: 'daily', periodStart: { gte: since } },
    orderBy: { periodStart: 'asc' },
  });

  return snapshots.map((s) => ({
    periodStart: s.periodStart.toISOString().split('T')[0],
    healthScore: s.healthScore,
    totalSkus: s.totalSkus,
    inStockSkus: s.inStockSkus,
    outOfStockSkus: s.outOfStockSkus,
    searchImpressions: s.searchImpressions,
    alertsTriggered: s.alertsTriggered,
    avgPrice: s.avgPrice,
  }));
}

// ─── 3. Search Visibility ───────────────────────────────────────

interface TopQuery {
  query: string;
  impressions: number;
  avgPosition: number;
}

interface DailyImpression {
  date: string;
  count: number;
}

interface SearchVisibilityResult {
  totalImpressions: number;
  topQueries: TopQuery[];
  dailyImpressions: DailyImpression[];
}

export async function getSearchVisibility(pharmacyId: string, period: string): Promise<SearchVisibilityResult> {
  const days = periodToDays(period);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  // Total impressions
  const totalImpressions = await prisma.searchImpression.count({
    where: { pharmacyId, createdAt: { gte: since } },
  });

  // Top queries via raw SQL (Prisma can't do GROUP BY with JOIN + AVG easily)
  const topQueriesRaw = await prisma.$queryRaw<Array<{
    query: string;
    impressions: bigint;
    avg_position: number;
  }>>`
    SELECT sq.query, COUNT(*)::bigint AS impressions, AVG(si.position) AS avg_position
    FROM search_impressions si
    JOIN search_queries sq ON sq.id = si.search_query_id
    WHERE si.pharmacy_id = ${pharmacyId} AND si.created_at >= ${since}
    GROUP BY sq.query
    ORDER BY impressions DESC
    LIMIT 10
  `;

  const topQueries: TopQuery[] = topQueriesRaw.map((r) => ({
    query: r.query,
    impressions: Number(r.impressions),
    avgPosition: Math.round(Number(r.avg_position) * 10) / 10,
  }));

  // Daily impressions via raw SQL
  const dailyRaw = await prisma.$queryRaw<Array<{
    date: Date;
    count: bigint;
  }>>`
    SELECT DATE(created_at) AS date, COUNT(*)::bigint AS count
    FROM search_impressions
    WHERE pharmacy_id = ${pharmacyId} AND created_at >= ${since}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  const dailyImpressions: DailyImpression[] = dailyRaw.map((r) => ({
    date: new Date(r.date).toISOString().split('T')[0],
    count: Number(r.count),
  }));

  return { totalImpressions, topQueries, dailyImpressions };
}

// ─── 4. Inventory Health ────────────────────────────────────────

interface InventoryHealthItem {
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

export async function getInventoryHealth(pharmacyId: string): Promise<InventoryHealthItem[]> {
  const inventory = await prisma.pharmacyInventory.findMany({
    where: { pharmacyId },
    include: { medicine: { select: { name: true, genericName: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  return inventory.map((item) => {
    const qty = item.quantity;
    const available = item.isAvailable && qty > 0;

    let stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
    if (!available) stockStatus = 'out_of_stock';
    else if (qty <= item.lowStockThreshold) stockStatus = 'low_stock';
    else stockStatus = 'in_stock';

    let expiryStatus: 'ok' | 'expiring_soon' | 'expiring_critical' | 'expired' | null = null;
    if (item.expiryDate) {
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);
      const exp = new Date(item.expiryDate);
      exp.setUTCHours(0, 0, 0, 0);
      const days = Math.round((exp.getTime() - now.getTime()) / 86400000);

      if (days < 0) expiryStatus = 'expired';
      else if (days <= 30) expiryStatus = 'expiring_critical';
      else if (days <= 90) expiryStatus = 'expiring_soon';
      else expiryStatus = 'ok';
    }

    return {
      id: item.id,
      medicineName: item.medicine.name,
      genericName: item.medicine.genericName,
      quantity: qty,
      price: item.price,
      isAvailable: item.isAvailable,
      expiryDate: item.expiryDate?.toISOString().split('T')[0] ?? null,
      stockStatus,
      expiryStatus,
      updatedAt: item.updatedAt.toISOString(),
    };
  });
}

// ─── 5. CSV Export ──────────────────────────────────────────────

export async function getInventoryExportCsv(pharmacyId: string): Promise<string> {
  const items = await getInventoryHealth(pharmacyId);

  const headers = [
    'Medicine Name',
    'Generic Name',
    'Quantity',
    'Price',
    'Available',
    'Expiry Date',
    'Stock Status',
    'Expiry Status',
    'Last Updated',
  ];

  const rows = items.map((item) => [
    escapeCsvField(item.medicineName),
    escapeCsvField(item.genericName ?? ''),
    item.quantity.toString(),
    item.price.toString(),
    item.isAvailable ? 'Yes' : 'No',
    item.expiryDate ?? '',
    item.stockStatus,
    item.expiryStatus ?? '',
    item.updatedAt,
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
