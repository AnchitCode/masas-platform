import { eventBus } from './eventBus.js';
import prisma from './prisma.js';
import logger from '../utils/logger.js';
import type { Prisma } from '@prisma/client';

/**
 * Bridge Event Bus events to persistent analytics log.
 *
 * Listens to 9 analytics-relevant event types and writes them
 * as append-only rows to the `analytics_events` table.
 * `user.session_invalidated` is intentionally excluded — it's
 * a session/security mechanism, not an analytics-relevant business event.
 *
 * RESPONSIBILITY SEPARATION:
 *   socketEventBridge           → inventory data sync + session invalidation (no DB rows)
 *   notificationEventBridge     → persistent notifications + Socket.io push
 *   analyticsEventBridge (this) → append-only analytics log (no side effects)
 *
 * All writes are fire-and-forget. A failing insert is logged but never thrown —
 * analytics must never block or degrade business operations.
 *
 * Called once during server startup.
 */
let initialized = false;

export function initAnalyticsEventBridge(): void {
  if (initialized) return;
  initialized = true;

  // ── 1. inventory.created ──────────────────────────────────────
  eventBus.on('inventory.created', async (payload) => {
    await safeInsert({
      type: 'INVENTORY_CREATED',
      actorRole: 'PHARMACY',
      pharmacyId: payload.pharmacyId,
      targetId: payload.inventoryId,
      targetType: 'INVENTORY',
      metadata: {
        medicineName: payload.medicineName,
        quantity: payload.quantity,
        medicineId: payload.medicineId,
      },
    });
  });

  // ── 2. inventory.updated ──────────────────────────────────────
  eventBus.on('inventory.updated', async (payload) => {
    await safeInsert({
      type: 'INVENTORY_UPDATED',
      actorRole: 'PHARMACY',
      pharmacyId: payload.pharmacyId,
      targetId: payload.inventoryId,
      targetType: 'INVENTORY',
      metadata: {
        medicineName: payload.medicineName,
        quantity: payload.quantity,
        previousQuantity: payload.previousQuantity,
      },
    });
  });

  // ── 3. inventory.deleted ──────────────────────────────────────
  // NOTE: medicineName is NOT available in the delete payload (see eventBus.ts:41-43)
  eventBus.on('inventory.deleted', async (payload) => {
    await safeInsert({
      type: 'INVENTORY_DELETED',
      actorRole: 'PHARMACY',
      pharmacyId: payload.pharmacyId,
      targetId: payload.inventoryId,
      targetType: 'INVENTORY',
      metadata: {
        medicineId: payload.medicineId,
      },
    });
  });

  // ── 4. inventory.low_stock ────────────────────────────────────
  eventBus.on('inventory.low_stock', async (payload) => {
    await safeInsert({
      type: 'LOW_STOCK_ALERT',
      actorRole: 'SYSTEM',
      pharmacyId: payload.pharmacyId,
      targetId: payload.inventoryId,
      targetType: 'INVENTORY',
      metadata: {
        medicineName: payload.medicineName,
        quantity: payload.quantity,
        threshold: payload.lowStockThreshold,
      },
    });
  });

  // ── 5. medicine.availability_detected ─────────────────────────
  eventBus.on('medicine.availability_detected', async (payload) => {
    await safeInsert({
      type: 'AVAILABILITY_TRIGGERED',
      actorRole: 'SYSTEM',
      pharmacyId: payload.pharmacyId,
      targetId: payload.medicineId,
      targetType: 'MEDICINE',
      metadata: {
        medicineName: payload.medicineName,
        pharmacyName: payload.pharmacyName,
        savedSearchId: payload.savedSearchId,
      },
    });
  });

  // ── 6. pharmacy.verified ──────────────────────────────────────
  eventBus.on('pharmacy.verified', async (payload) => {
    await safeInsert({
      type: 'PHARMACY_VERIFIED',
      actorId: payload.userId,
      actorRole: 'ADMIN',
      pharmacyId: payload.pharmacyId,
      targetId: payload.pharmacyId,
      targetType: 'PHARMACY',
      metadata: {
        pharmacyName: payload.pharmacyName,
      },
    });
  });

  // ── 7. pharmacy.rejected ──────────────────────────────────────
  eventBus.on('pharmacy.rejected', async (payload) => {
    await safeInsert({
      type: 'PHARMACY_REJECTED',
      actorId: payload.userId,
      actorRole: 'ADMIN',
      pharmacyId: payload.pharmacyId,
      targetId: payload.pharmacyId,
      targetType: 'PHARMACY',
      metadata: {
        pharmacyName: payload.pharmacyName,
        // reason may be undefined (Zod .optional()); store as null for JSON
        reason: payload.reason ?? null,
      },
    });
  });

  // ── 8. catalog.created ────────────────────────────────────────
  // No pharmacyId in payload — catalog events are pharmacy-agnostic.
  // EventMap uses `name`, not `medicineName`.
  eventBus.on('catalog.created', async (payload) => {
    await safeInsert({
      type: 'CATALOG_CREATED',
      actorRole: 'PHARMACY',
      pharmacyId: null,
      targetId: payload.medicineId,
      targetType: 'MEDICINE',
      metadata: {
        medicineName: payload.name,
      },
    });
  });

  // ── 9. catalog.updated ────────────────────────────────────────
  eventBus.on('catalog.updated', async (payload) => {
    await safeInsert({
      type: 'CATALOG_UPDATED',
      actorRole: 'PHARMACY',
      pharmacyId: null,
      targetId: payload.medicineId,
      targetType: 'MEDICINE',
      metadata: {
        medicineName: payload.name,
      },
    });
  });

  logger.info('📊 Analytics event bridge initialized');
}

// ─── Safe insert helper ─────────────────────────────────────────
// Fire-and-forget: NEVER throws. Business operations must never be
// affected by analytics write failures.

interface AnalyticsEventData {
  type: string;
  actorId?: string | null;
  actorRole: string;
  pharmacyId: string | null;
  targetId: string;
  targetType: string;
  metadata: Prisma.InputJsonValue;
}

async function safeInsert(data: AnalyticsEventData): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        type: data.type,
        actorId: data.actorId ?? null,
        actorRole: data.actorRole,
        pharmacyId: data.pharmacyId,
        targetId: data.targetId,
        targetType: data.targetType,
        metadata: data.metadata,
      },
    });
  } catch (error) {
    logger.error('analytics-event-bridge: insert failed', {
      error: String(error),
      type: data.type,
    });
  }
}
