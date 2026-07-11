/**
 * Database Safety Guard — Verification Tests
 *
 * These tests verify that the central safety guard (dbSafety.ts)
 * correctly rejects destructive operations when any safety condition
 * is not met. Each test temporarily modifies process.env and restores
 * it after — no actual database operations are performed.
 */

import { isTestDatabaseSafe } from '../utils/dbSafety.js';

// Snapshot the original env values once before all tests
const ORIGINAL_ENV: Record<string, string | undefined> = {};

const SAFETY_KEYS = [
  'NODE_ENV',
  'ALLOW_TEST_DB_RESET',
  'DATABASE_BRANCH',
  'DATABASE_URL',
  'SAFE_TEST_DATABASE_HOST',
  'PRODUCTION_DATABASE_HOST',
] as const;

beforeEach(() => {
  // Save a snapshot of current env values
  for (const key of SAFETY_KEYS) {
    ORIGINAL_ENV[key] = process.env[key];
  }
});

afterEach(() => {
  // Restore original env values
  for (const key of SAFETY_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = ORIGINAL_ENV[key];
    }
  }
});

describe('Database Safety Guard', () => {
  it('should pass when all safety conditions are correct', () => {
    // The real .env.test values should already be loaded by setup.ts
    const result = isTestDatabaseSafe();
    expect(result.safe).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject when NODE_ENV is not "test"', () => {
    process.env.NODE_ENV = 'production';

    const result = isTestDatabaseSafe();

    expect(result.safe).toBe(false);
    expect(result.errors.some((e) => e.includes('NODE_ENV'))).toBe(true);
  });

  it('should reject when ALLOW_TEST_DB_RESET is not "true"', () => {
    process.env.ALLOW_TEST_DB_RESET = 'false';

    const result = isTestDatabaseSafe();

    expect(result.safe).toBe(false);
    expect(result.errors.some((e) => e.includes('ALLOW_TEST_DB_RESET'))).toBe(true);
  });

  it('should reject when DATABASE_BRANCH is not "masas-test"', () => {
    process.env.DATABASE_BRANCH = 'production';

    const result = isTestDatabaseSafe();

    expect(result.safe).toBe(false);
    expect(result.errors.some((e) => e.includes('DATABASE_BRANCH'))).toBe(true);
  });

  it('should reject when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;

    const result = isTestDatabaseSafe();

    expect(result.safe).toBe(false);
    expect(result.errors.some((e) => e.includes('DATABASE_URL is missing'))).toBe(true);
  });

  it('should reject when SAFE_TEST_DATABASE_HOST is missing', () => {
    delete process.env.SAFE_TEST_DATABASE_HOST;

    const result = isTestDatabaseSafe();

    expect(result.safe).toBe(false);
    expect(result.errors.some((e) => e.includes('SAFE_TEST_DATABASE_HOST is missing'))).toBe(true);
  });

  it('should reject when PRODUCTION_DATABASE_HOST is missing', () => {
    delete process.env.PRODUCTION_DATABASE_HOST;

    const result = isTestDatabaseSafe();

    expect(result.safe).toBe(false);
    expect(result.errors.some((e) => e.includes('PRODUCTION_DATABASE_HOST is missing'))).toBe(true);
  });

  it('should reject when DATABASE_URL hostname matches PRODUCTION_DATABASE_HOST', () => {
    const prodHost = process.env.PRODUCTION_DATABASE_HOST!;
    process.env.DATABASE_URL = `postgresql://user:pass@${prodHost}/testdb?sslmode=require`;
    // Also set SAFE_TEST_DATABASE_HOST to the prod host to isolate this check
    process.env.SAFE_TEST_DATABASE_HOST = prodHost;

    const result = isTestDatabaseSafe();

    expect(result.safe).toBe(false);
    expect(
      result.errors.some((e) => e.includes('matches PRODUCTION_DATABASE_HOST'))
    ).toBe(true);
  });

  it('should reject when DATABASE_URL hostname does not match SAFE_TEST_DATABASE_HOST', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@some-random-host.neon.tech/testdb?sslmode=require';

    const result = isTestDatabaseSafe();

    expect(result.safe).toBe(false);
    expect(
      result.errors.some((e) => e.includes('does not match SAFE_TEST_DATABASE_HOST'))
    ).toBe(true);
  });

  it('should reject with multiple errors when several conditions fail', () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_DB_RESET = 'false';
    process.env.DATABASE_BRANCH = 'main';

    const result = isTestDatabaseSafe();

    expect(result.safe).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
