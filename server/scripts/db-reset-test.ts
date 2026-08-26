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
import { assertTestDatabaseSafety } from '../src/utils/dbSafety.js';

// ─── Step 1: Load .env.test with override ─────────────────────
// This MUST happen before any Prisma module is imported/evaluated.
const envTestPath = path.resolve(__dirname, '../.env.test');
dotenv.config({ path: envTestPath, override: true });

async function main(): Promise<void> {
  // ─── Step 2: Dynamically import Prisma ────────────────────────
  // Guarantees PrismaClient is instantiated AFTER the test environment is loaded.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });

  // ─── Step 3: Safety check (validates actual active connection)
  await assertTestDatabaseSafety(prisma, 'db:reset:test TRUNCATE');

  console.log('\n🧹 Resetting test database...');
  console.log(`   DATABASE_URL host: ${process.env.SAFE_TEST_DATABASE_HOST}`);
  console.log(`   DATABASE_BRANCH: ${process.env.DATABASE_BRANCH}\n`);

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
