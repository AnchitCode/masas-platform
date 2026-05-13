import api from './api';

/**
 * Service for managing a pharmacy's specific inventory
 */
const inventoryService = {
  /**
   * Get all inventory items for the logged-in pharmacy
   * @returns {Promise<{ success: boolean, message: string, data?: object }>} API envelope
   */
  getInventory: async () => {
    const response = await api.get('/inventory');
    return response.data;
  },

  /**
   * Add a new medicine to the inventory
   * @param {Object} data - Inventory data (medicineName, price, quantity, etc.)
   * @returns {Promise<{ success: boolean, message: string, data?: object }>} API envelope
   */
  addMedicine: async (data) => {
    const response = await api.post('/inventory', data);
    return response.data;
  },

  /**
   * Update an existing inventory item
   * @param {string} id - Inventory item ID
   * @param {Object} data - Updated fields (price, quantity, isAvailable, etc.)
   * @returns {Promise<{ success: boolean, message: string, data?: object }>} API envelope
   */
  updateMedicine: async (id, data) => {
    const response = await api.patch(`/inventory/${id}`, data);
    return response.data;
  },

  /**
   * Delete an inventory item
   * @param {string} id - Inventory item ID
   * @returns {Promise<{ success: boolean, message: string, data?: object }>} API envelope
   */
  deleteMedicine: async (id) => {
    const response = await api.delete(`/inventory/${id}`);
    return response.data;
  },
};

export default inventoryService;
