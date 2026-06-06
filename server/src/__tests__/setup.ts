/**
 * Global test setup for MASAS backend.
 *
 * SAFETY: This file performs destructive operations (TRUNCATE CASCADE).
 * It enforces a triple safety check before ANY database operation:
 *   1. NODE_ENV must be "test"
 *   2. DATABASE_BRANCH must be "masas-test"
 *   3. ALLOW_TEST_DB_RESET must be "true"
 */

// ─── Step 1: Load .env.test FIRST — before ANY require ───────
import dotenv from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';

const envTestPath = path.resolve(__dirname, '../../.env.test');
dotenv.config({ path: envTestPath, override: true });

// ─── Step 2: Triple safety check ─────────────────────────────

interface TestUserOverrides {
  email?: string;
  password?: string;
  role?: 'PHARMACY' | 'ADMIN';
  name?: string;
  licenseNumber?: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  status?: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

interface TestMedicineOverrides {
  name?: string;
  genericName?: string;
  manufacturer?: string;
  category?: string;
  dosageForm?: string;
}

interface TestInventoryOverrides {
  price?: number;
  quantity?: number;
  expiryDate?: string | null;
  isAvailable?: boolean;
}

function enforceTestSafety(context: string): void {
  const errors: string[] = [];

  if (process.env.NODE_ENV !== 'test') {
    errors.push(
      `NODE_ENV is "${process.env.NODE_ENV}" (expected "test")`
    );
  }

  if (process.env.DATABASE_BRANCH !== 'masas-test') {
    errors.push(
      `DATABASE_BRANCH is "${process.env.DATABASE_BRANCH}" (expected "masas-test")`
    );
  }

  if (process.env.ALLOW_TEST_DB_RESET !== 'true') {
    errors.push(
      `ALLOW_TEST_DB_RESET is "${process.env.ALLOW_TEST_DB_RESET}" (expected "true")`
    );
  }

  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is missing');
  }

  if (errors.length > 0) {
    throw new Error(
      `\n🛑 TEST SAFETY CHECK FAILED [${context}]\n` +
      `\nRefusing to proceed — destructive test operations blocked.\n\n` +
      errors.map((e) => `  ✖ ${e}`).join('\n') +
      `\n\nEnsure your server/.env.test has:\n` +
      `  NODE_ENV=test\n` +
      `  DATABASE_BRANCH=masas-test\n` +
      `  ALLOW_TEST_DB_RESET=true\n` +
      `  DATABASE_URL=<your NeonDB test branch URL>\n`
    );
  }
}

// Run safety check BEFORE any DB operations
enforceTestSafety('module load');

// ─── Database lifecycle ───────────────────────────────────────

beforeAll(async () => {
  enforceTestSafety('beforeAll — prisma migrate deploy');

  const serverRoot = path.resolve(__dirname, '../..');
  execSync('npx prisma migrate deploy', {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
    },
    cwd: serverRoot,
    stdio: 'pipe',
  });
});

beforeEach(async () => {
  enforceTestSafety('beforeEach — TRUNCATE');

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "pharmacy_inventory", "pharmacies", "medicine_catalog", "users" CASCADE
  `);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── Factory helpers ──────────────────────────────────────────

const SALT_ROUNDS = 4;

async function createTestUser(overrides: TestUserOverrides = {}) {
  const email = overrides.email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const password = overrides.password || 'TestPassword123';
  const role = overrides.role || 'PHARMACY';

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, passwordHash, role },
  });

  const accessToken = generateAccessToken({ userId: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user.id });

  return { user, accessToken, refreshToken, password };
}

async function createTestPharmacy(userId: string, overrides: TestUserOverrides = {}) {
  const pharmacy = await prisma.pharmacy.create({
    data: {
      userId,
      name: overrides.name || 'Test Pharmacy',
      licenseNumber: overrides.licenseNumber || `LIC-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      address: overrides.address || '123 Test Street, New Delhi 110001',
      phone: overrides.phone || '+91-9876543210',
      latitude: overrides.latitude ?? 28.6139,
      longitude: overrides.longitude ?? 77.2090,
      status: overrides.status || 'PENDING',
    },
  });

  return pharmacy;
}

async function createTestMedicine(overrides: TestMedicineOverrides = {}) {
  const medicine = await prisma.medicineCatalog.create({
    data: {
      name: overrides.name || `test-medicine-${Date.now()}`,
      genericName: overrides.genericName || 'Test Generic',
      manufacturer: overrides.manufacturer || 'Test Pharma Ltd',
      category: overrides.category || 'Analgesic',
      dosageForm: overrides.dosageForm || 'Tablet',
    },
  });

  return medicine;
}

async function createTestInventory(pharmacyId: string, medicineId: string, overrides: TestInventoryOverrides = {}) {
  const inventory = await prisma.pharmacyInventory.create({
    data: {
      pharmacyId,
      medicineId,
      price: overrides.price ?? 25.50,
      quantity: overrides.quantity ?? 100,
      expiryDate: overrides.expiryDate || null,
      isAvailable: overrides.isAvailable ?? true,
    },
  });

  return inventory;
}

async function createVerifiedPharmacyUser(overrides: TestUserOverrides = {}) {
  const { user, accessToken, refreshToken, password } = await createTestUser({
    role: 'PHARMACY',
    ...overrides,
  });

  const pharmacy = await createTestPharmacy(user.id, {
    status: 'VERIFIED',
    ...overrides,
  });

  return { user, pharmacy, accessToken, refreshToken, password };
}

async function createAdminUser(overrides: TestUserOverrides = {}) {
  return createTestUser({ role: 'ADMIN', ...overrides });
}

export {
  prisma,
  createTestUser,
  createTestPharmacy,
  createTestMedicine,
  createTestInventory,
  createVerifiedPharmacyUser,
  createAdminUser,
};
