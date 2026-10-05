import { analyticsQueue } from './queues.js';
import logger from '../utils/logger.js';

/**
 * Analytics Scheduler (Phase 10.3 + 10.6).
 *
 * Registers BullMQ repeatable jobs:
 *   1. `aggregate-hourly` — fires every hour at minute 0 (Phase 10.3)
 *   2. `cleanup-ttl` — fires daily at 03:00 UTC (Phase 10.6)
 *
 * Follows the same pattern as alertScheduler.ts:
 *   - Remove stale repeatables from previous deployments
 *   - Register fresh repeatables with current cron patterns
 *
 * Called once during server startup.
 */

const DEFAULT_AGGREGATION_CRON = '0 * * * *';     // Every hour at minute 0
const DEFAULT_CLEANUP_CRON = '0 3 * * *';          // Daily at 03:00 UTC

export async function startAnalyticsScheduler(): Promise<void> {
  const aggregationCron = process.env.ANALYTICS_CRON_PATTERN || DEFAULT_AGGREGATION_CRON;
  const cleanupCron = process.env.ANALYTICS_CLEANUP_CRON_PATTERN || DEFAULT_CLEANUP_CRON;

  // Remove any stale repeatable jobs from previous deployments
  // (in case the cron pattern changed)
  const existing = await analyticsQueue.getRepeatableJobs();
  for (const job of existing) {
    await analyticsQueue.removeRepeatableByKey(job.key);
  }

  // Schedule hourly aggregation (Phase 10.3)
  await analyticsQueue.add('aggregate-hourly', {}, {
    repeat: { pattern: aggregationCron },
  });

  // Schedule daily cleanup (Phase 10.6)
  await analyticsQueue.add('cleanup-ttl', {}, {
    repeat: { pattern: cleanupCron },
  });

  logger.info(`📊 Analytics scheduler registered: aggregation=${aggregationCron}, cleanup=${cleanupCron}`);
}
