import type { Request, Response, NextFunction } from 'express';
import notificationService from './notification.service.js';
import { createSuccessResponse } from '../../utils/response.js';
import ApiError from '../../utils/apiError.js';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── GET / — List own notifications (paginated) ──────────────────

const listNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { page, limit, unreadOnly } = req.query as unknown as {
      page: number;
      limit: number;
      unreadOnly: boolean;
    };

    const result = await notificationService.listByUser({
      userId: authReq.user.userId,
      page,
      limit,
      unreadOnly,
    });

    res.status(200).json(createSuccessResponse('Notifications retrieved', result));
  } catch (error) {
    next(error);
  }
};

// ─── GET /unread-count — Badge count ─────────────────────────────

const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const count = await notificationService.getUnreadCount(authReq.user.userId);

    res.status(200).json(createSuccessResponse('Unread count retrieved', { count }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /:id/read — Mark single as read ───────────────────────

const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const notification = await notificationService.markAsRead(
      req.params.id as string,
      authReq.user.userId,
    );

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    res.status(200).json(createSuccessResponse('Notification marked as read', { notification }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /read-all — Mark all as read ──────────────────────────

const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const count = await notificationService.markAllAsRead(authReq.user.userId);

    res.status(200).json(createSuccessResponse('All notifications marked as read', { count }));
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /:id — Delete single notification ────────────────────

const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const deleted = await notificationService.deleteNotification(
      req.params.id as string,
      authReq.user.userId,
    );

    if (!deleted) {
      throw ApiError.notFound('Notification not found');
    }

    res.status(200).json(createSuccessResponse('Notification deleted'));
  } catch (error) {
    next(error);
  }
};

export {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
