import api from './api';

/**
 * Public medicine availability search (no auth required).
 */
const searchService = {
  /**
   * @param {object} params
   * @param {string} params.q
   * @param {number} params.lat
   * @param {number} params.lng
   * @param {number} [params.radiusKm]
   * @param {number} [params.page]
   * @param {number} [params.limit]
   * @returns {Promise<{ success: boolean, message: string, data?: object }>}
   */
  searchInventory: async ({ q, lat, lng, radiusKm, page, limit }: { q: string; lat: number; lng: number; radiusKm?: number; page?: number; limit?: number }, options: { signal?: AbortSignal } = {}) => {
    const searchParams = new URLSearchParams();
    searchParams.set('q', q);
    searchParams.set('lat', String(lat));
    searchParams.set('lng', String(lng));
    if (radiusKm != null) searchParams.set('radiusKm', String(radiusKm));
    if (page != null) searchParams.set('page', String(page));
    if (limit != null) searchParams.set('limit', String(limit));

    const response = await api.get(`/search/inventory?${searchParams.toString()}`, {
      signal: options.signal,
    });
    return response.data;
  },
};

export default searchService;
