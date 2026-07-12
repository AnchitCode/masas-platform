export const APP_NAME = import.meta.env.VITE_APP_NAME || 'MASAS';
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const PHARMACY_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
};

export const USER_ROLES = {
  PHARMACY: 'PHARMACY',
  ADMIN: 'ADMIN',
};

export const ROUTES = {
  HOME: '/',
  SEARCH: '/search',
  LOGIN: '/login',
  REGISTER: '/register',
  ACCOUNT_CREATED: '/account-created',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  PHARMACY_PUBLIC: '/pharmacy/:id',
  DASHBOARD: '/dashboard',
  DASHBOARD_INVENTORY: '/dashboard/inventory',
  DASHBOARD_PROFILE: '/dashboard/profile',
  ADMIN: '/admin',
  ADMIN_PHARMACIES: '/admin/pharmacies',
};
