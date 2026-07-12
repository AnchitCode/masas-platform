/**
 * Global test setup for MASAS backend.
 *
 * SAFETY: This file performs destructive operations (TRUNCATE CASCADE).
 * It uses the central database safety guard (dbSafety.ts) which enforces
 * 8 checks including hostname validation before ANY database operation.
 */

// ─── Step 1: Load .env.test FIRST — before ANY require ───────
import dotenv from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { generateSecureToken, hashToken } from '../utils/tokenUtils.js';
import { assertTestDatabaseSafety } from '../utils/dbSafety.js';

const envTestPath = path.resolve(__dirname, '../../.env.test');
dotenv.config({ path: envTestPath, override: true });

// ─── Step 2: Central safety check ────────────────────────────

interface TestUserOverrides {
  email?: string;
  password?: string;
  role?: 'PHARMACY' | 'ADMIN';
  name?: string;
  isEmailVerified?: boolean;
  googleId?: string;
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

// Run safety check BEFORE any DB operations
assertTestDatabaseSafety('module load');

// ─── Database lifecycle ───────────────────────────────────────

beforeAll(async () => {
  assertTestDatabaseSafety('beforeAll — prisma migrate deploy');

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
  assertTestDatabaseSafety('beforeEach — TRUNCATE');

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "auth_audit_logs", "refresh_tokens", "password_reset_tokens", "email_verification_tokens", "pharmacy_inventory", "pharmacies", "medicine_catalog", "users" CASCADE
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
  const isEmailVerified = overrides.isEmailVerified ?? true; // default true for backward compat

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      isEmailVerified,
      name: overrides.name || null,
      googleId: overrides.googleId || null,
    },
  });

  const accessToken = generateAccessToken({ userId: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user.id, tokenVersion: user.tokenVersion });

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

/**
 * Create an email verification token for testing.
 * Returns the raw token (to send in API calls) and the hash (stored in DB).
 */
async function createEmailVerificationToken(userId: string, expiresInHours = 24) {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { rawToken, tokenHash };
}

/**
 * Create a password reset token for testing.
 */
async function createPasswordResetToken(userId: string, expiresInHours = 1) {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { rawToken, tokenHash };
}

/**
 * Store a refresh token in the DB for testing revocation flows.
 */
async function storeRefreshToken(userId: string, token: string, expiresInDays = 7) {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });
}

export {
  prisma,
  createTestUser,
  createTestPharmacy,
  createTestMedicine,
  createTestInventory,
  createVerifiedPharmacyUser,
  createAdminUser,
  createEmailVerificationToken,
  createPasswordResetToken,
  storeRefreshToken,
  generateSecureToken,
  hashToken,
};
