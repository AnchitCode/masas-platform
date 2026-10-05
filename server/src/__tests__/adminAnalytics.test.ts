import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma, createTestUser, createTestPharmacy } from './setup.js';

/**
 * Phase 10.5 — Admin Analytics API Tests
 *
 * Verifies:
 *   - Auth/authz: 401 without token, 403 without ADMIN role
 *   - Overview returns correct platform counts
 *   - Search trends aggregate by day
 *   - Top searches ranked by count
 *   - Demand gaps only include targetFound=false
 *   - Pharmacy leaderboard sorts by health score
 *   - Empty state: returns zeroed data
 */

const BASE = '/api/v1/admin/analytics';

describe('Admin Analytics API', () => {
  let adminToken: string;

  beforeEach(async () => {
    const { accessToken } = await createTestUser({ role: 'ADMIN' });
    adminToken = accessToken;
  });

  // ─── Auth & Authz ─────────────────────────────────────────────
  describe('authentication & authorization', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get(`${BASE}/overview`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-ADMIN role', async () => {
      const { accessToken: pharmaToken } = await createTestUser({
        role: 'PHARMACY',
        email: 'pharma-admin-test@test.com',
      });
      const res = await request(app)
        .get(`${BASE}/overview`)
        .set('Authorization', `Bearer ${pharmaToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ─── Overview ─────────────────────────────────────────────────
  describe('GET /overview', () => {
    it('returns zeroed platform data when empty', async () => {
      const res = await request(app)
        .get(`${BASE}/overview`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.platform.totalUsers).toBeGreaterThanOrEqual(1); // at least the admin
      expect(res.body.data.platform.totalSearches).toBe(0);
      expect(res.body.data.platform.searchesWithNoResults).toBe(0);
      expect(res.body.data.platform.alertsTriggered).toBe(0);
      expect(res.body.data.trends7d).toBeDefined();
    });

    it('counts match direct queries', async () => {
      // Seed some data
      await prisma.medicineCatalog.create({ data: { name: 'admin-test-med' } });
      await prisma.searchQuery.create({
        data: {
          query: 'test', latitude: 0, longitude: 0, radiusKm: 5,
          resultCount: 3, aiUsed: false, responseTimeMs: 10,
        },
      });
      await prisma.searchQuery.create({
        data: {
          query: 'empty', latitude: 0, longitude: 0, radiusKm: 5,
          resultCount: 0, aiUsed: true, responseTimeMs: 20,
        },
      });

      const res = await request(app)
        .get(`${BASE}/overview`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.platform.totalMedicines).toBe(1);
      expect(res.body.data.platform.totalSearches).toBe(2);
      expect(res.body.data.platform.searchesWithNoResults).toBe(1);
      expect(res.body.data.platform.avgResultCount).toBe(1.5); // (3+0)/2
    });
  });

  // ─── Search Trends ────────────────────────────────────────────
  describe('GET /search-trends', () => {
    it('returns empty trends with no searches', async () => {
      const res = await request(app)
        .get(`${BASE}/search-trends?period=7d`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.period).toBe('7d');
      expect(res.body.data.trends).toEqual([]);
    });

    it('aggregates searches by day', async () => {
      await prisma.searchQuery.create({
        data: {
          query: 'trend-test', latitude: 0, longitude: 0, radiusKm: 5,
          resultCount: 2, aiUsed: true, responseTimeMs: 15,
        },
      });

      const res = await request(app)
        .get(`${BASE}/search-trends?period=7d`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.trends).toHaveLength(1);
      expect(res.body.data.trends[0].totalSearches).toBe(1);
      expect(res.body.data.trends[0].aiSearches).toBe(1);
    });
  });

  // ─── Top Searches ─────────────────────────────────────────────
  describe('GET /top-searches', () => {
    it('returns top queries ranked by count', async () => {
      // Seed 3 searches for "paracetamol", 1 for "aspirin"
      for (let i = 0; i < 3; i++) {
        await prisma.searchQuery.create({
          data: {
            query: 'paracetamol', latitude: 0, longitude: 0, radiusKm: 5,
            resultCount: 5, aiUsed: false, responseTimeMs: 10,
          },
        });
      }
      await prisma.searchQuery.create({
        data: {
          query: 'aspirin', latitude: 0, longitude: 0, radiusKm: 5,
          resultCount: 2, aiUsed: false, responseTimeMs: 10,
        },
      });

      const res = await request(app)
        .get(`${BASE}/top-searches?period=7d&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.searches[0].query).toBe('paracetamol');
      expect(res.body.data.searches[0].searchCount).toBe(3);
      expect(res.body.data.searches[1].query).toBe('aspirin');
    });
  });

  // ─── Demand Gaps ──────────────────────────────────────────────
  describe('GET /demand-gaps', () => {
    it('returns empty when no demand gaps exist', async () => {
      const res = await request(app)
        .get(`${BASE}/demand-gaps?period=30d&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.gaps).toEqual([]);
    });

    it('only includes queries where targetFound=false', async () => {
      // Found target — should NOT appear in gaps
      await prisma.searchQuery.create({
        data: {
          query: 'paracetamol', latitude: 0, longitude: 0, radiusKm: 5,
          resultCount: 3, aiUsed: false, responseTimeMs: 10,
          targetMedicineId: 'med-1', targetFound: true,
        },
      });

      // Unmet demand — should appear in gaps
      await prisma.searchQuery.create({
        data: {
          query: 'insulin', latitude: 0, longitude: 0, radiusKm: 5,
          resultCount: 0, aiUsed: false, responseTimeMs: 20,
          targetMedicineId: 'med-2', targetFound: false,
        },
      });

      const res = await request(app)
        .get(`${BASE}/demand-gaps?period=30d&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.gaps).toHaveLength(1);
      expect(res.body.data.gaps[0].query).toBe('insulin');
      expect(res.body.data.gaps[0].notFoundCount).toBe(1);
      expect(res.body.data.gaps[0].gapRate).toBe(1); // 1/1
    });
  });

  // ─── Pharmacy Leaderboard ─────────────────────────────────────
  describe('GET /pharmacy-leaderboard', () => {
    it('returns empty when no snapshots exist', async () => {
      const res = await request(app)
        .get(`${BASE}/pharmacy-leaderboard?limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.leaderboard).toEqual([]);
    });

    it('returns pharmacies sorted by health score', async () => {
      // Create 2 pharmacies with daily snapshots
      const { user: u1 } = await createTestUser({ role: 'PHARMACY', email: 'lb1@test.com' });
      const p1 = await createTestPharmacy(u1.id, { status: 'VERIFIED', name: 'Top Pharmacy' });

      const { user: u2 } = await createTestUser({ role: 'PHARMACY', email: 'lb2@test.com' });
      const p2 = await createTestPharmacy(u2.id, { status: 'VERIFIED', name: 'Okay Pharmacy' });

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      yesterday.setUTCHours(0, 0, 0, 0);

      await prisma.pharmacyMetricsSnapshot.create({
        data: {
          pharmacyId: p1.id, period: 'daily', periodStart: yesterday,
          totalSkus: 50, inStockSkus: 48, outOfStockSkus: 2,
          lowStockSkus: 1, expiredSkus: 0, expiringSoonSkus: 0,
          totalQuantity: 5000, avgPrice: 100, healthScore: 95,
          searchImpressions: 100, alertsTriggered: 5,
        },
      });

      await prisma.pharmacyMetricsSnapshot.create({
        data: {
          pharmacyId: p2.id, period: 'daily', periodStart: yesterday,
          totalSkus: 20, inStockSkus: 15, outOfStockSkus: 5,
          lowStockSkus: 3, expiredSkus: 2, expiringSoonSkus: 1,
          totalQuantity: 1000, avgPrice: 50, healthScore: 60,
          searchImpressions: 30, alertsTriggered: 2,
        },
      });

      const res = await request(app)
        .get(`${BASE}/pharmacy-leaderboard?limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.leaderboard).toHaveLength(2);
      // Sorted by healthScore DESC
      expect(res.body.data.leaderboard[0].pharmacyName).toBe('Top Pharmacy');
      expect(res.body.data.leaderboard[0].healthScore).toBe(95);
      expect(res.body.data.leaderboard[0].healthTier).toBe('excellent');
      expect(res.body.data.leaderboard[1].pharmacyName).toBe('Okay Pharmacy');
      expect(res.body.data.leaderboard[1].healthScore).toBe(60);
      expect(res.body.data.leaderboard[1].healthTier).toBe('watch');
    });
  });
});
