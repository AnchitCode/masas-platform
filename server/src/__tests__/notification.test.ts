import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prisma,
  createTestUser,
  createTestNotification,
  createTestPharmacy,
  createAdminUser,
  createVerifiedPharmacyUser,
} from './setup.js';
import notificationService from '../modules/notification/notification.service.js';
import { eventBus } from '../lib/eventBus.js';
import app from '../app.js';
import request from 'supertest';

// ─── Notification Service — Unit Tests ───────────────────────────

describe('Notification Service', () => {
  describe('create()', () => {
    it('creates a notification with all fields', async () => {
      const { user } = await createTestUser();

      const notification = await notificationService.create({
        userId: user.id,
        type: 'PHARMACY_VERIFIED',
        title: 'Pharmacy Verified! 🎉',
        message: 'Your pharmacy has been verified.',
        data: { pharmacyId: 'some-id' },
      });

      expect(notification).toMatchObject({
        userId: user.id,
        type: 'PHARMACY_VERIFIED',
        title: 'Pharmacy Verified! 🎉',
        message: 'Your pharmacy has been verified.',
        data: { pharmacyId: 'some-id' },
        isRead: false,
      });
      expect(notification.id).toBeDefined();
      expect(notification.createdAt).toBeInstanceOf(Date);
    });

    it('creates a notification without optional data field', async () => {
      const { user } = await createTestUser();

      const notification = await notificationService.create({
        userId: user.id,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: 'System Update',
        message: 'Scheduled maintenance tonight.',
      });

      expect(notification.data).toBeNull();
    });
  });

  describe('listByUser()', () => {
    it('returns notifications ordered by most recent first', async () => {
      const { user } = await createTestUser();

      // Create 3 notifications with explicit time gaps for deterministic ordering
      const now = Date.now();
      const n1 = await createTestNotification(user.id, { title: 'First', createdAt: new Date(now - 2000) });
      const n2 = await createTestNotification(user.id, { title: 'Second', createdAt: new Date(now - 1000) });
      const n3 = await createTestNotification(user.id, { title: 'Third', createdAt: new Date(now) });

      const result = await notificationService.listByUser({ userId: user.id });

      expect(result.notifications).toHaveLength(3);
      expect(result.total).toBe(3);
      // Most recent first
      expect(result.notifications[0].id).toBe(n3.id);
      expect(result.notifications[1].id).toBe(n2.id);
      expect(result.notifications[2].id).toBe(n1.id);
    });

    it('paginates correctly', async () => {
      const { user } = await createTestUser();

      // Create 5 notifications
      for (let i = 0; i < 5; i++) {
        await createTestNotification(user.id, { title: `Notification ${i}` });
      }

      const page1 = await notificationService.listByUser({ userId: user.id, page: 1, limit: 2 });
      const page2 = await notificationService.listByUser({ userId: user.id, page: 2, limit: 2 });
      const page3 = await notificationService.listByUser({ userId: user.id, page: 3, limit: 2 });

      expect(page1.notifications).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page2.notifications).toHaveLength(2);
      expect(page3.notifications).toHaveLength(1);
    });

    it('filters by unreadOnly', async () => {
      const { user } = await createTestUser();

      await createTestNotification(user.id, { isRead: false, title: 'Unread 1' });
      await createTestNotification(user.id, { isRead: true, title: 'Read 1' });
      await createTestNotification(user.id, { isRead: false, title: 'Unread 2' });

      const result = await notificationService.listByUser({ userId: user.id, unreadOnly: true });

      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.notifications.every((n) => !n.isRead)).toBe(true);
    });

    it('does not return notifications from other users', async () => {
      const { user: user1 } = await createTestUser({ email: 'user1@test.com' });
      const { user: user2 } = await createTestUser({ email: 'user2@test.com' });

      await createTestNotification(user1.id, { title: 'For User 1' });
      await createTestNotification(user2.id, { title: 'For User 2' });

      const result = await notificationService.listByUser({ userId: user1.id });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].title).toBe('For User 1');
    });
  });

  describe('markAsRead()', () => {
    it('marks a notification as read', async () => {
      const { user } = await createTestUser();
      const notification = await createTestNotification(user.id);

      expect(notification.isRead).toBe(false);

      const updated = await notificationService.markAsRead(notification.id, user.id);

      expect(updated).not.toBeNull();
      expect(updated!.isRead).toBe(true);
    });

    it('returns null if notification belongs to another user', async () => {
      const { user: user1 } = await createTestUser({ email: 'owner@test.com' });
      const { user: user2 } = await createTestUser({ email: 'other@test.com' });
      const notification = await createTestNotification(user1.id);

      const result = await notificationService.markAsRead(notification.id, user2.id);

      expect(result).toBeNull();
    });

    it('returns the notification as-is if already read', async () => {
      const { user } = await createTestUser();
      const notification = await createTestNotification(user.id, { isRead: true });

      const result = await notificationService.markAsRead(notification.id, user.id);

      expect(result).not.toBeNull();
      expect(result!.isRead).toBe(true);
    });
  });

  describe('markAllAsRead()', () => {
    it('marks all unread notifications as read and returns count', async () => {
      const { user } = await createTestUser();

      await createTestNotification(user.id, { isRead: false });
      await createTestNotification(user.id, { isRead: false });
      await createTestNotification(user.id, { isRead: true }); // already read

      const count = await notificationService.markAllAsRead(user.id);

      expect(count).toBe(2);

      const unreadCount = await notificationService.getUnreadCount(user.id);
      expect(unreadCount).toBe(0);
    });
  });

  describe('getUnreadCount()', () => {
    it('returns the correct unread count', async () => {
      const { user } = await createTestUser();

      await createTestNotification(user.id, { isRead: false });
      await createTestNotification(user.id, { isRead: false });
      await createTestNotification(user.id, { isRead: true });

      const count = await notificationService.getUnreadCount(user.id);

      expect(count).toBe(2);
    });

    it('returns 0 when no notifications exist', async () => {
      const { user } = await createTestUser();

      const count = await notificationService.getUnreadCount(user.id);

      expect(count).toBe(0);
    });
  });

  describe('deleteOlderThan()', () => {
    it('deletes notifications older than N days', async () => {
      const { user } = await createTestUser();

      // Create a notification, then backdate it to 31 days ago
      const old = await createTestNotification(user.id, { title: 'Old' });
      await prisma.notification.update({
        where: { id: old.id },
        data: { createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
      });

      await createTestNotification(user.id, { title: 'Recent' });

      const deletedCount = await notificationService.deleteOlderThan(30);

      expect(deletedCount).toBe(1);

      const remaining = await notificationService.listByUser({ userId: user.id });
      expect(remaining.total).toBe(1);
      expect(remaining.notifications[0].title).toBe('Recent');
    });
  });
});

// ─── Notification Event Bridge — Integration Tests ───────────────

describe('Notification Event Bridge — Integration', () => {
  // Initialize the bridge once — idempotency guard prevents duplicate listeners
  beforeAll(async () => {
    const { bridgeEventsToNotifications } = await import('../lib/notificationEventBridge.js');
    bridgeEventsToNotifications();
  });

  it('creates a notification when pharmacy.verified is emitted', async () => {
    const { user } = await createTestUser();
    const pharmacy = await createTestPharmacy(user.id, { name: 'Bridge Test Pharmacy', status: 'PENDING' });

    // Emit the event
    eventBus.emit('pharmacy.verified', {
      pharmacyId: pharmacy.id,
      userId: user.id,
      pharmacyName: 'Bridge Test Pharmacy',
    });

    // Wait for async handler to finish
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Check the DB
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      userId: user.id,
      type: 'PHARMACY_VERIFIED',
      title: 'Pharmacy Verified! 🎉',
      isRead: false,
    });
    expect(notifications[0].message).toContain('Bridge Test Pharmacy');
    expect(notifications[0].data).toMatchObject({ pharmacyId: pharmacy.id });
  });

  it('creates a notification when pharmacy.rejected is emitted with reason', async () => {
    const { user } = await createTestUser();
    const pharmacy = await createTestPharmacy(user.id, { name: 'Rejected Pharmacy' });

    eventBus.emit('pharmacy.rejected', {
      pharmacyId: pharmacy.id,
      userId: user.id,
      pharmacyName: 'Rejected Pharmacy',
      reason: 'Invalid license documentation',
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('PHARMACY_REJECTED');
    expect(notifications[0].message).toContain('Invalid license documentation');
    expect(notifications[0].data).toMatchObject({
      pharmacyId: pharmacy.id,
      reason: 'Invalid license documentation',
    });
  });

  it('creates a notification when pharmacy.rejected is emitted without reason', async () => {
    const { user } = await createTestUser();
    const pharmacy = await createTestPharmacy(user.id, { name: 'No Reason Pharmacy' });

    eventBus.emit('pharmacy.rejected', {
      pharmacyId: pharmacy.id,
      userId: user.id,
      pharmacyName: 'No Reason Pharmacy',
      reason: undefined,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain('Please update your profile and resubmit');
    expect(notifications[0].data).toMatchObject({ reason: null });
  });

  it('admin verify endpoint creates a notification for the pharmacy owner', async () => {
    const { user: adminUser, accessToken: adminToken } = await createAdminUser();
    const { user: pharmacyUser } = await createTestUser({ email: 'pharmacy-owner@test.com' });
    const pharmacy = await createTestPharmacy(pharmacyUser.id, {
      name: 'API Test Pharmacy',
      status: 'PENDING',
    });

    // The admin verifies the pharmacy via the API
    const res = await request(app)
      .patch(`/api/v1/admin/pharmacies/${pharmacy.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'VERIFIED' });

    expect(res.status).toBe(200);

    // Wait for async event handler to process
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Check that a notification was created for the pharmacy owner
    const notifications = await prisma.notification.findMany({
      where: { userId: pharmacyUser.id },
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('PHARMACY_VERIFIED');
    expect(notifications[0].message).toContain('API Test Pharmacy');
  });
});

// ─── Notification API — HTTP Endpoint Tests ──────────────────────

describe('Notification API Endpoints', () => {
  describe('GET /api/v1/notifications', () => {
    it('returns paginated notifications for authenticated user', async () => {
      const { user, accessToken } = await createTestUser();
      const now = Date.now();
      await createTestNotification(user.id, { title: 'Notif 1', createdAt: new Date(now - 2000) });
      await createTestNotification(user.id, { title: 'Notif 2', createdAt: new Date(now - 1000) });
      await createTestNotification(user.id, { title: 'Notif 3', createdAt: new Date(now) });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toHaveLength(3);
      expect(res.body.data.total).toBe(3);
      // Most recent first
      expect(res.body.data.notifications[0].title).toBe('Notif 3');
    });

    it('supports pagination', async () => {
      const { user, accessToken } = await createTestUser();
      for (let i = 0; i < 5; i++) {
        await createTestNotification(user.id, { title: `N${i}` });
      }

      const res = await request(app)
        .get('/api/v1/notifications?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications).toHaveLength(2);
      expect(res.body.data.total).toBe(5);
    });

    it('supports unreadOnly filter', async () => {
      const { user, accessToken } = await createTestUser();
      await createTestNotification(user.id, { title: 'Unread', isRead: false });
      await createTestNotification(user.id, { title: 'Read', isRead: true });

      const res = await request(app)
        .get('/api/v1/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.notifications[0].title).toBe('Unread');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });

    it('does not return other users notifications', async () => {
      const { user: u1, accessToken: t1 } = await createTestUser({ email: 'u1@test.com' });
      const { user: u2 } = await createTestUser({ email: 'u2@test.com' });
      await createTestNotification(u1.id, { title: 'For U1' });
      await createTestNotification(u2.id, { title: 'For U2' });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${t1}`);

      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.notifications[0].title).toBe('For U1');
    });
  });

  describe('GET /api/v1/notifications/unread-count', () => {
    it('returns the unread count', async () => {
      const { user, accessToken } = await createTestUser();
      await createTestNotification(user.id, { isRead: false });
      await createTestNotification(user.id, { isRead: false });
      await createTestNotification(user.id, { isRead: true });

      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('marks a notification as read', async () => {
      const { user, accessToken } = await createTestUser();
      const notification = await createTestNotification(user.id, { isRead: false });

      const res = await request(app)
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notification.isRead).toBe(true);
    });

    it('returns 404 for another users notification', async () => {
      const { user: u1 } = await createTestUser({ email: 'owner@test.com' });
      const { accessToken: t2 } = await createTestUser({ email: 'attacker@test.com' });
      const notification = await createTestNotification(u1.id);

      const res = await request(app)
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${t2}`);

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid UUID', async () => {
      const { accessToken } = await createTestUser();

      const res = await request(app)
        .patch('/api/v1/notifications/not-a-uuid/read')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/notifications/read-all', () => {
    it('marks all notifications as read', async () => {
      const { user, accessToken } = await createTestUser();
      await createTestNotification(user.id, { isRead: false });
      await createTestNotification(user.id, { isRead: false });

      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);

      // Verify via unread count
      const countRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(countRes.body.data.count).toBe(0);
    });
  });

  describe('DELETE /api/v1/notifications/:id', () => {
    it('deletes a notification', async () => {
      const { user, accessToken } = await createTestUser();
      const notification = await createTestNotification(user.id);

      const res = await request(app)
        .delete(`/api/v1/notifications/${notification.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);

      // Verify it's gone
      const listRes = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(listRes.body.data.total).toBe(0);
    });

    it('returns 404 for another users notification', async () => {
      const { user: u1 } = await createTestUser({ email: 'del-owner@test.com' });
      const { accessToken: t2 } = await createTestUser({ email: 'del-attacker@test.com' });
      const notification = await createTestNotification(u1.id);

      const res = await request(app)
        .delete(`/api/v1/notifications/${notification.id}`)
        .set('Authorization', `Bearer ${t2}`);

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid UUID', async () => {
      const { accessToken } = await createTestUser();

      const res = await request(app)
        .delete('/api/v1/notifications/not-a-uuid')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
    });
  });
});
