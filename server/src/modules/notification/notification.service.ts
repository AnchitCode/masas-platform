import prisma from '../../lib/prisma.js';
import type { NotificationType, Prisma } from '@prisma/client';

// ─── Input Types ─────────────────────────────────────────────────

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue | null;
}

interface ListNotificationsParams {
  userId: string;
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────

/**
 * Notification data layer.
 *
 * Pure CRUD operations — no event handling, no Socket.io.
 * Event-driven notification creation happens in notificationEventBridge.
 */
const notificationService = {
  /**
   * Create a notification and return the full record.
   */
  async create(input: CreateNotificationInput) {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data === null || input.data === undefined ? undefined : input.data,
      },
    });

    return notification;
  },

  /**
   * List notifications for a user with pagination.
   * Ordered by most recent first.
   */
  async listByUser({ userId, page = 1, limit = 20, unreadOnly = false }: ListNotificationsParams) {
    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return { notifications, total, page, limit };
  },

  /**
   * Mark a single notification as read.
   * Returns the updated notification, or null if not found / not owned by user.
   */
  async markAsRead(notificationId: string, userId: string) {
    // Ensure the notification belongs to this user
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) return null;

    if (notification.isRead) return notification; // Already read

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  },

  /**
   * Mark all notifications for a user as read.
   * Returns the count of updated notifications.
   */
  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return result.count;
  },

  /**
   * Get the count of unread notifications for a user.
   */
  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  },

  /**
   * Delete a single notification.
   * Returns true if deleted, false if not found / not owned by user.
   */
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) return false;

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    return true;
  },

  /**
   * Delete notifications older than the given number of days.
   * Intended for future scheduled cleanup jobs (Phase 8.5+).
   */
  async deleteOlderThan(days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return result.count;
  },
};

export default notificationService;
