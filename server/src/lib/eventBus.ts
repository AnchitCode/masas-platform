import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

// ─── Event Payload Definitions ───────────────────────────────────
// Every event name maps to its exact payload shape.
// Fields are annotated with their source (which Prisma result they come from)
// to prevent future mismatches.
//
// This map is extended in later phases:
//   Phase 8.10 adds: medicine.availability_detected

export interface EventMap {
  // ── Inventory Events ──────────────────────────────────────────

  /** Emitted after a new inventory item is created via addInventory(). */
  'inventory.created': {
    inventoryId: string;          // from: created.id
    pharmacyId: string;           // from: function parameter
    medicineId: string;           // from: created.medicineId
    medicineName: string;         // from: created.medicine.name (include: { medicine: true })
    quantity: number;             // from: created.quantity
    lowStockThreshold: number;    // from: created.lowStockThreshold
  };

  /** Emitted after an inventory item is updated via updateInventory(). */
  'inventory.updated': {
    inventoryId: string;          // from: updated.id
    pharmacyId: string;           // from: function parameter
    medicineId: string;           // from: updated.medicineId
    medicineName: string;         // from: updated.medicine.name (include: { medicine: true })
    quantity: number;             // from: updated.quantity
    previousQuantity: number;     // from: existing.quantity (findFirst — base fields only)
    lowStockThreshold: number;    // from: updated.lowStockThreshold
  };

  /** Emitted after an inventory item is deleted via deleteInventory(). */
  'inventory.deleted': {
    inventoryId: string;       // from: existing.id (findFirst before delete)
    pharmacyId: string;        // from: function parameter
    medicineId: string;        // from: existing.medicineId (findFirst — base field)
    // NOTE: medicineName is NOT available here.
    // deleteInventory fetches `existing` via findFirst (no include),
    // then calls prisma.delete (also no include).
  };

  /** Emitted by lowStockDetector when inventory crosses below the threshold. */
  'inventory.low_stock': {
    inventoryId: string;
    pharmacyId: string;
    medicineId: string;
    medicineName: string;
    quantity: number;
    lowStockThreshold: number;
  };

  // ── Availability Detection Events (Phase 8.10) ─────────────
  /** Emitted by availabilityDetector when a medicine becomes newly available
   *  matching an active SavedSearch. One event per SavedSearch match. */
  'medicine.availability_detected': {
    savedSearchId: string;
    customerId: string;         // SavedSearch owner's userId
    inventoryId: string;
    medicineId: string;
    medicineName: string;
    genericName: string | null;
    pharmacyId: string;
    pharmacyName: string;
    quantity: number;
    distanceMeters: number;     // distance from SavedSearch location to pharmacy
  };

  // ── Pharmacy Events ───────────────────────────────────────────

  /** Emitted after admin verifies a pharmacy. */
  'pharmacy.verified': {
    pharmacyId: string;        // from: function parameter
    userId: string;            // from: pharmacy.userId (findUnique — full model, no select)
    pharmacyName: string;      // from: updated.name (select includes name)
  };

  /** Emitted after admin rejects a pharmacy. */
  'pharmacy.rejected': {
    pharmacyId: string;        // from: function parameter
    userId: string;            // from: pharmacy.userId (findUnique — full model, no select)
    pharmacyName: string;      // from: updated.name (select includes name)
    reason: string | undefined; // from: rejectionReason — Zod .optional() produces undefined, not null
  };

  // ── Session Events ────────────────────────────────────────────

  /** Emitted when a user's session is invalidated (password reset, forced logout).
   *  Socket.io bridge listens to this to force-disconnect all of the user's sockets. */
  'user.session_invalidated': {
    userId: string;
  };
}

// ─── Typed Event Bus ─────────────────────────────────────────────

/**
 * In-process typed event bus.
 *
 * Wraps Node.js EventEmitter with compile-time type safety.
 * Every event name and payload is defined in EventMap — consumers
 * get autocomplete and type checking at compile time.
 *
 * Why EventEmitter and not a library?
 *   Node's built-in EventEmitter is battle-tested, zero-dependency,
 *   and sufficient for in-process event dispatch. We're not building
 *   distributed microservices — we're building a monolith with clean
 *   internal boundaries.
 */
class TypedEventBus {
  private emitter = new EventEmitter();

  /**
   * Emit a typed event. Fire-and-forget — listeners run asynchronously
   * and errors in listeners are caught and logged, never thrown to the emitter.
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    logger.debug(`event-bus emit: ${event}`, payload as Record<string, unknown>);
    this.emitter.emit(event, payload);
  }

  /**
   * Subscribe to a typed event.
   * The handler receives the exact payload type for that event.
   * Handlers may be sync or async — async errors are caught and logged.
   */
  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void | Promise<void>): void {
    // Wrap handler to catch async errors — prevents unhandled rejections
    // from crashing the process when handlers do async work.
    const safeHandler = (payload: EventMap[K]): void => {
      try {
        const result = handler(payload);
        // If handler returns a promise (async), catch its errors
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            logger.error(`event-bus handler error [${event}]`, {
              error: String(error),
            });
          });
        }
      } catch (error) {
        logger.error(`event-bus handler error [${event}]`, {
          error: String(error),
        });
      }
    };

    // Store the original handler reference on the safe wrapper
    // so we can remove it later via off()
    (safeHandler as unknown as Record<string, unknown>).__originalHandler = handler;

    this.emitter.on(event, safeHandler);
  }

  /**
   * Unsubscribe a handler from a typed event.
   */
  off<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void | Promise<void>): void {
    // Find the safe wrapper that wraps this original handler
    const listeners = this.emitter.listeners(event);
    for (const listener of listeners) {
      if ((listener as unknown as Record<string, unknown>).__originalHandler === handler) {
        this.emitter.off(event, listener as (...args: unknown[]) => void);
        return;
      }
    }
  }

  /**
   * Subscribe to a typed event for a single emission only.
   */
  once<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void {
    this.emitter.once(event, handler);
  }

  /**
   * Remove all listeners for a specific event, or all events if none specified.
   * Primarily used in tests for cleanup.
   */
  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get the count of listeners for a specific event.
   * Useful for testing.
   */
  listenerCount(event: keyof EventMap): number {
    return this.emitter.listenerCount(event);
  }
}

// ─── Singleton Export ────────────────────────────────────────────

export const eventBus = new TypedEventBus();
