import prisma from '../lib/prisma.js';
import logger from '../utils/logger.js';
import { computeHealthScoreFromInventory } from '../utils/healthScore.js';

/**
 * Metrics Aggregation Service (Phase 10.3).
 *
 * Pure aggregation logic — testable without BullMQ.
 * Called by the analyticsAggregationWorker.
 *
 * Produces PharmacyMetricsSnapshot rows:
 *   - Hourly: periodStart = previous hour, counting fields from [periodStart, periodEnd)
 *   - Daily: rollup of hourly snapshots, inventory fields from last hourly observation
 */

// ─── Types ──────────────────────────────────────────────────────

interface AggregationResult {
  pharmaciesProcessed: number;
  snapshotsCreated: number;
  dailyRollupsCreated: number;
  errors: number;
}

// ─── Hourly aggregation ─────────────────────────────────────────

/**
 * Aggregate metrics for ALL verified pharmacies for a single hourly period.
 *
 * periodEnd = current hour floor (e.g. 12:00 UTC)
 * periodStart = periodEnd - 1 hour (e.g. 11:00 UTC)
 *
 * Counting fields (searchImpressions, alertsTriggered):
 *   WHERE createdAt >= periodStart AND createdAt < periodEnd
 *
 * Inventory fields: current live state observed at aggregation time.
 *
 * Idempotent: uses upsert keyed on [pharmacyId, period, periodStart].
 */
export async function aggregateHourlyMetrics(): Promise<AggregationResult> {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setUTCMinutes(0, 0, 0);

  const periodStart = new Date(periodEnd);
  periodStart.setUTCHours(periodStart.getUTCHours() - 1);

  logger.info('📊 Hourly aggregation starting', {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  });

  // Fetch all verified pharmacies
  const pharmacies = await prisma.pharmacy.findMany({
    where: { status: 'VERIFIED' },
    select: { id: true },
  });

  let snapshotsCreated = 0;
  let errors = 0;

  for (const pharmacy of pharmacies) {
    try {
      await aggregatePharmacyHourly(pharmacy.id, periodStart, periodEnd);
      snapshotsCreated++;
    } catch (error) {
      errors++;
      logger.error('Hourly aggregation failed for pharmacy', {
        pharmacyId: pharmacy.id,
        error: String(error),
      });
    }
  }

  // Check for daily rollup
  let dailyRollupsCreated = 0;
  try {
    dailyRollupsCreated = await rollupDailySnapshots(pharmacies.map((p) => p.id));
  } catch (error) {
    logger.error('Daily rollup failed', { error: String(error) });
  }

  logger.info('📊 Hourly aggregation complete', {
    pharmaciesProcessed: pharmacies.length,
    snapshotsCreated,
    dailyRollupsCreated,
    errors,
  });

  return {
    pharmaciesProcessed: pharmacies.length,
    snapshotsCreated,
    dailyRollupsCreated,
    errors,
  };
}

// ─── Per-pharmacy hourly aggregation ────────────────────────────

async function aggregatePharmacyHourly(
  pharmacyId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  // 1. Fetch current inventory (point-in-time observation)
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

  // 2. Compute health score and inventory metrics
  const health = computeHealthScoreFromInventory(inventory);
  const totalSkus = health.total;
  const inStockSkus = totalSkus - health.outOfStock;
  const outOfStockSkus = health.outOfStock;
  const lowStockSkus = health.lowStock;
  const expiredSkus = health.expired;
  const expiringSoonSkus = health.expiringCritical + health.expiringSoon;
  const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);

  // avgPrice: average price of all inventory items, or 0 if no inventory
  const avgPrice = inventory.length > 0
    ? Math.round((inventory.reduce((sum, item) => sum + item.price, 0) / inventory.length) * 100) / 100
    : 0;

  // 3. Count search impressions in the hour window
  const searchImpressions = await prisma.searchImpression.count({
    where: {
      pharmacyId,
      createdAt: { gte: periodStart, lt: periodEnd },
    },
  });

  // 4. Count availability alerts triggered in the hour window
  const alertsTriggered = await prisma.analyticsEvent.count({
    where: {
      pharmacyId,
      type: 'AVAILABILITY_TRIGGERED',
      createdAt: { gte: periodStart, lt: periodEnd },
    },
  });

  // 5. Upsert snapshot (idempotent)
  const snapshotData = {
    totalSkus,
    inStockSkus,
    outOfStockSkus,
    lowStockSkus,
    expiredSkus,
    expiringSoonSkus,
    totalQuantity,
    healthScore: health.healthScore,
    avgPrice,
    searchImpressions,
    alertsTriggered,
  };

  await prisma.pharmacyMetricsSnapshot.upsert({
    where: {
      pharmacyId_period_periodStart: {
        pharmacyId,
        period: 'hourly',
        periodStart,
      },
    },
    create: {
      pharmacyId,
      period: 'hourly',
      periodStart,
      ...snapshotData,
    },
    update: snapshotData,
  });
}

// ─── Daily rollup ───────────────────────────────────────────────

/**
 * For each pharmacy, check if the previous calendar day (UTC) needs
 * a daily rollup. Generates one daily snapshot per pharmacy per day.
 *
 * Daily snapshot fields:
 *   - healthScore = ROUND(AVG of hourly healthScores)
 *   - searchImpressions = SUM of hourly searchImpressions
 *   - alertsTriggered = SUM of hourly alertsTriggered
 *   - Inventory fields = LAST hourly observation (greatest periodStart)
 */
async function rollupDailySnapshots(pharmacyIds: string[]): Promise<number> {
  // Yesterday UTC midnight
  const now = new Date();
  const yesterdayStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1,
  ));
  const yesterdayEnd = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));

  let rollupsCreated = 0;

  for (const pharmacyId of pharmacyIds) {
    try {
      // Check if daily snapshot already exists
      const existingDaily = await prisma.pharmacyMetricsSnapshot.findUnique({
        where: {
          pharmacyId_period_periodStart: {
            pharmacyId,
            period: 'daily',
            periodStart: yesterdayStart,
          },
        },
      });

      if (existingDaily) continue; // Already rolled up

      // Get all hourly snapshots for yesterday
      const hourlySnapshots = await prisma.pharmacyMetricsSnapshot.findMany({
        where: {
          pharmacyId,
          period: 'hourly',
          periodStart: { gte: yesterdayStart, lt: yesterdayEnd },
        },
        orderBy: { periodStart: 'asc' },
      });

      if (hourlySnapshots.length === 0) continue; // No data for yesterday

      // Compute daily aggregates
      const avgHealthScore = Math.round(
        hourlySnapshots.reduce((sum, s) => sum + s.healthScore, 0) / hourlySnapshots.length,
      );
      const totalSearchImpressions = hourlySnapshots.reduce((sum, s) => sum + s.searchImpressions, 0);
      const totalAlertsTriggered = hourlySnapshots.reduce((sum, s) => sum + s.alertsTriggered, 0);

      // Inventory fields from LAST hourly observation
      const lastHourly = hourlySnapshots[hourlySnapshots.length - 1];

      await prisma.pharmacyMetricsSnapshot.create({
        data: {
          pharmacyId,
          period: 'daily',
          periodStart: yesterdayStart,
          totalSkus: lastHourly.totalSkus,
          inStockSkus: lastHourly.inStockSkus,
          outOfStockSkus: lastHourly.outOfStockSkus,
          lowStockSkus: lastHourly.lowStockSkus,
          expiredSkus: lastHourly.expiredSkus,
          expiringSoonSkus: lastHourly.expiringSoonSkus,
          totalQuantity: lastHourly.totalQuantity,
          healthScore: avgHealthScore,
          avgPrice: lastHourly.avgPrice,
          searchImpressions: totalSearchImpressions,
          alertsTriggered: totalAlertsTriggered,
        },
      });

      rollupsCreated++;
    } catch (error) {
      logger.error('Daily rollup failed for pharmacy', {
        pharmacyId,
        error: String(error),
      });
    }
  }

  return rollupsCreated;
}

export { aggregatePharmacyHourly, rollupDailySnapshots };
