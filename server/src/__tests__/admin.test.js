const request = require('supertest');
const app = require('../app');
const {
  createTestUser,
  createTestPharmacy,
  createTestMedicine,
  createTestInventory,
  createAdminUser,
} = require('./setup');

describe('Admin Module', () => {
  // ─── Authorization Guards ──────────────────────────────────

  describe('Authorization', () => {
    it('rejects non-admin user with 403', async () => {
      const { accessToken } = await createTestUser({ role: 'PHARMACY' });

      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/admin/stats');
      expect(res.status).toBe(401);
    });
  });

  // ─── Stats ────────────────────────────────────────────────

  describe('GET /api/v1/admin/stats', () => {
    it('returns all stat counts', async () => {
      const { accessToken } = await createAdminUser();

      // Seed some data
      const { user: u1 } = await createTestUser({ email: 'ph1@test.com' });
      await createTestPharmacy(u1.id, { status: 'VERIFIED' });
      const { user: u2 } = await createTestUser({ email: 'ph2@test.com' });
      await createTestPharmacy(u2.id, { status: 'PENDING' });

      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const stats = res.body.data.stats;
      expect(stats.totalUsers).toBeGreaterThanOrEqual(3); // admin + 2 pharmacies
      expect(stats.totalPharmacies).toBeGreaterThanOrEqual(2);
      expect(stats.verifiedPharmacies).toBeGreaterThanOrEqual(1);
      expect(stats.pendingPharmacies).toBeGreaterThanOrEqual(1);
      expect(stats.recentPharmacies).toBeDefined();
      expect(Array.isArray(stats.recentPharmacies)).toBe(true);
    });

    it('returns recent pharmacies list', async () => {
      const { accessToken } = await createAdminUser();

      const { user } = await createTestUser({ email: 'recent@test.com' });
      await createTestPharmacy(user.id, { name: 'Recent Pharmacy' });

      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const recent = res.body.data.stats.recentPharmacies;
      expect(recent.length).toBeGreaterThanOrEqual(1);
      expect(recent[0].name).toBeDefined();
      expect(recent[0].user).toBeDefined();
      expect(recent[0].user.email).toBeDefined();
    });
  });

  // ─── List Pharmacies ──────────────────────────────────────

  describe('GET /api/v1/admin/pharmacies', () => {
    it('returns paginated list', async () => {
      const { accessToken } = await createAdminUser();

      const { user: u1 } = await createTestUser({ email: 'list1@test.com' });
      await createTestPharmacy(u1.id, { status: 'VERIFIED' });
      const { user: u2 } = await createTestUser({ email: 'list2@test.com' });
      await createTestPharmacy(u2.id, { status: 'PENDING' });

      const res = await request(app)
        .get('/api/v1/admin/pharmacies')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pharmacies).toBeDefined();
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
      expect(res.body.data.page).toBe(1);
    });

    it('filters by status (PENDING)', async () => {
      const { accessToken } = await createAdminUser();

      const { user: u1 } = await createTestUser({ email: 'f-pend@test.com' });
      await createTestPharmacy(u1.id, { status: 'PENDING' });
      const { user: u2 } = await createTestUser({ email: 'f-ver@test.com' });
      await createTestPharmacy(u2.id, { status: 'VERIFIED' });

      const res = await request(app)
        .get('/api/v1/admin/pharmacies')
        .query({ status: 'PENDING' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      res.body.data.pharmacies.forEach((p) => {
        expect(p.status).toBe('PENDING');
      });
    });

    it('respects pagination limit', async () => {
      const { accessToken } = await createAdminUser();

      // Seed 3 pharmacies
      for (let i = 0; i < 3; i++) {
        const { user } = await createTestUser({ email: `pag${i}@test.com` });
        await createTestPharmacy(user.id);
      }

      const res = await request(app)
        .get('/api/v1/admin/pharmacies')
        .query({ limit: 2 })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pharmacies.length).toBeLessThanOrEqual(2);
      expect(res.body.data.total).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── Pharmacy Detail ──────────────────────────────────────

  describe('GET /api/v1/admin/pharmacies/:id', () => {
    it('returns full pharmacy detail', async () => {
      const { accessToken } = await createAdminUser();

      const { user } = await createTestUser({ email: 'detail@test.com' });
      const pharmacy = await createTestPharmacy(user.id, { name: 'Detail Pharmacy' });
      const medicine = await createTestMedicine();
      await createTestInventory(pharmacy.id, medicine.id);

      const res = await request(app)
        .get(`/api/v1/admin/pharmacies/${pharmacy.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pharmacy.name).toBe('Detail Pharmacy');
      expect(res.body.data.pharmacy.user).toBeDefined();
      expect(res.body.data.pharmacy._count.inventory).toBe(1);
    });

    it('returns 404 for non-existent pharmacy', async () => {
      const { accessToken } = await createAdminUser();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app)
        .get(`/api/v1/admin/pharmacies/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── Update Status ────────────────────────────────────────

  describe('PATCH /api/v1/admin/pharmacies/:id/status', () => {
    it('PENDING → VERIFIED transition', async () => {
      const { accessToken } = await createAdminUser();
      const { user } = await createTestUser({ email: 'pv@test.com' });
      const pharmacy = await createTestPharmacy(user.id, { status: 'PENDING' });

      const res = await request(app)
        .patch(`/api/v1/admin/pharmacies/${pharmacy.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'VERIFIED' });

      expect(res.status).toBe(200);
      expect(res.body.data.pharmacy.status).toBe('VERIFIED');
    });

    it('PENDING → REJECTED transition', async () => {
      const { accessToken } = await createAdminUser();
      const { user } = await createTestUser({ email: 'pr@test.com' });
      const pharmacy = await createTestPharmacy(user.id, { status: 'PENDING' });

      const res = await request(app)
        .patch(`/api/v1/admin/pharmacies/${pharmacy.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'REJECTED', rejectionReason: 'Invalid license' });

      expect(res.status).toBe(200);
      expect(res.body.data.pharmacy.status).toBe('REJECTED');
    });

    it('REJECTED → VERIFIED transition (re-verify)', async () => {
      const { accessToken } = await createAdminUser();
      const { user } = await createTestUser({ email: 'rv@test.com' });
      const pharmacy = await createTestPharmacy(user.id, { status: 'REJECTED' });

      const res = await request(app)
        .patch(`/api/v1/admin/pharmacies/${pharmacy.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'VERIFIED' });

      expect(res.status).toBe(200);
      expect(res.body.data.pharmacy.status).toBe('VERIFIED');
    });

    it('VERIFIED → REJECTED transition (revoke)', async () => {
      const { accessToken } = await createAdminUser();
      const { user } = await createTestUser({ email: 'vr@test.com' });
      const pharmacy = await createTestPharmacy(user.id, { status: 'VERIFIED' });

      const res = await request(app)
        .patch(`/api/v1/admin/pharmacies/${pharmacy.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'REJECTED' });

      expect(res.status).toBe(200);
      expect(res.body.data.pharmacy.status).toBe('REJECTED');
    });

    it('rejects same-status transition with 400', async () => {
      const { accessToken } = await createAdminUser();
      const { user } = await createTestUser({ email: 'noop@test.com' });
      const pharmacy = await createTestPharmacy(user.id, { status: 'VERIFIED' });

      const res = await request(app)
        .patch(`/api/v1/admin/pharmacies/${pharmacy.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'VERIFIED' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already/i);
    });

    it('returns 404 for non-existent pharmacy', async () => {
      const { accessToken } = await createAdminUser();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app)
        .patch(`/api/v1/admin/pharmacies/${fakeId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'VERIFIED' });

      expect(res.status).toBe(404);
    });
  });
});
