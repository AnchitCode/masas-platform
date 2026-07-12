import type { Request, Response, NextFunction } from 'express';

// ─── Re-export Prisma enums ──────────────────────────────────────
// After `npx prisma generate`, these are available from @prisma/client.
// We re-export them so the rest of the codebase imports from one place.
export { UserRole, PharmacyStatus } from '@prisma/client';

// ─── JWT Payload ─────────────────────────────────────────────────

export interface AccessTokenPayload {
  userId: string;
  role: 'PHARMACY' | 'ADMIN';
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

// ─── Extended Express Request ────────────────────────────────────

/**
 * Express request after the `auth` middleware has verified the JWT
 * and attached `req.user`.
 */
export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: 'PHARMACY' | 'ADMIN';
  };
}

/**
 * Express request after `requireVerifiedPharmacy` middleware
 * has attached `req.pharmacyId`.
 */
export interface PharmacyRequest extends AuthenticatedRequest {
  pharmacyId: string;
}

// ─── API Response Envelopes ──────────────────────────────────────

export interface ApiSuccessResponseBody<T = unknown> {
  success: true;
  message: string;
  data?: T;
}

export interface ApiErrorResponseBody {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }> | null;
}

// ─── Pagination ──────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Environment Config ──────────────────────────────────────────

export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRY: string;
  JWT_REFRESH_EXPIRY: string;
  CLIENT_URL: string;
  GOOGLE_CLIENT_ID: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX: number;
  isDev: boolean;
  isProd: boolean;
}

// ─── Logger ──────────────────────────────────────────────────────

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

// ─── Controller / Middleware helpers ─────────────────────────────

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void | Response>;

export type AsyncAuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => Promise<void | Response>;

export type AsyncPharmacyHandler = (
  req: PharmacyRequest,
  res: Response,
  next: NextFunction,
) => Promise<void | Response>;
