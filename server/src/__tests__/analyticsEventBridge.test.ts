import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { prisma } from './setup.js';
import { eventBus } from '../lib/eventBus.js';
import { initAnalyticsEventBridge } from '../lib/analyticsEventBridge.js';
import logger from '../utils/logger.js';

/**
 * Phase 10.1 — Analytics Event Bridge Tests
 *
 * Verifies:
 *   - All 9 EventMap → AnalyticsEvent mappings
 *   - pharmacyId populated for 7 events, null for 2
 *   - actorId/actorRole/targetId/targetType correctness
 *   - metadata field mapping (including catalog name → medicineName)
 *   - inventory.deleted does NOT include medicineName
 *   - pharmacy.rejected.reason undefined → null
 *   - Fire-and-forget: Prisma failures are swallowed
 *   - Business event flow unaffected by analytics failure
 *   - Idempotent initialization (no duplicate listeners)
 */

// Wait helper — event handlers are async
const waitForHandler = () => new Promise((resolve) => setTimeout(resolve, 200));

describe('Analytics Event Bridge', () => {
  beforeAll(() => {
    initAnalyticsEventBridge();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. inventory.created ─────────────────────────────────────
  describe('inventory.created → INVENTORY_CREATED', () => {
    it('creates an analytics event with correct fields', async () => {
      eventBus.emit('inventory.created', {
        inventoryId: 'inv-100',
        pharmacyId: 'pharm-100',
        medicineId: 'med-100',
        medicineName: 'Paracetamol',
        quantity: 50,
        lowStockThreshold: 10,
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'INVENTORY_CREATED' },
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'INVENTORY_CREATED',
        actorRole: 'PHARMACY',
        pharmacyId: 'pharm-100',
        targetId: 'inv-100',
        targetType: 'INVENTORY',
        actorId: null,
      });
      expect(events[0].metadata).toMatchObject({
        medicineName: 'Paracetamol',
        quantity: 50,
        medicineId: 'med-100',
      });
    });
  });

  // ─── 2. inventory.updated ─────────────────────────────────────
  describe('inventory.updated → INVENTORY_UPDATED', () => {
    it('creates an analytics event with previousQuantity in metadata', async () => {
      eventBus.emit('inventory.updated', {
        inventoryId: 'inv-200',
        pharmacyId: 'pharm-200',
        medicineId: 'med-200',
        medicineName: 'Amoxicillin',
        quantity: 20,
        previousQuantity: 80,
        lowStockThreshold: 10,
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'INVENTORY_UPDATED' },
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'INVENTORY_UPDATED',
        actorRole: 'PHARMACY',
        pharmacyId: 'pharm-200',
        targetId: 'inv-200',
        targetType: 'INVENTORY',
      });
      expect(events[0].metadata).toMatchObject({
        medicineName: 'Amoxicillin',
        quantity: 20,
        previousQuantity: 80,
      });
    });
  });

  // ─── 3. inventory.deleted ─────────────────────────────────────
  describe('inventory.deleted → INVENTORY_DELETED', () => {
    it('creates an analytics event WITHOUT medicineName (not in payload)', async () => {
      eventBus.emit('inventory.deleted', {
        inventoryId: 'inv-300',
        pharmacyId: 'pharm-300',
        medicineId: 'med-300',
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'INVENTORY_DELETED' },
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'INVENTORY_DELETED',
        actorRole: 'PHARMACY',
        pharmacyId: 'pharm-300',
        targetId: 'inv-300',
        targetType: 'INVENTORY',
      });
      // metadata should have medicineId but NOT medicineName
      expect(events[0].metadata).toMatchObject({ medicineId: 'med-300' });
      expect((events[0].metadata as Record<string, unknown>).medicineName).toBeUndefined();
    });
  });

  // ─── 4. inventory.low_stock ───────────────────────────────────
  describe('inventory.low_stock → LOW_STOCK_ALERT', () => {
    it('creates an analytics event with SYSTEM actorRole', async () => {
      eventBus.emit('inventory.low_stock', {
        inventoryId: 'inv-400',
        pharmacyId: 'pharm-400',
        medicineId: 'med-400',
        medicineName: 'Ibuprofen',
        quantity: 3,
        lowStockThreshold: 10,
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'LOW_STOCK_ALERT' },
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'LOW_STOCK_ALERT',
        actorRole: 'SYSTEM',
        pharmacyId: 'pharm-400',
        targetId: 'inv-400',
        targetType: 'INVENTORY',
        actorId: null,
      });
      expect(events[0].metadata).toMatchObject({
        medicineName: 'Ibuprofen',
        quantity: 3,
        threshold: 10,
      });
    });
  });

  // ─── 5. medicine.availability_detected ────────────────────────
  describe('medicine.availability_detected → AVAILABILITY_TRIGGERED', () => {
    it('creates an analytics event with savedSearchId in metadata', async () => {
      eventBus.emit('medicine.availability_detected', {
        savedSearchId: 'ss-500',
        customerId: 'user-500',
        inventoryId: 'inv-500',
        medicineId: 'med-500',
        medicineName: 'Metformin',
        genericName: 'metformin hydrochloride',
        pharmacyId: 'pharm-500',
        pharmacyName: 'Apollo Pharmacy',
        quantity: 25,
        distanceMeters: 1500,
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'AVAILABILITY_TRIGGERED' },
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'AVAILABILITY_TRIGGERED',
        actorRole: 'SYSTEM',
        pharmacyId: 'pharm-500',
        targetId: 'med-500',
        targetType: 'MEDICINE',
        actorId: null,
      });
      expect(events[0].metadata).toMatchObject({
        medicineName: 'Metformin',
        pharmacyName: 'Apollo Pharmacy',
        savedSearchId: 'ss-500',
      });
    });
  });

  // ─── 6. pharmacy.verified ─────────────────────────────────────
  describe('pharmacy.verified → PHARMACY_VERIFIED', () => {
    it('creates an analytics event with actorId = userId (admin)', async () => {
      eventBus.emit('pharmacy.verified', {
        pharmacyId: 'pharm-600',
        userId: 'admin-600',
        pharmacyName: 'Verified Pharmacy',
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'PHARMACY_VERIFIED' },
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'PHARMACY_VERIFIED',
        actorId: 'admin-600',
        actorRole: 'ADMIN',
        pharmacyId: 'pharm-600',
        targetId: 'pharm-600',
        targetType: 'PHARMACY',
      });
      expect(events[0].metadata).toMatchObject({
        pharmacyName: 'Verified Pharmacy',
      });
    });
  });

  // ─── 7. pharmacy.rejected ─────────────────────────────────────
  describe('pharmacy.rejected → PHARMACY_REJECTED', () => {
    it('creates an analytics event with reason in metadata', async () => {
      eventBus.emit('pharmacy.rejected', {
        pharmacyId: 'pharm-700',
        userId: 'admin-700',
        pharmacyName: 'Rejected Pharmacy',
        reason: 'Invalid license',
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'PHARMACY_REJECTED' },
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'PHARMACY_REJECTED',
        actorId: 'admin-700',
        actorRole: 'ADMIN',
        pharmacyId: 'pharm-700',
        targetId: 'pharm-700',
        targetType: 'PHARMACY',
      });
      expect(events[0].metadata).toMatchObject({
        pharmacyName: 'Rejected Pharmacy',
        reason: 'Invalid license',
      });
    });

    it('handles undefined reason → null in metadata', async () => {
      eventBus.emit('pharmacy.rejected', {
        pharmacyId: 'pharm-701',
        userId: 'admin-701',
        pharmacyName: 'Rejected Pharmacy 2',
        reason: undefined,
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'PHARMACY_REJECTED', pharmacyId: 'pharm-701' },
      });

      expect(events).toHaveLength(1);
      expect((events[0].metadata as Record<string, unknown>).reason).toBeNull();
    });
  });

  // ─── 8. catalog.created ───────────────────────────────────────
  describe('catalog.created → CATALOG_CREATED', () => {
    it('creates an analytics event with pharmacyId = null and metadata.medicineName from payload.name', async () => {
      eventBus.emit('catalog.created', {
        medicineId: 'med-800',
        name: 'new catalog medicine',
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'CATALOG_CREATED' },
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'CATALOG_CREATED',
        actorRole: 'PHARMACY',
        pharmacyId: null,
        targetId: 'med-800',
        targetType: 'MEDICINE',
        actorId: null,
      });
      // Verify payload.name is mapped to metadata.medicineName
      expect(events[0].metadata).toMatchObject({
        medicineName: 'new catalog medicine',
      });
    });
  });

  // ─── 9. catalog.updated ───────────────────────────────────────
  describe('catalog.updated → CATALOG_UPDATED', () => {
    it('creates an analytics event with pharmacyId = null and metadata.medicineName from payload.name', async () => {
      eventBus.emit('catalog.updated', {
        medicineId: 'med-900',
        name: 'updated catalog medicine',
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'CATALOG_UPDATED' },
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'CATALOG_UPDATED',
        actorRole: 'PHARMACY',
        pharmacyId: null,
        targetId: 'med-900',
        targetType: 'MEDICINE',
        actorId: null,
      });
      expect(events[0].metadata).toMatchObject({
        medicineName: 'updated catalog medicine',
      });
    });
  });

  // ─── user.session_invalidated is NOT logged ───────────────────
  describe('user.session_invalidated exclusion', () => {
    it('does not create an analytics event (security event, not business event)', async () => {
      eventBus.emit('user.session_invalidated', {
        userId: 'user-excluded',
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany();
      expect(events).toHaveLength(0);
    });
  });

  // ─── pharmacyId verification: 7 with, 2 without ──────────────
  describe('pharmacyId field mapping', () => {
    it('populates pharmacyId for all 7 pharmacy-affiliated events', async () => {
      // Emit all 7 events sequentially with individual waits
      eventBus.emit('inventory.created', {
        inventoryId: 'i1', pharmacyId: 'p1', medicineId: 'm1', medicineName: 'Med', quantity: 1, lowStockThreshold: 10,
      });
      await waitForHandler();

      eventBus.emit('inventory.updated', {
        inventoryId: 'i2', pharmacyId: 'p2', medicineId: 'm2', medicineName: 'Med', quantity: 1, previousQuantity: 2, lowStockThreshold: 10,
      });
      await waitForHandler();

      eventBus.emit('inventory.deleted', {
        inventoryId: 'i3', pharmacyId: 'p3', medicineId: 'm3',
      });
      await waitForHandler();

      eventBus.emit('inventory.low_stock', {
        inventoryId: 'i4', pharmacyId: 'p4', medicineId: 'm4', medicineName: 'Med', quantity: 1, lowStockThreshold: 10,
      });
      await waitForHandler();

      eventBus.emit('medicine.availability_detected', {
        savedSearchId: 'ss5', customerId: 'c5', inventoryId: 'i5', medicineId: 'm5',
        medicineName: 'Med', genericName: null, pharmacyId: 'p5', pharmacyName: 'P', quantity: 1, distanceMeters: 100,
      });
      await waitForHandler();

      eventBus.emit('pharmacy.verified', {
        pharmacyId: 'p6', userId: 'u6', pharmacyName: 'P',
      });
      await waitForHandler();

      eventBus.emit('pharmacy.rejected', {
        pharmacyId: 'p7', userId: 'u7', pharmacyName: 'P', reason: undefined,
      });
      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { pharmacyId: { not: null } },
      });
      expect(events).toHaveLength(7);

      // Verify each has the correct pharmacyId
      const pharmacyIds = events.map((e) => e.pharmacyId).sort();
      expect(pharmacyIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
    });

    it('sets pharmacyId = null for catalog.created and catalog.updated', async () => {
      eventBus.emit('catalog.created', { medicineId: 'mc1', name: 'Med A' });
      await waitForHandler();

      eventBus.emit('catalog.updated', { medicineId: 'mc2', name: 'Med B' });
      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { pharmacyId: null },
      });
      expect(events).toHaveLength(2);
      const types = events.map((e) => e.type).sort();
      expect(types).toEqual(['CATALOG_CREATED', 'CATALOG_UPDATED']);
    });
  });

  // ─── Idempotent initialization ────────────────────────────────
  describe('idempotent initialization', () => {
    it('calling initAnalyticsEventBridge() twice does not register duplicate listeners', async () => {
      // Get listener count before second call
      const countBefore = eventBus.listenerCount('inventory.created');

      // Call init again — should be a no-op
      initAnalyticsEventBridge();

      const countAfter = eventBus.listenerCount('inventory.created');
      expect(countAfter).toBe(countBefore);
    });

    it('single event produces exactly one analytics row (no duplicates from double init)', async () => {
      // init was already called twice — verify single row per event
      eventBus.emit('inventory.created', {
        inventoryId: 'idem-inv',
        pharmacyId: 'idem-pharm',
        medicineId: 'idem-med',
        medicineName: 'Idempotent Test',
        quantity: 1,
        lowStockThreshold: 10,
      });

      await waitForHandler();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'INVENTORY_CREATED' },
      });
      // Exactly 1 row, not 2 (proves double init didn't register double listeners)
      expect(events).toHaveLength(1);
    });
  });

  // ─── Fire-and-forget: failed insert is swallowed ──────────────
  describe('error swallowing', () => {
    it('swallows Prisma insert failure and logs error', async () => {
      const logSpy = vi.spyOn(logger, 'error');

      // Force prisma.analyticsEvent.create to fail
      const createSpy = vi.spyOn(prisma.analyticsEvent, 'create').mockRejectedValueOnce(
        new Error('DB connection lost'),
      );

      eventBus.emit('inventory.created', {
        inventoryId: 'fail-inv',
        pharmacyId: 'fail-pharm',
        medicineId: 'fail-med',
        medicineName: 'FailMed',
        quantity: 1,
        lowStockThreshold: 10,
      });

      await waitForHandler();

      // Verify the error was logged
      expect(logSpy).toHaveBeenCalledWith(
        'analytics-event-bridge: insert failed',
        expect.objectContaining({
          error: expect.stringContaining('DB connection lost'),
          type: 'INVENTORY_CREATED',
        }),
      );

      // Verify no row was created (since we forced the error)
      createSpy.mockRestore();
      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'INVENTORY_CREATED' },
      });
      expect(events).toHaveLength(0);

      logSpy.mockRestore();
    });

    it('does not prevent business event flow when analytics insert fails', async () => {
      // Force analytics to fail
      const createSpy = vi.spyOn(prisma.analyticsEvent, 'create').mockRejectedValueOnce(
        new Error('Simulated analytics failure'),
      );

      // Emit an event — the Event Bus error handling should NOT throw
      // and other listeners should continue working
      let otherHandlerCalled = false;
      const testHandler = () => { otherHandlerCalled = true; };
      eventBus.on('inventory.created', testHandler);

      eventBus.emit('inventory.created', {
        inventoryId: 'biz-inv',
        pharmacyId: 'biz-pharm',
        medicineId: 'biz-med',
        medicineName: 'BizMed',
        quantity: 1,
        lowStockThreshold: 10,
      });

      await waitForHandler();

      // Other handler should have been called despite analytics failure
      expect(otherHandlerCalled).toBe(true);

      // Cleanup
      eventBus.off('inventory.created', testHandler);
      createSpy.mockRestore();
    });
  });
});
