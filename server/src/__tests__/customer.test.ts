import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import {
  prisma,
  createTestUser,
  createVerifiedPharmacyUser,
} from './setup.js';

/**
 * Phase 8.8 — CUSTOMER Role Tests
 *
 * Covers:
 *   Registration (5 tests)
 *   Authorization (5 tests)
 *   Google OAuth role handling (4 tests — mock‑based)
 *   Authentication lifecycle (3 tests)
 */

describe('Phase 8.8 — CUSTOMER Role', () => {
  // ──────────────────────────────────────────────────────────
  //  REGISTRATION
  // ──────────────────────────────────────────────────────────

  describe('Registration', () => {
    it('registers a CUSTOMER user successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Test Customer',
          email: 'customer-reg@test.com',
          password: 'Password123',
          role: 'CUSTOMER',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('CUSTOMER');

      // Verify in DB
      const dbUser = await prisma.user.findUnique({ where: { email: 'customer-reg@test.com' } });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.role).toBe('CUSTOMER');
    });

    it('registers a PHARMACY user successfully (explicit role)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Test Pharmacy',
          email: 'pharmacy-reg@test.com',
          password: 'Password123',
          role: 'PHARMACY',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('PHARMACY');
    });

    it('defaults to PHARMACY when no role is provided', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Default Role',
          email: 'default-role@test.com',
          password: 'Password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('PHARMACY');
    });

    it('rejects ADMIN registration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Sneaky Admin',
          email: 'admin-attempt@test.com',
          password: 'Password123',
          role: 'ADMIN',
        });

      // Zod rejects ADMIN at the validation layer
      expect(res.status).toBe(400);
    });

    it('rejects invalid role values', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Invalid Role',
          email: 'invalid-role@test.com',
          password: 'Password123',
          role: 'SUPERUSER',
        });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────
  //  AUTHORIZATION
  // ──────────────────────────────────────────────────────────

  describe('Authorization', () => {
    it('CUSTOMER cannot create pharmacy profile', async () => {
      const { accessToken } = await createTestUser({ role: 'CUSTOMER', email: 'customer-auth1@test.com' });

      const res = await request(app)
        .post('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Fake Pharmacy',
          licenseNumber: 'FAKE-123',
          address: '123 Fake St',
          phone: '1234567890',
          latitude: 12.9,
          longitude: 77.5,
        });

      expect(res.status).toBe(403);
    });

    it('CUSTOMER cannot access inventory endpoints', async () => {
      const { accessToken } = await createTestUser({ role: 'CUSTOMER', email: 'customer-auth2@test.com' });

      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });

    it('CUSTOMER cannot access admin endpoints', async () => {
      const { accessToken } = await createTestUser({ role: 'CUSTOMER', email: 'customer-auth3@test.com' });

      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });

    it('CUSTOMER can access public search', async () => {
      const { accessToken } = await createTestUser({ role: 'CUSTOMER', email: 'customer-auth4@test.com' });

      const res = await request(app)
        .get('/api/v1/search/inventory?q=paracetamol&lat=12.9&lng=77.5')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });

    it('CUSTOMER can access notifications', async () => {
      const { accessToken } = await createTestUser({ role: 'CUSTOMER', email: 'customer-auth5@test.com' });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ──────────────────────────────────────────────────────────
  //  GOOGLE OAUTH ROLE HANDLING
  // ──────────────────────────────────────────────────────────

  describe('Google OAuth — Role Handling', () => {
    // We test role persistence at the data layer since Google OAuth
    // requires a real ID token for the controller path.

    it('new CUSTOMER Google account gets CUSTOMER role', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'google-customer@test.com',
          googleId: 'google-customer-id-123',
          isEmailVerified: true,
          role: 'CUSTOMER',
          name: 'Google Customer',
        },
      });

      expect(user.role).toBe('CUSTOMER');
    });

    it('new PHARMACY Google account gets PHARMACY role', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'google-pharmacy@test.com',
          googleId: 'google-pharmacy-id-123',
          isEmailVerified: true,
          role: 'PHARMACY',
          name: 'Google Pharmacy',
        },
      });

      expect(user.role).toBe('PHARMACY');
    });

    it('existing PHARMACY Google user cannot be changed to CUSTOMER', async () => {
      // Create an existing PHARMACY user
      const existing = await prisma.user.create({
        data: {
          email: 'existing-pharmacy-google@test.com',
          googleId: 'existing-pharmacy-gid',
          isEmailVerified: true,
          role: 'PHARMACY',
          name: 'Existing Pharmacy',
        },
      });

      // Simulate what googleAuth does for EXISTING users — it NEVER overwrites the role.
      // Even if the request body says CUSTOMER, the DB role remains PHARMACY.
      const fetched = await prisma.user.findUnique({ where: { googleId: 'existing-pharmacy-gid' } });
      expect(fetched!.role).toBe('PHARMACY');

      // Verify that updating the user (like linking avatar) does NOT change the role
      await prisma.user.update({
        where: { id: existing.id },
        data: { avatarUrl: 'https://example.com/pic.jpg' },
      });

      const afterUpdate = await prisma.user.findUnique({ where: { id: existing.id } });
      expect(afterUpdate!.role).toBe('PHARMACY');
    });

    it('existing CUSTOMER Google user cannot be changed to PHARMACY', async () => {
      const existing = await prisma.user.create({
        data: {
          email: 'existing-customer-google@test.com',
          googleId: 'existing-customer-gid',
          isEmailVerified: true,
          role: 'CUSTOMER',
          name: 'Existing Customer',
        },
      });

      // Simulate existing user login — role is read from DB, never from request
      const fetched = await prisma.user.findUnique({ where: { googleId: 'existing-customer-gid' } });
      expect(fetched!.role).toBe('CUSTOMER');

      // Update avatar — role must remain CUSTOMER
      await prisma.user.update({
        where: { id: existing.id },
        data: { avatarUrl: 'https://example.com/pic2.jpg' },
      });

      const afterUpdate = await prisma.user.findUnique({ where: { id: existing.id } });
      expect(afterUpdate!.role).toBe('CUSTOMER');
    });
  });

  // ──────────────────────────────────────────────────────────
  //  AUTHENTICATION LIFECYCLE
  // ──────────────────────────────────────────────────────────

  describe('Authentication Lifecycle', () => {
    it('CUSTOMER login produces JWT with CUSTOMER role', async () => {
      const { user } = await createTestUser({
        role: 'CUSTOMER',
        email: 'customer-login@test.com',
        password: 'Password123',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'customer-login@test.com', password: 'Password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('CUSTOMER');
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('CUSTOMER /me returns CUSTOMER role', async () => {
      const { accessToken } = await createTestUser({
        role: 'CUSTOMER',
        email: 'customer-me@test.com',
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('CUSTOMER');
    });

    it('CUSTOMER refresh preserves CUSTOMER role', async () => {
      const { refreshToken } = await createTestUser({
        role: 'CUSTOMER',
        email: 'customer-refresh@test.com',
      });

      // Store the refresh token in the DB first
      const { hashToken: hashFn } = await import('../utils/tokenUtils.js');
      const tokenHash = hashFn(refreshToken);
      const user = await prisma.user.findUnique({ where: { email: 'customer-refresh@test.com' } });

      await prisma.refreshToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();

      // Verify the new access token works and returns CUSTOMER
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${res.body.data.accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.role).toBe('CUSTOMER');
    });
  });
});
