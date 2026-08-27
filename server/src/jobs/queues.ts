import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';

/**
 * BullMQ Queue Definitions.
 *
 * EXTRACTABILITY CONTRACT:
 *   - Services import from this file only (never import workers).
 *   - Workers import from this file to get queue names/connections.
 *   - To extract workers to a separate process later, move worker files
 *     to a new entry point — no changes to this file or any service.
 *
 * Queue names are prefixed with `masas:` to namespace them in
 * shared Redis instances (e.g., Upstash free tier).
 */

// ─── Connections ─────────────────────────────────────────────────
// Each Queue gets its own connection (BullMQ best practice).
const emailQueueConnection = createRedisConnection('emailQueue');
const alertQueueConnection = createRedisConnection('alertQueue');
const embeddingQueueConnection = createRedisConnection('embeddingQueue');

// ─── Email Queue ─────────────────────────────────────────────────
// Handles all email sending: verification, password reset, notification alerts.
// Phase 8.6 adds the corresponding emailWorker.
export const emailQueue = new Queue('email', {
  connection: emailQueueConnection,
  prefix: 'masas',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },  // Keep last 100 completed jobs for debugging
    removeOnFail: { count: 500 },      // Keep last 500 failed jobs for investigation
  },
});

// ─── Alert Queue ─────────────────────────────────────────────────
// Handles saved-search background checking (Phase 8.11).
// Each job processes a batch of saved searches.
export const alertQueue = new Queue('alerts', {
  connection: alertQueueConnection,
  prefix: 'masas',
  defaultJobOptions: {
    attempts: 1,                       // Alert checks are idempotent — no retry needed
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

// ─── Embedding Queue (Phase 9.1c) ───────────────────────────────
// Handles background embedding generation for medicine catalog entries.
// Jobs are queued when medicines are created/updated, and for bulk backfill.
export const embeddingQueue = new Queue('embeddings', {
  connection: embeddingQueueConnection,
  prefix: 'masas',
  defaultJobOptions: {
    attempts: 5,                       // Ollama may be temporarily unavailable
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

// ─── Queue Names (exported constants for workers) ────────────────
export const QUEUE_NAMES = {
  EMAIL: 'email',
  ALERTS: 'alerts',
  EMBEDDINGS: 'embeddings',
} as const;

export const QUEUE_PREFIX = 'masas';
