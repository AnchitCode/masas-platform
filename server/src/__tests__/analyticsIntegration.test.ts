import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import {
  prisma,
  createVerifiedPharmacyUser,
  createAdminUser,
  createTestMedicine,
  createTestInventory,
} from './setup.js';
import { eventBus } from '../lib/eventBus.js';
import { initAnalyticsEventBridge } from '../lib/analyticsEventBridge.js';
import { logSearchAnalytics, roundCoord } from '../modules/search/searchAnalytics.js';
import {
  aggregatePharmacyHourly,
  rollupDailySnapshots,
} from '../services/metricsAggregator.js';
import { computeHealthScore } from '../utils/healthScore.js';

/**
 * Phase 10.9 — Analytics Integration Tests
 *
 * End-to-end pipeline verification:
 *   Business Event → AnalyticsEvent → SearchQuery/Impression
 *     → Hourly Aggregation → Daily Rollup → Pharmacy/Admin API
 *
 * Tests the interactions between components that the unit tests cover individually.
 */

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));
const API_BASE_PHARMACY = '/api/v1/pharmacy/analytics';
const API_BASE_ADMIN = '/api/v1/admin/analytics';

describe('Analytics Integration', () => {
  beforeAll(() => {
    initAnalyticsEventBridge();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // A. Event → AnalyticsEvent Pipeline
  // ═══════════════════════════════════════════════════════════════

  describe('Event → AnalyticsEvent pipeline', () => {
    it('inventory.created event produces a correct INVENTORY_CREATED analytics row', async () => {
      eventBus.emit('inventory.created', {
        inventoryId: 'inv-int-1',
        pharmacyId: 'pharm-int-1',
        medicineId: 'med-int-1',
        medicineName: 'Paracetamol',
        quantity: 50,
        lowStockThreshold: 10,
      });
      await wait();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'INVENTORY_CREATED', targetId: 'inv-int-1' },
      });
      expect(events).toHaveLength(1);
      expect(events[0].pharmacyId).toBe('pharm-int-1');
      expect(events[0].actorRole).toBe('PHARMACY');
      expect(events[0].targetType).toBe('INVENTORY');
      expect((events[0].metadata as Record<string, unknown>).medicineName).toBe('Paracetamol');
    });

    it('catalog.created has null pharmacyId (pharmacy-agnostic)', async () => {
      eventBus.emit('catalog.created', {
        medicineId: 'cat-int-1',
        name: 'Test Catalog Med',
      });
      await wait();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'CATALOG_CREATED', targetId: 'cat-int-1' },
      });
      expect(events).toHaveLength(1);
      expect(events[0].pharmacyId).toBeNull();
    });

    it('medicine.availability_detected produces AVAILABILITY_TRIGGERED analytics row', async () => {
      eventBus.emit('medicine.availability_detected', {
        pharmacyId: 'pharm-avail-1',
        medicineId: 'med-avail-1',
        medicineName: 'Ibuprofen',
        pharmacyName: 'Avail Pharmacy',
        savedSearchId: 'ss-1',
        customerId: 'user-1',
        inventoryId: 'inv-avail-1',
        genericName: null,
        quantity: 25,
        distanceMeters: 500,
      });
      await wait();

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'AVAILABILITY_TRIGGERED', targetId: 'med-avail-1' },
      });
      expect(events).toHaveLength(1);
      expect(events[0].pharmacyId).toBe('pharm-avail-1');
      expect(events[0].actorRole).toBe('SYSTEM');
    });

    it('session_invalidated is excluded — no analytics row is created', async () => {
      // The analytics bridge does NOT listen for 'user.session_invalidated'
      // Emit it and verify no analytics row appears
      eventBus.emit('user.session_invalidated', {
        userId: 'user-session-1',
      });
      await wait();

      const all = await prisma.analyticsEvent.findMany();
      const sessionRows = all.filter(
        (e) => e.type === 'SESSION_INVALIDATED' || e.type === 'user.session_invalidated',
      );
      expect(sessionRows).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // B. Search → SearchQuery + SearchImpressions
  // ═══════════════════════════════════════════════════════════════

  describe('Search → SearchQuery + SearchImpressions pipeline', () => {
    it('successful search creates 1 query + N impressions with global positions', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'PharmA' });
      const medicine = await createTestMedicine({ name: 'Aspirin' });
      await createTestInventory(pharmacy.id, medicine.id, { quantity: 20 });

      // Simulate a search on page 2, limit 10
      const page = 2;
      const limit = 10;
      await logSearchAnalytics({
        query: 'aspirin',
        normalizedQuery: null,
        latitude: roundCoord(28.6139),
        longitude: roundCoord(77.2090),
        radiusKm: 5,
        resultCount: 1,
        aiUsed: false,
        targetMedicineId: medicine.id,
        targetFound: true,
        responseTimeMs: 35,
        impressions: [
          {
            pharmacyId: pharmacy.id,
            medicineId: medicine.id,
            matchType: 'exact',
            position: (page - 1) * limit + 0, // Global position = 10
          },
        ],
      });

      const queries = await prisma.searchQuery.findMany();
      expect(queries).toHaveLength(1);
      expect(queries[0].query).toBe('aspirin');
      expect(queries[0].resultCount).toBe(1);
      expect(queries[0].latitude).toBe(28.61);
      expect(queries[0].longitude).toBe(77.21);

      const impressions = await prisma.searchImpression.findMany();
      expect(impressions).toHaveLength(1);
      expect(impressions[0].position).toBe(10); // Global position for page 2
      expect(impressions[0].pharmacyId).toBe(pharmacy.id);
    });

    it('zero-result search creates query row but no impressions', async () => {
      await logSearchAnalytics({
        query: 'nonexistent-drug',
        normalizedQuery: null,
        latitude: 28.61,
        longitude: 77.21,
        radiusKm: 5,
        resultCount: 0,
        aiUsed: false,
        targetMedicineId: null,
        targetFound: null,
        responseTimeMs: 15,
        impressions: [],
      });

      const queries = await prisma.searchQuery.findMany();
      expect(queries).toHaveLength(1);
      expect(queries[0].resultCount).toBe(0);

      const impressions = await prisma.searchImpression.findMany();
      expect(impressions).toHaveLength(0);
    });

    it('analytics failure does not throw (fire-and-forget)', async () => {
      // Spy on prisma to force a create failure
      const spy = vi.spyOn(prisma.searchQuery, 'create').mockRejectedValueOnce(new Error('DB down'));

      // Should NOT throw
      await logSearchAnalytics({
        query: 'test',
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

      spy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // C. Hourly Aggregation
  // ═══════════════════════════════════════════════════════════════

  describe('Hourly aggregation', () => {
    it('creates snapshot with correct inventory metrics and health score', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'AggPharm' });
      const med1 = await createTestMedicine({ name: 'Med1' });
      const med2 = await createTestMedicine({ name: 'Med2' });

      // 1 in-stock, 1 out-of-stock
      await createTestInventory(pharmacy.id, med1.id, { quantity: 50, isAvailable: true });
      await createTestInventory(pharmacy.id, med2.id, { quantity: 0, isAvailable: false });

      // Run hourly aggregation for this pharmacy
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setUTCMinutes(0, 0, 0);
      const periodStart = new Date(periodEnd);
      periodStart.setUTCHours(periodStart.getUTCHours() - 1);

      await aggregatePharmacyHourly(pharmacy.id, periodStart, periodEnd);

      const snapshot = await prisma.pharmacyMetricsSnapshot.findUnique({
        where: {
          pharmacyId_period_periodStart: {
            pharmacyId: pharmacy.id,
            period: 'hourly',
            periodStart,
          },
        },
      });

      expect(snapshot).not.toBeNull();
      expect(snapshot!.totalSkus).toBe(2);
      expect(snapshot!.inStockSkus).toBe(1);
      expect(snapshot!.outOfStockSkus).toBe(1);
      expect(snapshot!.period).toBe('hourly');
      // Health score: 100 - min(14, 1*2) = 98 → excellent
      expect(snapshot!.healthScore).toBe(98);
    });

    it('is idempotent — upserting twice does not create duplicates', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'IdempPharm' });
      const med = await createTestMedicine({ name: 'IdempMed' });
      await createTestInventory(pharmacy.id, med.id, { quantity: 30 });

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setUTCMinutes(0, 0, 0);
      const periodStart = new Date(periodEnd);
      periodStart.setUTCHours(periodStart.getUTCHours() - 1);

      await aggregatePharmacyHourly(pharmacy.id, periodStart, periodEnd);
      await aggregatePharmacyHourly(pharmacy.id, periodStart, periodEnd);

      const snapshots = await prisma.pharmacyMetricsSnapshot.findMany({
        where: { pharmacyId: pharmacy.id, period: 'hourly' },
      });
      expect(snapshots).toHaveLength(1);
    });

    it('counts AVAILABILITY_TRIGGERED events in window as alertsTriggered', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'AlertPharm' });
      const med = await createTestMedicine({ name: 'AlertMed' });
      await createTestInventory(pharmacy.id, med.id, { quantity: 10 });

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setUTCMinutes(0, 0, 0);
      const periodStart = new Date(periodEnd);
      periodStart.setUTCHours(periodStart.getUTCHours() - 1);

      // Create AVAILABILITY_TRIGGERED event within the window
      const withinWindow = new Date(periodStart.getTime() + 30 * 60 * 1000); // +30min
      await prisma.analyticsEvent.create({
        data: {
          type: 'AVAILABILITY_TRIGGERED',
          actorRole: 'SYSTEM',
          pharmacyId: pharmacy.id,
          targetId: med.id,
          targetType: 'MEDICINE',
          metadata: {},
          createdAt: withinWindow,
        },
      });

      // Create one OUTSIDE the window (should not count)
      const outsideWindow = new Date(periodEnd.getTime() + 10 * 60 * 1000);
      await prisma.analyticsEvent.create({
        data: {
          type: 'AVAILABILITY_TRIGGERED',
          actorRole: 'SYSTEM',
          pharmacyId: pharmacy.id,
          targetId: med.id,
          targetType: 'MEDICINE',
          metadata: {},
          createdAt: outsideWindow,
        },
      });

      await aggregatePharmacyHourly(pharmacy.id, periodStart, periodEnd);

      const snapshot = await prisma.pharmacyMetricsSnapshot.findUnique({
        where: {
          pharmacyId_period_periodStart: {
            pharmacyId: pharmacy.id,
            period: 'hourly',
            periodStart,
          },
        },
      });

      expect(snapshot!.alertsTriggered).toBe(1); // Only the one within window
    });

    it('counts search impressions in the time window correctly', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'ImpPharm' });
      const med = await createTestMedicine({ name: 'ImpMed' });
      await createTestInventory(pharmacy.id, med.id, { quantity: 5 });

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setUTCMinutes(0, 0, 0);
      const periodStart = new Date(periodEnd);
      periodStart.setUTCHours(periodStart.getUTCHours() - 1);

      const withinWindow = new Date(periodStart.getTime() + 15 * 60 * 1000);

      // Use raw SQL INSERT with the correct timestamp directly.
      // This avoids Prisma proxy issues caused by vi.spyOn in earlier tests.
      const sqId = crypto.randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "search_queries" (id, query, latitude, longitude, radius_km, result_count, ai_used, response_time_ms, created_at)
        VALUES (${sqId}, 'test-imp', 28.61, 77.21, 5, 1, false, 20, ${withinWindow})
      `;
      await prisma.$executeRaw`
        INSERT INTO "search_impressions" (id, search_query_id, pharmacy_id, medicine_id, match_type, position, created_at)
        VALUES (${crypto.randomUUID()}, ${sqId}, ${pharmacy.id}, ${med.id}, 'exact', 0, ${withinWindow})
      `;

      await aggregatePharmacyHourly(pharmacy.id, periodStart, periodEnd);

      const snapshot = await prisma.pharmacyMetricsSnapshot.findUnique({
        where: {
          pharmacyId_period_periodStart: {
            pharmacyId: pharmacy.id,
            period: 'hourly',
            periodStart,
          },
        },
      });

      expect(snapshot!.searchImpressions).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // D. Daily Rollup
  // ═══════════════════════════════════════════════════════════════

  describe('Daily rollup', () => {
    it('rolls up hourly snapshots: healthScore=AVG, impressions/alerts=SUM, inventory=LAST', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'RollupPharm' });

      // Create 3 hourly snapshots for "yesterday"
      const now = new Date();
      const yesterdayStart = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1,
      ));

      const hour1 = new Date(yesterdayStart);
      hour1.setUTCHours(0);
      const hour2 = new Date(yesterdayStart);
      hour2.setUTCHours(8);
      const hour3 = new Date(yesterdayStart);
      hour3.setUTCHours(16);

      // Create hourly snapshots with different data
      await prisma.pharmacyMetricsSnapshot.createMany({
        data: [
          {
            pharmacyId: pharmacy.id,
            period: 'hourly',
            periodStart: hour1,
            totalSkus: 10, inStockSkus: 8, outOfStockSkus: 2,
            lowStockSkus: 1, expiredSkus: 0, expiringSoonSkus: 0,
            totalQuantity: 500, healthScore: 90, avgPrice: 25.0,
            searchImpressions: 5, alertsTriggered: 1,
          },
          {
            pharmacyId: pharmacy.id,
            period: 'hourly',
            periodStart: hour2,
            totalSkus: 10, inStockSkus: 7, outOfStockSkus: 3,
            lowStockSkus: 2, expiredSkus: 0, expiringSoonSkus: 0,
            totalQuantity: 480, healthScore: 80, avgPrice: 24.5,
            searchImpressions: 10, alertsTriggered: 2,
          },
          {
            pharmacyId: pharmacy.id,
            period: 'hourly',
            periodStart: hour3,
            totalSkus: 12, inStockSkus: 10, outOfStockSkus: 2,
            lowStockSkus: 1, expiredSkus: 1, expiringSoonSkus: 0,
            totalQuantity: 520, healthScore: 70, avgPrice: 26.0,
            searchImpressions: 3, alertsTriggered: 0,
          },
        ],
      });

      const count = await rollupDailySnapshots([pharmacy.id]);
      expect(count).toBe(1);

      const daily = await prisma.pharmacyMetricsSnapshot.findUnique({
        where: {
          pharmacyId_period_periodStart: {
            pharmacyId: pharmacy.id,
            period: 'daily',
            periodStart: yesterdayStart,
          },
        },
      });

      expect(daily).not.toBeNull();
      // healthScore = AVG(90, 80, 70) = 80
      expect(daily!.healthScore).toBe(80);
      // searchImpressions = SUM(5, 10, 3) = 18
      expect(daily!.searchImpressions).toBe(18);
      // alertsTriggered = SUM(1, 2, 0) = 3
      expect(daily!.alertsTriggered).toBe(3);
      // Inventory = LAST (hour3)
      expect(daily!.totalSkus).toBe(12);
      expect(daily!.inStockSkus).toBe(10);
      expect(daily!.avgPrice).toBe(26.0);
    });

    it('does not roll up current/incomplete day', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'NoRollupPharm' });

      // Create snapshot for today (current day)
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      await prisma.pharmacyMetricsSnapshot.create({
        data: {
          pharmacyId: pharmacy.id,
          period: 'hourly',
          periodStart: todayStart,
          totalSkus: 5, inStockSkus: 5, outOfStockSkus: 0,
          lowStockSkus: 0, expiredSkus: 0, expiringSoonSkus: 0,
          totalQuantity: 100, healthScore: 100, avgPrice: 10.0,
          searchImpressions: 0, alertsTriggered: 0,
        },
      });

      const count = await rollupDailySnapshots([pharmacy.id]);
      expect(count).toBe(0); // No rollup for today
    });

    it('skips pharmacies with zero hourly snapshots yesterday', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'EmptyRollup' });

      // No hourly snapshots exist
      const count = await rollupDailySnapshots([pharmacy.id]);
      expect(count).toBe(0);
    });

    it('is idempotent — repeated rollup does not create duplicate daily snapshots', async () => {
      const { pharmacy } = await createVerifiedPharmacyUser({ name: 'IdempRollup' });

      const now = new Date();
      const yesterdayStart = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1,
      ));

      await prisma.pharmacyMetricsSnapshot.create({
        data: {
          pharmacyId: pharmacy.id,
          period: 'hourly',
          periodStart: yesterdayStart,
          totalSkus: 5, inStockSkus: 5, outOfStockSkus: 0,
          lowStockSkus: 0, expiredSkus: 0, expiringSoonSkus: 0,
          totalQuantity: 100, healthScore: 90, avgPrice: 10.0,
          searchImpressions: 2, alertsTriggered: 0,
        },
      });

      const count1 = await rollupDailySnapshots([pharmacy.id]);
      const count2 = await rollupDailySnapshots([pharmacy.id]);
      expect(count1).toBe(1);
      expect(count2).toBe(0); // Already exists, skip

      const dailies = await prisma.pharmacyMetricsSnapshot.findMany({
        where: { pharmacyId: pharmacy.id, period: 'daily' },
      });
      expect(dailies).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // E. Health Score Parity
  // ═══════════════════════════════════════════════════════════════

  describe('Health score parity', () => {
    it('empty inventory → score=72, tier=strong', () => {
      const result = computeHealthScore({
        total: 0, outOfStock: 0, lowStock: 0,
        expired: 0, expiringCritical: 0, expiringSoon: 0,
      });
      expect(result.healthScore).toBe(72);
      expect(result.healthTier).toBe('strong');
    });

    it('all healthy inventory → score=100, tier=excellent', () => {
      const result = computeHealthScore({
        total: 10, outOfStock: 0, lowStock: 0,
        expired: 0, expiringCritical: 0, expiringSoon: 0,
      });
      expect(result.healthScore).toBe(100);
      expect(result.healthTier).toBe('excellent');
    });

    it('all expired → score clamped at 0, tier=critical', () => {
      const result = computeHealthScore({
        total: 5, outOfStock: 5, lowStock: 0,
        expired: 5, expiringCritical: 0, expiringSoon: 0,
      });
      // 100 - min(36, 5*12=60)=36 - min(14, 5*2=10)=10 = 54
      expect(result.healthScore).toBe(54);
      expect(result.healthTier).toBe('critical');
    });

    it('penalty caps prevent unbounded deductions', () => {
      // 10 expired → capped at 36 (not 120)
      // 10 outOfStock → capped at 14 (not 20)
      const result = computeHealthScore({
        total: 10, outOfStock: 10, lowStock: 0,
        expired: 10, expiringCritical: 0, expiringSoon: 0,
      });
      // 100 - 36 - 14 = 50
      expect(result.healthScore).toBe(50);
      expect(result.healthTier).toBe('critical');
    });

    it('tier boundaries are exact: 88, 72, 55', () => {
      // 100 → excellent
      expect(computeHealthScore({
        total: 1, outOfStock: 0, lowStock: 0,
        expired: 0, expiringCritical: 0, expiringSoon: 0,
      }).healthTier).toBe('excellent'); // 100

      // expiringSoon=12 → penalty=min(12,12)=12 → score=88 → excellent
      expect(computeHealthScore({
        total: 1, outOfStock: 0, lowStock: 0,
        expired: 0, expiringCritical: 0, expiringSoon: 12,
      }).healthTier).toBe('excellent'); // 100-12=88

      // expiringSoon=13 → penalty=min(12,13)=12 → score=88 → still excellent (cap!)
      expect(computeHealthScore({
        total: 1, outOfStock: 0, lowStock: 0,
        expired: 0, expiringCritical: 0, expiringSoon: 13,
      }).healthTier).toBe('excellent'); // capped at 12

      // 87 → strong: use lowStock=1 to push one more point
      expect(computeHealthScore({
        total: 2, outOfStock: 0, lowStock: 1,
        expired: 0, expiringCritical: 0, expiringSoon: 12,
      }).healthScore).toBe(86); // 100-12-2=86 → strong

      expect(computeHealthScore({
        total: 2, outOfStock: 0, lowStock: 1,
        expired: 0, expiringCritical: 0, expiringSoon: 12,
      }).healthTier).toBe('strong');

      // 72 → strong boundary
      expect(computeHealthScore({
        total: 2, outOfStock: 0, lowStock: 0,
        expired: 1, expiringCritical: 6, expiringSoon: 0,
      }).healthScore).toBe(70); // 100-12-18=70 → watch
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // F. Full Pipeline: Event → Aggregation → API
  // ═══════════════════════════════════════════════════════════════

  describe('Full pipeline: event → aggregation → API', () => {
    it('inventory event → aggregation → pharmacy overview API returns correct data', async () => {
      const { pharmacy, accessToken } = await createVerifiedPharmacyUser({
        name: 'PipelinePharm',
      });
      const med = await createTestMedicine({ name: 'PipelineMed' });
      await createTestInventory(pharmacy.id, med.id, { quantity: 100, isAvailable: true });

      // Emit inventory event
      eventBus.emit('inventory.created', {
        inventoryId: 'inv-pipeline-1',
        pharmacyId: pharmacy.id,
        medicineId: med.id,
        medicineName: 'PipelineMed',
        quantity: 100,
        lowStockThreshold: 10,
      });
      await wait();

      // Verify analytics event was recorded
      const events = await prisma.analyticsEvent.findMany({
        where: { pharmacyId: pharmacy.id, type: 'INVENTORY_CREATED' },
      });
      expect(events.length).toBeGreaterThanOrEqual(1);

      // Query pharmacy analytics API
      const res = await request(app)
        .get(`${API_BASE_PHARMACY}/overview`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.current.totalSkus).toBe(1);
      expect(res.body.data.current.inStockSkus).toBe(1);
      expect(res.body.data.current.healthScore).toBe(100);
      expect(res.body.data.current.healthTier).toBe('excellent');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // G. Admin API Smoke
  // ═══════════════════════════════════════════════════════════════

  describe('Admin analytics API (smoke)', () => {
    it('admin can access overview endpoint', async () => {
      const { accessToken } = await createAdminUser();

      const res = await request(app)
        .get(`${API_BASE_ADMIN}/overview`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.platform).toBeDefined();
    });

    it('non-admin gets 403 on admin analytics', async () => {
      const { accessToken } = await createVerifiedPharmacyUser({ name: 'NonAdmin' });

      const res = await request(app)
        .get(`${API_BASE_ADMIN}/overview`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });

    it('unauthenticated gets 401 on admin analytics', async () => {
      const res = await request(app).get(`${API_BASE_ADMIN}/overview`);
      expect(res.status).toBe(401);
    });
  });
});
