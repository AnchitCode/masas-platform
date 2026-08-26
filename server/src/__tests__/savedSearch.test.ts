import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import { createTestUser, createTestSavedSearch } from './setup.js';
import prisma from '../lib/prisma.js';

describe('Saved Searches API (Phase 8.9)', () => {
  let customerToken: string;
  let customerId: string;
  let pharmacyToken: string;
  let adminToken: string;

  beforeEach(async () => {
    // CUSTOMER
    const customer = await createTestUser({ role: 'CUSTOMER' });
    customerToken = customer.accessToken;
    customerId = customer.user.id;

    // PHARMACY
    const pharmacy = await createTestUser({ role: 'PHARMACY' });
    pharmacyToken = pharmacy.accessToken;

    // ADMIN
    const admin = await createTestUser({ role: 'ADMIN' });
    adminToken = admin.accessToken;
  });

  describe('Authentication & Authorization', () => {
    it('rejects unauthenticated POST requests with 401', async () => {
      const res = await request(app)
        .post('/api/v1/saved-searches')
        .send({ query: 'paracetamol', latitude: 20, longitude: 30 });
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated GET requests with 401', async () => {
      const res = await request(app).get('/api/v1/saved-searches');
      expect(res.status).toBe(401);
    });

    it('rejects PHARMACY users with 403', async () => {
      const res = await request(app)
        .get('/api/v1/saved-searches')
        .set('Authorization', `Bearer ${pharmacyToken}`);
      expect(res.status).toBe(403);
    });

    it('rejects ADMIN users with 403', async () => {
      const res = await request(app)
        .get('/api/v1/saved-searches')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/saved-searches', () => {
    it('creates a saved search successfully', async () => {
      const res = await request(app)
        .post('/api/v1/saved-searches')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          query: 'ibuprofen',
          latitude: 28.6139,
          longitude: 77.2090,
          radiusKm: 10,
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        query: 'ibuprofen',
        latitude: 28.6139,
        longitude: 77.2090,
        radiusKm: 10,
        isActive: true,
      });

      const dbRecord = await prisma.savedSearch.findUnique({
        where: { id: res.body.data.id }
      });
      expect(dbRecord).toBeTruthy();
      expect(dbRecord?.userId).toBe(customerId);
    });

    it('rejects invalid validation (empty query, bad lat/lng)', async () => {
      const res = await request(app)
        .post('/api/v1/saved-searches')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          query: '',
          latitude: 91, // invalid
          longitude: 200, // invalid
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/v1/saved-searches', () => {
    it('lists only the authenticated user\'s saved searches', async () => {
      // Create one for our customer
      await createTestSavedSearch(customerId, { query: 'med1' });
      
      // Create one for another customer
      const otherCustomer = await createTestUser({ role: 'CUSTOMER' });
      await createTestSavedSearch(otherCustomer.user.id, { query: 'med2' });

      const res = await request(app)
        .get('/api/v1/saved-searches')
        .set('Authorization', `Bearer ${customerToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].query).toBe('med1');
    });
  });

  describe('GET /api/v1/saved-searches/:id', () => {
    it('returns a saved search if owned by the user', async () => {
      const search = await createTestSavedSearch(customerId, { query: 'med1' });
      
      const res = await request(app)
        .get(`/api/v1/saved-searches/${search.id}`)
        .set('Authorization', `Bearer ${customerToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(search.id);
    });

    it('returns 404 (IDOR protection) if owned by another user', async () => {
      const otherCustomer = await createTestUser({ role: 'CUSTOMER' });
      const search = await createTestSavedSearch(otherCustomer.user.id, { query: 'med2' });
      
      const res = await request(app)
        .get(`/api/v1/saved-searches/${search.id}`)
        .set('Authorization', `Bearer ${customerToken}`);
      
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/saved-searches/:id', () => {
    it('updates a saved search (e.g., deactivates it)', async () => {
      const search = await createTestSavedSearch(customerId, { isActive: true });
      
      const res = await request(app)
        .patch(`/api/v1/saved-searches/${search.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ isActive: false, radiusKm: 20 });
      
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
      expect(res.body.data.radiusKm).toBe(20);

      const dbRecord = await prisma.savedSearch.findUnique({
        where: { id: search.id }
      });
      expect(dbRecord?.isActive).toBe(false);
    });

    it('returns 404 (IDOR protection) when trying to update another user\'s search', async () => {
      const otherCustomer = await createTestUser({ role: 'CUSTOMER' });
      const search = await createTestSavedSearch(otherCustomer.user.id);
      
      const res = await request(app)
        .patch(`/api/v1/saved-searches/${search.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ isActive: false });
      
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/saved-searches/:id', () => {
    it('deletes a saved search successfully', async () => {
      const search = await createTestSavedSearch(customerId);
      
      const res = await request(app)
        .delete(`/api/v1/saved-searches/${search.id}`)
        .set('Authorization', `Bearer ${customerToken}`);
      
      expect(res.status).toBe(200);
      
      const dbRecord = await prisma.savedSearch.findUnique({
        where: { id: search.id }
      });
      expect(dbRecord).toBeNull();
    });

    it('returns 404 (IDOR protection) when trying to delete another user\'s search', async () => {
      const otherCustomer = await createTestUser({ role: 'CUSTOMER' });
      const search = await createTestSavedSearch(otherCustomer.user.id);
      
      const res = await request(app)
        .delete(`/api/v1/saved-searches/${search.id}`)
        .set('Authorization', `Bearer ${customerToken}`);
      
      expect(res.status).toBe(404);

      // Verify it was NOT deleted
      const dbRecord = await prisma.savedSearch.findUnique({
        where: { id: search.id }
      });
      expect(dbRecord).toBeTruthy();
    });
  });
});
