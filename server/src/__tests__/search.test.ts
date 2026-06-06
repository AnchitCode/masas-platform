import request from 'supertest';
import app from '../app.js';
import { createTestUser, createTestPharmacy, createTestMedicine, createTestInventory } from './setup.js';

interface SeedOptions {
  lat: number;
  lng: number;
  medicineName?: string;
  genericName?: string;
  quantity?: number;
  price?: number;
  status?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  isAvailable?: boolean;
}

describe('Search Module', () => {
  async function seedPharmacyWithInventory({ lat, lng, medicineName = 'paracetamol 500mg', genericName = 'acetaminophen', quantity = 100, price = 25, status = 'VERIFIED', isAvailable = true }: SeedOptions) {
    const { user } = await createTestUser();
    const pharmacy = await createTestPharmacy(user.id, { latitude: lat, longitude: lng, status });
    const medicine = await createTestMedicine({ name: medicineName, genericName });
    const inventory = await createTestInventory(pharmacy.id, medicine.id, { quantity, price, isAvailable });
    return { pharmacy, medicine, inventory };
  }

  describe('GET /api/v1/search/inventory', () => {
    it('returns results for matching medicine near location', async () => { await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'paracetamol' }); const res = await request(app).get('/api/v1/search/inventory').query({ q: 'paracetamol', lat: 28.6139, lng: 77.209, radiusKm: 10 }); expect(res.status).toBe(200); expect(res.body.data.results.length).toBeGreaterThanOrEqual(1); expect(res.body.data.results[0].distanceMeters).toBeDefined(); });
    it('results are sorted by distance (nearest first)', async () => { await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'aspirin' }); await seedPharmacyWithInventory({ lat: 28.70, lng: 77.30, medicineName: 'aspirin' }); const res = await request(app).get('/api/v1/search/inventory').query({ q: 'aspirin', lat: 28.6139, lng: 77.209, radiusKm: 50 }); expect(res.status).toBe(200); const results = res.body.data.results; expect(results.length).toBe(2); expect(results[0].distanceMeters).toBeLessThan(results[1].distanceMeters); });
    it('excludes unverified pharmacies', async () => { await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'ibuprofen', status: 'PENDING' }); const res = await request(app).get('/api/v1/search/inventory').query({ q: 'ibuprofen', lat: 28.6139, lng: 77.209, radiusKm: 10 }); expect(res.status).toBe(200); expect(res.body.data.results).toHaveLength(0); });
    it('excludes out-of-stock items (quantity=0)', async () => { await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'cetirizine', quantity: 0 }); const res = await request(app).get('/api/v1/search/inventory').query({ q: 'cetirizine', lat: 28.6139, lng: 77.209, radiusKm: 10 }); expect(res.status).toBe(200); expect(res.body.data.results).toHaveLength(0); });
    it('excludes unavailable items (isAvailable=false)', async () => { await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'metformin', isAvailable: false, quantity: 50 }); const res = await request(app).get('/api/v1/search/inventory').query({ q: 'metformin', lat: 28.6139, lng: 77.209, radiusKm: 10 }); expect(res.status).toBe(200); expect(res.body.data.results).toHaveLength(0); });
    it('matches by generic name', async () => { await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'crocin advance', genericName: 'acetaminophen' }); const res = await request(app).get('/api/v1/search/inventory').query({ q: 'acetaminophen', lat: 28.6139, lng: 77.209, radiusKm: 10 }); expect(res.status).toBe(200); expect(res.body.data.results.length).toBeGreaterThanOrEqual(1); });
    it('is case-insensitive', async () => { await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'omeprazole' }); const res = await request(app).get('/api/v1/search/inventory').query({ q: 'OMEPRAZOLE', lat: 28.6139, lng: 77.209, radiusKm: 10 }); expect(res.status).toBe(200); expect(res.body.data.results.length).toBeGreaterThanOrEqual(1); });
    it('respects radius parameter', async () => { await seedPharmacyWithInventory({ lat: 29.0, lng: 77.5, medicineName: 'amoxicillin' }); const res = await request(app).get('/api/v1/search/inventory').query({ q: 'amoxicillin', lat: 28.6139, lng: 77.209, radiusKm: 5 }); expect(res.status).toBe(200); expect(res.body.data.results).toHaveLength(0); });
    it('pagination works (page, limit)', async () => { for (let i = 0; i < 3; i++) { await seedPharmacyWithInventory({ lat: 28.613 + i * 0.002, lng: 77.209 + i * 0.002, medicineName: 'vitamin c' }); } const res = await request(app).get('/api/v1/search/inventory').query({ q: 'vitamin c', lat: 28.6139, lng: 77.209, radiusKm: 50, page: 1, limit: 2 }); expect(res.status).toBe(200); expect(res.body.data.results).toHaveLength(2); expect(res.body.data.total).toBe(3); });
    it('returns empty results for no matches', async () => { const res = await request(app).get('/api/v1/search/inventory').query({ q: 'nonexistentxyz', lat: 28.6139, lng: 77.209, radiusKm: 10 }); expect(res.status).toBe(200); expect(res.body.data.results).toHaveLength(0); expect(res.body.data.total).toBe(0); });
    it('rejects missing query params with 400', async () => { const res = await request(app).get('/api/v1/search/inventory').query({}); expect(res.status).toBe(400); });
    it('rejects missing lat/lng with 400', async () => { const res = await request(app).get('/api/v1/search/inventory').query({ q: 'paracetamol' }); expect(res.status).toBe(400); });
  });
});
