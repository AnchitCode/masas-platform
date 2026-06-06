import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import env from '../config/env.js';
import type { AccessTokenPayload, RefreshTokenPayload } from '../types/index.js';

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
 */
const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRY as string & jwt.SignOptions['expiresIn'],
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
