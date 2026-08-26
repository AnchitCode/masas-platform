import { io, Socket } from 'socket.io-client';

/**
 * Socket.io client singleton.
 *
 * Connects to the same origin as the API (Socket.io runs on the same HTTP server).
 * Auth token is passed via handshake.auth — NOT as a query param (which would leak in logs).
 *
 * Usage:
 *   connectSocket(token)  — create and connect
 *   disconnectSocket()    — clean disconnect
 *   getSocket()           — get current instance (may be null)
 */

let socket: Socket | null = null;

/**
 * Extract the base URL (origin) from the API URL.
 * VITE_API_URL is something like "http://localhost:5001/api/v1"
 * Socket.io needs just the origin: "http://localhost:5001"
 */
function getSocketUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';
  try {
    const url = new URL(apiUrl);
    return url.origin;
  } catch {
    // Fallback if URL parsing fails
    return 'http://localhost:5001';
  }
}

/**
 * Create and connect a Socket.io client.
 * If a socket already exists, disconnects it first.
 */
export function connectSocket(token: string): Socket {
  // Disconnect existing socket if any
  if (socket?.connected) {
    socket.disconnect();
  }

  socket = io(getSocketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

/**
 * Disconnect and clean up the socket.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get the current socket instance (may be null if not connected).
 */
export function getSocket(): Socket | null {
  return socket;
}
