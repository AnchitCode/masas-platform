import IORedis from 'ioredis';
import env from './env.js';
import logger from '../utils/logger.js';

/**
 * Create a new Redis connection.
 *
 * Returns a FACTORY — NOT a singleton.
 * BullMQ requires separate connections for Queue and Worker.
 * Each call creates a fresh IORedis instance.
 *
 * @param label - Optional label for debug logging (e.g., 'emailQueue', 'emailWorker')
 */
export function createRedisConnection(label?: string): IORedis {
  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,    // Faster startup; BullMQ manages readiness
    lazyConnect: true,          // Don't connect until first command — avoids test startup errors
  });

  connection.on('error', (err) => {
    logger.error(`Redis connection error${label ? ` [${label}]` : ''}`, {
      error: String(err),
    });
  });

  return connection;
}

/**
 * Shared Redis client for non-BullMQ usage.
 * Used for:
 *   - Direct Redis commands in tests (key cleanup)
 *   - Health checks
 *   - Any future Redis-direct operations
 *
 * NOT used by BullMQ queues/workers — they create their own connections
 * via createRedisConnection().
 */
export const redisClient = new IORedis(env.REDIS_URL, {
  lazyConnect: true,
  enableReadyCheck: false,
});

redisClient.on('error', (err) => {
  logger.error('Redis client error', { error: String(err) });
});
