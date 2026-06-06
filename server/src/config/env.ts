import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import type { EnvConfig } from '../types/index.js';

// Load the correct .env file based on NODE_ENV.
// In test mode, use `override: true` because Prisma Client's built-in
// dotenv may have already loaded production .env values. We must ensure
// .env.test values take precedence.
const isTest = process.env.NODE_ENV === 'test';
const envFile = isTest ? '.env.test' : '.env';
const envPath = path.resolve(process.cwd(), envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: isTest });
}

/**
 * Validates that all required environment variables are present.
 * Throws an error at startup if any are missing — fail fast.
 */
const requiredVars: string[] = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

const missing = requiredVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `❌ Missing required environment variables:\n${missing.map((v) => `   - ${v}`).join('\n')}`
  );
}

const env: EnvConfig = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT!, 10) || 5000,

  DATABASE_URL: process.env.DATABASE_URL!,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',

  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS!, 10) || 60000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX!, 10) || 100,

  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
};

export default env;
