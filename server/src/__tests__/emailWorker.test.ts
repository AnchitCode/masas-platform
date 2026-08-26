import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { emailQueue } from '../jobs/queues.js';
import { emailWorker } from '../jobs/emailWorker.js';
import * as emailUtils from '../utils/email.js';

describe('Email Worker', () => {
  let queueEvents: QueueEvents;

  beforeAll(async () => {
    // BullMQ requires a dedicated connection for QueueEvents
    queueEvents = new QueueEvents('email', { 
      connection: createRedisConnection('queueEvents'),
      prefix: 'masas'
    });
    await queueEvents.waitUntilReady();
  });

  beforeEach(() => {
    vi.spyOn(emailUtils, 'sendVerificationEmail').mockResolvedValue(undefined);
    vi.spyOn(emailUtils, 'sendPasswordResetEmail').mockResolvedValue(undefined);
    vi.spyOn(emailUtils, 'sendPharmacyVerifiedEmail').mockResolvedValue(undefined);
    vi.spyOn(emailUtils, 'sendPharmacyRejectedEmail').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await queueEvents.close();
    await emailWorker.close();
  });

  it('processes verification-email jobs', async () => {
    const job = await emailQueue.add('verification-email', {
      to: 'verify@example.com',
      name: 'Verify User',
      verifyUrl: 'http://localhost/verify',
    });

    // Wait for worker to pick up and finish the job
    await job.waitUntilFinished(queueEvents);

    expect(emailUtils.sendVerificationEmail).toHaveBeenCalledWith(
      'verify@example.com',
      'Verify User',
      'http://localhost/verify'
    );
  });

  it('processes password-reset-email jobs', async () => {
    const job = await emailQueue.add('password-reset-email', {
      to: 'reset@example.com',
      name: 'Reset User',
      resetUrl: 'http://localhost/reset',
    });

    await job.waitUntilFinished(queueEvents);

    expect(emailUtils.sendPasswordResetEmail).toHaveBeenCalledWith(
      'reset@example.com',
      'Reset User',
      'http://localhost/reset'
    );
  });

  it('processes pharmacy-verified-email jobs', async () => {
    const job = await emailQueue.add('pharmacy-verified-email', {
      to: 'pharmacy@example.com',
      pharmacyName: 'My Pharmacy',
      dashboardUrl: 'http://localhost/dashboard',
    });

    await job.waitUntilFinished(queueEvents);

    expect(emailUtils.sendPharmacyVerifiedEmail).toHaveBeenCalledWith(
      'pharmacy@example.com',
      'My Pharmacy',
      'http://localhost/dashboard'
    );
  });

  it('processes pharmacy-rejected-email jobs', async () => {
    const job = await emailQueue.add('pharmacy-rejected-email', {
      to: 'rejected@example.com',
      pharmacyName: 'Rejected Pharmacy',
      reason: 'Invalid license',
      dashboardUrl: 'http://localhost/dashboard',
    });

    await job.waitUntilFinished(queueEvents);

    expect(emailUtils.sendPharmacyRejectedEmail).toHaveBeenCalledWith(
      'rejected@example.com',
      'Rejected Pharmacy',
      'Invalid license',
      'http://localhost/dashboard'
    );
  });

  it('fails gracefully when encountering an unknown job name', async () => {
    // Cast to any because the generic name string isn't tightly constrained in standard BullMQ Queue.add,
    // but we know our worker throws on unknown names.
    const job = await emailQueue.add('unknown-job-type', { to: 'test' });

    await expect(job.waitUntilFinished(queueEvents)).rejects.toThrow('Unknown email job type: unknown-job-type');
  });

  it('fails and retries if email sending throws an error', async () => {
    // Mock the utility to throw an error on the first call, then succeed on the second
    vi.mocked(emailUtils.sendVerificationEmail).mockRejectedValueOnce(new Error('SMTP connection failed'));

    const job = await emailQueue.add('verification-email', {
      to: 'retry@example.com',
      name: 'Retry User',
      verifyUrl: 'http://localhost/verify',
    });

    // waitUntilFinished will wait through the retries until the job succeeds
    await job.waitUntilFinished(queueEvents);

    // Assert that the function was called twice (once failed, once succeeded)
    expect(emailUtils.sendVerificationEmail).toHaveBeenCalledTimes(2);

    // Job should ultimately be marked as completed
    const state = await job.getState();
    expect(state).toBe('completed');
  });
});
