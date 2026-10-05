import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { QUEUE_NAMES, QUEUE_PREFIX } from './queues.js';
import { aggregateHourlyMetrics } from '../services/metricsAggregator.js';
import logger from '../utils/logger.js';

/**
 * BullMQ Worker for the Analytics Queue (Phase 10.3).
 *
 * Processes the `aggregate-hourly` repeatable job:
 *   1. Computes per-pharmacy metric snapshots for the completed previous hour
 *   2. Generates daily rollups for completed calendar days
 *
 * Concurrency is set to 1 — only one aggregation cycle runs at a time.
 */

const workerConnection = createRedisConnection('analyticsWorker');

export const analyticsAggregationWorker = new Worker(
  QUEUE_NAMES.ANALYTICS,
  async (job: Job) => {
    if (job.name !== 'aggregate-hourly') {
      logger.warn(`analyticsWorker: unknown job name "${job.name}"`);
      return;
    }

    logger.info('📊 Analytics aggregation cycle starting');

    const result = await aggregateHourlyMetrics();

    logger.info('📊 Analytics aggregation cycle complete', { ...result });

    return result;
  },
  {
    connection: workerConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1, // Only one aggregation cycle at a time
  },
);

analyticsAggregationWorker.on('completed', (job: Job) => {
  logger.debug(`Analytics job completed: ${job.name} (ID: ${job.id})`);
});

analyticsAggregationWorker.on('failed', (job: Job | undefined, err: Error) => {
  if (job) {
    logger.error(`Analytics job failed: ${job.name} (ID: ${job.id})`, {
      error: String(err),
    });
  } else {
    logger.error('Analytics worker encountered an error', {
      error: String(err),
    });
  }
});
