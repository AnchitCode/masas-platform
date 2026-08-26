import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { QUEUE_NAMES, QUEUE_PREFIX } from './queues.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPharmacyVerifiedEmail,
  sendPharmacyRejectedEmail,
  sendMedicineAvailableEmail,
} from '../utils/email.js';
import logger from '../utils/logger.js';

/**
 * BullMQ Worker for the Email Queue.
 *
 * Pulls jobs from the Redis queue and calls the appropriate Nodemailer
 * function. If the job fails (e.g., SMTP error), BullMQ will automatically
 * retry it based on the queue's defaultJobOptions.
 */

// Worker needs its own dedicated Redis connection
const workerConnection = createRedisConnection('emailWorker');

export const emailWorker = new Worker(
  QUEUE_NAMES.EMAIL,
  async (job: Job) => {
    logger.debug(`Processing email job: ${job.name} (ID: ${job.id})`);

    switch (job.name) {
      case 'verification-email':
        await sendVerificationEmail(job.data.to, job.data.name, job.data.verifyUrl);
        break;

      case 'password-reset-email':
        await sendPasswordResetEmail(job.data.to, job.data.name, job.data.resetUrl);
        break;

      case 'pharmacy-verified-email':
        await sendPharmacyVerifiedEmail(job.data.to, job.data.pharmacyName, job.data.dashboardUrl);
        break;

      case 'pharmacy-rejected-email':
        await sendPharmacyRejectedEmail(job.data.to, job.data.pharmacyName, job.data.reason, job.data.dashboardUrl);
        break;

      case 'medicine-available-email':
        await sendMedicineAvailableEmail(
          job.data.to, job.data.userName, job.data.medicineName,
          job.data.pharmacyName, job.data.quantity, job.data.distanceKm,
          job.data.searchUrl,
        );
        break;

      default:
        throw new Error(`Unknown email job type: ${job.name}`);
    }
  },
  {
    connection: workerConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 5, // Process up to 5 emails in parallel
  }
);

emailWorker.on('completed', (job: Job) => {
  logger.debug(`Email job completed: ${job.name} (ID: ${job.id})`);
});

emailWorker.on('failed', (job: Job | undefined, err: Error) => {
  if (job) {
    logger.error(`Email job failed: ${job.name} (ID: ${job.id})`, { error: String(err) });
  } else {
    logger.error(`Email worker encountered an error`, { error: String(err) });
  }
});
