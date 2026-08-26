import { getIO } from './socket.js';
import { eventBus } from './eventBus.js';
import logger from '../utils/logger.js';

/**
 * Bridge Event Bus events to Socket.io rooms.
 *
 * This bridge handles ONLY real-time data sync events — things that
 * don't need persistence as notifications but benefit from live updates
 * on connected dashboards.
 *
 * RESPONSIBILITY SEPARATION:
 *   socketEventBridge   → inventory data sync + session invalidation
 *   notificationEventBridge (Phase 8.3) → persistent notifications + Socket.io push
 *
 * No event is handled by both bridges. Rule:
 *   If it needs a DB notification row → notificationEventBridge only.
 *   If it's purely live data sync → socketEventBridge only.
 *
 * Called once during server startup.
 */
let initialized = false;

export function bridgeEventsToSocket(): void {
  if (initialized) return;
  initialized = true;

  // ── Inventory Data Sync ─────────────────────────────────────
  // These push real-time updates to connected pharmacy dashboards.
  // They do NOT create notifications — that's a separate concern (Phase 8.3).

  eventBus.on('inventory.created', (payload) => {
    getIO()?.to(`pharmacy:${payload.pharmacyId}`).emit('inventory:created', {
      inventoryId: payload.inventoryId,
      medicineName: payload.medicineName,
      quantity: payload.quantity,
    });
  });

  eventBus.on('inventory.updated', (payload) => {
    getIO()?.to(`pharmacy:${payload.pharmacyId}`).emit('inventory:updated', {
      inventoryId: payload.inventoryId,
      medicineId: payload.medicineId,
      medicineName: payload.medicineName,
      quantity: payload.quantity,
    });
  });

  eventBus.on('inventory.deleted', (payload) => {
    getIO()?.to(`pharmacy:${payload.pharmacyId}`).emit('inventory:deleted', {
      inventoryId: payload.inventoryId,
    });
  });

  // ── Session Invalidation ────────────────────────────────────
  // Force-disconnect all sockets for a user whose session has been revoked
  // (password reset, forced logout via tokenVersion increment).

  eventBus.on('user.session_invalidated', (payload) => {
    const io = getIO();
    if (!io) return;

    io.to(`user:${payload.userId}`).emit('auth:revoked', {
      reason: 'Session invalidated',
    });

    // Force-disconnect all sockets in this user's room
    io.in(`user:${payload.userId}`).disconnectSockets(true);

    logger.debug('socket force-disconnect: user session invalidated', {
      userId: payload.userId,
    });
  });

  logger.info('🔌 Socket event bridge initialized');
}
