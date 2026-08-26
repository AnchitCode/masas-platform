import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

// ─── Context Type ────────────────────────────────────────────────

interface SocketContextType {
  /** The active Socket.io client instance, or null if not connected */
  socket: Socket | null;
  /** Whether the socket is currently connected */
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

// ─── Provider ────────────────────────────────────────────────────

/**
 * SocketProvider manages the Socket.io lifecycle:
 *
 *  - Connects when a user is authenticated (accessToken exists)
 *  - Disconnects on logout
 *  - Handles auth:revoked from the server (forced session invalidation)
 *  - Tracks connection state for UI indicators
 *
 * Must be rendered INSIDE <AuthProvider> so it can access the auth state.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    // Only connect if user is authenticated and we have a token
    if (!user || !token) {
      disconnectSocket();
      /* eslint-disable react-hooks/set-state-in-effect */
      setSocket(null);
      setIsConnected(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    // Connect
    const sock = connectSocket(token);
    /* eslint-disable react-hooks/set-state-in-effect */
    setSocket(sock);
    /* eslint-enable react-hooks/set-state-in-effect */

    // ── Connection Events ──────────────────────────────────
    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    // ── Server-Forced Session Revocation ───────────────────
    // The server emits this when tokenVersion changes
    // (password reset, admin force-logout, etc.)
    const onAuthRevoked = () => {
      localStorage.removeItem('accessToken');
      disconnectSocket();
      setSocket(null);
      // Redirect to login — logout() clears user state
      logout();
    };

    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);
    sock.on('auth:revoked', onAuthRevoked);

    // If already connected (synchronous connect)
    if (sock.connected) {
      setIsConnected(true);
    }

    // ── Cleanup ────────────────────────────────────────────
    return () => {
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.off('auth:revoked', onAuthRevoked);
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Reconnect when user changes (login/logout/switch user)

  const value: SocketContextType = {
    socket: socket ?? getSocket(),
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  return useContext(SocketContext);
}

export default SocketContext;
