import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

interface User {
  id: string;
  email: string;
  role: string;
  pharmacy?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (data: { email: string; password: string }) => Promise<unknown>;
  register: (data: { email: string; password: string; role?: string }) => Promise<unknown>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  const login = async (data: { email: string; password: string }) => {
    const response = await authService.login(data);
    setUser(response?.data?.user ?? null);
    return response;
  };

  const register = async (data: { email: string; password: string; role?: string }) => {
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

  const value: AuthContextType = {
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
