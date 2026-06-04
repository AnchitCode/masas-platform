const request = require('supertest');
const app = require('../app');
const { createTestUser, createTestMedicine } = require('./setup');

describe('Catalog Module', () => {
  describe('GET /api/v1/catalog/search', () => {
    it('returns matching medicines', async () => {
      const { accessToken } = await createTestUser();
      await createTestMedicine({ name: 'paracetamol 500mg', genericName: 'Acetaminophen' });
      await createTestMedicine({ name: 'paracetamol 650mg', genericName: 'Acetaminophen' });

      const res = await request(app)
        .get('/api/v1/catalog/search')
        .query({ q: 'paracetamol' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.medicines.length).toBeGreaterThanOrEqual(2);
    });

    it('is case-insensitive', async () => {
      const { accessToken } = await createTestUser();
      await createTestMedicine({ name: 'amoxicillin' });

      const res = await request(app)
        .get('/api/v1/catalog/search')
        .query({ q: 'AMOXICILLIN' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.medicines.length).toBeGreaterThanOrEqual(1);
    });

    it('searches both name and genericName', async () => {
      const { accessToken } = await createTestUser();
      await createTestMedicine({ name: 'crocin', genericName: 'acetaminophen' });

      // Search by generic name
      const res = await request(app)
        .get('/api/v1/catalog/search')
        .query({ q: 'acetaminophen' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.medicines.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for empty query', async () => {
      const { accessToken } = await createTestUser();

      const res = await request(app)
        .get('/api/v1/catalog/search')
        .query({ q: '' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.medicines).toEqual([]);
    });

    it('limits results to 10 (autocomplete cap)', async () => {
      const { accessToken } = await createTestUser();

      // Seed 12 medicines with the same prefix
      for (let i = 0; i < 12; i++) {
        await createTestMedicine({ name: `vitamin-test-${i}` });
      }

      const res = await request(app)
        .get('/api/v1/catalog/search')
        .query({ q: 'vitamin-test' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.medicines.length).toBeLessThanOrEqual(10);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/search')
        .query({ q: 'test' });

      expect(res.status).toBe(401);
    });
  });
});
