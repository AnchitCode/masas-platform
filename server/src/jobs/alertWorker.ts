import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { QUEUE_NAMES, QUEUE_PREFIX } from './queues.js';
import alertService from '../modules/search/alert.service.js';
import logger from '../utils/logger.js';

/**
 * BullMQ Worker for the Alert Queue (Phase 8.11).
 *
 * Processes the `check-availability` repeatable job:
 *   1. Fetches active saved searches that haven't been checked recently
 *   2. Runs each through alertService.processSearch()
 *   3. Individual failures are caught and logged — one bad search
 *      doesn't block the entire batch
 *
 * Concurrency is set to 1 — only one alert cycle runs at a time.
 */

const BATCH_SIZE = 50;

const workerConnection = createRedisConnection('alertWorker');

export const alertWorker = new Worker(
  QUEUE_NAMES.ALERTS,
  async (job: Job) => {
    if (job.name !== 'check-availability') {
      logger.warn(`alertWorker: unknown job name "${job.name}"`);
      return;
    }

    logger.info('🔔 Alert cycle starting');

    // Fetch searches not checked in the last 25 minutes
    // (slightly less than the 30-min interval to avoid drift gaps)
    const searches = await alertService.getActiveSearchesBatch(BATCH_SIZE, 25);

    logger.info(`🔔 Processing ${searches.length} saved searches`);

    let processed = 0;
    let failed = 0;

    for (const search of searches) {
      try {
        await alertService.processSearch(search);
        processed++;
      } catch (error) {
        failed++;
        logger.error('Alert processing failed for search', {
          searchId: search.id,
          userId: search.userId,
          query: search.query,
          error: (error as Error).message,
        });
        // Continue with next search — don't let one failure block the batch
      }
    }

    logger.info('🔔 Alert cycle complete', {
      total: searches.length,
      processed,
      failed,
    });
  },
  {
    connection: workerConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1, // Only one alert cycle at a time
  },
);

alertWorker.on('completed', (job: Job) => {
  logger.debug(`Alert job completed: ${job.name} (ID: ${job.id})`);
});

alertWorker.on('failed', (job: Job | undefined, err: Error) => {
  if (job) {
    logger.error(`Alert job failed: ${job.name} (ID: ${job.id})`, {
      error: String(err),
    });
  } else {
    logger.error('Alert worker encountered an error', {
      error: String(err),
    });
  }
});
