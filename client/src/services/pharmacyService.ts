import api from './api';

/**
 * Pharmacy service — wraps all pharmacy API calls.
 */
const pharmacyService = {
  /**
   * Create pharmacy profile.
   */
  async createProfile(data: Record<string, unknown>) {
    const response = await api.post('/pharmacy/profile', data);
    return response.data;
  },

  /**
   * Get own pharmacy profile.
   */
  async getOwnProfile() {
    const response = await api.get('/pharmacy/profile');
    return response.data;
  },

  /**
   * Update own pharmacy profile.
   */
  async updateProfile(data: Record<string, unknown>) {
    const response = await api.put('/pharmacy/profile', data);
    return response.data;
  },

  /**
   * Get a pharmacy's public profile by ID.
   */
  async getPublicProfile(pharmacyId: string) {
    const response = await api.get(`/pharmacy/${pharmacyId}`);
    return response.data;
  },
};

export default pharmacyService;
