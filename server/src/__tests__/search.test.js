const request = require('supertest');
const app = require('../app');
const {
  createTestUser,
  createTestPharmacy,
  createTestMedicine,
  createTestInventory,
} = require('./setup');

describe('Search Module', () => {
  // Helper: seed a verified pharmacy with inventory at known coordinates
  async function seedPharmacyWithInventory({
    lat,
    lng,
    medicineName = 'paracetamol 500mg',
    genericName = 'acetaminophen',
    quantity = 100,
    price = 25,
    status = 'VERIFIED',
    isAvailable = true,
  } = {}) {
    const { user } = await createTestUser();
    const pharmacy = await createTestPharmacy(user.id, { latitude: lat, longitude: lng, status });
    const medicine = await createTestMedicine({ name: medicineName, genericName });
    const inventory = await createTestInventory(pharmacy.id, medicine.id, {
      quantity,
      price,
      isAvailable,
    });
    return { pharmacy, medicine, inventory };
  }

  // Delhi center: 28.6139, 77.2090
  // ~2km away:    28.6300, 77.2200
  // ~50km away:   29.0000, 77.5000
  // ~200km away:  30.0000, 78.0000

  describe('GET /api/v1/search/inventory', () => {
    it('returns results for matching medicine near location', async () => {
      await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'paracetamol' });

      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({ q: 'paracetamol', lat: 28.6139, lng: 77.209, radiusKm: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.results[0].pharmacy).toBeDefined();
      expect(res.body.data.results[0].medicine).toBeDefined();
      expect(res.body.data.results[0].inventory).toBeDefined();
      expect(res.body.data.results[0].distanceMeters).toBeDefined();
    });

    it('results are sorted by distance (nearest first)', async () => {
      // Seed two pharmacies at different distances
      await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'aspirin' }); // ~2km
      await seedPharmacyWithInventory({ lat: 28.70, lng: 77.30, medicineName: 'aspirin' }); // ~13km

      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({ q: 'aspirin', lat: 28.6139, lng: 77.209, radiusKm: 50 });

      expect(res.status).toBe(200);
      const results = res.body.data.results;
      expect(results.length).toBe(2);
      expect(results[0].distanceMeters).toBeLessThan(results[1].distanceMeters);
    });

    it('excludes unverified pharmacies', async () => {
      await seedPharmacyWithInventory({
        lat: 28.63,
        lng: 77.22,
        medicineName: 'ibuprofen',
        status: 'PENDING',
      });

      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({ q: 'ibuprofen', lat: 28.6139, lng: 77.209, radiusKm: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(0);
    });

    it('excludes out-of-stock items (quantity=0)', async () => {
      await seedPharmacyWithInventory({
        lat: 28.63,
        lng: 77.22,
        medicineName: 'cetirizine',
        quantity: 0,
      });

      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({ q: 'cetirizine', lat: 28.6139, lng: 77.209, radiusKm: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(0);
    });

    it('excludes unavailable items (isAvailable=false)', async () => {
      await seedPharmacyWithInventory({
        lat: 28.63,
        lng: 77.22,
        medicineName: 'metformin',
        isAvailable: false,
        quantity: 50,
      });

      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({ q: 'metformin', lat: 28.6139, lng: 77.209, radiusKm: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(0);
    });

    it('matches by generic name', async () => {
      await seedPharmacyWithInventory({
        lat: 28.63,
        lng: 77.22,
        medicineName: 'crocin advance',
        genericName: 'acetaminophen',
      });

      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({ q: 'acetaminophen', lat: 28.6139, lng: 77.209, radiusKm: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.results.length).toBeGreaterThanOrEqual(1);
    });

    it('is case-insensitive', async () => {
      await seedPharmacyWithInventory({
        lat: 28.63,
        lng: 77.22,
        medicineName: 'omeprazole',
      });

      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({ q: 'OMEPRAZOLE', lat: 28.6139, lng: 77.209, radiusKm: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.results.length).toBeGreaterThanOrEqual(1);
    });

    it('respects radius parameter', async () => {
      // Place pharmacy ~50km away
      await seedPharmacyWithInventory({
        lat: 29.0,
        lng: 77.5,
        medicineName: 'amoxicillin',
      });

      // Search with small radius (5km) — should NOT find it
      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({ q: 'amoxicillin', lat: 28.6139, lng: 77.209, radiusKm: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(0);
    });

    it('pagination works (page, limit)', async () => {
      // Seed 3 pharmacies with the same medicine
      for (let i = 0; i < 3; i++) {
        await seedPharmacyWithInventory({
          lat: 28.613 + i * 0.002,
          lng: 77.209 + i * 0.002,
          medicineName: 'vitamin c',
        });
      }

      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({ q: 'vitamin c', lat: 28.6139, lng: 77.209, radiusKm: 50, page: 1, limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(2);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.page).toBe(1);
    });

    it('returns empty results for no matches', async () => {
      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({ q: 'nonexistentxyz', lat: 28.6139, lng: 77.209, radiusKm: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(0);
      expect(res.body.data.total).toBe(0);
    });

    it('rejects missing query params with 400', async () => {
      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({}); // missing q, lat, lng

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing lat/lng with 400', async () => {
      const res = await request(app)
        .get('/api/v1/search/inventory')
        .query({ q: 'paracetamol' }); // missing lat, lng

      expect(res.status).toBe(400);
    });
  });
});
