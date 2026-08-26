import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import {
  prisma,
  createTestUser,
  createTestPharmacy,
  createTestMedicine,
  createTestInventory,
} from './setup.js';
import { eventBus } from '../lib/eventBus.js';
import { initLowStockDetector } from '../lib/lowStockDetector.js';

describe('Low-Stock Detector', () => {
  beforeAll(() => {
    // Initialize detector once (idempotent)
    initLowStockDetector();
  });

  beforeEach(() => {
    // Clear event listeners if needed, but in our case, the bus is shared.
    // Instead we just spy on emit and clear mock before each test.
    vi.spyOn(eventBus, 'emit');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('inventory.updated threshold crossing', () => {
    it('emits inventory.low_stock when crossing threshold downward (15 -> 9, threshold 10)', async () => {
      eventBus.emit('inventory.updated', {
        inventoryId: 'inv-1',
        pharmacyId: 'pharm-1',
        medicineId: 'med-1',
        medicineName: 'Test Med',
        quantity: 9,
        previousQuantity: 15,
        lowStockThreshold: 10,
      });

      expect(eventBus.emit).toHaveBeenCalledWith('inventory.low_stock', expect.objectContaining({
        inventoryId: 'inv-1',
        quantity: 9,
        lowStockThreshold: 10,
      }));
    });

    it('does not emit when staying below threshold (9 -> 8, threshold 10)', async () => {
      eventBus.emit('inventory.updated', {
        inventoryId: 'inv-1',
        pharmacyId: 'pharm-1',
        medicineId: 'med-1',
        medicineName: 'Test Med',
        quantity: 8,
        previousQuantity: 9,
        lowStockThreshold: 10,
      });

      // The first call was our mock emit above, we want to ensure low_stock wasn't emitted as a side effect
      const lowStockEmits = vi.mocked(eventBus.emit).mock.calls.filter(call => call[0] === 'inventory.low_stock');
      expect(lowStockEmits).toHaveLength(0);
    });

    it('does not emit when recovering above threshold (8 -> 20, threshold 10)', async () => {
      eventBus.emit('inventory.updated', {
        inventoryId: 'inv-1',
        pharmacyId: 'pharm-1',
        medicineId: 'med-1',
        medicineName: 'Test Med',
        quantity: 20,
        previousQuantity: 8,
        lowStockThreshold: 10,
      });

      const lowStockEmits = vi.mocked(eventBus.emit).mock.calls.filter(call => call[0] === 'inventory.low_stock');
      expect(lowStockEmits).toHaveLength(0);
    });

    it('emits when crossing to exactly threshold (11 -> 10, threshold 10)', async () => {
      eventBus.emit('inventory.updated', {
        inventoryId: 'inv-1',
        pharmacyId: 'pharm-1',
        medicineId: 'med-1',
        medicineName: 'Test Med',
        quantity: 10,
        previousQuantity: 11,
        lowStockThreshold: 10,
      });

      expect(eventBus.emit).toHaveBeenCalledWith('inventory.low_stock', expect.any(Object));
    });

    it('does not emit when quantity does not change (10 -> 10, threshold 10)', async () => {
      eventBus.emit('inventory.updated', {
        inventoryId: 'inv-1',
        pharmacyId: 'pharm-1',
        medicineId: 'med-1',
        medicineName: 'Test Med',
        quantity: 10,
        previousQuantity: 10,
        lowStockThreshold: 10,
      });

      const lowStockEmits = vi.mocked(eventBus.emit).mock.calls.filter(call => call[0] === 'inventory.low_stock');
      expect(lowStockEmits).toHaveLength(0);
    });

    it('does not emit if threshold is 0 (disabled)', async () => {
      eventBus.emit('inventory.updated', {
        inventoryId: 'inv-1',
        pharmacyId: 'pharm-1',
        medicineId: 'med-1',
        medicineName: 'Test Med',
        quantity: 0, // Crossed to 0
        previousQuantity: 10,
        lowStockThreshold: 0,
      });

      const lowStockEmits = vi.mocked(eventBus.emit).mock.calls.filter(call => call[0] === 'inventory.low_stock');
      expect(lowStockEmits).toHaveLength(0);
    });
  });

  describe('inventory.created immediate check', () => {
    it('emits when new stock is created below threshold (quantity 3, threshold 10)', async () => {
      eventBus.emit('inventory.created', {
        inventoryId: 'inv-1',
        pharmacyId: 'pharm-1',
        medicineId: 'med-1',
        medicineName: 'Test Med',
        quantity: 3,
        lowStockThreshold: 10,
      });

      expect(eventBus.emit).toHaveBeenCalledWith('inventory.low_stock', expect.objectContaining({
        inventoryId: 'inv-1',
        quantity: 3,
        lowStockThreshold: 10,
      }));
    });

    it('does not emit when new stock is created above threshold (quantity 15, threshold 10)', async () => {
      eventBus.emit('inventory.created', {
        inventoryId: 'inv-1',
        pharmacyId: 'pharm-1',
        medicineId: 'med-1',
        medicineName: 'Test Med',
        quantity: 15,
        lowStockThreshold: 10,
      });

      const lowStockEmits = vi.mocked(eventBus.emit).mock.calls.filter(call => call[0] === 'inventory.low_stock');
      expect(lowStockEmits).toHaveLength(0);
    });
  });

  describe('Notification Event Bridge Integration', () => {
    beforeAll(async () => {
      const { bridgeEventsToNotifications } = await import('../lib/notificationEventBridge.js');
      bridgeEventsToNotifications();
    });

    it('creates a low stock notification when inventory.low_stock is emitted', async () => {
      // Create user and pharmacy so the notification has a valid owner
      const { user } = await createTestUser();
      const pharmacy = await createTestPharmacy(user.id, { name: 'Notification Bridge Test Pharmacy' });

      // Emulate the low stock detector firing the event
      eventBus.emit('inventory.low_stock', {
        inventoryId: 'fake-inv-123',
        pharmacyId: pharmacy.id,
        medicineId: 'fake-med-123',
        medicineName: 'Paracetamol',
        quantity: 2,
        lowStockThreshold: 10,
      });

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify DB row
      const notifications = await prisma.notification.findMany({
        where: { userId: user.id },
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('LOW_STOCK_ALERT');
      expect(notifications[0].title).toBe('Low Stock: Paracetamol');
      expect(notifications[0].message).toContain('Only 2 units remaining');
      expect(notifications[0].data).toMatchObject({
        inventoryId: 'fake-inv-123',
        quantity: 2,
        threshold: 10,
      });
    });
  });
});
