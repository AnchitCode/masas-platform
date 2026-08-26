import api from './api';

export interface Notification {
  id: string;
  userId: string;
  type: 'PHARMACY_VERIFIED' | 'PHARMACY_REJECTED' | 'LOW_STOCK_ALERT' | 'MEDICINE_AVAILABLE' | 'SYSTEM_ANNOUNCEMENT';
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
}

const notificationService = {
  async list(params?: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const { data } = await api.get('/notifications', { params });
    return data.data as NotificationListResponse;
  },

  async getUnreadCount() {
    const { data } = await api.get('/notifications/unread-count');
    return data.data.count as number;
  },

  async markAsRead(id: string) {
    const { data } = await api.patch(`/notifications/${id}/read`);
    return data.data.notification as Notification;
  },

  async markAllAsRead() {
    const { data } = await api.patch('/notifications/read-all');
    return data.data.count as number;
  },

  async deleteNotification(id: string) {
    await api.delete(`/notifications/${id}`);
  },
};

export default notificationService;
