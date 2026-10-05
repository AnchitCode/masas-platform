import { describe, it, expect, beforeEach } from 'vitest';
import { prisma, createTestUser, createTestPharmacy } from './setup.js';
import { aggregateHourlyMetrics } from '../services/metricsAggregator.js';

/**
 * Phase 10.3 — Metrics Aggregator Integration Tests
 *
 * Verifies:
 *   - Hourly aggregation produces correct snapshot
 *   - Running twice is idempotent (upsert)
 *   - Empty inventory → healthScore=72
 *   - searchImpressions/alertsTriggered counts are accurate
 *   - Daily rollup: AVG health, SUM counts, LAST inventory
 *   - Daily rollup is skipped for days with 0 hourly snapshots
 */

describe('Metrics Aggregator', () => {
  let pharmacyId: string;

  // Create pharmacy before EACH test since beforeEach TRUNCATE wipes all data
  beforeEach(async () => {
    const { user } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(user.id, { status: 'VERIFIED' });
    pharmacyId = pharmacy.id;
  });

  // ─── Hourly aggregation ─────────────────────────────────────────
  describe('hourly aggregation', () => {
    it('creates a snapshot for verified pharmacy with 0 inventory', async () => {
      await aggregateHourlyMetrics();

      const snapshots = await prisma.pharmacyMetricsSnapshot.findMany({
        where: { pharmacyId, period: 'hourly' },
      });

      expect(snapshots.length).toBeGreaterThanOrEqual(1);
      const latest = snapshots[snapshots.length - 1];
      expect(latest.totalSkus).toBe(0);
      expect(latest.inStockSkus).toBe(0);
      expect(latest.outOfStockSkus).toBe(0);
      expect(latest.healthScore).toBe(72); // empty inventory → 72
      expect(latest.searchImpressions).toBe(0);
      expect(latest.alertsTriggered).toBe(0);
      expect(latest.totalQuantity).toBe(0);
    });

    it('is idempotent — running twice produces same data', async () => {
      await aggregateHourlyMetrics();
      const first = await prisma.pharmacyMetricsSnapshot.findMany({
        where: { pharmacyId, period: 'hourly' },
      });

      await aggregateHourlyMetrics();
      const second = await prisma.pharmacyMetricsSnapshot.findMany({
        where: { pharmacyId, period: 'hourly' },
      });

      // Same number of rows (upsert, not duplicate)
      expect(second.length).toBe(first.length);
    });

    it('includes inventory metrics when items exist', async () => {
      // Create a medicine and inventory item
      const medicine = await prisma.medicineCatalog.create({
        data: { name: 'test-agg-med', genericName: 'test generic' },
      });

      await prisma.pharmacyInventory.create({
        data: {
          pharmacyId,
          medicineId: medicine.id,
          price: 50.0,
          quantity: 100,
          isAvailable: true,
          expiryDate: new Date(Date.now() + 365 * 86400000), // 1 year ahead
        },
      });

      await aggregateHourlyMetrics();

      const snapshots = await prisma.pharmacyMetricsSnapshot.findMany({
        where: { pharmacyId, period: 'hourly' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      expect(snapshots[0].totalSkus).toBe(1);
      expect(snapshots[0].inStockSkus).toBe(1);
      expect(snapshots[0].outOfStockSkus).toBe(0);
      expect(snapshots[0].healthScore).toBe(100);
      expect(snapshots[0].avgPrice).toBe(50.0);
      expect(snapshots[0].totalQuantity).toBe(100);
    });
  });

  // ─── Daily rollup ───────────────────────────────────────────────
  describe('daily rollup', () => {
    it('does NOT create a daily snapshot when no hourly data exists for yesterday', async () => {
      // Run aggregation — creates hourly for current period only
      await aggregateHourlyMetrics();

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      yesterday.setUTCHours(0, 0, 0, 0);

      const daily = await prisma.pharmacyMetricsSnapshot.findMany({
        where: { pharmacyId, period: 'daily', periodStart: yesterday },
      });

      // No hourly data was seeded for yesterday, so no daily rollup
      expect(daily).toHaveLength(0);
    });

    it('creates daily rollup from hourly snapshots', async () => {
      // Seed hourly snapshots for yesterday
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      yesterday.setUTCHours(0, 0, 0, 0);

      // Create 3 hourly snapshots for yesterday
      for (let h = 10; h <= 12; h++) {
        const periodStart = new Date(yesterday);
        periodStart.setUTCHours(h);

        await prisma.pharmacyMetricsSnapshot.create({
          data: {
            pharmacyId,
            period: 'hourly',
            periodStart,
            totalSkus: 10,
            inStockSkus: 8,
            outOfStockSkus: 2,
            lowStockSkus: 1,
            expiredSkus: 0,
            expiringSoonSkus: 1,
            totalQuantity: 500,
            avgPrice: 75.0,
            healthScore: h === 10 ? 80 : h === 11 ? 85 : 90,
            searchImpressions: 10,
            alertsTriggered: 2,
          },
        });
      }

      // Run aggregation (triggers daily rollup)
      await aggregateHourlyMetrics();

      const dailySnapshots = await prisma.pharmacyMetricsSnapshot.findMany({
        where: { pharmacyId, period: 'daily', periodStart: yesterday },
      });

      expect(dailySnapshots).toHaveLength(1);
      const daily = dailySnapshots[0];

      // healthScore = ROUND(AVG(80, 85, 90)) = 85
      expect(daily.healthScore).toBe(85);

      // searchImpressions = SUM(10, 10, 10) = 30
      expect(daily.searchImpressions).toBe(30);

      // alertsTriggered = SUM(2, 2, 2) = 6
      expect(daily.alertsTriggered).toBe(6);

      // Inventory fields = LAST hourly (h=12)
      expect(daily.totalSkus).toBe(10);
      expect(daily.inStockSkus).toBe(8);
      expect(daily.avgPrice).toBe(75.0);
      expect(daily.totalQuantity).toBe(500);
    });
  });
});
