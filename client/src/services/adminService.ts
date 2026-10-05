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
  getPharmacies(params: { status?: string; page?: number; limit?: number } = {}) {
    return api.get('/admin/pharmacies', { params });
  },

  /**
   * GET /admin/pharmacies/:id — Full pharmacy detail
   * @param {string} id
   */
  getPharmacyDetail(id: string) {
    return api.get(`/admin/pharmacies/${id}`);
  },

  /**
   * PATCH /admin/pharmacies/:id/status — Verify or reject pharmacy
   * @param {string} id
   * @param {{ status: string, rejectionReason?: string }} data
   */
  updatePharmacyStatus(id: string, data: { status: string; rejectionReason?: string }) {
    return api.patch(`/admin/pharmacies/${id}/status`, data);
  },

  // ── Analytics (Phase 10.8) ───────────────────────────────────

  getAnalyticsOverview() {
    return api.get('/admin/analytics/overview');
  },

  getSearchTrends(period: '7d' | '30d' = '7d') {
    return api.get('/admin/analytics/search-trends', { params: { period } });
  },

  getTopSearches(period: '7d' | '30d' = '7d', limit = 20) {
    return api.get('/admin/analytics/top-searches', { params: { period, limit } });
  },

  getDemandGaps(period: '7d' | '30d' = '30d', limit = 20) {
    return api.get('/admin/analytics/demand-gaps', { params: { period, limit } });
  },

  getPharmacyLeaderboard(limit = 20) {
    return api.get('/admin/analytics/pharmacy-leaderboard', { params: { limit } });
  },
};

export default adminService;
