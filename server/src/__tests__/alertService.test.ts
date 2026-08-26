import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import {
  prisma,
  createTestUser,
  createTestPharmacy,
  createTestMedicine,
  createTestInventory,
  createTestSavedSearch,
} from './setup.js';
import alertService from '../modules/search/alert.service.js';
import { eventBus } from '../lib/eventBus.js';

// ─── Helpers ──────────────────────────────────────────────────

/** Wait for async event handlers to finish processing */
const tick = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

const DELHI_CENTER = { latitude: 28.6139, longitude: 77.2090 };
const DELHI_NEARBY = { latitude: 28.63, longitude: 77.22 };

// ═══════════════════════════════════════════════════════════════
// alertService.processSearch()
// ═══════════════════════════════════════════════════════════════

describe('Alert Service — processSearch()', () => {
  beforeAll(async () => {
    // Ensure availability detector + bridge are initialized for event flow
    const { initAvailabilityDetector } = await import('../lib/availabilityDetector.js');
    initAvailabilityDetector();
    const { bridgeEventsToNotifications } = await import('../lib/notificationEventBridge.js');
    bridgeEventsToNotifications();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Match found → event emitted, lastCheckedAt + lastMatchAt updated
  it('emits medicine.availability_detected when matching inventory exists', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const savedSearch = await createTestSavedSearch(customer.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'paracetamol 500mg' });
    await createTestInventory(pharmacy.id, medicine.id, { quantity: 50 });

    await alertService.processSearch(savedSearch);
    await tick();

    // Verify event was emitted
    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0][0];
    expect(payload.savedSearchId).toBe(savedSearch.id);
    expect(payload.customerId).toBe(customer.id);
    expect(payload.medicineName).toBe('paracetamol 500mg');

    // Verify lastCheckedAt and lastMatchAt were updated
    const updated = await prisma.savedSearch.findUnique({
      where: { id: savedSearch.id },
    });
    expect(updated!.lastCheckedAt).toBeTruthy();
    expect(updated!.lastMatchAt).toBeTruthy();
  });

  // Test 2: No matches → no event, lastCheckedAt updated, lastMatchAt NOT updated
  it('does not emit event when no matching inventory exists', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const savedSearch = await createTestSavedSearch(customer.id, {
      query: 'nonexistent-medicine-xyz',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    await alertService.processSearch(savedSearch);
    await tick();

    expect(handler).not.toHaveBeenCalled();

    // Verify lastCheckedAt updated but lastMatchAt is still null
    const updated = await prisma.savedSearch.findUnique({
      where: { id: savedSearch.id },
    });
    expect(updated!.lastCheckedAt).toBeTruthy();
    expect(updated!.lastMatchAt).toBeNull();
  });

  // Test 3: Match found but within 24h cooldown → no event
  it('does not emit event when lastMatchAt is within 24h cooldown', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId: customer.id,
        query: 'paracetamol',
        ...DELHI_CENTER,
        radiusKm: 10,
        isActive: true,
        lastMatchAt: twoHoursAgo,
      },
    });

    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'paracetamol 500mg' });
    await createTestInventory(pharmacy.id, medicine.id, { quantity: 50 });

    await alertService.processSearch(savedSearch);
    await tick();

    // shouldNotify returns false → no event emitted
    expect(handler).not.toHaveBeenCalled();

    // lastCheckedAt still updated
    const updated = await prisma.savedSearch.findUnique({
      where: { id: savedSearch.id },
    });
    expect(updated!.lastCheckedAt).toBeTruthy();
  });

  // Test 4: Match found and lastMatchAt > 24h ago → event emitted
  it('emits event when lastMatchAt is older than 24h', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId: customer.id,
        query: 'paracetamol',
        ...DELHI_CENTER,
        radiusKm: 10,
        isActive: true,
        lastMatchAt: twentyFiveHoursAgo,
      },
    });

    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'paracetamol 500mg' });
    await createTestInventory(pharmacy.id, medicine.id, { quantity: 50 });

    await alertService.processSearch(savedSearch);
    await tick();

    expect(handler).toHaveBeenCalledOnce();
  });

  // Test 5: Dedup — existing AvailabilityAlert row → no event even if cooldown passed
  it('does not emit event when dedup row already exists for top result', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const savedSearch = await createTestSavedSearch(customer.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'paracetamol 500mg' });
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 50 });

    // Pre-insert dedup row
    await prisma.availabilityAlert.create({
      data: { savedSearchId: savedSearch.id, inventoryId: inv.id },
    });

    await alertService.processSearch(savedSearch);
    await tick();

    // Event should NOT be emitted due to dedup
    expect(handler).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// alertService.shouldNotify()
// ═══════════════════════════════════════════════════════════════

describe('Alert Service — shouldNotify()', () => {
  it('returns true when lastMatchAt is null (never notified)', () => {
    const search = { lastMatchAt: null } as Parameters<typeof alertService.shouldNotify>[0];
    expect(alertService.shouldNotify(search)).toBe(true);
  });

  it('returns false when lastMatchAt is 2 hours ago (within 24h)', () => {
    const search = {
      lastMatchAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    } as Parameters<typeof alertService.shouldNotify>[0];
    expect(alertService.shouldNotify(search)).toBe(false);
  });

  it('returns true when lastMatchAt is 25 hours ago (past 24h)', () => {
    const search = {
      lastMatchAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    } as Parameters<typeof alertService.shouldNotify>[0];
    expect(alertService.shouldNotify(search)).toBe(true);
  });

  it('returns false when lastMatchAt is exactly 23 hours ago', () => {
    const search = {
      lastMatchAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
    } as Parameters<typeof alertService.shouldNotify>[0];
    expect(alertService.shouldNotify(search)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// alertService.getActiveSearchesBatch()
// ═══════════════════════════════════════════════════════════════

describe('Alert Service — getActiveSearchesBatch()', () => {
  it('returns searches that have never been checked', async () => {
    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    const batch = await alertService.getActiveSearchesBatch(50, 30);
    expect(batch.length).toBe(1);
    expect(batch[0].lastCheckedAt).toBeNull();
  });

  it('excludes recently checked searches', async () => {
    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await prisma.savedSearch.create({
      data: {
        userId: customer.id,
        query: 'paracetamol',
        ...DELHI_CENTER,
        radiusKm: 10,
        isActive: true,
        lastCheckedAt: new Date(), // just now
      },
    });

    const batch = await alertService.getActiveSearchesBatch(50, 30);
    expect(batch.length).toBe(0);
  });

  it('excludes inactive searches', async () => {
    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 10,
      isActive: false,
    });

    const batch = await alertService.getActiveSearchesBatch(50, 30);
    expect(batch.length).toBe(0);
  });

  it('includes searches checked longer ago than the interval', async () => {
    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1000);

    await prisma.savedSearch.create({
      data: {
        userId: customer.id,
        query: 'paracetamol',
        ...DELHI_CENTER,
        radiusKm: 10,
        isActive: true,
        lastCheckedAt: fortyMinutesAgo,
      },
    });

    const batch = await alertService.getActiveSearchesBatch(50, 30);
    expect(batch.length).toBe(1);
  });

  it('respects batchSize limit', async () => {
    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    for (let i = 0; i < 5; i++) {
      await createTestSavedSearch(customer.id, {
        query: `med-${i}`,
        ...DELHI_CENTER,
        radiusKm: 10,
      });
    }

    const batch = await alertService.getActiveSearchesBatch(3, 30);
    expect(batch.length).toBe(3);
  });

  it('orders by lastCheckedAt ascending (oldest first)', async () => {
    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000);

    const newer = await prisma.savedSearch.create({
      data: {
        userId: customer.id,
        query: 'newer',
        ...DELHI_CENTER,
        radiusKm: 10,
        isActive: true,
        lastCheckedAt: oneHourAgo,
      },
    });

    const older = await prisma.savedSearch.create({
      data: {
        userId: customer.id,
        query: 'older',
        ...DELHI_CENTER,
        radiusKm: 10,
        isActive: true,
        lastCheckedAt: twoHoursAgo,
      },
    });

    const batch = await alertService.getActiveSearchesBatch(50, 30);
    // null lastCheckedAt sorts first in asc, then oldest timestamp
    expect(batch[0].id).toBe(older.id);
    expect(batch[1].id).toBe(newer.id);
  });
});

// ═══════════════════════════════════════════════════════════════
// Batch Processing (simulating what the worker does)
// ═══════════════════════════════════════════════════════════════

describe('Alert Service — Batch Processing', () => {
  it('processes multiple searches: 2 with matches, 1 without', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });

    // Create 3 saved searches
    const ss1 = await createTestSavedSearch(customer.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 10,
    });
    const ss2 = await createTestSavedSearch(customer.id, {
      query: 'ibuprofen',
      ...DELHI_CENTER,
      radiusKm: 10,
    });
    const ss3 = await createTestSavedSearch(customer.id, {
      query: 'nonexistent-medicine',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    // Create matching inventory for paracetamol and ibuprofen
    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });

    const med1 = await createTestMedicine({ name: 'paracetamol 500mg' });
    const med2 = await createTestMedicine({ name: 'ibuprofen 400mg' });
    await createTestInventory(pharmacy.id, med1.id, { quantity: 50 });
    await createTestInventory(pharmacy.id, med2.id, { quantity: 30 });

    // Process all three
    for (const search of [ss1, ss2, ss3]) {
      await alertService.processSearch(search);
    }

    await tick();

    // Two events should have been emitted (paracetamol + ibuprofen)
    expect(handler).toHaveBeenCalledTimes(2);

    // All three should have lastCheckedAt set
    for (const search of [ss1, ss2, ss3]) {
      const updated = await prisma.savedSearch.findUnique({
        where: { id: search.id },
      });
      expect(updated!.lastCheckedAt).toBeTruthy();
    }

    // Only paracetamol and ibuprofen should have lastMatchAt set
    const updatedSs3 = await prisma.savedSearch.findUnique({
      where: { id: ss3.id },
    });
    expect(updatedSs3!.lastMatchAt).toBeNull();
  });

  it('isolates failures: one bad search does not block others', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });

    const goodSearch = await createTestSavedSearch(customer.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'paracetamol 500mg' });
    await createTestInventory(pharmacy.id, medicine.id, { quantity: 50 });

    // Create a "bad" search that will cause processSearch to throw
    const badSearch = await createTestSavedSearch(customer.id, {
      query: 'will-fail',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    // Simulate batch processing with failure isolation
    const searches = [badSearch, goodSearch];
    let failed = 0;

    // Mock to make the bad search throw
    const originalProcess = alertService.processSearch.bind(alertService);
    let callCount = 0;
    vi.spyOn(alertService, 'processSearch').mockImplementation(async (search) => {
      callCount++;
      if (search.id === badSearch.id) {
        throw new Error('Simulated processing failure');
      }
      return originalProcess(search);
    });

    for (const search of searches) {
      try {
        await alertService.processSearch(search);
      } catch {
        failed++;
      }
    }

    await tick();

    // One failure, but the good search still processed
    expect(failed).toBe(1);
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════
// Cross-Path Dedup: 8.10 (event-driven) + 8.11 (poll-based)
// ═══════════════════════════════════════════════════════════════

describe('Cross-Path Dedup — 8.10 + 8.11 cannot double-notify', () => {
  /**
   * Scenario: Phase 8.10 already created a dedup row for (savedSearch, inventory).
   * When Phase 8.11's processSearch() polls the same search, it must NOT
   * emit a duplicate event for that same inventory item.
   */
  it('8.10 dedup row prevents 8.11 from re-emitting for the same inventory', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const savedSearch = await createTestSavedSearch(customer.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'paracetamol 500mg' });
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 50 });

    // Simulate Phase 8.10 having already created the dedup row
    // (this is what notificationEventBridge does after step 1+2 succeed)
    await prisma.availabilityAlert.create({
      data: { savedSearchId: savedSearch.id, inventoryId: inv.id },
    });

    // Phase 8.11 polls this same search
    await alertService.processSearch(savedSearch);
    await tick();

    // NO duplicate event — the dedup row blocks it
    expect(handler).not.toHaveBeenCalled();

    // Verify only 1 dedup row exists (the pre-inserted one)
    const alerts = await prisma.availabilityAlert.findMany({
      where: { savedSearchId: savedSearch.id },
    });
    expect(alerts).toHaveLength(1);
  });

  /**
   * Scenario: Dedup row exists for inventory A, but a DIFFERENT pharmacy
   * stocks the same medicine (inventory B). The new inventory B must NOT
   * be suppressed by inventory A's dedup row.
   *
   * This proves the dedup key is (savedSearchId, inventoryId) — not
   * (savedSearchId, medicineId) — so different pharmacies are independent.
   */
  it('dedup for one pharmacy does not suppress a different pharmacy\'s inventory', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const savedSearch = await createTestSavedSearch(customer.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    // Pharmacy A — already notified (dedup row exists)
    const { user: pharmaUserA } = await createTestUser({ role: 'PHARMACY' });
    const pharmacyA = await createTestPharmacy(pharmaUserA.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'paracetamol 500mg' });
    const invA = await createTestInventory(pharmacyA.id, medicine.id, { quantity: 10 });

    // Pre-insert dedup row for Pharmacy A's inventory
    await prisma.availabilityAlert.create({
      data: { savedSearchId: savedSearch.id, inventoryId: invA.id },
    });

    // Pharmacy B — a different pharmacy stocking the same medicine, closer to the customer
    const DELHI_VERY_CLOSE = { latitude: 28.615, longitude: 77.210 };
    const { user: pharmaUserB } = await createTestUser({ role: 'PHARMACY' });
    const pharmacyB = await createTestPharmacy(pharmaUserB.id, {
      status: 'VERIFIED',
      ...DELHI_VERY_CLOSE,
    });
    const invB = await createTestInventory(pharmacyB.id, medicine.id, { quantity: 20 });

    // Process the search — Pharmacy B's inventory is closer, so it'll be the top result
    await alertService.processSearch(savedSearch);
    await tick();

    // Event IS emitted because invB has no dedup row
    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0][0];
    expect(payload.inventoryId).toBe(invB.id);
    expect(payload.pharmacyId).toBe(pharmacyB.id);
  });
});
