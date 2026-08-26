import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isTestDatabaseSafe, assertTestDatabaseSafety } from '../utils/dbSafety.js';
import type { PrismaClient } from '@prisma/client';

describe('Database Safety Guard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clone env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore env after each test
    process.env = originalEnv;
  });

  // Mock Prisma client generator
  const createMockPrisma = (currentDbResult: string = 'neondb', shouldThrow: boolean = false) => {
    return {
      $queryRawUnsafe: async (query: string) => {
        if (shouldThrow) throw new Error('Connection failed');
        if (query === 'SELECT current_database();') {
          return [{ current_database: currentDbResult }];
        }
        return [];
      },
    } as unknown as PrismaClient;
  };

  const setupSafeEnv = () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_TEST_DB_RESET = 'true';
    process.env.DATABASE_BRANCH = 'masas-test';
    process.env.DATABASE_URL = 'postgresql://user:pass@test-host.neon.tech/neondb';
    process.env.SAFE_TEST_DATABASE_HOST = 'test-host.neon.tech';
    process.env.SAFE_TEST_DATABASE_NAME = 'neondb';
    process.env.PRODUCTION_DATABASE_HOST = 'prod-host.neon.tech';
  };

  it('allows operation when all checks pass', async () => {
    setupSafeEnv();
    const mockPrisma = createMockPrisma('neondb');

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Should not throw
    await expect(assertTestDatabaseSafety(mockPrisma, 'test')).resolves.toBeUndefined();
  });

  it('rejects if NODE_ENV is not test', async () => {
    setupSafeEnv();
    process.env.NODE_ENV = 'development';
    const mockPrisma = createMockPrisma('neondb');

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(false);
    expect(result.errors).toContain('NODE_ENV is "development" (expected "test")');
  });

  it('rejects if ALLOW_TEST_DB_RESET is not true', async () => {
    setupSafeEnv();
    process.env.ALLOW_TEST_DB_RESET = 'false';
    const mockPrisma = createMockPrisma('neondb');

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(false);
    expect(result.errors).toContain('ALLOW_TEST_DB_RESET is "false" (expected "true")');
  });

  it('rejects if DATABASE_BRANCH is incorrect', async () => {
    setupSafeEnv();
    process.env.DATABASE_BRANCH = 'production';
    const mockPrisma = createMockPrisma('neondb');

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(false);
    expect(result.errors).toContain('DATABASE_BRANCH is "production" (expected "masas-test")');
  });

  it('rejects if DATABASE_URL is missing', async () => {
    setupSafeEnv();
    delete process.env.DATABASE_URL;
    const mockPrisma = createMockPrisma('neondb');

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(false);
    expect(result.errors).toContain('DATABASE_URL is missing');
  });

  it('rejects if DATABASE_URL hostname does not match SAFE_TEST_DATABASE_HOST', async () => {
    setupSafeEnv();
    process.env.DATABASE_URL = 'postgresql://user:pass@wrong-host.neon.tech/neondb';
    const mockPrisma = createMockPrisma('neondb');

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(false);
    expect(result.errors[0]).toMatch(/does not match SAFE_TEST_DATABASE_HOST/);
  });

  it('CRITICAL EMERGENCY BRAKE: rejects if DATABASE_URL matches PRODUCTION_DATABASE_HOST', async () => {
    setupSafeEnv();
    // Even if we misconfigure SAFE_TEST_DATABASE_HOST, if the URL points to prod, reject it
    process.env.DATABASE_URL = 'postgresql://user:pass@prod-host.neon.tech/neondb';
    process.env.SAFE_TEST_DATABASE_HOST = 'prod-host.neon.tech'; 
    const mockPrisma = createMockPrisma('neondb');

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(false);
    expect(result.errors.join(' ')).toMatch(/matches PRODUCTION_DATABASE_HOST/);
  });

  it('EXACT REPRODUCTION: rejects if process.env claims test but Prisma connects to different database name', async () => {
    setupSafeEnv();
    // process.env is perfectly configured for TEST
    
    // BUT the active Prisma connection actually points to a different database
    const mockPrisma = createMockPrisma('production_db');

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(false);
    expect(result.errors[0]).toMatch(/Active database connection is to "production_db", but expected SAFE_TEST_DATABASE_NAME is "neondb"/);
    
    await expect(assertTestDatabaseSafety(mockPrisma, 'test')).rejects.toThrow(/database safety check failed/);
  });

  it('rejects if SAFE_TEST_DATABASE_HOST is missing', async () => {
    setupSafeEnv();
    delete process.env.SAFE_TEST_DATABASE_HOST;
    const mockPrisma = createMockPrisma('neondb');

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(false);
    expect(result.errors).toContain('SAFE_TEST_DATABASE_HOST is missing');
  });

  it('rejects if PRODUCTION_DATABASE_HOST is missing', async () => {
    setupSafeEnv();
    delete process.env.PRODUCTION_DATABASE_HOST;
    const mockPrisma = createMockPrisma('neondb');

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(false);
    expect(result.errors).toContain('PRODUCTION_DATABASE_HOST is missing');
  });

  it('rejects with multiple errors when several conditions fail', async () => {
    setupSafeEnv();
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_BRANCH = 'production';
    delete process.env.SAFE_TEST_DATABASE_HOST;
    const mockPrisma = createMockPrisma('neondb');

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.errors).toContain('NODE_ENV is "development" (expected "test")');
    expect(result.errors).toContain('DATABASE_BRANCH is "production" (expected "masas-test")');
    expect(result.errors).toContain('SAFE_TEST_DATABASE_HOST is missing');
  });

  it('rejects if actual Prisma query fails', async () => {
    setupSafeEnv();
    const mockPrisma = createMockPrisma('neondb', true); // Should throw

    const result = await isTestDatabaseSafe(mockPrisma);
    expect(result.safe).toBe(false);
    expect(result.errors[0]).toMatch(/Failed to verify active database connection/);
  });
});
