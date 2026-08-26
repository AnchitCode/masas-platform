import { getIO } from './socket.js';
import { eventBus } from './eventBus.js';
import prisma from './prisma.js';
import notificationService from '../modules/notification/notification.service.js';
import logger from '../utils/logger.js';
import { emailQueue } from '../jobs/queues.js';
import env from '../config/env.js';

/**
 * Bridge Event Bus events to persistent notifications + Socket.io push.
 *
 * RESPONSIBILITY SEPARATION:
 *   socketEventBridge         → inventory data sync + session invalidation (no DB rows)
 *   notificationEventBridge   → persistent notifications with Socket.io push as side effect
 *
 * No event is handled by both bridges. Rule:
 *   If it needs a DB notification row → notificationEventBridge only.
 *   If it's purely live data sync     → socketEventBridge only.
 *
 * Each handler:
 *   1. Creates a DB notification via notificationService.create()
 *   2. Pushes the created notification to the user via Socket.io
 *   3. (Phase 8.6) Will also queue an email job via BullMQ
 *
 * Called once during server startup.
 */
let initialized = false;

export function bridgeEventsToNotifications(): void {
  if (initialized) return;
  initialized = true;

  // ── pharmacy.verified ───────────────────────────────────────
  eventBus.on('pharmacy.verified', async (payload) => {
    try {
      const notification = await notificationService.create({
        userId: payload.userId,
        type: 'PHARMACY_VERIFIED',
        title: 'Pharmacy Verified! 🎉',
        message: `Your pharmacy "${payload.pharmacyName}" has been verified. You can now manage your inventory.`,
        data: { pharmacyId: payload.pharmacyId },
      });

      getIO()?.to(`user:${payload.userId}`).emit('notification:new', notification);

      logger.debug('notification created: pharmacy.verified', {
        notificationId: notification.id,
        userId: payload.userId,
      });

      const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
      if (user) {
        emailQueue.add('pharmacy-verified-email', {
          to: user.email,
          pharmacyName: payload.pharmacyName,
          dashboardUrl: `${env.CLIENT_URL}/dashboard`,
        }).catch((err) => {
          logger.error('Failed to enqueue verified email', { userId: payload.userId, error: String(err) });
        });
      }
    } catch (error) {
      logger.error('notification bridge error: pharmacy.verified', {
        error: String(error),
        userId: payload.userId,
      });
    }
  });

  // ── pharmacy.rejected ───────────────────────────────────────
  eventBus.on('pharmacy.rejected', async (payload) => {
    try {
      const reasonSuffix = payload.reason
        ? ` Reason: ${payload.reason}`
        : ' Please update your profile and resubmit.';

      const notification = await notificationService.create({
        userId: payload.userId,
        type: 'PHARMACY_REJECTED',
        title: 'Pharmacy Requires Updates',
        message: `Your pharmacy "${payload.pharmacyName}" was not approved.${reasonSuffix}`,
        data: { pharmacyId: payload.pharmacyId, reason: payload.reason ?? null },
      });

      getIO()?.to(`user:${payload.userId}`).emit('notification:new', notification);

      logger.debug('notification created: pharmacy.rejected', {
        notificationId: notification.id,
        userId: payload.userId,
      });

      const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
      if (user) {
        emailQueue.add('pharmacy-rejected-email', {
          to: user.email,
          pharmacyName: payload.pharmacyName,
          reason: payload.reason ?? null,
          dashboardUrl: `${env.CLIENT_URL}/dashboard`,
        }).catch((err) => {
          logger.error('Failed to enqueue rejected email', { userId: payload.userId, error: String(err) });
        });
      }
    } catch (error) {
      logger.error('notification bridge error: pharmacy.rejected', {
        error: String(error),
        userId: payload.userId,
      });
    }
  });

  // ── inventory.low_stock ─────────────────────────────────────
  // Low-stock payload has pharmacyId but not userId.
  // We look up the pharmacy owner to create their notification.
  eventBus.on('inventory.low_stock', async (payload) => {
    try {
      const pharmacy = await prisma.pharmacy.findUnique({
        where: { id: payload.pharmacyId },
        select: { userId: true },
      });

      if (!pharmacy) return;

      const notification = await notificationService.create({
        userId: pharmacy.userId,
        type: 'LOW_STOCK_ALERT',
        title: `Low Stock: ${payload.medicineName}`,
        message: `Only ${payload.quantity} units remaining (threshold: ${payload.lowStockThreshold}).`,
        data: {
          inventoryId: payload.inventoryId,
          medicineId: payload.medicineId,
          quantity: payload.quantity,
          threshold: payload.lowStockThreshold,
        },
      });

      getIO()?.to(`user:${pharmacy.userId}`).emit('notification:new', notification);

      logger.debug('notification created: inventory.low_stock', {
        notificationId: notification.id,
        userId: pharmacy.userId,
        medicineName: payload.medicineName,
      });
    } catch (error) {
      logger.error('notification bridge error: inventory.low_stock', {
        error: String(error),
        pharmacyId: payload.pharmacyId,
      });
    }
  });

  // ── medicine.availability_detected (Phase 8.10) ─────────────
  // A medicine matching a customer's SavedSearch has become newly available.
  //
  // Ordering contract (approved design):
  //   1. DB notification row (durable)
  //   2. Email queue (durable — persisted in Redis by BullMQ)
  //   3. Dedup row INSERT (only after 1+2 succeed)
  //   4. Socket.io push (best-effort — failure does NOT invalidate notification)
  //
  // If step 1 or 2 fails, no dedup row is created → next inventory event retries.
  // If step 3 hits a unique constraint (P2002), another concurrent handler already
  // succeeded → treat as "already handled", not a failure.
  eventBus.on('medicine.availability_detected', async (payload) => {
    try {
      // 1. Create persistent DB notification
      const notification = await notificationService.create({
        userId: payload.customerId,
        type: 'MEDICINE_AVAILABLE',
        title: `${payload.medicineName} is now available! 💊`,
        message: `"${payload.medicineName}" is now available at ${payload.pharmacyName}, ${(payload.distanceMeters / 1000).toFixed(1)} km from your saved location.`,
        data: {
          savedSearchId: payload.savedSearchId,
          inventoryId: payload.inventoryId,
          medicineId: payload.medicineId,
          pharmacyId: payload.pharmacyId,
          quantity: payload.quantity,
          distanceMeters: payload.distanceMeters,
        },
      });

      // 2. Queue email via existing BullMQ emailQueue
      const user = await prisma.user.findUnique({
        where: { id: payload.customerId },
        select: { email: true, name: true },
      });
      if (user) {
        await emailQueue.add('medicine-available-email', {
          to: user.email,
          userName: user.name,
          medicineName: payload.medicineName,
          pharmacyName: payload.pharmacyName,
          quantity: payload.quantity,
          distanceKm: (payload.distanceMeters / 1000).toFixed(1),
          searchUrl: `${env.CLIENT_URL}/search?q=${encodeURIComponent(payload.medicineName)}`,
        });
      }

      // 3. Insert dedup row — ONLY after notification + email succeed
      try {
        await prisma.availabilityAlert.create({
          data: {
            savedSearchId: payload.savedSearchId,
            inventoryId: payload.inventoryId,
          },
        });
      } catch (dedupErr: unknown) {
        // Prisma P2002 = unique constraint violation (concurrent handler already inserted)
        if (
          typeof dedupErr === 'object' &&
          dedupErr !== null &&
          'code' in dedupErr &&
          (dedupErr as { code: string }).code === 'P2002'
        ) {
          logger.debug('availability-alert dedup: concurrent insert (P2002)', {
            savedSearchId: payload.savedSearchId,
            inventoryId: payload.inventoryId,
          });
        } else {
          // Non-constraint error — log but don't throw.
          // Notification was already created; missing dedup row means
          // a possible duplicate on next event, which is acceptable.
          logger.error('availability-alert dedup insert error', {
            error: String(dedupErr),
            savedSearchId: payload.savedSearchId,
            inventoryId: payload.inventoryId,
          });
        }
      }

      // 4. Socket.io push — best-effort, failure does NOT invalidate notification
      try {
        getIO()?.to(`user:${payload.customerId}`).emit('notification:new', notification);
      } catch (socketErr) {
        logger.error('availability notification socket push error', {
          error: String(socketErr),
          customerId: payload.customerId,
        });
      }

      logger.debug('notification created: medicine.availability_detected', {
        notificationId: notification.id,
        customerId: payload.customerId,
        medicineName: payload.medicineName,
        pharmacyName: payload.pharmacyName,
      });
    } catch (error) {
      // Notification or email queueing failed — NO dedup row was inserted.
      // Next inventory event WILL retry detection for this SavedSearch.
      logger.error('notification bridge error: medicine.availability_detected', {
        error: String(error),
        customerId: payload.customerId,
        savedSearchId: payload.savedSearchId,
      });
    }
  });

  logger.info('🔔 Notification event bridge initialized');
}
