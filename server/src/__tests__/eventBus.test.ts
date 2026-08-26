import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { eventBus } from '../lib/eventBus.js';
import {
  createVerifiedPharmacyUser,
  createAdminUser,
  createTestPharmacy,
  createTestUser,
  createTestMedicine,
  createTestInventory,
} from './setup.js';

// ─── Clean up listeners between tests ──────────────────────────
afterEach(() => {
  eventBus.removeAllListeners();
});

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS — TypedEventBus class
// ═══════════════════════════════════════════════════════════════

describe('EventBus — Unit', () => {
  it('delivers payload to a listener', () => {
    const handler = vi.fn();
    eventBus.on('pharmacy.verified', handler);

    const payload = {
      pharmacyId: 'p-1',
      userId: 'u-1',
      pharmacyName: 'Test Pharmacy',
    };

    eventBus.emit('pharmacy.verified', payload);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('delivers to multiple listeners on the same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    eventBus.on('pharmacy.verified', handler1);
    eventBus.on('pharmacy.verified', handler2);

    eventBus.emit('pharmacy.verified', {
      pharmacyId: 'p-1',
      userId: 'u-1',
      pharmacyName: 'Test',
    });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('does not deliver to listeners of other events', () => {
    const verifiedHandler = vi.fn();
    const rejectedHandler = vi.fn();
    eventBus.on('pharmacy.verified', verifiedHandler);
    eventBus.on('pharmacy.rejected', rejectedHandler);

    eventBus.emit('pharmacy.verified', {
      pharmacyId: 'p-1',
      userId: 'u-1',
      pharmacyName: 'Test',
    });

    expect(verifiedHandler).toHaveBeenCalledOnce();
    expect(rejectedHandler).not.toHaveBeenCalled();
  });

  it('unsubscribes via off()', () => {
    const handler = vi.fn();
    eventBus.on('pharmacy.verified', handler);
    eventBus.off('pharmacy.verified', handler);

    eventBus.emit('pharmacy.verified', {
      pharmacyId: 'p-1',
      userId: 'u-1',
      pharmacyName: 'Test',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('once() fires handler exactly once', () => {
    const handler = vi.fn();
    eventBus.once('pharmacy.verified', handler);

    const payload = {
      pharmacyId: 'p-1',
      userId: 'u-1',
      pharmacyName: 'Test',
    };

    eventBus.emit('pharmacy.verified', payload);
    eventBus.emit('pharmacy.verified', payload);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('removeAllListeners(event) removes only that event', () => {
    const vHandler = vi.fn();
    const rHandler = vi.fn();
    eventBus.on('pharmacy.verified', vHandler);
    eventBus.on('pharmacy.rejected', rHandler);

    eventBus.removeAllListeners('pharmacy.verified');

    eventBus.emit('pharmacy.verified', {
      pharmacyId: 'p-1',
      userId: 'u-1',
      pharmacyName: 'Test',
    });
    eventBus.emit('pharmacy.rejected', {
      pharmacyId: 'p-1',
      userId: 'u-1',
      pharmacyName: 'Test',
      reason: undefined,
    });

    expect(vHandler).not.toHaveBeenCalled();
    expect(rHandler).toHaveBeenCalledOnce();
  });

  it('listenerCount() returns correct count', () => {
    expect(eventBus.listenerCount('pharmacy.verified')).toBe(0);

    const h1 = vi.fn();
    const h2 = vi.fn();
    eventBus.on('pharmacy.verified', h1);
    eventBus.on('pharmacy.verified', h2);

    expect(eventBus.listenerCount('pharmacy.verified')).toBe(2);
  });

  it('catches sync errors in handlers without crashing', () => {
    const badHandler = () => {
      throw new Error('sync boom');
    };
    const goodHandler = vi.fn();

    eventBus.on('pharmacy.verified', badHandler);
    eventBus.on('pharmacy.verified', goodHandler);

    // Should not throw
    expect(() => {
      eventBus.emit('pharmacy.verified', {
        pharmacyId: 'p-1',
        userId: 'u-1',
        pharmacyName: 'Test',
      });
    }).not.toThrow();

    // Good handler still ran
    expect(goodHandler).toHaveBeenCalledOnce();
  });

  it('catches async errors in handlers without unhandled rejection', async () => {
    const badAsyncHandler = async () => {
      throw new Error('async boom');
    };
    const goodHandler = vi.fn();

    eventBus.on('pharmacy.verified', badAsyncHandler);
    eventBus.on('pharmacy.verified', goodHandler);

    eventBus.emit('pharmacy.verified', {
      pharmacyId: 'p-1',
      userId: 'u-1',
      pharmacyName: 'Test',
    });

    // Give the async error a tick to propagate (and be caught)
    await new Promise((r) => setTimeout(r, 50));

    expect(goodHandler).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════
// INTEGRATION TESTS — Events emitted from real service calls
// ═══════════════════════════════════════════════════════════════

describe('EventBus — Inventory Integration', () => {
  it('emits inventory.created when adding to inventory', async () => {
    const handler = vi.fn();
    eventBus.on('inventory.created', handler);

    const { accessToken } = await createVerifiedPharmacyUser();

    await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        medicineName: 'EventBus Test Med',
        price: 42,
        quantity: 100,
      })
      .expect(201);

    expect(handler).toHaveBeenCalledOnce();

    const payload = handler.mock.calls[0][0];
    expect(payload.inventoryId).toEqual(expect.any(String));
    expect(payload.pharmacyId).toEqual(expect.any(String));
    expect(payload.medicineId).toEqual(expect.any(String));
    expect(payload.medicineName).toBe('eventbus test med'); // stored lowercase
    expect(payload.quantity).toBe(100);
  });

  it('emits inventory.updated with correct previousQuantity', async () => {
    const handler = vi.fn();
    eventBus.on('inventory.updated', handler);

    const { pharmacy, accessToken } = await createVerifiedPharmacyUser();
    const medicine = await createTestMedicine({ name: 'update-event-med' });
    const inv = await createTestInventory(pharmacy.id, medicine.id, {
      quantity: 50,
    });

    await request(app)
      .patch(`/api/v1/inventory/${inv.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ quantity: 20 })
      .expect(200);

    expect(handler).toHaveBeenCalledOnce();

    const payload = handler.mock.calls[0][0];
    expect(payload.inventoryId).toBe(inv.id);
    expect(payload.medicineId).toBe(medicine.id);
    expect(payload.medicineName).toBe('update-event-med');
    expect(payload.quantity).toBe(20);
    expect(payload.previousQuantity).toBe(50);
  });

  it('emits inventory.deleted without medicineName', async () => {
    const handler = vi.fn();
    eventBus.on('inventory.deleted', handler);

    const { pharmacy, accessToken } = await createVerifiedPharmacyUser();
    const medicine = await createTestMedicine({ name: 'delete-event-med' });
    const inv = await createTestInventory(pharmacy.id, medicine.id);

    await request(app)
      .delete(`/api/v1/inventory/${inv.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(handler).toHaveBeenCalledOnce();

    const payload = handler.mock.calls[0][0];
    expect(payload.inventoryId).toBe(inv.id);
    expect(payload.pharmacyId).toBe(pharmacy.id);
    expect(payload.medicineId).toBe(medicine.id);
    // Verify medicineName is NOT in the payload (audited design decision)
    expect(payload).not.toHaveProperty('medicineName');
  });

  it('does NOT emit inventory.created on validation failure', async () => {
    const handler = vi.fn();
    eventBus.on('inventory.created', handler);

    const { accessToken } = await createVerifiedPharmacyUser();

    await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ medicineName: 'BadMed', price: -10, quantity: 5 })
      .expect(400);

    expect(handler).not.toHaveBeenCalled();
  });

  it('does NOT emit inventory.updated on 404 (wrong pharmacy)', async () => {
    const handler = vi.fn();
    eventBus.on('inventory.updated', handler);

    const pharmaA = await createVerifiedPharmacyUser({ email: 'ev-a@test.com' });
    const medicine = await createTestMedicine();
    const inv = await createTestInventory(pharmaA.pharmacy.id, medicine.id);

    const pharmaB = await createVerifiedPharmacyUser({ email: 'ev-b@test.com' });

    await request(app)
      .patch(`/api/v1/inventory/${inv.id}`)
      .set('Authorization', `Bearer ${pharmaB.accessToken}`)
      .send({ price: 999 })
      .expect(404);

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('EventBus — Admin Integration', () => {
  it('emits pharmacy.verified when admin verifies pharmacy', async () => {
    const handler = vi.fn();
    eventBus.on('pharmacy.verified', handler);

    const { user } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(user.id, { status: 'PENDING' });
    const { accessToken: adminToken } = await createAdminUser();

    await request(app)
      .patch(`/api/v1/admin/pharmacies/${pharmacy.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'VERIFIED' })
      .expect(200);

    expect(handler).toHaveBeenCalledOnce();

    const payload = handler.mock.calls[0][0];
    expect(payload.pharmacyId).toBe(pharmacy.id);
    expect(payload.userId).toBe(user.id);
    expect(payload.pharmacyName).toBe('Test Pharmacy');
  });

  it('emits pharmacy.rejected with reason when admin rejects pharmacy', async () => {
    const handler = vi.fn();
    eventBus.on('pharmacy.rejected', handler);

    const { user } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(user.id, { status: 'PENDING' });
    const { accessToken: adminToken } = await createAdminUser();

    await request(app)
      .patch(`/api/v1/admin/pharmacies/${pharmacy.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED', rejectionReason: 'Invalid license' })
      .expect(200);

    expect(handler).toHaveBeenCalledOnce();

    const payload = handler.mock.calls[0][0];
    expect(payload.pharmacyId).toBe(pharmacy.id);
    expect(payload.userId).toBe(user.id);
    expect(payload.pharmacyName).toBe('Test Pharmacy');
    expect(payload.reason).toBe('Invalid license');
  });

  it('emits pharmacy.rejected with undefined reason when no reason provided', async () => {
    const handler = vi.fn();
    eventBus.on('pharmacy.rejected', handler);

    const { user } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(user.id, { status: 'PENDING' });
    const { accessToken: adminToken } = await createAdminUser();

    await request(app)
      .patch(`/api/v1/admin/pharmacies/${pharmacy.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED' })
      .expect(200);

    expect(handler).toHaveBeenCalledOnce();

    const payload = handler.mock.calls[0][0];
    expect(payload.reason).toBeUndefined();
  });

  it('does NOT emit when admin status change is rejected (no-op)', async () => {
    const verifiedHandler = vi.fn();
    const rejectedHandler = vi.fn();
    eventBus.on('pharmacy.verified', verifiedHandler);
    eventBus.on('pharmacy.rejected', rejectedHandler);

    const { user } = await createTestUser({ role: 'PHARMACY' });
    const pharmacy = await createTestPharmacy(user.id, { status: 'VERIFIED' });
    const { accessToken: adminToken } = await createAdminUser();

    // Try to verify an already-verified pharmacy → 400
    await request(app)
      .patch(`/api/v1/admin/pharmacies/${pharmacy.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'VERIFIED' })
      .expect(400);

    expect(verifiedHandler).not.toHaveBeenCalled();
    expect(rejectedHandler).not.toHaveBeenCalled();
  });
});
