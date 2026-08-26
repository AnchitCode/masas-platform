import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { verifyAccessToken } from '../utils/jwt.js';
import prisma from './prisma.js';

// ─── Singleton ───────────────────────────────────────────────────

let io: Server | null = null;

/**
 * Get the initialized Socket.io server instance.
 * Returns null if Socket.io hasn't been initialized (e.g., in tests).
 * All callers should use optional chaining: getIO()?.to(...).emit(...)
 */
export function getIO(): Server | null {
  return io;
}

// ─── Socket.io data attached during handshake ────────────────────
interface SocketData {
  userId: string;
  role: string;
  tokenVersion: number;
  pharmacyId?: string;
}

/**
 * Initialize Socket.io on the given HTTP server.
 *
 * - CORS mirrors the Express cors config
 * - Auth middleware verifies JWT from handshake.auth.token
 * - On connect: user joins rooms based on role
 */
export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.isDev
        ? [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000']
        : env.CLIENT_URL,
      credentials: true,
    },
    // Disable serving the client bundle — we install socket.io-client separately
    serveClient: false,
  });

  // ── Auth Middleware ──────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify JWT — throws if invalid/expired
      const decoded = verifyAccessToken(token);

      // Fetch user to get tokenVersion and optional pharmacy
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          role: true,
          tokenVersion: true,
          pharmacy: { select: { id: true } },
        },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      // Attach data to socket for room assignment and re-verification
      const socketData: SocketData = {
        userId: user.id,
        role: user.role,
        tokenVersion: user.tokenVersion,
        pharmacyId: user.pharmacy?.id,
      };

      socket.data = socketData;
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      next(new Error(message));
    }
  });

  // ── Connection Handler ──────────────────────────────────────
  io.on('connection', (socket) => {
    const data = socket.data as SocketData;

    logger.debug('socket connected', {
      socketId: socket.id,
      userId: data.userId,
      role: data.role,
    });

    // ── Join Rooms ──────────────────────────────────────────
    // Personal room — every user gets their own
    void socket.join(`user:${data.userId}`);

    // Pharmacy room — if user has an associated pharmacy
    if (data.pharmacyId) {
      void socket.join(`pharmacy:${data.pharmacyId}`);
    }

    // Admin room
    if (data.role === 'ADMIN') {
      void socket.join('admin');
    }

    // ── Cleanup ────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.debug('socket disconnected', {
        socketId: socket.id,
        userId: data.userId,
        reason,
      });
    });
  });

  logger.info('🔌 Socket.io initialized');

  return io;
}
