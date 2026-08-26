import { eventBus } from './eventBus.js';
import prisma from './prisma.js';
import logger from '../utils/logger.js';

/**
 * Availability Detector (Phase 8.10).
 *
 * Listens to inventory events and emits `medicine.availability_detected` when:
 *   1. A newly CREATED inventory item has quantity > 0
 *   2. An UPDATED item transitions from quantity 0 → positive
 *
 * When an item goes positive → 0, all deduplication records for that
 * inventory item are deleted, allowing re-notification on future restock.
 *
 * Architecture mirrors lowStockDetector:
 *   inventory events → detection logic → domain event → notificationEventBridge
 *
 * Called once during server startup.
 */

// ─── Types ───────────────────────────────────────────────────────

interface MatchingSavedSearch {
  id: string;
  user_id: string;
  distance_meters: number;
}

// ─── Idempotency Guard ──────────────────────────────────────────

let initialized = false;

export function initAvailabilityDetector(): void {
  if (initialized) return;
  initialized = true;

  // ── inventory.created — new medicine in stock ─────────────
  eventBus.on('inventory.created', async (payload) => {
    if (payload.quantity <= 0) return;

    await detectAvailability(
      payload.inventoryId,
      payload.pharmacyId,
      payload.medicineId,
      payload.medicineName,
      payload.quantity,
    );
  });

  // ── inventory.updated — quantity transitions ──────────────
  eventBus.on('inventory.updated', async (payload) => {
    const { previousQuantity, quantity, inventoryId, pharmacyId, medicineId, medicineName } = payload;

    // positive → 0: became unavailable — reset dedup state
    if (previousQuantity > 0 && quantity === 0) {
      await resetDedupState(inventoryId);
      return;
    }

    // 0 → positive: became newly available — detect
    if (previousQuantity === 0 && quantity > 0) {
      await detectAvailability(inventoryId, pharmacyId, medicineId, medicineName, quantity);
      return;
    }

    // positive → positive: already available — skip
    // 0 → 0: still unavailable — skip
  });

  logger.info('🔍 Availability detector initialized');
}

// ─── Core Detection ─────────────────────────────────────────────

async function detectAvailability(
  inventoryId: string,
  pharmacyId: string,
  medicineId: string,
  medicineName: string,
  quantity: number,
): Promise<void> {
  try {
    // 1. Look up pharmacy details — must be VERIFIED with valid location
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
      select: { id: true, name: true, latitude: true, longitude: true, status: true },
    });

    if (!pharmacy || pharmacy.status !== 'VERIFIED') return;

    // 2. Confirm the inventory item is actually available in the DB
    //    (guards against race conditions and explicit isAvailable=false)
    const inventory = await prisma.pharmacyInventory.findUnique({
      where: { id: inventoryId },
      select: { isAvailable: true, quantity: true },
    });

    if (!inventory || !inventory.isAvailable || inventory.quantity <= 0) return;

    // 3. Look up generic name for matching
    const medicine = await prisma.medicineCatalog.findUnique({
      where: { id: medicineId },
      select: { genericName: true },
    });

    const genericName = medicine?.genericName ?? null;

    // 4. Find matching active SavedSearches via PostGIS + reverse ILIKE
    const matches = await findMatchingSavedSearches(
      medicineName,
      genericName,
      pharmacy.longitude,
      pharmacy.latitude,
    );

    if (matches.length === 0) return;

    // 5. For each match, check dedup and emit event
    for (const match of matches) {
      // Optimistic dedup pre-check: skip if already notified
      const existingAlert = await prisma.availabilityAlert.findUnique({
        where: {
          savedSearchId_inventoryId: {
            savedSearchId: match.id,
            inventoryId,
          },
        },
      });

      if (existingAlert) continue;

      // Emit event — the bridge handler will create the notification
      // and insert the dedup row only after notification succeeds
      eventBus.emit('medicine.availability_detected', {
        savedSearchId: match.id,
        customerId: match.user_id,
        inventoryId,
        medicineId,
        medicineName,
        genericName,
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        quantity,
        distanceMeters: Number(match.distance_meters),
      });
    }
  } catch (error) {
    logger.error('availability-detector: detection error', {
      error: String(error),
      inventoryId,
      pharmacyId,
    });
  }
}

// ─── PostGIS + ILIKE Matching Query ─────────────────────────────

async function findMatchingSavedSearches(
  medicineName: string,
  genericName: string | null,
  pharmacyLng: number,
  pharmacyLat: number,
): Promise<MatchingSavedSearch[]> {
  // Reverse ILIKE: check if the medicine name/generic name contains
  // the SavedSearch query as a substring (same semantics as public search).
  //
  // When genericName is NULL, the OR clause evaluates to NULL → no match,
  // which is correct behavior.
  const rows = await prisma.$queryRaw<MatchingSavedSearch[]>`
    SELECT
      ss.id,
      ss.user_id,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(${pharmacyLng}, ${pharmacyLat}), 4326)::geography,
        ST_SetSRID(ST_MakePoint(ss.longitude, ss.latitude), 4326)::geography
      ) AS distance_meters
    FROM saved_searches ss
    WHERE ss.is_active = true
      AND (
        ${medicineName} ILIKE '%' || ss.query || '%'
        OR ${genericName} ILIKE '%' || ss.query || '%'
      )
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(${pharmacyLng}, ${pharmacyLat}), 4326)::geography,
        ST_SetSRID(ST_MakePoint(ss.longitude, ss.latitude), 4326)::geography,
        ss.radius_km * 1000
      )
  `;

  return rows;
}

// ─── Dedup State Reset ──────────────────────────────────────────

async function resetDedupState(inventoryId: string): Promise<void> {
  try {
    const { count } = await prisma.availabilityAlert.deleteMany({
      where: { inventoryId },
    });

    if (count > 0) {
      logger.debug('availability-detector: dedup state reset', {
        inventoryId,
        deletedAlerts: count,
      });
    }
  } catch (error) {
    logger.error('availability-detector: dedup reset error', {
      error: String(error),
      inventoryId,
    });
  }
}
