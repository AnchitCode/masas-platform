import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import type { EnvConfig } from '../types/index.js';

// Load .env only in non-test environments, or let it load as a fallback without overriding.
// In test mode, `env-setup.ts` has ALREADY run and loaded `.env.test`.
// We do not want to override it here.
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envPath) && process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: envPath });
}

/**
 * Validates that all required environment variables are present.
 * Throws an error at startup if any are missing — fail fast.
 */
const requiredVars: string[] = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'GOOGLE_CLIENT_ID',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
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

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,

  SMTP_HOST: process.env.SMTP_HOST!,
  SMTP_PORT: parseInt(process.env.SMTP_PORT!, 10) || 587,
  SMTP_USER: process.env.SMTP_USER!,
  SMTP_PASS: process.env.SMTP_PASS!,
  SMTP_FROM: process.env.SMTP_FROM!,

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS!, 10) || 60000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX!, 10) || 100,

  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  ALERT_CRON_PATTERN: process.env.ALERT_CRON_PATTERN || '*/30 * * * *',

  // ── AI Configuration (Phase 9) ───────────────────────────────
  // All AI vars have safe defaults. AI is disabled by default.
  // Server starts and runs normally without Ollama installed.
  AI_ENABLED: process.env.AI_ENABLED === 'true',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  AI_EMBEDDING_MODEL: process.env.AI_EMBEDDING_MODEL || 'nomic-embed-text',
  AI_LLM_MODEL: process.env.AI_LLM_MODEL || 'phi3.5:3.8b-mini-instruct-q4_K_M',
  AI_EMBEDDING_PROVIDER: process.env.AI_EMBEDDING_PROVIDER || 'ollama',
  AI_LLM_PROVIDER: process.env.AI_LLM_PROVIDER || 'ollama',

  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
};

export default env;
