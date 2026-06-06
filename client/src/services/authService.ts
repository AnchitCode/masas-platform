import api from './api';

/**
 * Auth service — wraps all authentication API calls.
 */
const authService = {
  /**
   * Register a new user.
   * @param {{ email: string, password: string, role?: string }} data
   */
  async register(data: { email: string; password: string; role?: string }) {
    const response = await api.post('/auth/register', data);
    const { accessToken } = response.data.data;
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
    }
    return response.data;
  },

  /**
   * Login with email and password.
   * @param {{ email: string, password: string }} data
   */
  async login(data: { email: string; password: string }) {
    const response = await api.post('/auth/login', data);
    const { accessToken } = response.data.data;
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
    }
    return response.data;
  },

  /**
   * Get current authenticated user profile.
   */
  async getMe() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Refresh access token.
   */
  async refresh() {
    const response = await api.post('/auth/refresh');
    const { accessToken } = response.data.data;
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
    }
    return response.data;
  },

  /**
   * Logout — clears token and cookie.
   */
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem('accessToken');
  },
};

export default authService;
