import { describe, it, expect, beforeEach } from 'vitest';
import { prisma, createTestUser, createTestPharmacy } from './setup.js';
import { runCleanup } from '../jobs/analyticsCleanupWorker.js';

/**
 * Phase 10.6 — Analytics Cleanup Worker Tests
 *
 * Verifies:
 *   - Rows older than TTL are deleted
 *   - Rows within TTL are preserved
 *   - search_impressions cascade-deletes when parent search_queries are deleted
 *   - Hourly snapshots older than 7 days are deleted
 *   - Daily snapshots older than 365 days are deleted
 *   - Worker runs successfully with empty tables
 */

// Helper: create a date N days ago
function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('Analytics Cleanup Worker', () => {
  let pharmacyId: string;

  beforeEach(async () => {
    const { user } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(user.id, { status: 'VERIFIED' });
    pharmacyId = pharmacy.id;
  });

  it('runs successfully with empty tables', async () => {
    const result = await runCleanup();
    expect(result.analyticsEventsDeleted).toBe(0);
    expect(result.searchQueriesDeleted).toBe(0);
    expect(result.hourlySnapshotsDeleted).toBe(0);
    expect(result.dailySnapshotsDeleted).toBe(0);
  });

  it('deletes analytics_events older than 90 days', async () => {
    // Create old event (100 days ago) and recent event (10 days ago)
    await prisma.analyticsEvent.create({
      data: {
        type: 'INVENTORY_ADDED',
        pharmacyId,
        actorId: 'test-actor',
        actorRole: 'PHARMACY',
        targetId: 'inv-1',
        targetType: 'INVENTORY',
        createdAt: daysAgo(100),
      },
    });

    await prisma.analyticsEvent.create({
      data: {
        type: 'INVENTORY_ADDED',
        pharmacyId,
        actorId: 'test-actor',
        actorRole: 'PHARMACY',
        targetId: 'inv-2',
        targetType: 'INVENTORY',
        createdAt: daysAgo(10),
      },
    });

    const result = await runCleanup();
    expect(result.analyticsEventsDeleted).toBe(1);

    // Verify recent event is preserved
    const remaining = await prisma.analyticsEvent.count({ where: { pharmacyId } });
    expect(remaining).toBe(1);
  });

  it('deletes search_queries older than 180 days and cascade-deletes impressions', async () => {
    // Create old query (200 days ago) with impressions
    const oldQuery = await prisma.searchQuery.create({
      data: {
        query: 'old-search',
        latitude: 0,
        longitude: 0,
        radiusKm: 5,
        resultCount: 1,
        aiUsed: false,
        responseTimeMs: 10,
        createdAt: daysAgo(200),
      },
    });

    // Create impression linked to old query
    await prisma.searchImpression.create({
      data: {
        searchQueryId: oldQuery.id,
        pharmacyId,
        medicineId: 'med-1',
        matchType: 'exact',
        position: 0,
        createdAt: daysAgo(200),
      },
    });

    // Create recent query (5 days ago)
    await prisma.searchQuery.create({
      data: {
        query: 'recent-search',
        latitude: 0,
        longitude: 0,
        radiusKm: 5,
        resultCount: 2,
        aiUsed: false,
        responseTimeMs: 15,
        createdAt: daysAgo(5),
      },
    });

    const result = await runCleanup();
    expect(result.searchQueriesDeleted).toBe(1);

    // Verify cascade: impression should be gone
    const impressions = await prisma.searchImpression.count({
      where: { searchQueryId: oldQuery.id },
    });
    expect(impressions).toBe(0);

    // Verify recent query is preserved
    const remaining = await prisma.searchQuery.count();
    expect(remaining).toBe(1);
  });

  it('deletes hourly snapshots older than 7 days but preserves recent ones', async () => {
    // Old hourly (10 days ago)
    await prisma.pharmacyMetricsSnapshot.create({
      data: {
        pharmacyId,
        period: 'hourly',
        periodStart: daysAgo(10),
        totalSkus: 5, inStockSkus: 5, outOfStockSkus: 0,
        lowStockSkus: 0, expiredSkus: 0, expiringSoonSkus: 0,
        totalQuantity: 100, avgPrice: 50, healthScore: 100,
      },
    });

    // Recent hourly (2 days ago)
    await prisma.pharmacyMetricsSnapshot.create({
      data: {
        pharmacyId,
        period: 'hourly',
        periodStart: daysAgo(2),
        totalSkus: 5, inStockSkus: 5, outOfStockSkus: 0,
        lowStockSkus: 0, expiredSkus: 0, expiringSoonSkus: 0,
        totalQuantity: 100, avgPrice: 50, healthScore: 100,
      },
    });

    const result = await runCleanup();
    expect(result.hourlySnapshotsDeleted).toBe(1);

    const remaining = await prisma.pharmacyMetricsSnapshot.count({
      where: { pharmacyId, period: 'hourly' },
    });
    expect(remaining).toBe(1);
  });

  it('deletes daily snapshots older than 365 days but preserves recent ones', async () => {
    // Old daily (400 days ago)
    await prisma.pharmacyMetricsSnapshot.create({
      data: {
        pharmacyId,
        period: 'daily',
        periodStart: daysAgo(400),
        totalSkus: 10, inStockSkus: 8, outOfStockSkus: 2,
        lowStockSkus: 1, expiredSkus: 0, expiringSoonSkus: 0,
        totalQuantity: 500, avgPrice: 75, healthScore: 85,
      },
    });

    // Recent daily (30 days ago)
    await prisma.pharmacyMetricsSnapshot.create({
      data: {
        pharmacyId,
        period: 'daily',
        periodStart: daysAgo(30),
        totalSkus: 10, inStockSkus: 8, outOfStockSkus: 2,
        lowStockSkus: 1, expiredSkus: 0, expiringSoonSkus: 0,
        totalQuantity: 500, avgPrice: 75, healthScore: 85,
      },
    });

    const result = await runCleanup();
    expect(result.dailySnapshotsDeleted).toBe(1);

    const remaining = await prisma.pharmacyMetricsSnapshot.count({
      where: { pharmacyId, period: 'daily' },
    });
    expect(remaining).toBe(1);
  });

  it('is idempotent — running twice deletes nothing extra', async () => {
    // Create old data
    await prisma.analyticsEvent.create({
      data: {
        type: 'INVENTORY_ADDED',
        pharmacyId,
        actorId: 'test-actor',
        actorRole: 'PHARMACY',
        targetId: 'inv-x',
        targetType: 'INVENTORY',
        createdAt: daysAgo(100),
      },
    });

    const first = await runCleanup();
    expect(first.analyticsEventsDeleted).toBe(1);

    const second = await runCleanup();
    expect(second.analyticsEventsDeleted).toBe(0);
  });
});
