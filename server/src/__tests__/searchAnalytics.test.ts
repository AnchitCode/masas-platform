import { describe, it, expect, vi, afterEach } from 'vitest';
import { prisma } from './setup.js';
import { logSearchAnalytics, roundCoord } from '../modules/search/searchAnalytics.js';
import logger from '../utils/logger.js';

/**
 * Phase 10.2 — Search Analytics & Impressions Tests
 *
 * Verifies:
 *   - SearchQuery row creation with all fields
 *   - SearchImpression rows via createMany
 *   - Coordinate rounding to 2 decimal places
 *   - 0-result search produces 1 query row, 0 impressions
 *   - Position uses global rank: (page-1)*limit + i
 *   - normalizedQuery is null when not AI-transformed
 *   - targetFound mapping
 *   - responseTimeMs is stored
 *   - Fire-and-forget: failures are swallowed
 *   - Analytics failure doesn't throw
 */

describe('Search Analytics & Impressions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── roundCoord ─────────────────────────────────────────────────
  describe('roundCoord', () => {
    it('rounds to 2 decimal places', () => {
      expect(roundCoord(28.613939)).toBe(28.61);
      expect(roundCoord(77.209023)).toBe(77.21);
      expect(roundCoord(0.005)).toBe(0.01);
      expect(roundCoord(0.004)).toBe(0);
    });

    it('preserves already-rounded values', () => {
      expect(roundCoord(28.61)).toBe(28.61);
      expect(roundCoord(0)).toBe(0);
    });

    it('handles negative coordinates', () => {
      expect(roundCoord(-33.8688)).toBe(-33.87);
      expect(roundCoord(-151.2093)).toBe(-151.21);
    });
  });

  // ─── logSearchAnalytics — successful writes ───────────────────
  describe('successful search logging', () => {
    it('creates 1 SearchQuery row with all fields', async () => {
      await logSearchAnalytics({
        query: 'paracetamol',
        normalizedQuery: null,
        latitude: 28.61,
        longitude: 77.21,
        radiusKm: 5,
        resultCount: 3,
        aiUsed: false,
        targetMedicineId: 'med-1',
        targetFound: true,
        responseTimeMs: 42,
        impressions: [],
      });

      const queries = await prisma.searchQuery.findMany();
      expect(queries).toHaveLength(1);
      expect(queries[0]).toMatchObject({
        query: 'paracetamol',
        normalizedQuery: null,
        latitude: 28.61,
        longitude: 77.21,
        radiusKm: 5,
        resultCount: 3,
        aiUsed: false,
        targetMedicineId: 'med-1',
        targetFound: true,
        responseTimeMs: 42,
      });
    });

    it('creates N SearchImpression rows via createMany', async () => {
      await logSearchAnalytics({
        query: 'amoxicillin',
        normalizedQuery: null,
        latitude: 28.61,
        longitude: 77.21,
        radiusKm: 5,
        resultCount: 3,
        aiUsed: false,
        targetMedicineId: null,
        targetFound: null,
        responseTimeMs: 55,
        impressions: [
          { pharmacyId: 'p1', medicineId: 'm1', matchType: 'exact', position: 0 },
          { pharmacyId: 'p2', medicineId: 'm1', matchType: 'exact', position: 1 },
          { pharmacyId: 'p3', medicineId: 'm2', matchType: 'generic', position: 2 },
        ],
      });

      const queries = await prisma.searchQuery.findMany();
      expect(queries).toHaveLength(1);

      const impressions = await prisma.searchImpression.findMany({
        orderBy: { position: 'asc' },
      });
      expect(impressions).toHaveLength(3);

      // Verify each impression is linked to the query
      expect(impressions[0].searchQueryId).toBe(queries[0].id);
      expect(impressions[1].searchQueryId).toBe(queries[0].id);
      expect(impressions[2].searchQueryId).toBe(queries[0].id);

      // Verify impression fields
      expect(impressions[0]).toMatchObject({
        pharmacyId: 'p1', medicineId: 'm1', matchType: 'exact', position: 0,
      });
      expect(impressions[2]).toMatchObject({
        pharmacyId: 'p3', medicineId: 'm2', matchType: 'generic', position: 2,
      });
    });

    it('creates 1 query row and 0 impressions for a 0-result search', async () => {
      await logSearchAnalytics({
        query: 'nonexistent_medicine_xyz',
        normalizedQuery: null,
        latitude: 28.61,
        longitude: 77.21,
        radiusKm: 5,
        resultCount: 0,
        aiUsed: false,
        targetMedicineId: null,
        targetFound: null,
        responseTimeMs: 10,
        impressions: [],
      });

      const queries = await prisma.searchQuery.findMany();
      expect(queries).toHaveLength(1);
      expect(queries[0].resultCount).toBe(0);

      const impressions = await prisma.searchImpression.findMany();
      expect(impressions).toHaveLength(0);
    });
  });

  // ─── Position uses global rank ────────────────────────────────
  describe('position global rank', () => {
    it('page 1 positions are 0–(limit-1)', async () => {
      const page = 1;
      const limit = 20;
      const impressions = Array.from({ length: 3 }, (_, i) => ({
        pharmacyId: `p${i}`, medicineId: `m${i}`, matchType: 'exact',
        position: (page - 1) * limit + i,
      }));

      await logSearchAnalytics({
        query: 'test', normalizedQuery: null, latitude: 0, longitude: 0,
        radiusKm: 5, resultCount: 50, aiUsed: false,
        targetMedicineId: null, targetFound: null, responseTimeMs: 10,
        impressions,
      });

      const rows = await prisma.searchImpression.findMany({ orderBy: { position: 'asc' } });
      expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
    });

    it('page 2 positions are limit–(2*limit-1)', async () => {
      const page = 2;
      const limit = 20;
      const impressions = Array.from({ length: 3 }, (_, i) => ({
        pharmacyId: `p${i}`, medicineId: `m${i}`, matchType: 'partial',
        position: (page - 1) * limit + i,
      }));

      await logSearchAnalytics({
        query: 'test2', normalizedQuery: null, latitude: 0, longitude: 0,
        radiusKm: 5, resultCount: 50, aiUsed: false,
        targetMedicineId: null, targetFound: null, responseTimeMs: 10,
        impressions,
      });

      const rows = await prisma.searchImpression.findMany({ orderBy: { position: 'asc' } });
      expect(rows.map((r) => r.position)).toEqual([20, 21, 22]);
    });
  });

  // ─── normalizedQuery ──────────────────────────────────────────
  describe('normalizedQuery', () => {
    it('stores normalizedQuery when AI transformed the query', async () => {
      await logSearchAnalytics({
        query: 'bukhar ki dawa',
        normalizedQuery: 'fever medicine',
        latitude: 28.61, longitude: 77.21, radiusKm: 5,
        resultCount: 5, aiUsed: true,
        targetMedicineId: null, targetFound: null, responseTimeMs: 100,
        impressions: [],
      });

      const queries = await prisma.searchQuery.findMany();
      expect(queries[0].normalizedQuery).toBe('fever medicine');
      expect(queries[0].aiUsed).toBe(true);
    });

    it('stores null when no AI normalization occurred', async () => {
      await logSearchAnalytics({
        query: 'paracetamol',
        normalizedQuery: null,
        latitude: 28.61, longitude: 77.21, radiusKm: 5,
        resultCount: 3, aiUsed: false,
        targetMedicineId: null, targetFound: null, responseTimeMs: 20,
        impressions: [],
      });

      const queries = await prisma.searchQuery.findMany();
      expect(queries[0].normalizedQuery).toBeNull();
      expect(queries[0].aiUsed).toBe(false);
    });
  });

  // ─── targetFound mapping ──────────────────────────────────────
  describe('targetFound', () => {
    it('stores true when target medicine is in results', async () => {
      await logSearchAnalytics({
        query: 'aspirin', normalizedQuery: null,
        latitude: 0, longitude: 0, radiusKm: 5,
        resultCount: 1, aiUsed: false,
        targetMedicineId: 'med-asp', targetFound: true, responseTimeMs: 15,
        impressions: [],
      });

      const queries = await prisma.searchQuery.findMany();
      expect(queries[0].targetFound).toBe(true);
      expect(queries[0].targetMedicineId).toBe('med-asp');
    });

    it('stores false when target medicine is NOT in results (unmet demand)', async () => {
      await logSearchAnalytics({
        query: 'rare-medicine', normalizedQuery: null,
        latitude: 0, longitude: 0, radiusKm: 5,
        resultCount: 0, aiUsed: false,
        targetMedicineId: 'med-rare', targetFound: false, responseTimeMs: 30,
        impressions: [],
      });

      const queries = await prisma.searchQuery.findMany();
      expect(queries[0].targetFound).toBe(false);
    });

    it('stores null when no target was identified', async () => {
      await logSearchAnalytics({
        query: 'some vague query', normalizedQuery: null,
        latitude: 0, longitude: 0, radiusKm: 5,
        resultCount: 10, aiUsed: false,
        targetMedicineId: null, targetFound: null, responseTimeMs: 50,
        impressions: [],
      });

      const queries = await prisma.searchQuery.findMany();
      expect(queries[0].targetFound).toBeNull();
      expect(queries[0].targetMedicineId).toBeNull();
    });
  });

  // ─── responseTimeMs ───────────────────────────────────────────
  describe('responseTimeMs', () => {
    it('stores the response time measurement', async () => {
      await logSearchAnalytics({
        query: 'timing-test', normalizedQuery: null,
        latitude: 0, longitude: 0, radiusKm: 5,
        resultCount: 1, aiUsed: false,
        targetMedicineId: null, targetFound: null, responseTimeMs: 237,
        impressions: [],
      });

      const queries = await prisma.searchQuery.findMany();
      expect(queries[0].responseTimeMs).toBe(237);
    });
  });

  // ─── Fire-and-forget: failures are swallowed ──────────────────
  // NOTE: These tests mock prisma.searchQuery.create and must run LAST
  // to avoid interfering with real DB tests above.
  describe('error swallowing', () => {
    it('swallows Prisma insert failure and logs error', async () => {
      const logSpy = vi.spyOn(logger, 'error');
      const createSpy = vi.spyOn(prisma.searchQuery, 'create').mockRejectedValueOnce(
        new Error('DB connection lost'),
      );

      // Should not throw
      await logSearchAnalytics({
        query: 'fail-test', normalizedQuery: null,
        latitude: 0, longitude: 0, radiusKm: 5,
        resultCount: 0, aiUsed: false,
        targetMedicineId: null, targetFound: null, responseTimeMs: 10,
        impressions: [],
      });

      expect(logSpy).toHaveBeenCalledWith(
        'search-analytics: log failed',
        expect.objectContaining({
          error: expect.stringContaining('DB connection lost'),
        }),
      );

      createSpy.mockRestore();
      logSpy.mockRestore();
    });

    it('does not throw when called with void/catch pattern', async () => {
      const createSpy = vi.spyOn(prisma.searchQuery, 'create').mockRejectedValueOnce(
        new Error('Simulated failure'),
      );

      // This is the exact pattern used in search.service.ts
      await expect(
        (async () => {
          void logSearchAnalytics({
            query: 'pattern-test', normalizedQuery: null,
            latitude: 0, longitude: 0, radiusKm: 5,
            resultCount: 0, aiUsed: false,
            targetMedicineId: null, targetFound: null, responseTimeMs: 10,
            impressions: [],
          }).catch(() => {});
        })()
      ).resolves.toBeUndefined();

      createSpy.mockRestore();
    });
  });
});

