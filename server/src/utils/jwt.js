const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * JWT utility helpers for token generation and verification.
 */

/**
 * Generate an access token (short-lived).
 * @param {{ userId: string, role: string }} payload
 * @returns {string} JWT access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
};

/**
 * Generate a refresh token (long-lived).
 * @param {{ userId: string }} payload
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });
};

/**
 * Verify an access token.
 * @param {string} token
 * @returns {{ userId: string, role: string }} decoded payload
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
};

/**
 * Verify a refresh token.
 * @param {string} token
 * @returns {{ userId: string }} decoded payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
