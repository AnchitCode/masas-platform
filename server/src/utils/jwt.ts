import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import env from '../config/env.js';
import type { AccessTokenPayload, RefreshTokenPayload } from '../types/index.js';

import crypto from 'crypto';

/**
 * JWT utility helpers for token generation and verification.
 */

/**
 * Generate an access token (short-lived).
 */
const generateAccessToken = (payload: AccessTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRY as string & jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload as object, env.JWT_ACCESS_SECRET, options);
};

/**
 * Generate a refresh token (long-lived).
 * Includes a random `jti` (JWT ID) to guarantee each token is unique,
 * even when generated with the same payload in the same second.
 * @param payload - Must include userId and tokenVersion
 * @param expiresIn - Override expiry (e.g. '30d' for remember-me). Defaults to env config.
 */
const generateRefreshToken = (
  payload: RefreshTokenPayload,
  expiresIn?: string,
): string => {
  const options: SignOptions = {
    expiresIn: (expiresIn || env.JWT_REFRESH_EXPIRY) as string & jwt.SignOptions['expiresIn'],
    jwtid: crypto.randomUUID(),
  };
  return jwt.sign(payload as object, env.JWT_REFRESH_SECRET, options);
};

/**
 * Verify an access token.
 */
const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
};

/**
 * Verify a refresh token.
 */
const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
};

export {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
