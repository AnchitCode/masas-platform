import api from './api';

/**
 * Auth service — wraps all authentication API calls.
 */
const authService = {
  /**
   * Register a new pharmacy user.
   * Does NOT store an access token (user must verify email first).
   */
  async register(data: { name: string; email: string; password: string }) {
    const response = await api.post('/auth/register', { ...data, role: 'PHARMACY' });
    // No token stored — user must verify email, then login
    return response.data;
  },

  /**
   * Login with email and password.
   */
  async login(data: { email: string; password: string; rememberMe?: boolean }) {
    const response = await api.post('/auth/login', data);
    const { accessToken } = response.data.data;
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
    }
    return response.data;
  },

  /**
   * Authenticate via Google ID token.
   */
  async googleAuth(idToken: string) {
    const response = await api.post('/auth/google', { idToken });
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

  /**
   * Request a password reset email.
   */
  async forgotPassword(email: string) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  /**
   * Reset password using a token.
   */
  async resetPassword(token: string, password: string) {
    const response = await api.post('/auth/reset-password', { token, password });
    // Clear any stale access token — user must login again
    localStorage.removeItem('accessToken');
    return response.data;
  },

  /**
   * Verify email using a token.
   */
  async verifyEmail(token: string) {
    const response = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    return response.data;
  },

  /**
   * Resend verification email.
   */
  async resendVerification(email: string) {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },
};

export default authService;
