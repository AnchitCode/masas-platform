import api from './api';
import type { ApiResponse } from '../types/index';

export interface SavedSearch {
  id: string;
  userId: string;
  query: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateSavedSearchInput {
  query: string;
  latitude: number;
  longitude: number;
  radiusKm?: number;
  isActive?: boolean;
}

export interface UpdateSavedSearchInput {
  query?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  isActive?: boolean;
}

const savedSearchService = {
  /**
   * Create a new saved search
   */
  async create(data: CreateSavedSearchInput): Promise<ApiResponse<SavedSearch>> {
    const response = await api.post<ApiResponse<SavedSearch>>('/saved-searches', data);
    return response.data;
  },

  /**
   * List all saved searches for the authenticated user
   */
  async list(): Promise<ApiResponse<SavedSearch[]>> {
    const response = await api.get<ApiResponse<SavedSearch[]>>('/saved-searches');
    return response.data;
  },

  /**
   * Get a specific saved search
   */
  async get(id: string): Promise<ApiResponse<SavedSearch>> {
    const response = await api.get<ApiResponse<SavedSearch>>(`/saved-searches/${id}`);
    return response.data;
  },

  /**
   * Update a saved search
   */
  async update(id: string, data: UpdateSavedSearchInput): Promise<ApiResponse<SavedSearch>> {
    const response = await api.patch<ApiResponse<SavedSearch>>(`/saved-searches/${id}`, data);
    return response.data;
  },

  /**
   * Delete a saved search
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const response = await api.delete<ApiResponse<void>>(`/saved-searches/${id}`);
    return response.data;
  },
};

export default savedSearchService;
