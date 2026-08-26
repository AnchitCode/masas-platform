import { eventBus } from './eventBus.js';
import logger from '../utils/logger.js';

/**
 * Low-Stock Detector.
 *
 * Listens to inventory events and emits `inventory.low_stock` when:
 *   1. An UPDATED item CROSSES below the threshold
 *      (previousQuantity > threshold AND quantity <= threshold)
 *   2. A newly CREATED item starts below the threshold
 *
 * The low_stock event is consumed by notificationEventBridge, which
 * creates a persistent notification and pushes via Socket.io.
 *
 * A threshold of 0 disables low-stock detection for that item.
 *
 * Called once during server startup.
 */
let initialized = false;

export function initLowStockDetector(): void {
  if (initialized) return;
  initialized = true;

  // ── inventory.updated — threshold CROSSING detection ──────
  eventBus.on('inventory.updated', (payload) => {
    const { previousQuantity, quantity, lowStockThreshold } = payload;

    // Skip if threshold is 0 (effectively disabled)
    if (lowStockThreshold <= 0) return;

    // Only alert on CROSSING the threshold downward:
    //   previousQuantity > threshold AND quantity <= threshold
    // This prevents repeated alerts when stock is already below threshold.
    if (previousQuantity > lowStockThreshold && quantity <= lowStockThreshold) {
      eventBus.emit('inventory.low_stock', {
        inventoryId: payload.inventoryId,
        pharmacyId: payload.pharmacyId,
        medicineId: payload.medicineId,
        medicineName: payload.medicineName,
        quantity,
        lowStockThreshold,
      });
    }
  });

  // ── inventory.created — immediate check for new stock ─────
  // A pharmacy can add a new medicine with quantity: 3, threshold: 10
  // — that's immediately below threshold and should alert.
  eventBus.on('inventory.created', (payload) => {
    const { quantity, lowStockThreshold } = payload;

    if (lowStockThreshold <= 0) return;

    // New item starts at or below threshold → alert immediately
    if (quantity <= lowStockThreshold) {
      eventBus.emit('inventory.low_stock', {
        inventoryId: payload.inventoryId,
        pharmacyId: payload.pharmacyId,
        medicineId: payload.medicineId,
        medicineName: payload.medicineName,
        quantity,
        lowStockThreshold,
      });
    }
  });

  logger.info('📉 Low-stock detector initialized');
}
