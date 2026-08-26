import { alertQueue } from './queues.js';
import logger from '../utils/logger.js';

/**
 * Alert Scheduler (Phase 8.11).
 *
 * Registers a BullMQ repeatable job that fires every 30 minutes
 * (configurable via ALERT_CRON_PATTERN env variable).
 *
 * Why BullMQ instead of node-cron:
 *   - Survives server restarts (job config persisted in Redis)
 *   - Safe in multi-instance deployments (only one worker picks the job)
 *   - Built-in failure tracking and retry
 *
 * Called once during server startup.
 */

const DEFAULT_CRON = '*/30 * * * *';

export async function startAlertScheduler(): Promise<void> {
  const cronPattern = process.env.ALERT_CRON_PATTERN || DEFAULT_CRON;

  // Remove any stale repeatable jobs from previous deployments
  // (in case the cron pattern changed)
  const existing = await alertQueue.getRepeatableJobs();
  for (const job of existing) {
    await alertQueue.removeRepeatableByKey(job.key);
  }

  // Schedule: fires on the specified cron pattern
  await alertQueue.add('check-availability', {}, {
    repeat: { pattern: cronPattern },
  });

  logger.info(`🔔 Alert scheduler registered: ${cronPattern}`);
}
