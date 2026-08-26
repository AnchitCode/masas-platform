import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import notificationService from '../services/notificationService';
import type { Notification } from '../services/notificationService';

/**
 * Notification state management hook.
 *
 * Manages the notification list, unread count, and provides
 * actions for marking as read, marking all as read, and deleting.
 *
 * Listens for real-time 'notification:new' events via Socket.io
 * through the SocketContext to immediately update UI state.
 */
export function useNotifications() {
  const { isAuthenticated } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const fetchedRef = useRef(false);

  // ── Fetch notifications from API ───────────────────────────────
  const fetchNotifications = useCallback(async (pageNum = 1) => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const result = await notificationService.list({ page: pageNum, limit: 20 });
      setNotifications(result.notifications);
      setTotal(result.total);
      setPage(pageNum);
    } catch {
      // Silently fail — don't crash the UI
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // ── Fetch unread count ─────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently fail
    }
  }, [isAuthenticated]);

  // ── Initial fetch ──────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated && !fetchedRef.current) {
      fetchedRef.current = true;
      void fetchNotifications();
      void fetchUnreadCount();
    }
    if (!isAuthenticated) {
      fetchedRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifications([]);
      setUnreadCount(0);
      setTotal(0);
    }
  }, [isAuthenticated, fetchNotifications, fetchUnreadCount]);

  // ── Socket.io listener for real-time notifications ─────────────
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
      setTotal((prev) => prev + 1);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, isAuthenticated]);

  // ── Actions ────────────────────────────────────────────────────

  const markAsRead = useCallback(async (id: string) => {
    try {
      const updated = await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? updated : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const was = notifications.find((n) => n.id === id);
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((prev) => prev - 1);
      if (was && !was.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Silently fail
    }
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    total,
    loading,
    page,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}
