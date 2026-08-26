import type { SavedSearch } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { searchPublicInventory } from '../search/search.service.js';
import { eventBus } from '../../lib/eventBus.js';
import logger from '../../utils/logger.js';

/**
 * Alert Service (Phase 8.10/8.11).
 *
 * Provides:
 *   - processSearch(): core poll-based detection, called per SavedSearch
 *     by the background checker (Phase 8.11).
 *   - getActiveSearchesBatch(): fetches a batch of active searches that
 *     haven't been checked recently.
 *
 * Architecture note:
 *   Phase 8.10's availabilityDetector handles *event-driven* detection
 *   (inventory changes → immediate check). This service handles *poll-based*
 *   detection (cron → scan all active searches → find new matches).
 *   Both emit the same `medicine.availability_detected` event, which flows
 *   through the notificationEventBridge.
 */

// ─── Constants ──────────────────────────────────────────────────

/** Minimum hours between notifications for the same SavedSearch */
const NOTIFICATION_COOLDOWN_HOURS = 24;

// ─── Public API ─────────────────────────────────────────────────

const alertService = {
  /**
   * Process a single saved search against current inventory.
   *
   * 1. Run the same PostGIS query as the public search API
   * 2. Update lastCheckedAt (always)
   * 3. If matches found AND notification cooldown has passed:
   *    - Update lastMatchAt
   *    - Emit `medicine.availability_detected` for the top result
   */
  async processSearch(search: SavedSearch): Promise<void> {
    // 1. Run PostGIS query — reuses the existing search logic
    const results = await searchPublicInventory({
      q: search.query,
      lat: search.latitude,
      lng: search.longitude,
      radiusKm: search.radiusKm,
      page: 1,
      limit: 5,
    });

    const hasMatches = results.total > 0;

    // 2. Update lastCheckedAt (always) and lastMatchAt (if matches found)
    await prisma.savedSearch.update({
      where: { id: search.id },
      data: {
        lastCheckedAt: new Date(),
        ...(hasMatches ? { lastMatchAt: new Date() } : {}),
      },
    });

    // 3. If matches found AND notification cooldown has passed → emit event
    if (hasMatches && this.shouldNotify(search)) {
      const top = results.results[0];

      // Check dedup: has this specific (savedSearch, inventory) combo
      // already been notified? (Reuses Phase 8.10 dedup table)
      const existingAlert = await prisma.availabilityAlert.findUnique({
        where: {
          savedSearchId_inventoryId: {
            savedSearchId: search.id,
            inventoryId: top.inventory.id,
          },
        },
      });

      if (existingAlert) {
        logger.debug('alert-service: skipped — dedup row exists', {
          searchId: search.id,
          inventoryId: top.inventory.id,
        });
        return;
      }

      eventBus.emit('medicine.availability_detected', {
        savedSearchId: search.id,
        customerId: search.userId,
        inventoryId: top.inventory.id,
        medicineId: top.medicine.id,
        medicineName: top.medicine.name,
        genericName: top.medicine.genericName,
        pharmacyId: top.pharmacy.id,
        pharmacyName: top.pharmacy.name,
        quantity: top.inventory.quantity,
        distanceMeters: top.distanceMeters,
      });

      logger.debug('alert-service: availability event emitted', {
        searchId: search.id,
        medicineName: top.medicine.name,
        pharmacyName: top.pharmacy.name,
      });
    }
  },

  /**
   * Deduplication: only notify if no match in the last 24 hours.
   * Prevents "Paracetamol available!" every 30 minutes while stock exists.
   */
  shouldNotify(search: SavedSearch): boolean {
    if (!search.lastMatchAt) return true;
    const hoursSinceLastMatch =
      (Date.now() - search.lastMatchAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastMatch >= NOTIFICATION_COOLDOWN_HOURS;
  },

  /**
   * Fetch a batch of active saved searches that haven't been checked
   * within the given interval.
   *
   * @param batchSize  Max rows to return
   * @param intervalMinutes  Only return searches not checked in this many minutes
   */
  async getActiveSearchesBatch(
    batchSize: number,
    intervalMinutes: number,
  ): Promise<SavedSearch[]> {
    const cutoff = new Date(Date.now() - intervalMinutes * 60 * 1000);

    return prisma.savedSearch.findMany({
      where: {
        isActive: true,
        OR: [
          { lastCheckedAt: null },       // Never checked
          { lastCheckedAt: { lt: cutoff } }, // Checked too long ago
        ],
      },
      orderBy: { lastCheckedAt: 'asc' }, // Oldest first — fairness
      take: batchSize,
    });
  },
};

export default alertService;
