import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import {
  prisma,
  createTestUser,
  createTestPharmacy,
  createTestMedicine,
  createTestInventory,
  createTestSavedSearch,
} from './setup.js';
import { eventBus } from '../lib/eventBus.js';
import { initAvailabilityDetector } from '../lib/availabilityDetector.js';
import notificationService from '../modules/notification/notification.service.js';
import { emailQueue } from '../jobs/queues.js';

// ─── Helpers ──────────────────────────────────────────────────

/** Wait for async event handlers to finish processing */
const tick = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

/**
 * Delhi coordinates used across tests.
 * Pharmacy at (28.63, 77.22) is ~2.1 km from SavedSearch at (28.6139, 77.2090)
 */
const DELHI_CENTER = { latitude: 28.6139, longitude: 77.2090 };
const DELHI_NEARBY = { latitude: 28.63, longitude: 77.22 };
const MUMBAI = { latitude: 19.0760, longitude: 72.8777 };

// ─── Setup ────────────────────────────────────────────────────

beforeAll(() => {
  initAvailabilityDetector();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// DETECTION LOGIC TESTS
// ═══════════════════════════════════════════════════════════════

describe('Availability Detector — Detection Logic', () => {

  // Test 1
  it('emits event when active SavedSearch matches newly created inventory', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
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

    // Emit inventory.created (as the inventory service would)
    eventBus.emit('inventory.created', {
      inventoryId: (await prisma.pharmacyInventory.findFirst({ where: { pharmacyId: pharmacy.id } }))!.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 50,
      lowStockThreshold: 10,
    });

    await tick();

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0][0];
    expect(payload.customerId).toBe(customer.id);
    expect(payload.medicineName).toBe('paracetamol 500mg');
    expect(payload.quantity).toBe(50);
    expect(payload.distanceMeters).toBeGreaterThan(0);

  });

  // Test 2
  it('does NOT emit event when medicine name does not match', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
      query: 'ibuprofen',
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

    eventBus.emit('inventory.created', {
      inventoryId: (await prisma.pharmacyInventory.findFirst({ where: { pharmacyId: pharmacy.id } }))!.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 50,
      lowStockThreshold: 10,
    });

    await tick();

    expect(handler).not.toHaveBeenCalled();

  });

  // Test 3
  it('does NOT emit event when pharmacy is outside saved radius', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 5,
    });

    // Pharmacy in Mumbai — far away
    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...MUMBAI,
    });
    const medicine = await createTestMedicine({ name: 'paracetamol 500mg' });
    await createTestInventory(pharmacy.id, medicine.id, { quantity: 50 });

    eventBus.emit('inventory.created', {
      inventoryId: (await prisma.pharmacyInventory.findFirst({ where: { pharmacyId: pharmacy.id } }))!.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 50,
      lowStockThreshold: 10,
    });

    await tick();

    expect(handler).not.toHaveBeenCalled();

  });

  // Test 4
  it('does NOT emit event when SavedSearch is inactive', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 10,
      isActive: false,
    });

    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'paracetamol 500mg' });
    await createTestInventory(pharmacy.id, medicine.id, { quantity: 50 });

    eventBus.emit('inventory.created', {
      inventoryId: (await prisma.pharmacyInventory.findFirst({ where: { pharmacyId: pharmacy.id } }))!.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 50,
      lowStockThreshold: 10,
    });

    await tick();

    expect(handler).not.toHaveBeenCalled();

  });

  // Test 5
  it('emits event on inventory update 0 → positive', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
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
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 5 });

    eventBus.emit('inventory.updated', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 5,
      previousQuantity: 0,
      lowStockThreshold: 10,
    });

    await tick();

    expect(handler).toHaveBeenCalledOnce();

  });

  // Test 6
  it('does NOT emit event on positive → positive (not newly available)', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
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
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 6 });

    eventBus.emit('inventory.updated', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 6,
      previousQuantity: 5,
      lowStockThreshold: 10,
    });

    await tick();

    expect(handler).not.toHaveBeenCalled();

  });

  // Test 7
  it('positive → 0 clears dedup rows and does NOT emit event', async () => {
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
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 5 });

    // Create a dedup row
    await prisma.availabilityAlert.create({
      data: { savedSearchId: savedSearch.id, inventoryId: inv.id },
    });

    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    // Stock goes to 0
    eventBus.emit('inventory.updated', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 0,
      previousQuantity: 5,
      lowStockThreshold: 10,
    });

    await tick();

    expect(handler).not.toHaveBeenCalled();

    // Verify dedup row was deleted
    const alertCount = await prisma.availabilityAlert.count({
      where: { inventoryId: inv.id },
    });
    expect(alertCount).toBe(0);

  });

  // Test 8
  it('0 → positive → 0 → positive: re-emits event after dedup reset', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
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
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 5 });

    // Step 1: 0 → 5 → event emitted
    eventBus.emit('inventory.updated', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 5,
      previousQuantity: 0,
      lowStockThreshold: 10,
    });
    await tick();
    expect(handler).toHaveBeenCalledOnce();

    // Simulate bridge creating the dedup row
    await prisma.availabilityAlert.create({
      data: {
        savedSearchId: (await prisma.savedSearch.findFirst({ where: { userId: customer.id } }))!.id,
        inventoryId: inv.id,
      },
    });

    handler.mockClear();

    // Step 2: 5 → 0 → dedup row deleted
    eventBus.emit('inventory.updated', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 0,
      previousQuantity: 5,
      lowStockThreshold: 10,
    });
    await tick();
    expect(handler).not.toHaveBeenCalled();

    // Step 3: 0 → 4 → event emitted again
    // Update inventory back to available
    await prisma.pharmacyInventory.update({
      where: { id: inv.id },
      data: { quantity: 4, isAvailable: true },
    });

    eventBus.emit('inventory.updated', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 4,
      previousQuantity: 0,
      lowStockThreshold: 10,
    });
    await tick();
    expect(handler).toHaveBeenCalledOnce();

  });

  // Test 9
  it('multiple customers with matching SavedSearches each receive their own event', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customerA } = await createTestUser({ role: 'CUSTOMER', email: 'a@test.com' });
    const { user: customerB } = await createTestUser({ role: 'CUSTOMER', email: 'b@test.com' });

    await createTestSavedSearch(customerA.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 10,
    });
    await createTestSavedSearch(customerB.id, {
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

    eventBus.emit('inventory.created', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 50,
      lowStockThreshold: 10,
    });

    await tick();

    expect(handler).toHaveBeenCalledTimes(2);
    const customerIds = handler.mock.calls.map((c: unknown[]) => (c[0] as { customerId: string }).customerId);
    expect(customerIds).toContain(customerA.id);
    expect(customerIds).toContain(customerB.id);

  });

  // Test 10
  it('does NOT emit event for unverified pharmacy', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
      query: 'paracetamol',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'PENDING',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'paracetamol 500mg' });
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 50 });

    eventBus.emit('inventory.created', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 50,
      lowStockThreshold: 10,
    });

    await tick();

    expect(handler).not.toHaveBeenCalled();

  });

  // Test 11
  it('matches by generic name', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
      query: 'acetaminophen',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({
      name: 'crocin advance',
      genericName: 'acetaminophen',
    });
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 50 });

    eventBus.emit('inventory.created', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'crocin advance',
      quantity: 50,
      lowStockThreshold: 10,
    });

    await tick();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].genericName).toBe('acetaminophen');

  });

  // Test 12
  it('does NOT emit event when inventory created with quantity 0', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
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
    await createTestInventory(pharmacy.id, medicine.id, { quantity: 0, isAvailable: false });

    eventBus.emit('inventory.created', {
      inventoryId: (await prisma.pharmacyInventory.findFirst({ where: { pharmacyId: pharmacy.id } }))!.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 0,
      lowStockThreshold: 10,
    });

    await tick();

    expect(handler).not.toHaveBeenCalled();

  });
});

// ═══════════════════════════════════════════════════════════════
// FAILURE-SAFE DEDUPLICATION TEST
// ═══════════════════════════════════════════════════════════════

describe('Availability Detector — Failure-Safe Dedup (Test 13)', () => {
  beforeAll(async () => {
    const { bridgeEventsToNotifications } = await import('../lib/notificationEventBridge.js');
    bridgeEventsToNotifications();
  });

  it('bridge failure does NOT permanently suppress future availability notifications (full lifecycle)', async () => {
    // Setup: customer, saved search, pharmacy, medicine
    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
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
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 5 });

    // ── Step 1: 0 → 5 with bridge FAILURE ──────────────────
    // Mock notificationService.create to throw
    const createSpy = vi.spyOn(notificationService, 'create').mockRejectedValueOnce(
      new Error('Simulated DB failure'),
    );

    eventBus.emit('inventory.updated', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 5,
      previousQuantity: 0,
      lowStockThreshold: 10,
    });

    await tick(500);

    // Verify: NO dedup row was created (bridge failed before dedup insert)
    const alertsAfterFailure = await prisma.availabilityAlert.count({
      where: { inventoryId: inv.id },
    });
    expect(alertsAfterFailure).toBe(0);

    // Verify: NO notification was created
    const notifsAfterFailure = await prisma.notification.count({
      where: { userId: customer.id, type: 'MEDICINE_AVAILABLE' },
    });
    expect(notifsAfterFailure).toBe(0);

    createSpy.mockRestore();

    // ── Step 2: 5 → 0 (stock depleted — reset dedup) ──────
    await prisma.pharmacyInventory.update({
      where: { id: inv.id },
      data: { quantity: 0, isAvailable: false },
    });

    eventBus.emit('inventory.updated', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 0,
      previousQuantity: 5,
      lowStockThreshold: 10,
    });
    await tick();

    // ── Step 3: 0 → 5 (restock — this time bridge succeeds) ──
    await prisma.pharmacyInventory.update({
      where: { id: inv.id },
      data: { quantity: 5, isAvailable: true },
    });

    eventBus.emit('inventory.updated', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 5,
      previousQuantity: 0,
      lowStockThreshold: 10,
    });

    await tick(500);

    // Verify: notification WAS created this time
    const notifsAfterSuccess = await prisma.notification.count({
      where: { userId: customer.id, type: 'MEDICINE_AVAILABLE' },
    });
    expect(notifsAfterSuccess).toBe(1);

    // Verify: dedup row WAS created this time
    const alertsAfterSuccess = await prisma.availabilityAlert.count({
      where: { inventoryId: inv.id },
    });
    expect(alertsAfterSuccess).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION BRIDGE INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════

describe('Availability Detector — Bridge Integration', () => {
  beforeAll(async () => {
    const { bridgeEventsToNotifications } = await import('../lib/notificationEventBridge.js');
    bridgeEventsToNotifications();
  });

  // Test 14
  it('creates MEDICINE_AVAILABLE notification when event is emitted', async () => {
    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'test-bridge-med' });
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 20 });

    eventBus.emit('medicine.availability_detected', {
      savedSearchId: 'fake-ss-id',
      customerId: customer.id,
      inventoryId: inv.id,
      medicineId: medicine.id,
      medicineName: 'test-bridge-med',
      genericName: null,
      pharmacyId: pharmacy.id,
      pharmacyName: 'Test Pharmacy',
      quantity: 20,
      distanceMeters: 2100,
    });

    await tick();

    const notifications = await prisma.notification.findMany({
      where: { userId: customer.id },
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('MEDICINE_AVAILABLE');
    expect(notifications[0].title).toContain('test-bridge-med');
    expect(notifications[0].title).toContain('💊');
    expect(notifications[0].message).toContain('Test Pharmacy');
    expect(notifications[0].message).toContain('2.1 km');
    expect(notifications[0].data).toMatchObject({
      inventoryId: inv.id,
      medicineId: medicine.id,
      pharmacyId: pharmacy.id,
      quantity: 20,
    });
  });

  // Test 15 — Socket.io push (we can't easily test without a mock, verify no crash)
  it('does not crash when Socket.io is not initialized', async () => {
    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'socket-test-med' });
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 10 });

    // getIO() returns null in test — should not throw
    expect(() => {
      eventBus.emit('medicine.availability_detected', {
        savedSearchId: 'fake-ss-id-2',
        customerId: customer.id,
        inventoryId: inv.id,
        medicineId: medicine.id,
        medicineName: 'socket-test-med',
        genericName: null,
        pharmacyId: pharmacy.id,
        pharmacyName: 'Socket Test Pharmacy',
        quantity: 10,
        distanceMeters: 3000,
      });
    }).not.toThrow();

    await tick();

    // Notification should still be created even though socket is unavailable
    const count = await prisma.notification.count({
      where: { userId: customer.id, type: 'MEDICINE_AVAILABLE' },
    });
    expect(count).toBe(1);
  });

  // Test 16 — Email queued
  it('queues email through existing emailQueue', async () => {
    const addSpy = vi.spyOn(emailQueue, 'add').mockResolvedValue({} as never);

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'email-test-med' });
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 15 });

    eventBus.emit('medicine.availability_detected', {
      savedSearchId: 'fake-ss-id-3',
      customerId: customer.id,
      inventoryId: inv.id,
      medicineId: medicine.id,
      medicineName: 'email-test-med',
      genericName: null,
      pharmacyId: pharmacy.id,
      pharmacyName: 'Email Test Pharmacy',
      quantity: 15,
      distanceMeters: 5000,
    });

    await tick();

    expect(addSpy).toHaveBeenCalledWith('medicine-available-email', expect.objectContaining({
      to: customer.email,
      medicineName: 'email-test-med',
      pharmacyName: 'Email Test Pharmacy',
      quantity: 15,
    }));

    addSpy.mockRestore();
  });

  // Test 17 — Idempotency guard
  it('calling initAvailabilityDetector() twice does not cause duplicate events', async () => {
    const handler = vi.fn();
    eventBus.on('medicine.availability_detected', handler);

    // Second call should be no-op due to `initialized` guard
    initAvailabilityDetector();

    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    await createTestSavedSearch(customer.id, {
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

    eventBus.emit('inventory.created', {
      inventoryId: inv.id,
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      medicineName: 'paracetamol 500mg',
      quantity: 50,
      lowStockThreshold: 10,
    });

    await tick();

    // Should only receive ONE event, not two
    expect(handler).toHaveBeenCalledOnce();

  });
});

// ═══════════════════════════════════════════════════════════════
// RACE CONDITION / UNIQUE CONSTRAINT TEST
// ═══════════════════════════════════════════════════════════════

describe('Availability Detector — Race Condition (Test 18)', () => {
  beforeAll(async () => {
    const { bridgeEventsToNotifications } = await import('../lib/notificationEventBridge.js');
    bridgeEventsToNotifications();
  });

  it('handles concurrent dedup insert (P2002 unique constraint) gracefully', async () => {
    const { user: customer } = await createTestUser({ role: 'CUSTOMER' });
    const savedSearch = await createTestSavedSearch(customer.id, {
      query: 'race-test',
      ...DELHI_CENTER,
      radiusKm: 10,
    });

    const { user: pharmaUser } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(pharmaUser.id, {
      status: 'VERIFIED',
      ...DELHI_NEARBY,
    });
    const medicine = await createTestMedicine({ name: 'race-test-med' });
    const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 10 });

    // Pre-insert the dedup row (simulating a concurrent handler that already ran)
    await prisma.availabilityAlert.create({
      data: { savedSearchId: savedSearch.id, inventoryId: inv.id },
    });

    // Now emit the event — the bridge handler will try to insert the same dedup row
    // and should handle the P2002 error gracefully
    eventBus.emit('medicine.availability_detected', {
      savedSearchId: savedSearch.id,
      customerId: customer.id,
      inventoryId: inv.id,
      medicineId: medicine.id,
      medicineName: 'race-test-med',
      genericName: null,
      pharmacyId: pharmacy.id,
      pharmacyName: 'Race Test Pharmacy',
      quantity: 10,
      distanceMeters: 2000,
    });

    await tick();

    // Notification should still be created (notification happens BEFORE dedup insert)
    const notifications = await prisma.notification.findMany({
      where: { userId: customer.id, type: 'MEDICINE_AVAILABLE' },
    });
    expect(notifications).toHaveLength(1);

    // Only ONE dedup row should exist (the pre-inserted one; the duplicate was caught)
    const alertCount = await prisma.availabilityAlert.count({
      where: { savedSearchId: savedSearch.id, inventoryId: inv.id },
    });
    expect(alertCount).toBe(1);
  });
});
