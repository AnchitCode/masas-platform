import { z } from 'zod';

// ─── Query Params ────────────────────────────────────────────────

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

// ─── Path Params ─────────────────────────────────────────────────

export const notificationIdSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
});
