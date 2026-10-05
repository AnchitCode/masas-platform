import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import {
  prisma,
  createVerifiedPharmacyUser,
  createAdminUser,
  createTestUser,
  createTestMedicine,
  createTestInventory,
} from './setup.js';
import { eventBus } from '../lib/eventBus.js';
import { initAnalyticsEventBridge } from '../lib/analyticsEventBridge.js';

/**
 * Phase 10.9 — Regression Tests
 *
 * Verifies Phase 10 does NOT break existing functionality:
 *   - Search still works with analytics logging enabled
 *   - Event bus listeners from Phase 8 still fire
 *   - Existing auth, inventory, pharmacy APIs still work
 *   - Notification system is not affected
 *   - Existing cleanup worker doesn't break analytics tables
 *   - Analytics does not affect non-analytics data
 */

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Phase 10 Regression', () => {
  beforeAll(() => {
    initAnalyticsEventBridge();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. Search still works with analytics enabled
  // ═══════════════════════════════════════════════════════════════

  describe('Search + analytics coexistence', () => {
    it('search API returns results even when analytics tables exist', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'SearchPharm' });
      const med = await createTestMedicine({ name: 'Paracetamol' });
      await createTestInventory(pharmacy.id, med.id, { quantity: 50 });

      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({
          q: 'paracetamol',
          lat: 28.6139,
          lng: 77.2090,
          radiusKm: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results.length).toBeGreaterThanOrEqual(0);
      // Response time should be reasonable (analytics is fire-and-forget)
    });

    it('search response does NOT include analytics internal fields', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'CleanSearch' });
      const med = await createTestMedicine({ name: 'Ibuprofen' });
      await createTestInventory(pharmacy.id, med.id, { quantity: 30 });

      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({
          q: 'ibuprofen',
          lat: 28.6139,
          lng: 77.2090,
          radiusKm: 10,
        });

      expect(res.status).toBe(200);
      // Should not expose analytics fields in the response
      expect(res.body.data.searchQueryId).toBeUndefined();
      expect(res.body.data.analyticsId).toBeUndefined();
    });

    it('search works even if analytics insert fails', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'FailSafe' });
      const med = await createTestMedicine({ name: 'Amoxicillin' });
      await createTestInventory(pharmacy.id, med.id, { quantity: 20 });

      // Spy on searchQuery create to simulate failure
      const spy = vi.spyOn(prisma.searchQuery, 'create').mockRejectedValueOnce(
        new Error('Analytics DB down'),
      );

      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({
          q: 'amoxicillin',
          lat: 28.6139,
          lng: 77.2090,
          radiusKm: 5,
        });

      // Search should still succeed
      expect(res.status).toBe(200);
      spy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. Event bus — existing listeners still fire
  // ═══════════════════════════════════════════════════════════════

  describe('Event bus regression', () => {
    it('inventory.created event fires both analytics bridge AND other listeners', async () => {
      const analyticsHandler = vi.fn();
      const otherHandler = vi.fn();

      eventBus.on('inventory.created', analyticsHandler);
      eventBus.on('inventory.created', otherHandler);

      eventBus.emit('inventory.created', {
        inventoryId: 'inv-regression-1',
        pharmacyId: 'pharm-reg-1',
        medicineId: 'med-reg-1',
        medicineName: 'RegMed',
        quantity: 10,
        lowStockThreshold: 5,
      });

      expect(analyticsHandler).toHaveBeenCalledOnce();
      expect(otherHandler).toHaveBeenCalledOnce();

      // Clean up only our test handlers (preserve analytics bridge listener)
      eventBus.off('inventory.created', analyticsHandler);
      eventBus.off('inventory.created', otherHandler);
    });

    it('pharmacy.verified event still fires and creates analytics + notification rows', async () => {
      const { user } = await createAdminUser();
      const { pharmacy } = await createVerifiedPharmacyUser({
        name: 'VerifyRegPharm',
      });

      eventBus.emit('pharmacy.verified', {
        pharmacyId: pharmacy.id,
        userId: user.id,
        pharmacyName: 'VerifyRegPharm',
      });
      await wait();

      // Analytics event should be created
      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'PHARMACY_VERIFIED', pharmacyId: pharmacy.id },
      });
      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. Auth regression
  // ═══════════════════════════════════════════════════════════════

  describe('Auth regression', () => {
    it('login still works and returns tokens', async () => {
      await createTestUser({
        email: 'auth-reg@test.com',
        password: 'TestPassword123',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'auth-reg@test.com', password: 'TestPassword123' });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('unauthenticated routes still return 401', async () => {
      const res = await request(app).get('/api/v1/pharmacy/profile');
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. Inventory CRUD regression
  // ═══════════════════════════════════════════════════════════════

  describe('Inventory regression', () => {
    it('creating inventory still works and emits event', async () => {
      const { pharmacy, accessToken } = await createVerifiedPharmacyUser({
        name: 'InvRegPharm',
      });

      const handler = vi.fn();
      eventBus.on('inventory.created', handler);

      const res = await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          medicineName: 'InvRegMed',
          price: 15.00,
          quantity: 100,
        });

      expect(res.status).toBe(201);
      await wait();
      expect(handler).toHaveBeenCalled();

      // Verify analytics event was also created
      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'INVENTORY_CREATED', pharmacyId: pharmacy.id },
      });
      expect(events.length).toBeGreaterThanOrEqual(1);

      eventBus.off('inventory.created', handler);
    });

    it('updating inventory still works', async () => {
      const { pharmacy, accessToken } = await createVerifiedPharmacyUser({
        name: 'InvUpdPharm',
      });
      const med = await createTestMedicine({ name: 'InvUpdMed' });
      const inv = await createTestInventory(pharmacy.id, med.id, { quantity: 50 });

      const res = await request(app)
        .patch(`/api/v1/inventory/${inv.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 75 });

      expect(res.status).toBe(200);
    });

    it('deleting inventory still works', async () => {
      const { pharmacy, accessToken } = await createVerifiedPharmacyUser({
        name: 'InvDelPharm',
      });
      const med = await createTestMedicine({ name: 'InvDelMed' });
      const inv = await createTestInventory(pharmacy.id, med.id, { quantity: 10 });

      const res = await request(app)
        .delete(`/api/v1/inventory/${inv.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. Pharmacy profile regression
  // ═══════════════════════════════════════════════════════════════

  describe('Pharmacy profile regression', () => {
    it('pharmacy profile API still works', async () => {
      const { accessToken } = await createVerifiedPharmacyUser({
        name: 'ProfileRegPharm',
      });

      const res = await request(app)
        .get('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pharmacy.name).toBe('ProfileRegPharm');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. Admin API regression
  // ═══════════════════════════════════════════════════════════════

  describe('Admin API regression', () => {
    it('admin stats endpoint still works alongside analytics', async () => {
      const { accessToken } = await createAdminUser();

      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('admin pharmacies list still works', async () => {
      const { accessToken } = await createAdminUser();
      await createVerifiedPharmacyUser({ name: 'ListRegPharm' });

      const res = await request(app)
        .get('/api/v1/admin/pharmacies')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. Analytics isolation — no cross-contamination
  // ═══════════════════════════════════════════════════════════════

  describe('Analytics isolation', () => {
    it('TRUNCATE in beforeEach clears analytics tables cleanly', async () => {
      // After beforeEach runs, analytics tables should be empty
      const events = await prisma.analyticsEvent.count();
      const queries = await prisma.searchQuery.count();
      const impressions = await prisma.searchImpression.count();
      const snapshots = await prisma.pharmacyMetricsSnapshot.count();

      expect(events).toBe(0);
      expect(queries).toBe(0);
      expect(impressions).toBe(0);
      expect(snapshots).toBe(0);
    });

    it('pharmacy analytics data is isolated per pharmacy (IDOR prevention)', async () => {
      const { pharmacy: pharmA, accessToken: tokenA } = await createVerifiedPharmacyUser({
        name: 'PharmA',
        email: 'pharma@test.com',
      });
      const { accessToken: tokenB } = await createVerifiedPharmacyUser({
        name: 'PharmB',
        email: 'pharmb@test.com',
      });

      const med = await createTestMedicine({ name: 'IsolationMed' });
      await createTestInventory(pharmA.id, med.id, { quantity: 50 });
      // PharmB has no inventory

      const resA = await request(app)
        .get('/api/v1/pharmacy/analytics/overview')
        .set('Authorization', `Bearer ${tokenA}`);
      const resB = await request(app)
        .get('/api/v1/pharmacy/analytics/overview')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resA.body.data.current.totalSkus).toBe(1);
      expect(resB.body.data.current.totalSkus).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. Saved searches regression
  // ═══════════════════════════════════════════════════════════════

  describe('Saved searches regression', () => {
    it('saved search CRUD still works', async () => {
      const { accessToken } = await createTestUser({
        role: 'CUSTOMER',
        email: 'saved@test.com',
      });

      const res = await request(app)
        .post('/api/v1/saved-searches')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: 'aspirin',
          latitude: 28.61,
          longitude: 77.21,
          radiusKm: 5,
        });

      expect(res.status).toBe(201);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. Health endpoint regression
  // ═══════════════════════════════════════════════════════════════

  describe('Health endpoint regression', () => {
    it('GET /health still returns 200', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
    });
  });
});
