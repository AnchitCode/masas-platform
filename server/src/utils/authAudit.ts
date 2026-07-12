import type { Request } from 'express';
import prisma from '../lib/prisma.js';
import logger from './logger.js';

/**
 * Lightweight authentication audit logger.
 * Extracts IP + User-Agent from the Express request and writes to AuthAuditLog.
 * Fire-and-forget: errors are logged but never affect the auth flow.
 */
export async function logAuthEvent(options: {
  userId?: string;
  action: string;
  req: Request;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const ipAddress =
      (options.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      options.req.socket?.remoteAddress ||
      null;
    const userAgent = (options.req.headers['user-agent'] as string) || null;

    await prisma.authAuditLog.create({
      data: {
        userId: options.userId || null,
        action: options.action,
        ipAddress,
        userAgent,
        metadata: options.metadata ? (options.metadata as Record<string, unknown>) : undefined,
      } as Parameters<typeof prisma.authAuditLog.create>[0]['data'],
    });
  } catch (error) {
    // Never let audit logging failures affect the auth flow
    logger.error('Failed to write auth audit log', {
      action: options.action,
      error: String(error),
    });
  }
}
