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
 * Validates 8 conditions — if ANY fail, the operation is blocked.
 */

export interface SafetyCheckResult {
  safe: boolean;
  errors: string[];
}

/**
 * Runs all safety checks and returns a result object.
 * Does NOT throw — use this in tests that verify the guard itself.
 */
export function isTestDatabaseSafe(): SafetyCheckResult {
  const errors: string[] = [];

  // 1. NODE_ENV must be "test"
  if (process.env.NODE_ENV !== 'test') {
    errors.push(
      `NODE_ENV is "${process.env.NODE_ENV}" (expected "test")`
    );
  }

  // 2. ALLOW_TEST_DB_RESET must be "true"
  if (process.env.ALLOW_TEST_DB_RESET !== 'true') {
    errors.push(
      `ALLOW_TEST_DB_RESET is "${process.env.ALLOW_TEST_DB_RESET}" (expected "true")`
    );
  }

  // 3. DATABASE_BRANCH must be "masas-test"
  if (process.env.DATABASE_BRANCH !== 'masas-test') {
    errors.push(
      `DATABASE_BRANCH is "${process.env.DATABASE_BRANCH}" (expected "masas-test")`
    );
  }

  // 4. DATABASE_URL must exist
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is missing');
  }

  // 5. SAFE_TEST_DATABASE_HOST must exist
  if (!process.env.SAFE_TEST_DATABASE_HOST) {
    errors.push('SAFE_TEST_DATABASE_HOST is missing');
  }

  // 6. PRODUCTION_DATABASE_HOST must exist
  if (!process.env.PRODUCTION_DATABASE_HOST) {
    errors.push('PRODUCTION_DATABASE_HOST is missing');
  }

  // 7 & 8. Hostname checks (only if DATABASE_URL is parseable)
  if (process.env.DATABASE_URL) {
    let hostname: string;
    try {
      // Handle postgresql:// URLs by replacing the scheme for URL parsing
      const urlString = process.env.DATABASE_URL.replace(
        /^postgresql:\/\//,
        'https://'
      );
      hostname = new URL(urlString).hostname;
    } catch {
      errors.push(
        `DATABASE_URL is not a valid URL: "${process.env.DATABASE_URL}"`
      );
      return { safe: errors.length === 0, errors };
    }

    // 7. DATABASE_URL hostname must match SAFE_TEST_DATABASE_HOST
    if (
      process.env.SAFE_TEST_DATABASE_HOST &&
      hostname !== process.env.SAFE_TEST_DATABASE_HOST
    ) {
      errors.push(
        `DATABASE_URL hostname "${hostname}" does not match SAFE_TEST_DATABASE_HOST "${process.env.SAFE_TEST_DATABASE_HOST}"`
      );
    }

    // 8. DATABASE_URL hostname must NOT match PRODUCTION_DATABASE_HOST
    if (
      process.env.PRODUCTION_DATABASE_HOST &&
      hostname === process.env.PRODUCTION_DATABASE_HOST
    ) {
      errors.push(
        `DATABASE_URL hostname "${hostname}" matches PRODUCTION_DATABASE_HOST — this is a production database!`
      );
    }
  }

  return { safe: errors.length === 0, errors };
}

/**
 * Asserts that all safety checks pass. Throws if any fail.
 * Call this before ANY destructive database operation.
 *
 * @param context — a label for the caller (e.g. "beforeEach — TRUNCATE")
 * @throws Error with a detailed message listing all failed checks
 */
export function assertTestDatabaseSafety(context: string): void {
  const { safe, errors } = isTestDatabaseSafe();

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
      `  PRODUCTION_DATABASE_HOST=<production Neon hostname>\n`
    );
  }
}
