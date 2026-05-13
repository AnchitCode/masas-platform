import api from './api';

/**
 * Service for interacting with the global medicine catalog
 */
const catalogService = {
  /**
   * Search for medicines by name or generic name
   * @param {string} query - The search term
   * @returns {Promise<{ success: boolean, message: string, data?: object }>} API envelope
   */
  searchMedicines: async (query) => {
    const response = await api.get(`/catalog/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },
};

export default catalogService;
