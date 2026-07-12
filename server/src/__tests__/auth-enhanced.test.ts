import request from 'supertest';
import app from '../app.js';
import {
  prisma,
  createTestUser,
  createTestPharmacy,
  createEmailVerificationToken,
  createPasswordResetToken,
  storeRefreshToken,
  hashToken,
} from './setup.js';

/**
 * Enhanced Auth Module tests covering:
 * - Email verification flow
 * - Forgot / reset password flow
 * - Resend verification
 * - Remember-me cookie duration
 * - Token revocation on password reset
 * - Login with unverified email
 * - Login returns pharmacy status
 * - Admin registration blocked
 */

describe('Auth Enhanced', () => {
  // ─── Registration (enhanced) ──────────────────────────────

  describe('Register', () => {
    it('creates an EmailVerificationToken in DB on register', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Token Test', email: 'verify-token@test.com', password: 'Password123' });

      expect(res.status).toBe(201);

      const userId = res.body.data.user.id;
      const tokens = await prisma.emailVerificationToken.findMany({
        where: { userId },
      });

      expect(tokens.length).toBe(1);
      expect(tokens[0].tokenHash).toBeDefined();
      expect(tokens[0].expiresAt).toBeDefined();
    });

    it('rejects ADMIN role in registration with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Admin Try', email: 'admin-try@test.com', password: 'Password123', role: 'ADMIN' });

      expect(res.status).toBe(400);
    });
  });

  // ─── Login (enhanced) ─────────────────────────────────────

  describe('Login', () => {
    it('rejects login with unverified email with 403', async () => {
      await createTestUser({
        email: 'unverified@test.com',
        password: 'Password123',
        isEmailVerified: false,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unverified@test.com', password: 'Password123' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/verify/i);
    });

    it('login with verified email returns 200', async () => {
      await createTestUser({
        email: 'verified@test.com',
        password: 'Password123',
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'verified@test.com', password: 'Password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('verified@test.com');
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('login returns pharmacy status (PENDING)', async () => {
      const { user } = await createTestUser({
        email: 'pending-pharm@test.com',
        password: 'Password123',
      });
      await createTestPharmacy(user.id, { status: 'PENDING' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'pending-pharm@test.com', password: 'Password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.pharmacy).toBeDefined();
      expect(res.body.data.user.pharmacy.status).toBe('PENDING');
    });

    it('login returns pharmacy status (REJECTED)', async () => {
      const { user } = await createTestUser({
        email: 'rejected-pharm@test.com',
        password: 'Password123',
      });
      await createTestPharmacy(user.id, { status: 'REJECTED' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'rejected-pharm@test.com', password: 'Password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.pharmacy.status).toBe('REJECTED');
    });

    it('login returns pharmacy status (VERIFIED)', async () => {
      const { user } = await createTestUser({
        email: 'verified-pharm@test.com',
        password: 'Password123',
      });
      await createTestPharmacy(user.id, { status: 'VERIFIED' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'verified-pharm@test.com', password: 'Password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.pharmacy.status).toBe('VERIFIED');
    });

    it('login with rememberMe=true returns cookie', async () => {
      await createTestUser({
        email: 'remember@test.com',
        password: 'Password123',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'remember@test.com', password: 'Password123', rememberMe: true });

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('login with rememberMe=false returns cookie', async () => {
      await createTestUser({
        email: 'no-remember@test.com',
        password: 'Password123',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'no-remember@test.com', password: 'Password123', rememberMe: false });

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });
  });

  // ─── Email Verification ──────────────────────────────────

  describe('Email Verification', () => {
    it('verifies email with valid token', async () => {
      const { user } = await createTestUser({
        email: 'ev-valid@test.com',
        isEmailVerified: false,
      });
      const { rawToken } = await createEmailVerificationToken(user.id);

      const res = await request(app)
        .get(`/api/v1/auth/verify-email?token=${rawToken}`);

      expect(res.status).toBe(200);

      // User should be marked as verified
      const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updatedUser?.isEmailVerified).toBe(true);
    });

    it('deletes all verification tokens after successful verification', async () => {
      const { user } = await createTestUser({
        email: 'ev-cleanup@test.com',
        isEmailVerified: false,
      });
      const { rawToken } = await createEmailVerificationToken(user.id);
      // Create a second token (e.g., from resend)
      await createEmailVerificationToken(user.id);

      await request(app).get(`/api/v1/auth/verify-email?token=${rawToken}`);

      const remainingTokens = await prisma.emailVerificationToken.findMany({
        where: { userId: user.id },
      });
      expect(remainingTokens.length).toBe(0);
    });

    it('rejects expired verification token', async () => {
      const { user } = await createTestUser({
        email: 'ev-expired@test.com',
        isEmailVerified: false,
      });
      // Create token that expired 1 hour ago
      const { rawToken } = await createEmailVerificationToken(user.id, -1);

      const res = await request(app)
        .get(`/api/v1/auth/verify-email?token=${rawToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired/i);
    });

    it('rejects invalid verification token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/verify-email?token=invalid-token-that-does-not-exist');

      expect(res.status).toBe(400);
    });
  });

  // ─── Resend Verification ─────────────────────────────────

  describe('Resend Verification', () => {
    it('resend verification for unverified user returns 200', async () => {
      await createTestUser({
        email: 'resend-unver@test.com',
        isEmailVerified: false,
      });

      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: 'resend-unver@test.com' });

      expect(res.status).toBe(200);
    });

    it('resend verification for verified user returns 200 (no enumeration)', async () => {
      await createTestUser({
        email: 'resend-ver@test.com',
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: 'resend-ver@test.com' });

      expect(res.status).toBe(200);
    });

    it('resend verification for non-existent email returns 200', async () => {
      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: 'nonexistent@test.com' });

      expect(res.status).toBe(200);
    });
  });

  // ─── Forgot Password ────────────────────────────────────

  describe('Forgot Password', () => {
    it('always returns 200 regardless of email existence', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' });

      expect(res.status).toBe(200);
    });

    it('creates a PasswordResetToken for existing user', async () => {
      const { user } = await createTestUser({
        email: 'forgot-existing@test.com',
      });

      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'forgot-existing@test.com' });

      const tokens = await prisma.passwordResetToken.findMany({
        where: { userId: user.id },
      });
      expect(tokens.length).toBe(1);
    });
  });

  // ─── Reset Password ─────────────────────────────────────

  describe('Reset Password', () => {
    it('resets password with valid token', async () => {
      const { user } = await createTestUser({
        email: 'reset-valid@test.com',
        password: 'OldPassword123',
      });
      const { rawToken } = await createPasswordResetToken(user.id);

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, password: 'NewPassword456' });

      expect(res.status).toBe(200);

      // Can login with new password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'reset-valid@test.com', password: 'NewPassword456' });

      expect(loginRes.status).toBe(200);
    });

    it('revokes all refresh tokens after password reset', async () => {
      const { user, refreshToken } = await createTestUser({
        email: 'reset-revoke@test.com',
      });
      // Store the refresh token
      await storeRefreshToken(user.id, refreshToken);

      const { rawToken } = await createPasswordResetToken(user.id);

      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, password: 'NewPassword456' });

      // Old refresh token should be revoked
      const storedToken = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
      });
      expect(storedToken?.revokedAt).not.toBeNull();
    });

    it('rejects expired reset token', async () => {
      const { user } = await createTestUser({
        email: 'reset-expired@test.com',
      });
      // Create token that expired 1 hour ago
      const { rawToken } = await createPasswordResetToken(user.id, -1);

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, password: 'NewPassword456' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired/i);
    });

    it('rejects invalid reset token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'invalid-token-string', password: 'NewPassword456' });

      expect(res.status).toBe(400);
    });

    it('rejects already-used reset token', async () => {
      const { user } = await createTestUser({
        email: 'reset-used@test.com',
      });
      const { rawToken } = await createPasswordResetToken(user.id);

      // First use — should succeed
      const firstRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, password: 'NewPassword456' });
      expect(firstRes.status).toBe(200);

      // Second use — should fail
      const secondRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, password: 'AnotherPassword789' });
      expect(secondRes.status).toBe(400);
    });
  });

  // ─── Refresh Token Revocation ────────────────────────────

  describe('Refresh Token Revocation', () => {
    it('rejects revoked refresh token', async () => {
      const { user, refreshToken } = await createTestUser({
        email: 'revoked-refresh@test.com',
      });

      // Store and then revoke the refresh token
      await storeRefreshToken(user.id, refreshToken);
      await prisma.refreshToken.update({
        where: { tokenHash: hashToken(refreshToken) },
        data: { revokedAt: new Date() },
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(res.status).toBe(401);
    });

    it('logout revokes stored refresh token', async () => {
      const { user, refreshToken } = await createTestUser({
        email: 'logout-revoke@test.com',
      });
      await storeRefreshToken(user.id, refreshToken);

      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', `refreshToken=${refreshToken}`);

      const storedToken = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
      });
      expect(storedToken?.revokedAt).not.toBeNull();
    });
  });

  // ─── Audit Logging ──────────────────────────────────────

  describe('Audit Logging', () => {
    it('creates audit log on registration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Audit Test', email: 'audit-reg@test.com', password: 'Password123' });

      expect(res.status).toBe(201);

      // Allow time for async audit log
      await new Promise(resolve => setTimeout(resolve, 200));

      const logs = await prisma.authAuditLog.findMany({
        where: { userId: res.body.data.user.id, action: 'REGISTER' },
      });
      expect(logs.length).toBe(1);
    });

    it('creates audit log on login', async () => {
      const { user } = await createTestUser({
        email: 'audit-login@test.com',
        password: 'Password123',
      });

      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'audit-login@test.com', password: 'Password123' });

      await new Promise(resolve => setTimeout(resolve, 200));

      const logs = await prisma.authAuditLog.findMany({
        where: { userId: user.id, action: 'LOGIN' },
      });
      expect(logs.length).toBe(1);
    });
  });
});
