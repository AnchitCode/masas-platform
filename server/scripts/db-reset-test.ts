/**
 * Manual test database reset script.
 *
 * Usage: npm run db:reset:test
 *
 * This script:
 *   1. Loads .env.test with override: true
 *   2. Runs the full database safety guard (8 checks)
 *   3. TRUNCATES all tables in the test database
 *
 * It will NEVER run against production — the safety guard blocks it.
 */

import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { assertTestDatabaseSafety } from '../src/utils/dbSafety.js';

// ─── Step 1: Load .env.test with override ─────────────────────
// Note: static imports are hoisted, but assertTestDatabaseSafety
// reads process.env at call time, not at import time.
const envTestPath = path.resolve(__dirname, '../.env.test');
dotenv.config({ path: envTestPath, override: true });

async function main(): Promise<void> {
  // ─── Step 2: Safety check (reads process.env at call time) ──
  assertTestDatabaseSafety('db:reset:test');

  console.log('\n🧹 Resetting test database...');
  console.log(`   DATABASE_URL host: ${process.env.SAFE_TEST_DATABASE_HOST}`);
  console.log(`   DATABASE_BRANCH: ${process.env.DATABASE_BRANCH}\n`);

  const prisma = new PrismaClient();

  try {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE "pharmacy_inventory", "pharmacies", "medicine_catalog", "users" CASCADE
    `);

    console.log('✅ All tables truncated successfully.\n');
  } catch (error) {
    console.error('❌ Reset failed:', (error as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
