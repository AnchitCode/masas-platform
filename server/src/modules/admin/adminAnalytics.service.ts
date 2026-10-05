import prisma from '../../lib/prisma.js';
import type { HealthTier } from '../../utils/healthScore.js';

/**
 * Phase 10.5 — Admin Analytics Service
 *
 * Platform-wide analytics. No pharmacy scoping — ADMIN role required.
 */

// ─── Helper ─────────────────────────────────────────────────────

function periodToDays(period: string): number {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    default: return 7;
  }
}

// ─── 1. Platform Overview ───────────────────────────────────────

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

export async function getOverview(): Promise<PlatformOverview> {
  const [
    totalUsers,
    totalPharmacies,
    verifiedPharmacies,
    totalMedicines,
    totalSearches,
    searchesWithNoResults,
    alertsTriggered,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.pharmacy.count(),
    prisma.pharmacy.count({ where: { status: 'VERIFIED' } }),
    prisma.medicineCatalog.count(),
    prisma.searchQuery.count(),
    prisma.searchQuery.count({ where: { resultCount: 0 } }),
    prisma.analyticsEvent.count({ where: { type: 'AVAILABILITY_TRIGGERED' } }),
  ]);

  // Average result count
  const avgResult = await prisma.searchQuery.aggregate({
    _avg: { resultCount: true },
  });
  const avgResultCount = Math.round((avgResult._avg.resultCount ?? 0) * 10) / 10;

  // 7-day trend deltas
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);

  const [
    usersThisWeek,
    usersLastWeek,
    searchesThisWeek,
    searchesLastWeek,
    noResultThisWeek,
    noResultLastWeek,
    alertsThisWeek,
    alertsLastWeek,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    prisma.searchQuery.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.searchQuery.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    prisma.searchQuery.count({ where: { resultCount: 0, createdAt: { gte: sevenDaysAgo } } }),
    prisma.searchQuery.count({ where: { resultCount: 0, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    prisma.analyticsEvent.count({ where: { type: 'AVAILABILITY_TRIGGERED', createdAt: { gte: sevenDaysAgo } } }),
    prisma.analyticsEvent.count({ where: { type: 'AVAILABILITY_TRIGGERED', createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
  ]);

  return {
    platform: {
      totalUsers,
      totalPharmacies,
      verifiedPharmacies,
      totalMedicines,
      totalSearches,
      avgResultCount,
      searchesWithNoResults,
      alertsTriggered,
    },
    trends7d: {
      usersDelta: usersThisWeek - usersLastWeek,
      searchesDelta: searchesThisWeek - searchesLastWeek,
      noResultSearchesDelta: noResultThisWeek - noResultLastWeek,
      alertsTriggeredDelta: alertsThisWeek - alertsLastWeek,
    },
  };
}

// ─── 2. Search Trends ───────────────────────────────────────────

interface SearchTrendPoint {
  date: string;
  totalSearches: number;
  aiSearches: number;
  noResultSearches: number;
}

export async function getSearchTrends(period: string): Promise<{ period: string; trends: SearchTrendPoint[] }> {
  const days = periodToDays(period);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const raw = await prisma.$queryRaw<Array<{
    date: Date;
    total_searches: bigint;
    ai_searches: bigint;
    no_result_searches: bigint;
  }>>`
    SELECT
      DATE(created_at) AS date,
      COUNT(*)::bigint AS total_searches,
      SUM(CASE WHEN ai_used = true THEN 1 ELSE 0 END)::bigint AS ai_searches,
      SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END)::bigint AS no_result_searches
    FROM search_queries
    WHERE created_at >= ${since}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return {
    period,
    trends: raw.map((r) => ({
      date: new Date(r.date).toISOString().split('T')[0],
      totalSearches: Number(r.total_searches),
      aiSearches: Number(r.ai_searches),
      noResultSearches: Number(r.no_result_searches),
    })),
  };
}

// ─── 3. Top Searches ────────────────────────────────────────────

interface TopSearch {
  query: string;
  searchCount: number;
  avgResultCount: number;
  aiUsageRate: number;
}

export async function getTopSearches(period: string, limit: number): Promise<TopSearch[]> {
  const days = periodToDays(period);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const raw = await prisma.$queryRaw<Array<{
    query: string;
    search_count: bigint;
    avg_result_count: number;
    ai_usage_rate: number;
  }>>`
    SELECT
      query,
      COUNT(*)::bigint AS search_count,
      AVG(result_count) AS avg_result_count,
      AVG(CASE WHEN ai_used = true THEN 1.0 ELSE 0.0 END) AS ai_usage_rate
    FROM search_queries
    WHERE created_at >= ${since}
    GROUP BY query
    ORDER BY search_count DESC
    LIMIT ${limit}
  `;

  return raw.map((r) => ({
    query: r.query,
    searchCount: Number(r.search_count),
    avgResultCount: Math.round(Number(r.avg_result_count) * 10) / 10,
    aiUsageRate: Math.round(Number(r.ai_usage_rate) * 100) / 100,
  }));
}

// ─── 4. Demand Gaps ─────────────────────────────────────────────

interface DemandGap {
  query: string;
  searchCount: number;
  notFoundCount: number;
  gapRate: number;
}

export async function getDemandGaps(period: string, limit: number): Promise<DemandGap[]> {
  const days = periodToDays(period);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const raw = await prisma.$queryRaw<Array<{
    query: string;
    search_count: bigint;
    not_found_count: bigint;
    gap_rate: number;
  }>>`
    SELECT
      query,
      COUNT(*)::bigint AS search_count,
      SUM(CASE WHEN target_found = false THEN 1 ELSE 0 END)::bigint AS not_found_count,
      ROUND(SUM(CASE WHEN target_found = false THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric, 2) AS gap_rate
    FROM search_queries
    WHERE created_at >= ${since}
      AND target_medicine_id IS NOT NULL
    GROUP BY query
    HAVING SUM(CASE WHEN target_found = false THEN 1 ELSE 0 END) > 0
    ORDER BY not_found_count DESC
    LIMIT ${limit}
  `;

  return raw.map((r) => ({
    query: r.query,
    searchCount: Number(r.search_count),
    notFoundCount: Number(r.not_found_count),
    gapRate: Number(r.gap_rate),
  }));
}

// ─── 5. Pharmacy Leaderboard ────────────────────────────────────

interface LeaderboardEntry {
  pharmacyId: string;
  pharmacyName: string;
  healthScore: number;
  healthTier: HealthTier;
  totalSkus: number;
  searchImpressions: number;
  alertsTriggered: number;
}

export async function getPharmacyLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
  // Get the latest completed daily snapshot per pharmacy
  // Using DISTINCT ON for Postgres to get the most recent per pharmacy
  const raw = await prisma.$queryRaw<Array<{
    pharmacy_id: string;
    pharmacy_name: string;
    health_score: number;
    total_skus: number;
    search_impressions: number;
    alerts_triggered: number;
  }>>`
    SELECT DISTINCT ON (pms.pharmacy_id)
      pms.pharmacy_id,
      p.name AS pharmacy_name,
      pms.health_score,
      pms.total_skus,
      pms.search_impressions,
      pms.alerts_triggered
    FROM pharmacy_metrics_snapshots pms
    JOIN pharmacies p ON p.id = pms.pharmacy_id
    WHERE pms.period = 'daily'
    ORDER BY pms.pharmacy_id, pms.period_start DESC
  `;

  // Sort by health_score DESC, then apply limit in JS
  // (DISTINCT ON requires ORDER BY to start with pharmacy_id)
  const sorted = raw
    .sort((a, b) => b.health_score - a.health_score)
    .slice(0, limit);

  return sorted.map((r) => {
    const tier: HealthTier =
      r.health_score >= 88 ? 'excellent'
        : r.health_score >= 72 ? 'strong'
          : r.health_score >= 55 ? 'watch'
            : 'critical';

    return {
      pharmacyId: r.pharmacy_id,
      pharmacyName: r.pharmacy_name,
      healthScore: r.health_score,
      healthTier: tier,
      totalSkus: r.total_skus,
      searchImpressions: r.search_impressions,
      alertsTriggered: r.alerts_triggered,
    };
  });
}
