import type { Request, Response, NextFunction } from 'express';
import adminService from './admin.service.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Admin controller — handles HTTP requests for admin operations.
 */
const adminController = {
  /**
   * GET /api/v1/admin/stats
   */
  async getStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getStats();
      return ApiResponse.success(res, 200, 'Platform statistics retrieved', { stats });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/pharmacies
   */
  async listPharmacies(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.listPharmacies(req.query as unknown as Parameters<typeof adminService.listPharmacies>[0]);
      return ApiResponse.success(res, 200, 'Pharmacies retrieved', result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/pharmacies/:id
   */
  async getPharmacyDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const pharmacy = await adminService.getPharmacyDetail(req.params.id as string);
      return ApiResponse.success(res, 200, 'Pharmacy detail retrieved', { pharmacy });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/pharmacies/:id/status
   */
  async updatePharmacyStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const pharmacy = await adminService.updatePharmacyStatus(req.params.id as string, req.body);
      return ApiResponse.success(res, 200, 'Pharmacy status updated', { pharmacy });
    } catch (error) {
      next(error);
    }
  },
};

export default adminController;
