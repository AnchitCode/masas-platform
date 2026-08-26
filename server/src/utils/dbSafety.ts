/**
 * Database Safety Guard
 *
 * Central utility to prevent destructive database operations
 * (TRUNCATE, deleteMany, migrate reset, etc.) from ever running
 * against production.
 *
 * MUST be called before any destructive DB operation in:
 *   - test setup / teardown
 *   - test seed scripts
 *   - manual DB reset scripts
 *
 * Validates 7 conditions sequentially, including an active DB connection check.
 * If ANY fail, the operation is blocked.
 */

import type { PrismaClient } from '@prisma/client';

export interface SafetyCheckResult {
  safe: boolean;
  errors: string[];
}

/**
 * Runs all safety checks asynchronously and returns a result object.
 * Does NOT throw — use this in tests that verify the guard itself.
 */
export async function isTestDatabaseSafe(prisma: PrismaClient): Promise<SafetyCheckResult> {
  const errors: string[] = [];

  // 1. NODE_ENV must be "test"
  if (process.env.NODE_ENV !== 'test') {
    errors.push(`NODE_ENV is "${process.env.NODE_ENV}" (expected "test")`);
  }

  // 2. ALLOW_TEST_DB_RESET must be "true"
  if (process.env.ALLOW_TEST_DB_RESET !== 'true') {
    errors.push(`ALLOW_TEST_DB_RESET is "${process.env.ALLOW_TEST_DB_RESET}" (expected "true")`);
  }

  // 3. DATABASE_BRANCH must be "masas-test"
  if (process.env.DATABASE_BRANCH !== 'masas-test') {
    errors.push(`DATABASE_BRANCH is "${process.env.DATABASE_BRANCH}" (expected "masas-test")`);
  }

  // 4. DATABASE_URL must exist
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is missing');
    return { safe: false, errors }; // Stop early if no URL
  }

  // 5 & 6. Hostname checks
  let hostname: string;
  try {
    const urlString = process.env.DATABASE_URL.replace(/^postgresql:\/\//, 'https://');
    hostname = new URL(urlString).hostname;
  } catch {
    errors.push(`DATABASE_URL is not a valid URL: "${process.env.DATABASE_URL}"`);
    return { safe: false, errors };
  }

  if (!process.env.SAFE_TEST_DATABASE_HOST) {
    errors.push('SAFE_TEST_DATABASE_HOST is missing');
  } else if (hostname !== process.env.SAFE_TEST_DATABASE_HOST) {
    errors.push(`DATABASE_URL hostname "${hostname}" does not match SAFE_TEST_DATABASE_HOST "${process.env.SAFE_TEST_DATABASE_HOST}"`);
  }

  if (!process.env.PRODUCTION_DATABASE_HOST) {
    errors.push('PRODUCTION_DATABASE_HOST is missing');
  } else if (hostname === process.env.PRODUCTION_DATABASE_HOST) {
    errors.push(`DATABASE_URL hostname "${hostname}" matches PRODUCTION_DATABASE_HOST — this is a production database!`);
  }

  // 7. Active Connection Verification
  // We explicitly run a query on the passed prisma instance to verify the actual
  // database we are connected to, completely bypassing environment variable assumptions.
  try {
    const result = await prisma.$queryRawUnsafe<{ current_database: string }[]>('SELECT current_database();');
    const actualDbName = result[0]?.current_database;
    const expectedDbName = process.env.SAFE_TEST_DATABASE_NAME;

    if (!expectedDbName) {
      errors.push('SAFE_TEST_DATABASE_NAME is missing in the environment');
    } else if (actualDbName !== expectedDbName) {
      errors.push(`Active database connection is to "${actualDbName}", but expected SAFE_TEST_DATABASE_NAME is "${expectedDbName}"`);
    }
  } catch (err) {
    errors.push(`Failed to verify active database connection: ${(err as Error).message}`);
  }

  return { safe: errors.length === 0, errors };
}

/**
 * Asserts that all safety checks pass. Throws if any fail.
 * Call this before ANY destructive database operation.
 *
 * @param prisma — the actual PrismaClient instance about to perform the operation
 * @param context — a label for the caller (e.g. "beforeEach — TRUNCATE")
 * @throws Error with a detailed message listing all failed checks
 */
export async function assertTestDatabaseSafety(prisma: PrismaClient, context: string): Promise<void> {
  const { safe, errors } = await isTestDatabaseSafe(prisma);

  if (!safe) {
    throw new Error(
      `\n🛑 Refusing destructive DB operation: database safety check failed.\n` +
      `\n   Context: ${context}\n\n` +
      errors.map((e) => `  ✖ ${e}`).join('\n') +
      `\n\nEnsure your server/.env.test has:\n` +
      `  NODE_ENV=test\n` +
      `  DATABASE_BRANCH=masas-test\n` +
      `  ALLOW_TEST_DB_RESET=true\n` +
      `  DATABASE_URL=<your NeonDB test branch URL>\n` +
      `  SAFE_TEST_DATABASE_HOST=<test Neon hostname>\n` +
      `  SAFE_TEST_DATABASE_NAME=<test DB name>\n` +
      `  PRODUCTION_DATABASE_HOST=<production Neon hostname>\n`
    );
  }

  // Log only once per process to avoid spamming the test output
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = global as any;
  if (!g.__DB_SAFETY_LOGGED) {
    console.log(`\n🛡️ SAFETY PASS: Verified active connection for [${context}]`);
    console.log(`   Environment: ${process.env.NODE_ENV}`);
    console.log(`   Branch: ${process.env.DATABASE_BRANCH}`);
    console.log(`   Database: ${process.env.SAFE_TEST_DATABASE_NAME}`);
    console.log(`   Host: ${process.env.SAFE_TEST_DATABASE_HOST}\n`);
    g.__DB_SAFETY_LOGGED = true;
  }
}
