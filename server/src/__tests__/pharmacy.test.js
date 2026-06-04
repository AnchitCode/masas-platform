const request = require('supertest');
const app = require('../app');
const {
  createTestUser,
  createTestPharmacy,
  createAdminUser,
} = require('./setup');

describe('Pharmacy Module', () => {
  // ─── Create Profile ─────────────────────────────────────

  describe('POST /api/v1/pharmacy/profile', () => {
    const validProfile = {
      name: 'Apollo Pharmacy',
      licenseNumber: 'PH-DL-2024-001',
      address: '456 Market Road, New Delhi',
      phone: '+91-9876500001',
      latitude: 28.6139,
      longitude: 77.2090,
    };

    it('creates pharmacy profile with valid data', async () => {
      const { accessToken } = await createTestUser();

      const res = await request(app)
        .post('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validProfile);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pharmacy.name).toBe('Apollo Pharmacy');
      expect(res.body.data.pharmacy.status).toBe('PENDING');
    });

    it('status defaults to PENDING', async () => {
      const { accessToken } = await createTestUser();

      const res = await request(app)
        .post('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validProfile, licenseNumber: 'PH-UNIQUE-001' });

      expect(res.body.data.pharmacy.status).toBe('PENDING');
    });

    it('rejects if user already has a profile', async () => {
      const { user, accessToken } = await createTestUser();
      await createTestPharmacy(user.id);

      const res = await request(app)
        .post('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validProfile, licenseNumber: 'PH-UNIQUE-002' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rejects duplicate license number', async () => {
      const { user: u1 } = await createTestUser();
      await createTestPharmacy(u1.id, { licenseNumber: 'PH-DUP-LIC' });

      const { accessToken } = await createTestUser({ email: 'another@test.com' });

      const res = await request(app)
        .post('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validProfile, licenseNumber: 'PH-DUP-LIC' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing required fields', async () => {
      const { accessToken } = await createTestUser();

      const res = await request(app)
        .post('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Incomplete' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid coordinates', async () => {
      const { accessToken } = await createTestUser();

      const res = await request(app)
        .post('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validProfile, latitude: 999, licenseNumber: 'PH-X-001' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthorized request', async () => {
      const res = await request(app)
        .post('/api/v1/pharmacy/profile')
        .send(validProfile);

      expect(res.status).toBe(401);
    });
  });

  // ─── Get Own Profile ──────────────────────────────────────

  describe('GET /api/v1/pharmacy/profile', () => {
    it('returns own profile with inventory count', async () => {
      const { user, accessToken } = await createTestUser();
      await createTestPharmacy(user.id, { name: 'My Pharmacy' });

      const res = await request(app)
        .get('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pharmacy.name).toBe('My Pharmacy');
      expect(res.body.data.pharmacy._count).toBeDefined();
    });

    it('returns 404 if no profile exists', async () => {
      const { accessToken } = await createTestUser();

      const res = await request(app)
        .get('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects non-PHARMACY role', async () => {
      const { accessToken } = await createAdminUser();

      const res = await request(app)
        .get('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── Update Profile ───────────────────────────────────────

  describe('PUT /api/v1/pharmacy/profile', () => {
    it('updates profile with partial data', async () => {
      const { user, accessToken } = await createTestUser();
      await createTestPharmacy(user.id);

      const res = await request(app)
        .put('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Pharmacy Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pharmacy.name).toBe('Updated Pharmacy Name');
    });

    it('auto-transitions REJECTED to PENDING on update', async () => {
      const { user, accessToken } = await createTestUser();
      await createTestPharmacy(user.id, { status: 'REJECTED' });

      const res = await request(app)
        .put('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Fixed Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.pharmacy.status).toBe('PENDING');
    });

    it('rejects unauthorized request', async () => {
      const res = await request(app)
        .put('/api/v1/pharmacy/profile')
        .send({ name: 'Hacker' });

      expect(res.status).toBe(401);
    });
  });

  // ─── Public Profile ───────────────────────────────────────

  describe('GET /api/v1/pharmacy/:id', () => {
    it('returns public profile by ID', async () => {
      const { user } = await createTestUser();
      const pharmacy = await createTestPharmacy(user.id, { name: 'Public Pharmacy' });

      const res = await request(app).get(`/api/v1/pharmacy/${pharmacy.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pharmacy.name).toBe('Public Pharmacy');
    });

    it('returns 404 for non-existent pharmacy', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app).get(`/api/v1/pharmacy/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('does not require authentication', async () => {
      const { user } = await createTestUser();
      const pharmacy = await createTestPharmacy(user.id);

      const res = await request(app).get(`/api/v1/pharmacy/${pharmacy.id}`);

      // No auth header — should still work
      expect(res.status).toBe(200);
    });
  });
});
