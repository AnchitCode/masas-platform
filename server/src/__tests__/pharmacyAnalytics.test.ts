import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma, createTestUser, createTestPharmacy } from './setup.js';

/**
 * Phase 10.4 — Pharmacy Analytics API Tests
 *
 * Verifies:
 *   - Auth/authz: 401 without token, 403 without PHARMACY role
 *   - IDOR: pharmacy A cannot access pharmacy B's analytics
 *   - Overview returns correct current metrics from live inventory
 *   - Trends return daily snapshot data
 *   - Search visibility aggregates from search_impressions
 *   - Inventory health returns per-medicine breakdown
 *   - CSV export produces valid CSV with correct headers
 *   - Empty state: returns zeroed data, not 404
 */

const BASE = '/api/v1/pharmacy/analytics';

describe('Pharmacy Analytics API', () => {
  let accessToken: string;
  let pharmacyId: string;

  beforeEach(async () => {
    // Create a verified pharmacy owner
    const { user, accessToken: token } = await createTestUser({ role: 'PHARMACY' });
    accessToken = token;
    const pharmacy = await createTestPharmacy(user.id, { status: 'VERIFIED' });
    pharmacyId = pharmacy.id;
  });

  // ─── Auth & Authz ─────────────────────────────────────────────
  describe('authentication & authorization', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get(`${BASE}/overview`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-PHARMACY role', async () => {
      const { accessToken: customerToken } = await createTestUser({
        role: 'CUSTOMER',
        email: 'customer@test.com',
      });
      const res = await request(app)
        .get(`${BASE}/overview`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 for unverified pharmacy', async () => {
      const { user: pendingUser, accessToken: pendingToken } = await createTestUser({
        role: 'PHARMACY',
        email: 'pending@test.com',
      });
      await createTestPharmacy(pendingUser.id, { status: 'PENDING' });

      const res = await request(app)
        .get(`${BASE}/overview`)
        .set('Authorization', `Bearer ${pendingToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ─── Overview ─────────────────────────────────────────────────
  describe('GET /overview', () => {
    it('returns zeroed data for a pharmacy with no inventory or snapshots', async () => {
      const res = await request(app)
        .get(`${BASE}/overview`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.current.totalSkus).toBe(0);
      expect(res.body.data.current.healthScore).toBe(72);
      expect(res.body.data.current.healthTier).toBe('strong');
      expect(res.body.data.current.searchImpressions).toBe(0);
      expect(res.body.data.trends.period).toBe('7d');
      expect(res.body.data.sparklines.healthScore).toEqual([]);
    });

    it('returns correct metrics when inventory exists', async () => {
      const medicine = await prisma.medicineCatalog.create({
        data: { name: 'test-analytics-med' },
      });
      await prisma.pharmacyInventory.create({
        data: {
          pharmacyId,
          medicineId: medicine.id,
          price: 100.0,
          quantity: 50,
          isAvailable: true,
          expiryDate: new Date(Date.now() + 365 * 86400000),
        },
      });

      const res = await request(app)
        .get(`${BASE}/overview`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.current.totalSkus).toBe(1);
      expect(res.body.data.current.inStockSkus).toBe(1);
      expect(res.body.data.current.outOfStockSkus).toBe(0);
      expect(res.body.data.current.healthScore).toBe(100);
      expect(res.body.data.current.avgPrice).toBe(100.0);
    });
  });

  // ─── Trends ───────────────────────────────────────────────────
  describe('GET /trends', () => {
    it('returns empty array when no daily snapshots exist', async () => {
      const res = await request(app)
        .get(`${BASE}/trends?period=7d`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.period).toBe('7d');
      expect(res.body.data.snapshots).toEqual([]);
    });

    it('returns daily snapshots for the requested period', async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      yesterday.setUTCHours(0, 0, 0, 0);

      await prisma.pharmacyMetricsSnapshot.create({
        data: {
          pharmacyId,
          period: 'daily',
          periodStart: yesterday,
          totalSkus: 10,
          inStockSkus: 8,
          outOfStockSkus: 2,
          lowStockSkus: 1,
          expiredSkus: 0,
          expiringSoonSkus: 0,
          totalQuantity: 500,
          avgPrice: 75.0,
          healthScore: 85,
          searchImpressions: 30,
          alertsTriggered: 5,
        },
      });

      const res = await request(app)
        .get(`${BASE}/trends?period=7d`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.snapshots).toHaveLength(1);
      expect(res.body.data.snapshots[0].healthScore).toBe(85);
    });
  });

  // ─── Search Visibility ────────────────────────────────────────
  describe('GET /search-visibility', () => {
    it('returns zeroed data with no impressions', async () => {
      const res = await request(app)
        .get(`${BASE}/search-visibility?period=7d`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalImpressions).toBe(0);
      expect(res.body.data.topQueries).toEqual([]);
      expect(res.body.data.dailyImpressions).toEqual([]);
    });

    it('returns aggregated search data when impressions exist', async () => {
      // Create search queries + impressions
      const sq = await prisma.searchQuery.create({
        data: {
          query: 'paracetamol',
          latitude: 28.61,
          longitude: 77.21,
          radiusKm: 5,
          resultCount: 3,
          aiUsed: false,
          responseTimeMs: 50,
        },
      });

      await prisma.searchImpression.createMany({
        data: [
          { searchQueryId: sq.id, pharmacyId, medicineId: 'med1', matchType: 'exact', position: 0 },
          { searchQueryId: sq.id, pharmacyId, medicineId: 'med2', matchType: 'exact', position: 1 },
        ],
      });

      const res = await request(app)
        .get(`${BASE}/search-visibility?period=7d`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalImpressions).toBe(2);
      expect(res.body.data.topQueries).toHaveLength(1);
      expect(res.body.data.topQueries[0].query).toBe('paracetamol');
      expect(res.body.data.topQueries[0].impressions).toBe(2);
    });
  });

  // ─── Inventory Health ─────────────────────────────────────────
  describe('GET /inventory-health', () => {
    it('returns empty array for pharmacy with no inventory', async () => {
      const res = await request(app)
        .get(`${BASE}/inventory-health`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
    });

    it('returns per-medicine breakdown with correct status', async () => {
      const medicine = await prisma.medicineCatalog.create({
        data: { name: 'aspirin', genericName: 'acetylsalicylic acid' },
      });

      await prisma.pharmacyInventory.create({
        data: {
          pharmacyId,
          medicineId: medicine.id,
          price: 25.0,
          quantity: 5,
          isAvailable: true,
          lowStockThreshold: 10,
        },
      });

      const res = await request(app)
        .get(`${BASE}/inventory-health`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].medicineName).toBe('aspirin');
      expect(res.body.data.items[0].stockStatus).toBe('low_stock');
    });
  });

  // ─── CSV Export ───────────────────────────────────────────────
  describe('GET /export', () => {
    it('returns valid CSV with correct headers', async () => {
      const medicine = await prisma.medicineCatalog.create({
        data: { name: 'ibuprofen' },
      });

      await prisma.pharmacyInventory.create({
        data: {
          pharmacyId,
          medicineId: medicine.id,
          price: 30.0,
          quantity: 100,
          isAvailable: true,
        },
      });

      const res = await request(app)
        .get(`${BASE}/export?format=csv`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('.csv');

      const lines = res.text.split('\n');
      expect(lines[0]).toBe('Medicine Name,Generic Name,Quantity,Price,Available,Expiry Date,Stock Status,Expiry Status,Last Updated');
      expect(lines.length).toBe(2); // header + 1 data row
      expect(lines[1]).toContain('ibuprofen');
    });

    it('returns CSV with only headers when no inventory', async () => {
      const res = await request(app)
        .get(`${BASE}/export?format=csv`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const lines = res.text.split('\n');
      expect(lines).toHaveLength(1); // header only
    });
  });

  // ─── IDOR Protection ──────────────────────────────────────────
  describe('IDOR protection', () => {
    it('pharmacy A cannot see pharmacy B search impressions', async () => {
      // Create pharmacy B with search impressions
      const { user: userB } = await createTestUser({ role: 'PHARMACY', email: 'pharmaB@test.com' });
      const pharmacyB = await createTestPharmacy(userB.id, { status: 'VERIFIED' });

      const sq = await prisma.searchQuery.create({
        data: {
          query: 'secret-medicine',
          latitude: 0,
          longitude: 0,
          radiusKm: 5,
          resultCount: 1,
          aiUsed: false,
          responseTimeMs: 10,
        },
      });
      await prisma.searchImpression.create({
        data: { searchQueryId: sq.id, pharmacyId: pharmacyB.id, medicineId: 'med-x', matchType: 'exact', position: 0 },
      });

      // Pharmacy A queries search visibility — should NOT see pharmacy B's data
      const res = await request(app)
        .get(`${BASE}/search-visibility?period=7d`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalImpressions).toBe(0);
      expect(res.body.data.topQueries).toEqual([]);
    });
  });
});
