/**
 * Safe diagnostic script to verify test database connectivity.
 * It NEVER performs destructive operations.
 *
 * Usage: npm run db:test:verify
 */

import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// 1. Load test environment explicitly
const envTestPath = path.resolve(__dirname, '../.env.test');
dotenv.config({ path: envTestPath, override: true });

async function main() {
  console.log('\n🔍 Verifying Test Database Connection...\n');

  // ── Diagnostics (safe — no credentials leaked) ──────────────
  const dbUrl = process.env.DATABASE_URL || '';
  let hostname = 'UNKNOWN';
  let port = '5432';
  let dbPath = 'UNKNOWN';
  let sslmode = 'UNKNOWN';
  let channelBinding = 'UNKNOWN';
  let isPooled = false;

  try {
    const parsed = new URL(dbUrl.replace(/^postgresql:\/\//, 'https://'));
    hostname = parsed.hostname;
    port = parsed.port || '5432';
    dbPath = parsed.pathname;
    sslmode = parsed.searchParams.get('sslmode') || 'not set';
    channelBinding = parsed.searchParams.get('channel_binding') || 'not set';
    isPooled = hostname.includes('-pooler');
  } catch {
    hostname = 'INVALID_URL';
  }

  console.log('── Connection Diagnostics ──');
  console.log(`  Prisma version:    ${require('@prisma/client/package.json').version}`);
  console.log(`  Hostname:          ${hostname}`);
  console.log(`  Port:              ${port}`);
  console.log(`  Database path:     ${dbPath}`);
  console.log(`  SSL mode:          ${sslmode}`);
  console.log(`  Channel binding:   ${channelBinding}`);
  console.log(`  Pooled endpoint:   ${isPooled}`);
  console.log(`  NODE_ENV:          ${process.env.NODE_ENV}`);
  console.log(`  DATABASE_BRANCH:   ${process.env.DATABASE_BRANCH}`);
  console.log('');

  // ── Prisma Connection ───────────────────────────────────────
  // Dynamically create a fresh PrismaClient (NOT the singleton)
  // to guarantee we test the exact URL from process.env right now.
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: ['error'],
  });

  try {
    const startMs = Date.now();
    const result = await prisma.$queryRawUnsafe<{ current_database: string }[]>(
      'SELECT current_database();'
    );
    const elapsed = Date.now() - startMs;
    const dbName = result[0]?.current_database;

    console.log(`── Active Connection ──`);
    console.log(`  Database:          ${dbName}`);
    console.log(`  Latency:           ${elapsed}ms`);

    // Safety checks
    const safeHost = process.env.SAFE_TEST_DATABASE_HOST;
    const prodHost = process.env.PRODUCTION_DATABASE_HOST;
    const safeDbName = process.env.SAFE_TEST_DATABASE_NAME;

    let isSafe = true;
    const errors: string[] = [];

    if (process.env.NODE_ENV !== 'test') { isSafe = false; errors.push('NODE_ENV is not test'); }
    if (process.env.DATABASE_BRANCH !== 'masas-test') { isSafe = false; errors.push('DATABASE_BRANCH is not masas-test'); }
    if (hostname !== safeHost) { isSafe = false; errors.push(`Host mismatch: got "${hostname}", expected "${safeHost}"`); }
    if (hostname === prodHost) { isSafe = false; errors.push('Host matches PRODUCTION_DATABASE_HOST!'); }
    if (dbName !== safeDbName) { isSafe = false; errors.push(`Database mismatch: got "${dbName}", expected "${safeDbName}"`); }

    if (isSafe) {
      console.log('\n✅ Safety: PASS\n');
    } else {
      console.log('\n❌ Safety: FAIL');
      errors.forEach(e => console.log(`  ✖ ${e}`));
      console.log('');
      process.exitCode = 1;
    }

  } catch (error) {
    const err = error as Error & { code?: string; meta?: unknown };
    console.error('❌ Connection failed!');
    console.error(`  Error:   ${err.message}`);
    if (err.code) console.error(`  Code:    ${err.code}`);
    if (err.meta) console.error(`  Meta:    ${JSON.stringify(err.meta)}`);
    console.error('');
    console.error('  Troubleshooting:');
    console.error('    - P1001: Neon cold-start timeout. Wait 30s and retry.');
    console.error('    - P1001: DNS resolution failure. Run: nslookup ' + hostname);
    console.error('    - P1001: Check if the Neon branch is suspended (auto-suspend after inactivity).');
    console.error('    - Verify: nc -vz ' + hostname + ' ' + port);
    console.error('');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
