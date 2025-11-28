/**
 * Socket.io WebSocket server setup
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, AuthUser } from '@tracearr/shared';
import { WS_EVENTS } from '@tracearr/shared';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketData {
  user: AuthUser;
}

let io: TypedServer | null = null;

export function initializeWebSocket(httpServer: HttpServer): TypedServer {
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? true,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket: TypedSocket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify JWT and attach user to socket
      // const user = await verifyJWT(token);
      // socket.data.user = user;

      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join user-specific room for targeted messages
    // const user = socket.data.user;
    // socket.join(`user:${user.userId}`);

    // Handle session subscriptions
    socket.on(WS_EVENTS.SUBSCRIBE_SESSIONS as 'subscribe:sessions', () => {
      socket.join('sessions');
      console.log(`${socket.id} subscribed to sessions`);
    });

    socket.on(WS_EVENTS.UNSUBSCRIBE_SESSIONS as 'unsubscribe:sessions', () => {
      socket.leave('sessions');
      console.log(`${socket.id} unsubscribed from sessions`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  return io;
}

export function getIO(): TypedServer {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  return io;
}

export function broadcastToSessions<K extends keyof ServerToClientEvents>(
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
): void {
  if (io) {
    io.to('sessions').emit(event, ...args);
  }
}

export function broadcastToServer<K extends keyof ServerToClientEvents>(
  serverId: string,
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
): void {
  if (io) {
    io.to(`server:${serverId}`).emit(event, ...args);
  }
}
