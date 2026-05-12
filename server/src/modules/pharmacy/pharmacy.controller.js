const pharmacyService = require('./pharmacy.service');
const ApiResponse = require('../../utils/apiResponse');

/**
 * Pharmacy controller — handles HTTP requests for pharmacy profiles.
 */
const pharmacyController = {
  /**
   * POST /api/v1/pharmacy/profile
   * Create pharmacy profile for the authenticated user.
   */
  async createProfile(req, res, next) {
    try {
      const pharmacy = await pharmacyService.createProfile(
        req.user.userId,
        req.body
      );

      return ApiResponse.success(res, 201, 'Pharmacy profile created successfully', {
        pharmacy,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/pharmacy/profile
   * Get the authenticated user's pharmacy profile.
   */
  async getOwnProfile(req, res, next) {
    try {
      const pharmacy = await pharmacyService.getOwnProfile(req.user.userId);

      return ApiResponse.success(res, 200, 'Pharmacy profile retrieved', {
        pharmacy,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/pharmacy/profile
   * Update the authenticated user's pharmacy profile.
   */
  async updateProfile(req, res, next) {
    try {
      const pharmacy = await pharmacyService.updateProfile(
        req.user.userId,
        req.body
      );

      return ApiResponse.success(res, 200, 'Pharmacy profile updated successfully', {
        pharmacy,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/pharmacy/:id
   * Get a pharmacy's public profile.
   */
  async getPublicProfile(req, res, next) {
    try {
      const pharmacy = await pharmacyService.getPublicProfile(req.params.id);

      return ApiResponse.success(res, 200, 'Pharmacy details retrieved', {
        pharmacy,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = pharmacyController;
