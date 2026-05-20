import api from './api';

/**
 * Admin API service — centralizes all admin-related API calls.
 */
const adminService = {
  /**
   * GET /admin/stats — Platform-wide statistics
   */
  getStats() {
    return api.get('/admin/stats');
  },

  /**
   * GET /admin/pharmacies — Paginated pharmacy list
   * @param {{ status?: string, page?: number, limit?: number }} params
   */
  getPharmacies(params = {}) {
    return api.get('/admin/pharmacies', { params });
  },

  /**
   * GET /admin/pharmacies/:id — Full pharmacy detail
   * @param {string} id
   */
  getPharmacyDetail(id) {
    return api.get(`/admin/pharmacies/${id}`);
  },

  /**
   * PATCH /admin/pharmacies/:id/status — Verify or reject pharmacy
   * @param {string} id
   * @param {{ status: string, rejectionReason?: string }} data
   */
  updatePharmacyStatus(id, data) {
    return api.patch(`/admin/pharmacies/${id}/status`, data);
  },
};

export default adminService;
