import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { QUEUE_NAMES, QUEUE_PREFIX } from './queues.js';
import prisma from '../lib/prisma.js';
import logger from '../utils/logger.js';

/**
 * Phase 10.6 — Analytics Cleanup Worker
 *
 * TTL-based data cleanup to prevent unbounded table growth.
 *
 * Retention policy:
 *   - analytics_events:                  90 days
 *   - search_queries (+ impressions):   180 days (impressions cascade-delete)
 *   - pharmacy_metrics_snapshots hourly:   7 days
 *   - pharmacy_metrics_snapshots daily:  365 days
 *
 * Runs daily at 03:00 UTC via BullMQ repeatable job.
 * DELETE is naturally idempotent — re-running deletes nothing if already cleaned.
 */

// ─── Configurable TTLs (env vars with defaults) ─────────────────

const ANALYTICS_EVENT_TTL_DAYS = parseInt(process.env.ANALYTICS_EVENT_TTL_DAYS || '90', 10);
const SEARCH_ANALYTICS_TTL_DAYS = parseInt(process.env.SEARCH_ANALYTICS_TTL_DAYS || '180', 10);
const HOURLY_SNAPSHOT_TTL_DAYS = parseInt(process.env.HOURLY_SNAPSHOT_TTL_DAYS || '7', 10);
const DAILY_SNAPSHOT_TTL_DAYS = parseInt(process.env.DAILY_SNAPSHOT_TTL_DAYS || '365', 10);

// ─── Cleanup Logic ──────────────────────────────────────────────

export interface CleanupResult {
  analyticsEventsDeleted: number;
  searchQueriesDeleted: number;
  hourlySnapshotsDeleted: number;
  dailySnapshotsDeleted: number;
}

export async function runCleanup(): Promise<CleanupResult> {
  const now = new Date();

  // 1. analytics_events: 90 days
  const eventsCutoff = new Date(now);
  eventsCutoff.setUTCDate(eventsCutoff.getUTCDate() - ANALYTICS_EVENT_TTL_DAYS);

  const eventsResult = await prisma.analyticsEvent.deleteMany({
    where: { createdAt: { lt: eventsCutoff } },
  });

  // 2. search_queries: 180 days (search_impressions cascade-delete via FK)
  const searchCutoff = new Date(now);
  searchCutoff.setUTCDate(searchCutoff.getUTCDate() - SEARCH_ANALYTICS_TTL_DAYS);

  const searchResult = await prisma.searchQuery.deleteMany({
    where: { createdAt: { lt: searchCutoff } },
  });

  // 3. hourly snapshots: 7 days
  const hourlyCutoff = new Date(now);
  hourlyCutoff.setUTCDate(hourlyCutoff.getUTCDate() - HOURLY_SNAPSHOT_TTL_DAYS);

  const hourlyResult = await prisma.pharmacyMetricsSnapshot.deleteMany({
    where: { period: 'hourly', periodStart: { lt: hourlyCutoff } },
  });

  // 4. daily snapshots: 365 days
  const dailyCutoff = new Date(now);
  dailyCutoff.setUTCDate(dailyCutoff.getUTCDate() - DAILY_SNAPSHOT_TTL_DAYS);

  const dailyResult = await prisma.pharmacyMetricsSnapshot.deleteMany({
    where: { period: 'daily', periodStart: { lt: dailyCutoff } },
  });

  const result: CleanupResult = {
    analyticsEventsDeleted: eventsResult.count,
    searchQueriesDeleted: searchResult.count,
    hourlySnapshotsDeleted: hourlyResult.count,
    dailySnapshotsDeleted: dailyResult.count,
  };

  logger.info('🧹 Analytics cleanup complete', { ...result });

  return result;
}

// ─── BullMQ Worker ──────────────────────────────────────────────

const workerConnection = createRedisConnection('analyticsCleanupWorker');

export const analyticsCleanupWorker = new Worker(
  QUEUE_NAMES.ANALYTICS,
  async (job: Job) => {
    if (job.name !== 'cleanup-ttl') {
      // Not our job — the aggregation worker handles 'aggregate-hourly'
      return;
    }

    logger.info('🧹 Analytics cleanup starting');
    return await runCleanup();
  },
  {
    connection: workerConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1,
  },
);

analyticsCleanupWorker.on('completed', (job: Job) => {
  if (job.name === 'cleanup-ttl') {
    logger.debug(`Cleanup job completed: ${job.name} (ID: ${job.id})`);
  }
});

analyticsCleanupWorker.on('failed', (job: Job | undefined, err: Error) => {
  if (job?.name === 'cleanup-ttl') {
    logger.error(`Cleanup job failed: ${job.name} (ID: ${job.id})`, { error: String(err) });
  }
});
