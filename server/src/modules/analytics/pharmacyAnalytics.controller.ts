import type { Request, Response, NextFunction } from 'express';
import * as analyticsService from './pharmacyAnalytics.service.js';
import { trendsQuerySchema, searchVisibilityQuerySchema } from './pharmacyAnalytics.validation.js';
import { createSuccessResponse } from '../../utils/response.js';
import type { PharmacyRequest } from '../../types/index.js';

/**
 * Phase 10.4 — Pharmacy Analytics Controller
 *
 * All endpoints require auth → authorize('PHARMACY') → requireVerifiedPharmacy.
 * IDOR protection: queries use req.pharmacyId exclusively.
 */

// 1. GET /pharmacy/analytics/overview
const getOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pharmacyReq = req as PharmacyRequest;
    const data = await analyticsService.getOverview(pharmacyReq.pharmacyId);
    res.status(200).json(createSuccessResponse('Pharmacy analytics retrieved', data));
  } catch (error) {
    next(error);
  }
};

// 2. GET /pharmacy/analytics/trends?period=7d|30d|90d
const getTrends = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pharmacyReq = req as PharmacyRequest;
    const { period } = trendsQuerySchema.parse(req.query);
    const data = await analyticsService.getTrends(pharmacyReq.pharmacyId, period);
    res.status(200).json(createSuccessResponse('Trends retrieved', { period, snapshots: data }));
  } catch (error) {
    next(error);
  }
};

// 3. GET /pharmacy/analytics/search-visibility?period=7d|30d
const getSearchVisibility = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pharmacyReq = req as PharmacyRequest;
    const { period } = searchVisibilityQuerySchema.parse(req.query);
    const data = await analyticsService.getSearchVisibility(pharmacyReq.pharmacyId, period);
    res.status(200).json(createSuccessResponse('Search visibility retrieved', data));
  } catch (error) {
    next(error);
  }
};

// 4. GET /pharmacy/analytics/inventory-health
const getInventoryHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pharmacyReq = req as PharmacyRequest;
    const data = await analyticsService.getInventoryHealth(pharmacyReq.pharmacyId);
    res.status(200).json(createSuccessResponse('Inventory health retrieved', { items: data }));
  } catch (error) {
    next(error);
  }
};

// 5. GET /pharmacy/analytics/export?format=csv
const exportData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pharmacyReq = req as PharmacyRequest;
    const csv = await analyticsService.getInventoryExportCsv(pharmacyReq.pharmacyId);
    const filename = `pharmacy-inventory-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

export default {
  getOverview,
  getTrends,
  getSearchVisibility,
  getInventoryHealth,
  exportData,
};
