/**
 * Global test setup for MASAS backend.
 *
 * - Cleans all tables before each test (TRUNCATE CASCADE)
 * - Provides factory helpers for creating test data
 * - Disconnects Prisma after all tests
 */

const { execSync } = require('child_process');
const path = require('path');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');

// ─── Database lifecycle ───────────────────────────────────────

beforeAll(async () => {
  // Ensure the test database schema is up-to-date.
  // CI provides DATABASE_URL via workflow env; local dev uses .env.test.
  const serverRoot = path.resolve(__dirname, '../..');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, NODE_ENV: 'test' },
    cwd: serverRoot,
    stdio: 'pipe',
  });
});

beforeEach(async () => {
  // Clean tables in reverse-dependency order
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "pharmacy_inventory", "pharmacies", "medicine_catalog", "users" CASCADE
  `);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── Factory helpers ──────────────────────────────────────────

const SALT_ROUNDS = 4; // Fast for tests (production uses 12)

/**
 * Create a user in the DB and return the record + JWT tokens.
 */
async function createTestUser(overrides = {}) {
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

/**
 * Create a pharmacy profile linked to a user.
 */
async function createTestPharmacy(userId, overrides = {}) {
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

/**
 * Create a medicine in the catalog.
 */
async function createTestMedicine(overrides = {}) {
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

/**
 * Create an inventory entry linking a pharmacy to a medicine.
 */
async function createTestInventory(pharmacyId, medicineId, overrides = {}) {
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

/**
 * Convenience: create a full verified pharmacy user with token.
 * Returns { user, pharmacy, accessToken, refreshToken }.
 */
async function createVerifiedPharmacyUser(overrides = {}) {
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

/**
 * Convenience: create an admin user with token.
 */
async function createAdminUser(overrides = {}) {
  return createTestUser({ role: 'ADMIN', ...overrides });
}

module.exports = {
  prisma,
  createTestUser,
  createTestPharmacy,
  createTestMedicine,
  createTestInventory,
  createVerifiedPharmacyUser,
  createAdminUser,
};
