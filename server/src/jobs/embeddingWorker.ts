/**
 * Embedding BullMQ Worker (Phase 9.1c)
 *
 * Background worker that generates embeddings for medicines.
 * Uses the existing MASAS BullMQ/Redis infrastructure.
 *
 * Job types:
 *   - 'generate-single': Generate embedding for one medicine (triggered by catalog events)
 *   - 'backfill': Process all medicines that need embeddings (admin-triggered)
 *
 * This worker does NOT block normal CRUD operations — jobs are queued
 * asynchronously and processed in the background.
 *
 * Safety:
 *   - Checks aiConfig.enabled before processing
 *   - Skips if embedding provider is unavailable
 *   - Each job is independently retriable
 *   - Never modifies medicine catalog fields (only embedding + embeddingHash)
 */

import { Worker } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { QUEUE_PREFIX } from './queues.js';
import { aiConfig } from '../ai/config.js';
import { generateEmbeddingForMedicine, backfillEmbeddings } from '../ai/embedding/index.js';
import logger from '../utils/logger.js';

// ─── Job Payload Types ───────────────────────────────────────────

export interface GenerateSingleJob {
  type: 'generate-single';
  medicineId: string;
}

export interface BackfillJob {
  type: 'backfill';
  batchSize?: number;
}

export type EmbeddingJobData = GenerateSingleJob | BackfillJob;

// ─── Worker ──────────────────────────────────────────────────────

const embeddingWorkerConnection = createRedisConnection('embeddingWorker');

export const embeddingWorker = new Worker<EmbeddingJobData>(
  'embeddings',
  async (job) => {
    if (!aiConfig.enabled) {
      logger.debug('Embedding worker: AI disabled, skipping job', { jobId: job.id });
      return { status: 'skipped', reason: 'AI disabled' };
    }

    const data = job.data;

    switch (data.type) {
      case 'generate-single': {
        const result = await generateEmbeddingForMedicine(data.medicineId);
        logger.debug('Embedding worker: single complete', { medicineId: data.medicineId, status: result.status });
        return result;
      }

      case 'backfill': {
        const report = await backfillEmbeddings(data.batchSize);
        logger.info('Embedding worker: backfill complete', {
          generated: report.generated,
          skipped: report.skipped,
          errors: report.errors,
          durationMs: report.durationMs,
        });
        return report;
      }

      default: {
        logger.warn('Embedding worker: unknown job type', { data });
        return { status: 'error', reason: 'Unknown job type' };
      }
    }
  },
  {
    connection: embeddingWorkerConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1, // Sequential — one embedding at a time for M1 8 GB
    limiter: {
      max: 1,
      duration: 500, // At most 1 job per 500ms to prevent Ollama overload
    },
  },
);

// Error handling
embeddingWorker.on('failed', (job, err) => {
  logger.error('Embedding worker job failed', {
    jobId: job?.id,
    error: err.message,
  });
});

embeddingWorker.on('error', (err) => {
  logger.error('Embedding worker error', { error: err.message });
});
