import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ChatConversationType, ChatMessageType, Prisma, UserRole } from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { REDIS_CHANNELS } from 'src/redis/constants/redis.constants';
import { RedisPresenceService } from 'src/redis/redis-presence.service';
import { RedisPubSubService } from 'src/redis/redis-pubsub.service';
import { RedisService } from 'src/redis/redis.service';
import { CloudinaryUploadService } from 'src/storage/cloudinary-upload.service';
import {
  ChatConversationQueryDto,
  ChatMessageQueryDto,
} from './dto/chat-query.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import {
  MessageAttachmentInputDto,
  SendChatMessageDto,
} from './dto/send-message.dto';
import { ChatQueueService } from './queues/chat-queue.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly pubSubService: RedisPubSubService,
    private readonly presenceService: RedisPresenceService,
    private readonly chatQueue: ChatQueueService,
    private readonly cloudinaryService: CloudinaryUploadService,
  ) {}

  private isAdmin(user?: RequestUser | null) {
    return user?.role === UserRole.ADMIN;
  }


  // CONVERSATIONS


  async getOrCreateConversation(
    dto: CreateConversationDto,
    user: RequestUser,
  ) {
    const isUserAdmin = this.isAdmin(user);

    // If customer creating a support conversation, check if one already exists
    if (!isUserAdmin && dto.type === ChatConversationType.SUPPORT) {
      const existing = await this.prisma.chatConversation.findFirst({
        where: {
          type: ChatConversationType.SUPPORT,
          participants: {
            some: { userId: user.id },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      if (existing) {
        return existing;
      }
    }

    // If order-specific or service-order-specific chat
    if (dto.orderId || dto.serviceOrderId) {
      const existing = await this.prisma.chatConversation.findFirst({
        where: {
          ...(dto.orderId ? { orderId: dto.orderId } : {}),
          ...(dto.serviceOrderId ? { serviceOrderId: dto.serviceOrderId } : {}),
          participants: {
            some: { userId: user.id },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      if (existing) return existing;
    }

    // Find an Admin user to assign to the room if created by customer
    const adminUser = await this.prisma.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true },
    });

    const participantsData = [
      { userId: user.id, roleInChat: user.role.toString() },
    ];

    if (dto.targetUserId && dto.targetUserId !== user.id) {
      participantsData.push({ userId: dto.targetUserId, roleInChat: 'MEMBER' });
    } else if (!isUserAdmin && adminUser && adminUser.id !== user.id) {
      participantsData.push({ userId: adminUser.id, roleInChat: 'ADMIN' });
    }

    const conversation = await this.prisma.chatConversation.create({
      data: {
        type: dto.type || ChatConversationType.SUPPORT,
        title: dto.title || `Support Chat - ${user.email}`,
        orderId: dto.orderId || null,
        serviceOrderId: dto.serviceOrderId || null,
        participants: {
          create: participantsData,
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });

    // If initial message provided, send it
    if (dto.initialMessage?.trim()) {
      await this.sendMessage(
        conversation.id,
        user,
        {
          content: dto.initialMessage.trim(),
          type: ChatMessageType.TEXT,
        },
      );
    }

    return conversation;
  }

  async getUserConversations(
    userId: string,
    query: ChatConversationQueryDto,
    user: RequestUser,
  ) {
    const isUserAdmin = this.isAdmin(user);

    const where: Prisma.ChatConversationWhereInput = isUserAdmin
      ? {}
      : {
          participants: {
            some: { userId },
          },
        };

    const totalItems = await this.prisma.chatConversation.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const conversations = await this.prisma.chatConversation.findMany({
      where,
      skip,
      take,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
      },
    });

    // Calculate unread count for user in each conversation
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const participant = conv.participants.find((p) => p.userId === userId);
        const lastReadAt = participant?.lastReadAt || new Date(0);

        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            createdAt: { gt: lastReadAt },
          },
        });

        // Determine online status of the other party
        const otherParticipant = conv.participants.find((p) => p.userId !== userId);
        const isOtherOnline = otherParticipant
          ? await this.presenceService.isUserOnline(otherParticipant.userId)
          : false;

        return {
          ...conv,
          unreadCount,
          isOtherOnline,
          lastMessage: conv.messages[0] || null,
        };
      }),
    );

    return {
      items: enriched,
      meta,
    };
  }

  async getConversationDetails(conversationId: string, user: RequestUser) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant = conversation.participants.some((p) => p.userId === user.id);
    if (!isParticipant && !this.isAdmin(user)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    return conversation;
  }


  // MESSAGES


  async getConversationMessages(
    conversationId: string,
    query: ChatMessageQueryDto,
    user: RequestUser,
  ) {
    await this.getConversationDetails(conversationId, user);

    const where: Prisma.ChatMessageWhereInput = {
      conversationId,
      ...(query.before ? { createdAt: { lt: new Date(query.before) } } : {}),
    };

    const totalItems = await this.prisma.chatMessage.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const messages = await this.prisma.chatMessage.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        attachments: true,
      },
    });

    // Auto mark as read for the requesting user
    await this.markConversationAsRead(conversationId, user.id);

    return {
      items: messages.reverse(), // return in chronological order for UI rendering
      meta,
    };
  }

  async sendMessage(
    conversationId: string,
    user: RequestUser,
    dto: SendChatMessageDto,
    files?: Array<Express.Multer.File>,
  ) {
    const conversation = await this.getConversationDetails(conversationId, user);

    // Process file uploads if present
    const uploadedAttachments: MessageAttachmentInputDto[] = [...(dto.attachments || [])];

    if (files && files.length > 0) {
      for (const file of files) {
        const uploadResult = await this.cloudinaryService.uploadFile({
          fileBuffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          folder: 'elite-vacuum/chat',
        });
        uploadedAttachments.push({
          fileUrl: uploadResult.url,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
        });
      }
    }

    const messageType =
      uploadedAttachments.length > 0
        ? uploadedAttachments[0].fileType.startsWith('image/')
          ? ChatMessageType.IMAGE
          : ChatMessageType.FILE
        : dto.type || ChatMessageType.TEXT;

    const message = await this.prisma.$transaction(async (tx) => {
      // 1. Create message
      const createdMessage = await tx.chatMessage.create({
        data: {
          conversationId,
          senderId: user.id,
          type: messageType,
          content: dto.content.trim(),
          attachments: {
            create: uploadedAttachments.map((att) => ({
              fileUrl: att.fileUrl,
              fileName: att.fileName,
              fileType: att.fileType,
              fileSize: att.fileSize,
            })),
          },
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          attachments: true,
        },
      });

      // 2. Update conversation last message timestamp & text snippet
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessageText: dto.content.trim().substring(0, 200),
        },
      });

      return createdMessage;
    });

    // 3. Publish to Redis PubSub for <10ms real-time multi-instance WebSocket distribution
    await this.pubSubService.publish(REDIS_CHANNELS.CHAT_MESSAGES, {
      conversationId,
      message,
    });

    // 4. Enqueue BullMQ delayed job for offline user email notifications
    await this.chatQueue.enqueueOfflineAlert({
      messageId: message.id,
      conversationId,
      senderId: user.id,
      content: dto.content,
      createdAt: message.createdAt.toISOString(),
    });

    return message;
  }

  async markConversationAsRead(conversationId: string, userId: string) {
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.chatParticipant.updateMany({
        where: { conversationId, userId },
        data: { lastReadAt: now },
      }),
      this.prisma.chatMessage.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          isRead: false,
        },
        data: { isRead: true, readAt: now },
      }),
    ]);

    // Broadcast read receipt over Redis PubSub
    await this.pubSubService.publish(REDIS_CHANNELS.CHAT_READ_RECEIPT, {
      conversationId,
      userId,
      readAt: now.toISOString(),
    });

    return { success: true, readAt: now };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const participants = await this.prisma.chatParticipant.findMany({
      where: { userId },
      select: { conversationId: true, lastReadAt: true },
    });

    if (participants.length === 0) return 0;

    let totalUnread = 0;
    for (const p of participants) {
      const count = await this.prisma.chatMessage.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: userId },
          createdAt: { gt: p.lastReadAt || new Date(0) },
        },
      });
      totalUnread += count;
    }

    return totalUnread;
  }
}
