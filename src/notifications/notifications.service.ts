import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { NotificationsQueueService } from './queues/notifications-queue.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly queueService: NotificationsQueueService,
    private readonly gateway: NotificationsGateway,
  ) {}

  private isAdmin(user?: RequestUser | null): boolean {
    return user?.role === UserRole.ADMIN;
  }

  // ==========================================
  // DISPATCH / CREATE NOTIFICATION (BullMQ)
  // ==========================================

  /**
   * Dispatches a notification asynchronously via the BullMQ resilient queue.
   */
  async create(dto: CreateNotificationDto, caller?: RequestUser) {
    // If called via API, ensure non-admins can only trigger notifications for themselves or system events
    if (caller && !this.isAdmin(caller) && dto.userId !== caller.id) {
      throw new ForbiddenException(
        'You do not have permission to send notifications to other users',
      );
    }

    const { jobId } = await this.queueService.enqueue(dto);

    return {
      success: true,
      message: 'Notification enqueued for delivery',
      jobId,
      recipientUserId: dto.userId,
    };
  }

  // ==========================================
  // QUERY NOTIFICATIONS
  // ==========================================

  /**
   * Retrieves paginated notifications for a specific user with metadata & unread summary.
   */
  async getUserNotifications(userId: string, query: NotificationQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [items, totalCount, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.getUnreadCount(userId),
    ]);

    const pagination = getPagination(page, limit, totalCount);

    return {
      success: true,
      data: items,
      unreadCount,
      pagination,
    };
  }

  /**
   * Retrieves unread notification count with fast Redis caching (30s TTL).
   */
  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = `notifications:unread_count:${userId}`;
    const cached = await this.redis.get<number>(cacheKey);

    if (cached !== null && cached !== undefined && !Number.isNaN(Number(cached))) {
      return Number(cached);
    }

    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    // Cache unread count in Redis for 30s
    await this.redis.set(cacheKey, count, 30);

    return count;
  }

  // ==========================================
  // MARK AS READ (Single & All)
  // ==========================================

  /**
   * Marks a single notification as read and emits real-time WebSocket events.
   */
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this notification');
    }

    if (notification.isRead) {
      return {
        success: true,
        message: 'Notification was already marked as read',
        notification,
      };
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Invalidate Redis cache
    await this.redis.del(`notifications:unread_count:${userId}`);

    const unreadCount = await this.getUnreadCount(userId);

    // Emit Real-Time WebSocket event
    this.gateway.sendToUser(userId, 'notification:read', {
      notificationId: id,
      readAt: updated.readAt,
      unreadCount,
    });

    this.gateway.sendToUser(userId, 'notification:unread_count', {
      unreadCount,
    });

    return {
      success: true,
      message: 'Notification marked as read',
      notification: updated,
      unreadCount,
    };
  }

  /**
   * Marks all unread notifications for a user as read in a single batch operation.
   */
  async markAllAsRead(userId: string) {
    const now = new Date();

    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });

    // Set unread count to 0 in Redis
    await this.redis.set(`notifications:unread_count:${userId}`, 0, 30);

    // Emit Real-Time WebSocket event
    this.gateway.sendToUser(userId, 'notification:all_read', {
      count: result.count,
      readAt: now.toISOString(),
      unreadCount: 0,
    });

    this.gateway.sendToUser(userId, 'notification:unread_count', {
      unreadCount: 0,
    });

    return {
      success: true,
      message: `Marked ${result.count} notifications as read`,
      updatedCount: result.count,
      unreadCount: 0,
    };
  }

  // ==========================================
  // DELETE NOTIFICATION
  // ==========================================

  /**
   * Deletes a single notification.
   */
  async deleteNotification(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this notification');
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    await this.redis.del(`notifications:unread_count:${userId}`);

    const unreadCount = await this.getUnreadCount(userId);

    this.gateway.sendToUser(userId, 'notification:deleted', {
      notificationId: id,
      unreadCount,
    });

    return {
      success: true,
      message: 'Notification deleted successfully',
      unreadCount,
    };
  }

  // ==========================================
  // NOTIFICATION PREFERENCES
  // ==========================================

  /**
   * Retrieves notification channel preferences for a user.
   */
  async getPreferences(userId: string) {
    let pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: {
          userId,
          emailNotifications: true,
          smsNotifications: false,
          pushNotifications: true,
        },
      });
    }

    return {
      success: true,
      preferences: pref,
    };
  }

  /**
   * Updates notification channel preferences for a user.
   */
  async updatePreferences(
    userId: string,
    dto: {
      emailNotifications?: boolean;
      smsNotifications?: boolean;
      pushNotifications?: boolean;
      preferences?: Record<string, any>;
    },
  ) {
    const updated = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        emailNotifications: dto.emailNotifications ?? true,
        smsNotifications: dto.smsNotifications ?? false,
        pushNotifications: dto.pushNotifications ?? true,
        preferences: dto.preferences || undefined,
      },
      update: {
        ...(dto.emailNotifications !== undefined
          ? { emailNotifications: dto.emailNotifications }
          : {}),
        ...(dto.smsNotifications !== undefined
          ? { smsNotifications: dto.smsNotifications }
          : {}),
        ...(dto.pushNotifications !== undefined
          ? { pushNotifications: dto.pushNotifications }
          : {}),
        ...(dto.preferences !== undefined ? { preferences: dto.preferences } : {}),
      },
    });

    return {
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: updated,
    };
  }
}
