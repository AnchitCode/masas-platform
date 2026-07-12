import crypto from 'crypto';

/**
 * Centralized crypto utilities for secure token generation and hashing.
 * Used for password reset tokens and email verification tokens.
 *
 * Security pattern:
 * 1. Generate a cryptographically secure random token
 * 2. Email the raw token to the user
 * 3. Store ONLY the SHA-256 hash in the database
 * 4. On verification, hash the submitted token and look up by hash
 */

/**
 * Generate a cryptographically secure random token (64-char hex string).
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256. Used for storing and looking up tokens.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
