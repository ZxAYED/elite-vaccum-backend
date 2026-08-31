import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
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
import { ChatService } from '../chat.service';
import { SendChatMessageDto } from '../dto/send-message.dto';

export interface AuthenticatedChatSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly presenceService: RedisPresenceService,
    private readonly pubSubService: RedisPubSubService,
    private readonly chatService: ChatService,
  ) {}

  async afterInit(server: Server) {
    this.logger.log('💬 Chat WebSocket Gateway initialized on namespace /chat');

    // Subscribe to Redis PubSub for real-time multi-node cluster synchronization
    await this.pubSubService.subscribe<{ conversationId: string; message: any }>(
      REDIS_CHANNELS.CHAT_MESSAGES,
      ({ conversationId, message }) => {
        this.server.to(`conversation:${conversationId}`).emit('chat:message_received', {
          conversationId,
          message,
        });
      },
    );

    await this.pubSubService.subscribe<{ conversationId: string; userId: string; isTyping: boolean; userName: string }>(
      REDIS_CHANNELS.CHAT_TYPING,
      (payload) => {
        this.server.to(`conversation:${payload.conversationId}`).emit('chat:typing_update', payload);
      },
    );

    await this.pubSubService.subscribe<{ conversationId: string; userId: string; readAt: string }>(
      REDIS_CHANNELS.CHAT_READ_RECEIPT,
      (payload) => {
        this.server.to(`conversation:${payload.conversationId}`).emit('chat:read_receipt_update', payload);
      },
    );

    this.logger.log('📡 ChatGateway subscribed to Redis chat channels');
  }

  async handleConnection(client: AuthenticatedChatSocket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`Unauthorized Chat socket ${client.id} provided no token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const secret =
        this.configService.get<string>('JWT_SECRET') ||
        this.configService.get<string>('SECRET_KEY') ||
        'default-jwt-secret';

      const payload = await this.jwtService.verifyAsync(token, { secret });

      if (!payload || !payload.id) {
        client.emit('error', { message: 'Invalid JWT credentials' });
        client.disconnect();
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        client.emit('error', { message: 'Account is inactive' });
        client.disconnect();
        return;
      }

      client.user = user;

      // Track online presence in Redis
      await this.presenceService.trackDeviceConnected(user.id, client.id, {
        ipAddress: client.handshake.address,
        userAgent: client.handshake.headers['user-agent'] as string,
      });

      // Join user personal channel
      client.join(`user:${user.id}`);

      // Auto-join all conversation rooms user belongs to
      const participants = await this.prisma.chatParticipant.findMany({
        where: { userId: user.id },
        select: { conversationId: true },
      });

      for (const p of participants) {
        client.join(`conversation:${p.conversationId}`);
      }

      this.logger.log(
        `✅ Chat client connected: ${user.email} (${user.role}) [Socket: ${client.id}, Rooms: ${participants.length}]`,
      );

      client.emit('chat:connected', {
        success: true,
        userId: user.id,
        connectedRooms: participants.map((p) => p.conversationId),
      });
    } catch (err: any) {
      this.logger.error(`Chat connection error: ${err.message}`);
      client.emit('error', { message: 'Connection authentication error' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedChatSocket) {
    if (client.user?.id) {
      await this.presenceService.trackDeviceDisconnected(client.user.id, client.id);
      this.logger.log(`Chat client disconnected: ${client.user.email} [Socket: ${client.id}]`);
    }
  }

  // ==========================================
  // CLIENT EVENTS
  // ==========================================

  @SubscribeMessage('chat:join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedChatSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) return { error: 'Unauthorized' };

    client.join(`conversation:${data.conversationId}`);
    return { success: true, room: `conversation:${data.conversationId}` };
  }

  @SubscribeMessage('chat:send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedChatSocket,
    @MessageBody() data: { conversationId: string; content: string; type?: any },
  ) {
    if (!client.user) return { error: 'Unauthorized' };

    const message = await this.chatService.sendMessage(
      data.conversationId,
      {
        id: client.user.id,
        email: client.user.email,
        role: client.user.role,
      } as any,
      {
        content: data.content,
        type: data.type,
      },
    );

    return { success: true, message };
  }

  @SubscribeMessage('chat:typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedChatSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    if (!client.user) return;

    await this.pubSubService.publish(REDIS_CHANNELS.CHAT_TYPING, {
      conversationId: data.conversationId,
      userId: client.user.id,
      userName: client.user.email,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('chat:mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedChatSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) return;

    return this.chatService.markConversationAsRead(data.conversationId, client.user.id);
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1].trim();
    }

    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
      return queryToken.trim();
    }

    const authPayloadToken = client.handshake.auth?.token;
    if (typeof authPayloadToken === 'string' && authPayloadToken.trim().length > 0) {
      return authPayloadToken.trim();
    }

    return null;
  }
}
