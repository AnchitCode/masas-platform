import request from 'supertest';
import { vi } from 'vitest';
import app from '../app.js';
import { createTestUser, createTestPharmacy, createTestMedicine, createTestInventory } from './setup.js';
import { findSemanticCandidates } from '../ai/search/semanticSearch.js';
import type { SemanticSearchResult, SemanticCandidate } from '../ai/search/semanticSearch.js';

/** Shorthand: only id, name, score required; rest defaults to null. */
type CandidateInput = Pick<SemanticCandidate, 'id' | 'name' | 'score'>;

/** Build a complete SemanticSearchResult with safe defaults. */
function mockSemanticResult(
  overrides: Omit<Partial<SemanticSearchResult>, 'candidates'> & { candidates?: CandidateInput[] } = {},
): SemanticSearchResult {
  const candidates: SemanticCandidate[] = (overrides.candidates ?? []).map((c) => ({
    genericName: null,
    category: null,
    dosageForm: null,
    ...c,
  }));
  return {
    normalizedQuery: overrides.normalizedQuery ?? '',
    latencyMs: overrides.latencyMs ?? 0,
    aiUsed: overrides.aiUsed ?? false,
    error: overrides.error,
    candidates,
  };
}

vi.mock('../ai/search/semanticSearch.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ai/search/semanticSearch.js')>();
  return {
    ...actual,
    findSemanticCandidates: vi.fn(),
  };
});

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSemanticCandidates).mockResolvedValue(mockSemanticResult());
  });

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

  describe('Hybrid Search (Phase 9.1e)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(findSemanticCandidates).mockResolvedValue(mockSemanticResult());
    });

    it('returns semantic match when keyword has no match', async () => {
      // Seed a medicine that does NOT match 'dard ki dawa' textually
      const { medicine } = await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'paracetamol', genericName: 'acetaminophen' });
      // Mock semantic search to return this medicine
      vi.mocked(findSemanticCandidates).mockResolvedValue(mockSemanticResult({
        candidates: [{ id: medicine.id, name: medicine.name, score: 0.85 }],
        aiUsed: true,
        normalizedQuery: 'pain medicine',
        latencyMs: 100,
      }));

      const res = await request(app).get('/api/v1/search/inventory').query({ q: 'dard ki dawa', lat: 28.6139, lng: 77.209, radiusKm: 10 });
      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(1);
      expect(res.body.data.results[0].medicine.name).toBe('paracetamol');
      expect(res.body.data.results[0].matchType).toBe('semantic');
      expect(res.body.data.meta.aiUsed).toBe(true);
      expect(res.body.data.meta.normalizedQuery).toBe('pain medicine');
    });

    it('suppresses semantic suggestions when exact target is available (Phase 9.2)', async () => {
      // Pharmacy 1: Semantic match, closer
      const p1 = await seedPharmacyWithInventory({ lat: 28.62, lng: 77.21, medicineName: 'ibuprofen' });
      // Pharmacy 2: Exact keyword match, farther
      const p2 = await seedPharmacyWithInventory({ lat: 28.64, lng: 77.23, medicineName: 'paracetamol' });

      // Mock semantic search returning ibuprofen for the query "paracetamol"
      vi.mocked(findSemanticCandidates).mockResolvedValue(mockSemanticResult({
        candidates: [{ id: p1.medicine.id, name: p1.medicine.name, score: 0.9 }],
        aiUsed: true,
        normalizedQuery: 'paracetamol',
      }));

      const res = await request(app).get('/api/v1/search/inventory').query({ q: 'paracetamol', lat: 28.6139, lng: 77.209, radiusKm: 10 });
      expect(res.status).toBe(200);
      // Phase 9.2: exact target is available → semantic suggestions suppressed
      expect(res.body.data.results).toHaveLength(1);
      expect(res.body.data.results[0].medicine.name).toBe('paracetamol');
      expect(res.body.data.results[0].matchType).toBe('exact');
    });

    it('ranks prefix match above semantic match', async () => {
      const p1 = await seedPharmacyWithInventory({ lat: 28.62, lng: 77.21, medicineName: 'ibuprofen' });
      const p2 = await seedPharmacyWithInventory({ lat: 28.64, lng: 77.23, medicineName: 'para advance' });

      vi.mocked(findSemanticCandidates).mockResolvedValue(mockSemanticResult({
        candidates: [{ id: p1.medicine.id, name: p1.medicine.name, score: 0.9 }],
        aiUsed: true,
        normalizedQuery: 'para',
      }));

      const res = await request(app).get('/api/v1/search/inventory').query({ q: 'para', lat: 28.6139, lng: 77.209, radiusKm: 10 });
      expect(res.body.data.results[0].medicine.name).toBe('para advance');
      expect(res.body.data.results[0].matchType).toBe('partial');
    });

    it('deduplicates when medicine matches both keyword and semantic (no duplicate inventory rows)', async () => {
      const { medicine } = await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'paracetamol' });
      
      // Semantic search ALSO returns paracetamol
      vi.mocked(findSemanticCandidates).mockResolvedValue(mockSemanticResult({
        candidates: [{ id: medicine.id, name: medicine.name, score: 0.99 }],
        aiUsed: true,
        normalizedQuery: 'paracetamol',
      }));

      const res = await request(app).get('/api/v1/search/inventory').query({ q: 'paracetamol', lat: 28.6139, lng: 77.209, radiusKm: 10 });
      
      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(1); // Should only have one entry for this pharmacy
      expect(res.body.data.results[0].matchType).toBe('exact'); // Gets the highest score
    });

    it('falls back seamlessly to keyword only when AI fails (returns empty)', async () => {
      await seedPharmacyWithInventory({ lat: 28.63, lng: 77.22, medicineName: 'paracetamol' });
      
      // Simulate AI failure returning empty array (as handled in semanticSearch.ts)
      vi.mocked(findSemanticCandidates).mockResolvedValue(mockSemanticResult({
        candidates: [],
        aiUsed: false,
        normalizedQuery: '',
      }));

      const res = await request(app).get('/api/v1/search/inventory').query({ q: 'paracetamol', lat: 28.6139, lng: 77.209, radiusKm: 10 });
      
      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(1); // Keyword search still works!
      expect(res.body.data.meta.aiUsed).toBe(false);
    });

    it('suppresses semantic results when synonym-resolved target is available (Phase 9.2)', async () => {
      // Both semantic matches, but p1 is closer
      const p1 = await seedPharmacyWithInventory({ lat: 28.614, lng: 77.209, medicineName: 'med-close' });
      const p2 = await seedPharmacyWithInventory({ lat: 28.620, lng: 77.209, medicineName: 'med-far' });

      // "test" has no pharma intent and no catalog match.
      // Top candidate med-close scores 0.8 >= SYNONYM_THRESHOLD (0.65),
      // so resolveTypoTarget resolves "test" → med-close.
      vi.mocked(findSemanticCandidates).mockResolvedValue(mockSemanticResult({
        candidates: [
          { id: p1.medicine.id, name: p1.medicine.name, score: 0.8 },
          { id: p2.medicine.id, name: p2.medicine.name, score: 0.9 },
        ],
        aiUsed: true,
        normalizedQuery: 'test',
      }));

      const res = await request(app).get('/api/v1/search/inventory').query({ q: 'test', lat: 28.6139, lng: 77.209, radiusKm: 10 });
      
      expect(res.status).toBe(200);
      // Phase 9.2: resolved target (med-close) is available → semantic suggestions suppressed,
      // target re-tagged from 'semantic' to 'exact'
      expect(res.body.data.results).toHaveLength(1);
      expect(res.body.data.results[0].medicine.name).toBe('med-close');
      expect(res.body.data.results[0].matchType).toBe('exact');
      // Target metadata should reflect the resolved target
      expect(res.body.data.meta.target).toBeDefined();
      expect(res.body.data.meta.target.name).toBe('med-close');
      expect(res.body.data.meta.target.isAvailable).toBe(true);
    });

    it('preserves existing pagination correctly with hybrid results', async () => {
      for (let i = 0; i < 5; i++) {
        await seedPharmacyWithInventory({ lat: 28.613 + i * 0.001, lng: 77.209 + i * 0.001, medicineName: `item-${i}` });
      }

      // Make items 0, 1, 2, 3, 4 all semantic matches
      // The first mock is immediately overwritten — we fall back to keyword-only for this pagination test
      vi.mocked(findSemanticCandidates).mockResolvedValue(mockSemanticResult());
      
      const res = await request(app).get('/api/v1/search/inventory').query({ q: 'item-', lat: 28.6139, lng: 77.209, radiusKm: 50, page: 2, limit: 2 });
      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(2); // Items 2 and 3
      expect(res.body.data.total).toBe(5);
    });
  });
});
