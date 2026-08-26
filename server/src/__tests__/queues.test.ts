import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { redisClient } from '../config/redis.js';
import { emailQueue, alertQueue, QUEUE_NAMES } from '../jobs/queues.js';

/**
 * BullMQ Queue Tests.
 *
 * These tests verify:
 *   1. Redis connectivity
 *   2. Queue instances are correctly configured
 *   3. Jobs can be added to queues
 *   4. Default job options are applied
 *
 * Requires Redis to be running locally (docker run -d -p 6379:6379 redis:7-alpine).
 */
describe('BullMQ Queues', () => {
  beforeAll(async () => {
    // Ensure Redis is connected for direct commands
    if (redisClient.status === 'wait') {
      await redisClient.connect();
    }
  });

  afterAll(async () => {
    // Clean up any test jobs
    const keys = await redisClient.keys('masas:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    
    // Close queue connections
    await emailQueue.close();
    await alertQueue.close();
  });

  describe('Redis Connectivity', () => {
    it('connects to Redis successfully', async () => {
      const pong = await redisClient.ping();
      expect(pong).toBe('PONG');
    });
  });

  describe('Queue Configuration', () => {
    it('email queue has the correct name', () => {
      expect(emailQueue.name).toBe(QUEUE_NAMES.EMAIL);
      expect(emailQueue.name).toBe('email');
    });

    it('alert queue has the correct name', () => {
      expect(alertQueue.name).toBe(QUEUE_NAMES.ALERTS);
      expect(alertQueue.name).toBe('alerts');
    });
  });

  describe('Job Addition', () => {
    it('can add a job to the email queue', async () => {
      const job = await emailQueue.add('verification-email', {
        to: 'test@example.com',
        name: 'Test User',
        verifyUrl: 'https://example.com/verify/abc',
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe('verification-email');
      expect(job.data).toMatchObject({
        to: 'test@example.com',
        name: 'Test User',
      });
    });

    it('can add a job to the alert queue', async () => {
      const job = await alertQueue.add('check-saved-searches', {
        batchSize: 50,
        offset: 0,
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe('check-saved-searches');
    });

    it('email queue applies default job options (3 attempts)', async () => {
      const job = await emailQueue.add('notification-email', {
        to: 'test@example.com',
        subject: 'Test',
      });

      expect(job.opts.attempts).toBe(3);
      expect(job.opts.backoff).toMatchObject({
        type: 'exponential',
        delay: 2000,
      });
    });

    it('alert queue applies default job options (1 attempt)', async () => {
      const job = await alertQueue.add('check-saved-searches', {
        batchSize: 50,
      });

      expect(job.opts.attempts).toBe(1);
    });
  });
});
