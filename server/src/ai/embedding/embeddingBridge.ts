/**
 * Embedding Event Bridge (Phase 9.1c)
 *
 * Listens for catalog.created and catalog.updated events on the event bus
 * and queues background embedding generation jobs via BullMQ.
 *
 * This bridge ensures that:
 *   1. Medicine CRUD operations are never blocked by AI inference
 *   2. Embeddings are automatically regenerated when catalog data changes
 *   3. If AI is disabled or Ollama is down, the job retries later (BullMQ backoff)
 *
 * Initialize this bridge during server startup (after event bus is ready).
 */

import { eventBus } from '../../lib/eventBus.js';
import { embeddingQueue } from '../../jobs/queues.js';
import { aiConfig } from '../config.js';
import logger from '../../utils/logger.js';
import type { EmbeddingJobData } from '../../jobs/embeddingWorker.js';

/**
 * Initialize the embedding event bridge.
 *
 * Call this once during server startup. Idempotent — safe to call multiple times
 * (but unnecessary since the event bus is a singleton).
 */
export function initEmbeddingBridge(): void {
  if (!aiConfig.enabled) {
    logger.info('Embedding bridge: AI disabled, not subscribing to catalog events');
    return;
  }

  // ── catalog.created → queue embedding generation ──────────────
  eventBus.on('catalog.created', async (payload) => {
    try {
      const jobData: EmbeddingJobData = {
        type: 'generate-single',
        medicineId: payload.medicineId,
      };
      await embeddingQueue.add('generate-single', jobData, {
        jobId: `embed-${payload.medicineId}`, // Deduplicate: only one job per medicine
      });
      logger.debug('Embedding bridge: queued for new medicine', {
        medicineId: payload.medicineId,
        name: payload.name,
      });
    } catch (error) {
      logger.error('Embedding bridge: failed to queue for new medicine', {
        medicineId: payload.medicineId,
        error: String(error),
      });
    }
  });

  // ── catalog.updated → queue embedding regeneration ────────────
  eventBus.on('catalog.updated', async (payload) => {
    try {
      const jobData: EmbeddingJobData = {
        type: 'generate-single',
        medicineId: payload.medicineId,
      };
      await embeddingQueue.add('generate-single', jobData, {
        jobId: `embed-${payload.medicineId}-${Date.now()}`, // Unique per update
      });
      logger.debug('Embedding bridge: queued update for medicine', {
        medicineId: payload.medicineId,
        name: payload.name,
      });
    } catch (error) {
      logger.error('Embedding bridge: failed to queue update for medicine', {
        medicineId: payload.medicineId,
        error: String(error),
      });
    }
  });

  logger.info('🧬 Embedding event bridge initialized');
}
