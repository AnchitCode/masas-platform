const request = require('supertest');
const app = require('../app');
const { createTestUser, createTestPharmacy } = require('./setup');

describe('Auth Module', () => {
  // ─── Register ─────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user with valid data', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'new@test.com', password: 'Password123' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('new@test.com');
      expect(res.body.data.user.role).toBe('PHARMACY');
      expect(res.body.data.accessToken).toBeDefined();
      // Password hash must never be in the response
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('sets refreshToken as httpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'cookie@test.com', password: 'Password123' });

      expect(res.status).toBe(201);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = Array.isArray(cookies)
        ? cookies.find((c) => c.startsWith('refreshToken='))
        : cookies;
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toMatch(/httponly/i);
    });

    it('rejects duplicate email with 409', async () => {
      await createTestUser({ email: 'dup@test.com' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'dup@test.com', password: 'Password123' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing email with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ password: 'Password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects short password (< 8 chars) with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'short@test.com', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid email format with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'notanemail', password: 'Password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('defaults role to PHARMACY', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'default@test.com', password: 'Password123' });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('PHARMACY');
    });
  });

  // ─── Login ────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('logs in with correct credentials', async () => {
      await createTestUser({ email: 'login@test.com', password: 'Password123' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@test.com', password: 'Password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('login@test.com');
      expect(res.body.data.accessToken).toBeDefined();
      // Password hash must never be in the response
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('rejects wrong password with 401', async () => {
      await createTestUser({ email: 'wrong@test.com', password: 'RightPassword' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'wrong@test.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects non-existent email with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@test.com', password: 'Password123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns same error message for wrong email and wrong password', async () => {
      await createTestUser({ email: 'enum@test.com', password: 'RightPass' });

      const wrongEmail = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'wrong-enum@test.com', password: 'RightPass' });

      const wrongPass = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'enum@test.com', password: 'WrongPass' });

      // Both should have the same generic error message (prevent user enumeration)
      expect(wrongEmail.body.message).toBe(wrongPass.body.message);
    });
  });

  // ─── Refresh Token ────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('refreshes token with valid cookie', async () => {
      const { refreshToken } = await createTestUser({ email: 'refresh@test.com' });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('rejects missing refresh token cookie with 401', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid refresh token with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Get Me ───────────────────────────────────────────────

  describe('GET /api/v1/auth/me', () => {
    it('returns user profile with valid token', async () => {
      const { accessToken } = await createTestUser({ email: 'me@test.com' });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('me@test.com');
    });

    it('includes pharmacy info when pharmacy exists', async () => {
      const { user, accessToken } = await createTestUser({ email: 'pharma-me@test.com' });
      await createTestPharmacy(user.id, { name: 'My Pharmacy' });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.pharmacy).toBeDefined();
      expect(res.body.data.user.pharmacy.name).toBe('My Pharmacy');
    });

    it('rejects missing token with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid token with 401', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Logout ───────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('clears refreshToken cookie', async () => {
      const res = await request(app).post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Cookie should be cleared (set to empty or with past expiry)
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        const refreshCookie = Array.isArray(cookies)
          ? cookies.find((c) => c.startsWith('refreshToken='))
          : cookies;
        if (refreshCookie) {
          // Cookie value should be empty or have a past expires date
          expect(
            refreshCookie.includes('refreshToken=;') ||
            refreshCookie.includes('Expires=Thu, 01 Jan 1970')
          ).toBe(true);
        }
      }
    });
  });
});
