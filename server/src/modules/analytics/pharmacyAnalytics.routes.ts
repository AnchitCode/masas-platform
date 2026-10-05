import { Router } from 'express';
import pharmacyAnalyticsController from './pharmacyAnalytics.controller.js';
import auth from '../../middleware/auth.js';
import authorize from '../../middleware/authorize.js';
import { requireVerifiedPharmacy } from '../../middleware/pharmacy.js';

/**
 * Phase 10.4 — Pharmacy Analytics Routes
 *
 * Authorization chain: auth → authorize('PHARMACY') → requireVerifiedPharmacy
 * All endpoints are scoped to the authenticated pharmacy via req.pharmacyId.
 *
 * Mounted at: /api/v1/pharmacy/analytics
 */

const router = Router();

// Apply auth chain to all analytics routes
router.use(auth, authorize('PHARMACY'), requireVerifiedPharmacy);

// 1. Overview — current metrics + 7d trend deltas + sparklines
router.get('/overview', pharmacyAnalyticsController.getOverview);

// 2. Trends — time-series daily snapshots
router.get('/trends', pharmacyAnalyticsController.getTrends);

// 3. Search visibility — impressions, top queries, daily breakdown
router.get('/search-visibility', pharmacyAnalyticsController.getSearchVisibility);

// 4. Inventory health — per-medicine breakdown
router.get('/inventory-health', pharmacyAnalyticsController.getInventoryHealth);

// 5. Export — CSV download
router.get('/export', pharmacyAnalyticsController.exportData);

export default router;
