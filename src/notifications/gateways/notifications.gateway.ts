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
import { REDIS_CHANNELS } from 'src/redis/constants/redis.constants';
import { RedisPresenceService } from 'src/redis/redis-presence.service';
import { RedisPubSubService } from 'src/redis/redis-pubsub.service';

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export interface NotificationPubSubPayload {
  target: 'user' | 'role' | 'broadcast';
  targetId?: string;
  role?: UserRole;
  event: string;
  data: any;
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

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly presenceService: RedisPresenceService,
    private readonly pubSubService: RedisPubSubService,
  ) {}

  async afterInit(server: Server) {
    this.logger.log('🔔 Notifications WebSocket Gateway initialized on namespace /notifications');

    // Subscribe to Redis PubSub channel for multi-instance cluster synchronization
    await this.pubSubService.subscribe<NotificationPubSubPayload>(
      REDIS_CHANNELS.NOTIFICATIONS,
      (payload) => {
        this.handlePubSubNotification(payload);
      },
    );

    this.logger.log(`📡 NotificationsGateway subscribed to Redis channel: '${REDIS_CHANNELS.NOTIFICATIONS}'`);
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

      // Join user specific room and role room in Socket.io
      const userRoom = `user:${user.id}`;
      const roleRoom = `role:${user.role}`;
      await client.join([userRoom, roleRoom]);

      // Wire presence tracking strictly in Redis (distributed & persistent)
      await this.presenceService.trackDeviceConnected(user.id, client.id, {
        userAgent: client.handshake.headers['user-agent'] as string,
        ipAddress: client.handshake.address,
        metadata: { role: user.role, email: user.email },
      });

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

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.user?.id) {
      const userId = client.user.id;
      // Untrack socket session from Redis
      await this.presenceService.trackDeviceDisconnected(userId, client.id);
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


  // PUBSUB DISPATCHER & BROADCAST HELPERS


  /**
   * Internal listener: Receives cross-instance notification events from Redis PubSub and emits to local sockets.
   */
  private handlePubSubNotification(payload: NotificationPubSubPayload) {
    if (!this.server) return;

    if (payload.target === 'user' && payload.targetId) {
      const room = `user:${payload.targetId}`;
      this.server.to(room).emit(payload.event, payload.data);
      this.logger.debug(`[Redis PubSub -> WS] Emitted '${payload.event}' to room '${room}'`);
    } else if (payload.target === 'role' && payload.role) {
      const room = `role:${payload.role}`;
      this.server.to(room).emit(payload.event, payload.data);
      this.logger.debug(`[Redis PubSub -> WS] Emitted '${payload.event}' to role room '${room}'`);
    } else if (payload.target === 'broadcast') {
      this.server.emit(payload.event, payload.data);
      this.logger.debug(`[Redis PubSub -> WS] Broadcasted '${payload.event}' to all clients`);
    }
  }

  /**
   * Publishes notification event to Redis PubSub (which broadcasts across all cluster instances).
   */
  async sendToUser(userId: string, event: string, payload: any): Promise<void> {
    await this.pubSubService.publish<NotificationPubSubPayload>(
      REDIS_CHANNELS.NOTIFICATIONS,
      {
        target: 'user',
        targetId: userId,
        event,
        data: payload,
      },
    );
  }

  /**
   * Publishes role event to Redis PubSub.
   */
  async sendToRole(role: UserRole, event: string, payload: any): Promise<void> {
    await this.pubSubService.publish<NotificationPubSubPayload>(
      REDIS_CHANNELS.NOTIFICATIONS,
      {
        target: 'role',
        role,
        event,
        data: payload,
      },
    );
  }

  /**
   * Publishes system-wide broadcast event to Redis PubSub.
   */
  async broadcast(event: string, payload: any): Promise<void> {
    await this.pubSubService.publish<NotificationPubSubPayload>(
      REDIS_CHANNELS.NOTIFICATIONS,
      {
        target: 'broadcast',
        event,
        data: payload,
      },
    );
  }

  /**
   * Checks if user is currently online via Redis presence state.
   */
  async isUserOnline(userId: string): Promise<boolean> {
    return this.presenceService.isUserOnline(userId);
  }


  // CLIENT SUBSCRIPTION MESSAGES


  @SubscribeMessage('notifications:ping')
  async handlePing(client: AuthenticatedSocket) {
    if (client.user?.id) {
      await this.presenceService.heartbeat(client.user.id);
    }
    return { event: 'notifications:pong', data: { timestamp: Date.now() } };
  }
}
