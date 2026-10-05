import type { Request, Response, NextFunction } from 'express';
import * as adminAnalyticsService from './adminAnalytics.service.js';
import {
  searchTrendsQuerySchema,
  topSearchesQuerySchema,
  demandGapsQuerySchema,
  leaderboardQuerySchema,
} from './adminAnalytics.validation.js';
import { createSuccessResponse } from '../../utils/response.js';

/**
 * Phase 10.5 — Admin Analytics Controller
 *
 * All endpoints require auth → authorize('ADMIN') (applied at router level).
 */

// 1. GET /admin/analytics/overview
const getOverview = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adminAnalyticsService.getOverview();
    res.status(200).json(createSuccessResponse('Platform analytics retrieved', data));
  } catch (error) {
    next(error);
  }
};

// 2. GET /admin/analytics/search-trends?period=7d|30d
const getSearchTrends = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period } = searchTrendsQuerySchema.parse(req.query);
    const data = await adminAnalyticsService.getSearchTrends(period);
    res.status(200).json(createSuccessResponse('Search trends retrieved', data));
  } catch (error) {
    next(error);
  }
};

// 3. GET /admin/analytics/top-searches?period=7d|30d&limit=20
const getTopSearches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, limit } = topSearchesQuerySchema.parse(req.query);
    const data = await adminAnalyticsService.getTopSearches(period, limit);
    res.status(200).json(createSuccessResponse('Top searches retrieved', { period, searches: data }));
  } catch (error) {
    next(error);
  }
};

// 4. GET /admin/analytics/demand-gaps?period=30d&limit=20
const getDemandGaps = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, limit } = demandGapsQuerySchema.parse(req.query);
    const data = await adminAnalyticsService.getDemandGaps(period, limit);
    res.status(200).json(createSuccessResponse('Demand gaps retrieved', { period, gaps: data }));
  } catch (error) {
    next(error);
  }
};

// 5. GET /admin/analytics/pharmacy-leaderboard?limit=20
const getPharmacyLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = leaderboardQuerySchema.parse(req.query);
    const data = await adminAnalyticsService.getPharmacyLeaderboard(limit);
    res.status(200).json(createSuccessResponse('Pharmacy leaderboard retrieved', { leaderboard: data }));
  } catch (error) {
    next(error);
  }
};

export default {
  getOverview,
  getSearchTrends,
  getTopSearches,
  getDemandGaps,
  getPharmacyLeaderboard,
};
