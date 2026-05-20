const adminService = require('./admin.service');
const ApiResponse = require('../../utils/apiResponse');

/**
 * Admin controller — handles HTTP requests for admin operations.
 * Each method wraps the service call and sends a standardized response.
 */
const adminController = {
  /**
   * GET /api/v1/admin/stats
   * Platform-wide statistics.
   */
  async getStats(req, res, next) {
    try {
      const stats = await adminService.getStats();
      return ApiResponse.success(res, 200, 'Platform statistics retrieved', { stats });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/pharmacies
   * Paginated pharmacy list with optional status filter.
   */
  async listPharmacies(req, res, next) {
    try {
      const result = await adminService.listPharmacies(req.query);
      return ApiResponse.success(res, 200, 'Pharmacies retrieved', result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/pharmacies/:id
   * Full pharmacy detail for admin review.
   */
  async getPharmacyDetail(req, res, next) {
    try {
      const pharmacy = await adminService.getPharmacyDetail(req.params.id);
      return ApiResponse.success(res, 200, 'Pharmacy detail retrieved', { pharmacy });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/pharmacies/:id/status
   * Update pharmacy verification status (verify or reject).
   */
  async updatePharmacyStatus(req, res, next) {
    try {
      const pharmacy = await adminService.updatePharmacyStatus(
        req.params.id,
        req.body
      );
      return ApiResponse.success(res, 200, 'Pharmacy status updated', { pharmacy });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = adminController;
