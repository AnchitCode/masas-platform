import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import type { Notification } from '../../services/notificationService';

// ─── Notification type → icon color mapping ──────────────────────

function getTypeColor(type: Notification['type']): string {
  switch (type) {
    case 'PHARMACY_VERIFIED':
      return 'var(--primary)';
    case 'PHARMACY_REJECTED':
      return 'var(--danger, #ef4444)';
    case 'LOW_STOCK_ALERT':
      return 'var(--warning, #f59e0b)';
    case 'MEDICINE_AVAILABLE':
      return 'var(--primary)';
    case 'SYSTEM_ANNOUNCEMENT':
      return 'var(--text-muted)';
    default:
      return 'var(--text-muted)';
  }
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button
        className="notification-bell-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        id="notification-bell-button"
      >
        <Bell style={{ width: 18, height: 18 }} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown" id="notification-dropdown">
          {/* Header */}
          <div className="notification-dropdown-header">
            <span className="notification-dropdown-title">Notifications</span>
            <div className="notification-dropdown-actions">
              {unreadCount > 0 && (
                <button
                  className="notification-action-btn"
                  onClick={() => void markAllAsRead()}
                  title="Mark all as read"
                >
                  <CheckCheck style={{ width: 14, height: 14 }} />
                </button>
              )}
              <button
                className="notification-action-btn"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="notification-dropdown-list">
            {loading ? (
              <div className="notification-empty">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notification-item ${!n.isRead ? 'unread' : ''}`}
                  onClick={() => {
                    if (!n.isRead) void markAsRead(n.id);
                  }}
                >
                  <div
                    className="notification-dot"
                    style={{ backgroundColor: !n.isRead ? getTypeColor(n.type) : 'transparent' }}
                  />
                  <div className="notification-content">
                    <div className="notification-title-row">
                      <span className="notification-item-title">{n.title}</span>
                      <span className="notification-time">{formatTimeAgo(n.createdAt)}</span>
                    </div>
                    <p className="notification-message">{n.message}</p>
                  </div>
                  <div className="notification-item-actions">
                    {!n.isRead && (
                      <button
                        className="notification-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          void markAsRead(n.id);
                        }}
                        title="Mark as read"
                      >
                        <Check style={{ width: 12, height: 12 }} />
                      </button>
                    )}
                    <button
                      className="notification-icon-btn danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteNotification(n.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
