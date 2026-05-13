import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

// eslint-disable-next-line react-refresh/only-export-components
const AuthContext = createContext(null);

/**
 * Auth provider — manages authentication state across the app.
 * Provides: user, loading, login, register, logout, refreshUser
 */
// eslint-disable-next-line react-refresh/only-export-components
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is already authenticated on mount
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await authService.getMe();
      setUser(response?.data?.user ?? null);
    } catch {
      // Token is invalid or expired — clear it
      localStorage.removeItem('accessToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAuth();
  }, [checkAuth]);

  const login = async (data) => {
    const response = await authService.login(data);
    setUser(response?.data?.user ?? null);
    return response;
  };

  const register = async (data) => {
    const response = await authService.register(data);
    setUser(response?.data?.user ?? null);
    return response;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const response = await authService.getMe();
      setUser(response?.data?.user ?? null);
    } catch {
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context.
 * Must be used within an AuthProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export default AuthContext;
