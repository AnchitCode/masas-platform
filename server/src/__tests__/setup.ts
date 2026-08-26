/**
 * Global test setup for MASAS backend.
 *
 * SAFETY: This file performs destructive operations (TRUNCATE CASCADE).
 * It uses the central database safety guard (dbSafety.ts) which enforces
 * 8 checks including hostname validation before ANY database operation.
 */

import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { generateSecureToken, hashToken } from '../utils/tokenUtils.js';
import { assertTestDatabaseSafety } from '../utils/dbSafety.js';
import { redisClient } from '../config/redis.js';
import { emailQueue, alertQueue } from '../jobs/queues.js';

// ─── Step 1: Central safety check ────────────────────────────

interface TestUserOverrides {
  email?: string;
  password?: string;
  role?: 'PHARMACY' | 'ADMIN' | 'CUSTOMER';
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

interface TestNotificationOverrides {
  type?: 'PHARMACY_VERIFIED' | 'PHARMACY_REJECTED' | 'LOW_STOCK_ALERT' | 'MEDICINE_AVAILABLE' | 'SYSTEM_ANNOUNCEMENT';
  title?: string;
  message?: string;
  data?: Prisma.InputJsonValue | null;
  isRead?: boolean;
}

// ─── Database lifecycle ───────────────────────────────────────

beforeEach(async () => {
  await assertTestDatabaseSafety(prisma, 'beforeEach — TRUNCATE');

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "availability_alerts", "saved_searches", "notifications", "auth_audit_logs", "refresh_tokens", "password_reset_tokens", "email_verification_tokens", "pharmacy_inventory", "pharmacies", "medicine_catalog", "users" CASCADE
  `);

  // Redis cleanup — flush only masas: prefixed BullMQ keys
  try {
    if (redisClient.status === 'wait') {
      await redisClient.connect();
    }
    if (redisClient.status === 'ready') {
      const keys = await redisClient.keys('masas:*');
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    }
  } catch {
    // Redis may not be available in all test environments — don't fail
  }
});

afterAll(async () => {
  await prisma.$disconnect();
  try {
    await emailQueue.close();
    await alertQueue.close();
    await redisClient.quit();
  } catch {
    // Redis may not be available — don't fail teardown
  }
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

async function createTestNotification(userId: string, overrides: TestNotificationOverrides = {}) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: overrides.type || 'SYSTEM_ANNOUNCEMENT',
      title: overrides.title || 'Test Notification',
      message: overrides.message || 'This is a test notification.',
      data: overrides.data === null || overrides.data === undefined ? undefined : overrides.data,
      isRead: overrides.isRead ?? false,
    },
  });

  return notification;
}

export interface TestSavedSearchOverrides {
  query?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  isActive?: boolean;
}

async function createTestSavedSearch(userId: string, overrides: TestSavedSearchOverrides = {}) {
  const savedSearch = await prisma.savedSearch.create({
    data: {
      userId,
      query: overrides.query || 'paracetamol',
      latitude: overrides.latitude ?? 28.6139,
      longitude: overrides.longitude ?? 77.2090,
      radiusKm: overrides.radiusKm ?? 5,
      isActive: overrides.isActive ?? true,
    },
  });
  return savedSearch;
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
  createTestNotification,
  createTestSavedSearch,
  generateSecureToken,
  hashToken,
};
