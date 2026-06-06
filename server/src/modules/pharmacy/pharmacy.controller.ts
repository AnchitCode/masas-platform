import type { Request, Response, NextFunction } from 'express';
import pharmacyService from './pharmacy.service.js';
import ApiResponse from '../../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../../types/index.js';

/**
 * Pharmacy controller — handles HTTP requests for pharmacy profiles.
 */
const pharmacyController = {
  /**
   * POST /api/v1/pharmacy/profile
   */
  async createProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const pharmacy = await pharmacyService.createProfile(authReq.user.userId, req.body);
      return ApiResponse.success(res, 201, 'Pharmacy profile created successfully', { pharmacy });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/pharmacy/profile
   */
  async getOwnProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const pharmacy = await pharmacyService.getOwnProfile(authReq.user.userId);
      return ApiResponse.success(res, 200, 'Pharmacy profile retrieved', { pharmacy });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/pharmacy/profile
   */
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const pharmacy = await pharmacyService.updateProfile(authReq.user.userId, req.body);
      return ApiResponse.success(res, 200, 'Pharmacy profile updated successfully', { pharmacy });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/pharmacy/:id
   */
  async getPublicProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const pharmacy = await pharmacyService.getPublicProfile(req.params.id as string);
      return ApiResponse.success(res, 200, 'Pharmacy details retrieved', { pharmacy });
    } catch (error) {
      next(error);
    }
  },
};

export default pharmacyController;
