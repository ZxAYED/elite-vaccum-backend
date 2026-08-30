import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UserRole } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  // In-memory mapping of userId -> Set of active socket IDs
  private readonly activeUserSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🔔 Notifications WebSocket Gateway initialized on namespace /notifications');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`Unauthorized WebSocket connection attempt: socket ${client.id} provided no token`);
        client.emit('error', { message: 'Authentication required. Please provide a valid Bearer token.' });
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(token, { secret });

      if (!payload || !payload.id) {
        client.emit('error', { message: 'Invalid or expired token.' });
        client.disconnect();
        return;
      }

      // Verify user exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        client.emit('error', { message: 'User account is deactivated or does not exist.' });
        client.disconnect();
        return;
      }

      client.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      // Join user specific room and role room
      const userRoom = `user:${user.id}`;
      const roleRoom = `role:${user.role}`;
      await client.join([userRoom, roleRoom]);

      // Track active sockets
      if (!this.activeUserSockets.has(user.id)) {
        this.activeUserSockets.set(user.id, new Set());
      }
      this.activeUserSockets.get(user.id)!.add(client.id);

      this.logger.log(
        `⚡ Client connected: User [${user.email} | ${user.role}] (Socket: ${client.id})`,
      );

      // Send initial connection acknowledgement
      client.emit('notifications:ready', {
        success: true,
        message: 'Connected to real-time notification stream',
        userId: user.id,
        connectedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.error(`WebSocket authentication failed for socket ${client.id}: ${err.message}`);
      client.emit('error', { message: 'Authentication failed.' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user?.id) {
      const userId = client.user.id;
      const userSockets = this.activeUserSockets.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.activeUserSockets.delete(userId);
        }
      }
      this.logger.log(`🔌 Client disconnected: User [${client.user.email}] (Socket: ${client.id})`);
    } else {
      this.logger.log(`🔌 Anonymous socket disconnected: ${client.id}`);
    }
  }

  private extractToken(client: Socket): string | null {
    // 1. Check handshake.auth.token
    if (client.handshake?.auth?.token) {
      const auth = client.handshake.auth.token;
      return auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();
    }

    // 2. Check authorization header
    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }

    // 3. Check query string token (?token=...)
    if (client.handshake?.query?.token) {
      const queryToken = client.handshake.query.token as string;
      return queryToken.trim();
    }

    return null;
  }

  // ==========================================
  // DISPATCH & BROADCAST HELPERS
  // ==========================================

  /**
   * Emits a real-time notification event to a specific user across all their active sessions/devices.
   */
  sendToUser(userId: string, event: string, payload: any) {
    const room = `user:${userId}`;
    this.server.to(room).emit(event, payload);
    this.logger.debug(`Sent WS event '${event}' to user room '${room}'`);
  }

  /**
   * Emits an event to all users with a specific role (e.g. 'ADMIN' or 'TECHNICIAN').
   */
  sendToRole(role: UserRole, event: string, payload: any) {
    const room = `role:${role}`;
    this.server.to(room).emit(event, payload);
    this.logger.debug(`Sent WS event '${event}' to role room '${room}'`);
  }

  /**
   * Broadcasts a system alert to all currently connected clients.
   */
  broadcast(event: string, payload: any) {
    this.server.emit(event, payload);
    this.logger.debug(`Broadcasted WS event '${event}' to all clients`);
  }

  /**
   * Checks if a user is currently online with an active WebSocket connection.
   */
  isUserOnline(userId: string): boolean {
    const sockets = this.activeUserSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  // ==========================================
  // CLIENT SUBSCRIPTION MESSAGES
  // ==========================================

  @SubscribeMessage('notifications:ping')
  handlePing(client: AuthenticatedSocket) {
    return { event: 'notifications:pong', data: { timestamp: Date.now() } };
  }
}
