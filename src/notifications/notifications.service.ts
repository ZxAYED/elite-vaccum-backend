import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { getPagination } from 'src/common/utils/pagination';
import { EmailService } from 'src/email/email.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';
import { REDIS_CHANNELS } from 'src/redis/constants/redis.constants';
import { RedisPubSubService } from 'src/redis/redis-pubsub.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationPubSubPayload } from './gateways/notifications.gateway';
import { NotificationsQueueService } from './queues/notifications-queue.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly pubSub: RedisPubSubService,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => NotificationsQueueService))
    private readonly queueService: NotificationsQueueService,
  ) {}

  private isAdmin(user?: RequestUser | null): boolean {
    return user?.role === UserRole.ADMIN;
  }

  // ==========================================
  // DISPATCH NOTIFICATION (BullMQ Queue)
  // ==========================================

  /**
   * Enqueues a notification into the BullMQ background queue for asynchronous,
   * resilient delivery with automatic retries and rate limiting.
   */
  async create(dto: CreateNotificationDto, caller?: RequestUser) {
    if (caller && !this.isAdmin(caller) && dto.userId !== caller.id) {
      throw new ForbiddenException(
        'You do not have permission to send notifications to other users',
      );
    }

    const { jobId } = await this.queueService.enqueue(dto);

    return {
      success: true,
      message: 'Notification enqueued for processing via BullMQ',
      jobId,
      recipientUserId: dto.userId,
    };
  }

  /**
   * Core notification processor (called by BullMQ Worker or direct dispatcher).
   * Persists to PostgreSQL, computes Redis unread cache, broadcasts via Redis PubSub, and sends email.
   */
  async processNotification(dto: CreateNotificationDto) {
    this.logger.log(`Processing notification for User [${dto.userId}] - Title: "${dto.title}"`);

    // 1. Verify recipient user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { notificationPreference: true },
    });

    if (!user) {
      this.logger.warn(`Recipient User '${dto.userId}' not found. Skipping delivery.`);
      return { status: 'SKIPPED_USER_NOT_FOUND' };
    }

    // 2. Persist to PostgreSQL Database
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title.trim(),
        message: dto.message.trim(),
        ctaLabel: dto.ctaLabel?.trim() || null,
        ctaUrl: dto.ctaUrl?.trim() || null,
        metadata: dto.metadata || undefined,
        isRead: false,
      },
    });

    // 3. Compute and Cache Fresh Unread Count in Redis (60s TTL)
    const unreadCount = await this.prisma.notification.count({
      where: { userId: dto.userId, isRead: false },
    });
    const cacheKey = `notifications:unread_count:${dto.userId}`;
    await this.redis.set(cacheKey, unreadCount, 60);

    // 4. Publish Real-Time Event to Redis PubSub (broadcasts across all WebSocket gateway nodes)
    await this.pubSub.publish<NotificationPubSubPayload>(
      REDIS_CHANNELS.NOTIFICATIONS,
      {
        target: 'user',
        targetId: dto.userId,
        event: 'notification:new',
        data: { notification, unreadCount },
      },
    );

    await this.pubSub.publish<NotificationPubSubPayload>(
      REDIS_CHANNELS.NOTIFICATIONS,
      {
        target: 'user',
        targetId: dto.userId,
        event: 'notification:unread_count',
        data: { unreadCount },
      },
    );

    // 5. Asynchronous Optional Email Notification
    const shouldSendEmail =
      dto.sendEmail ||
      user.notificationPreference?.emailNotifications !== false;

    if (dto.sendEmail && user.email && shouldSendEmail) {
      this.emailService
        .sendEmail({
          to: user.email,
          subject: dto.title,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #004488; margin-top: 0;">${dto.title}</h2>
              <p style="font-size: 16px; color: #333; line-height: 1.5;">${dto.message}</p>
              ${
                dto.ctaUrl
                  ? `<div style="margin-top: 25px;">
                      <a href="${dto.ctaUrl}" style="background-color: #0066cc; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                        ${dto.ctaLabel || 'View Details'}
                      </a>
                    </div>`
                  : ''
              }
              <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #888;">Elite Vacuum Service Platform Notification System</p>
            </div>
          `,
        })
        .catch((err) => {
          this.logger.warn(
            `Asynchronous email dispatch note for ${user.email}: ${err.message}`,
          );
        });
    }

    return {
      status: 'PROCESSED',
      notificationId: notification.id,
      unreadCount,
    };
  }

  /**
   * Direct dispatch bypassing the queue when synchronous processing is explicitly needed.
   */
  async dispatchDirect(dto: CreateNotificationDto) {
    return this.processNotification(dto);
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
   * Retrieves unread notification count with fast Redis caching (60s TTL).
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

    // Cache unread count in Redis for 60s
    await this.redis.set(cacheKey, count, 60);

    return count;
  }

  // ==========================================
  // MARK AS READ (Single & All)
  // ==========================================

  /**
   * Marks a single notification as read and publishes real-time Redis PubSub events.
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

    // Invalidate and refresh Redis unread count cache
    const cacheKey = `notifications:unread_count:${userId}`;
    await this.redis.del(cacheKey);
    const unreadCount = await this.getUnreadCount(userId);

    // Publish to Redis PubSub
    await this.pubSub.publish<NotificationPubSubPayload>(
      REDIS_CHANNELS.NOTIFICATIONS,
      {
        target: 'user',
        targetId: userId,
        event: 'notification:read',
        data: { notificationId: id, readAt: updated.readAt, unreadCount },
      },
    );

    await this.pubSub.publish<NotificationPubSubPayload>(
      REDIS_CHANNELS.NOTIFICATIONS,
      {
        target: 'user',
        targetId: userId,
        event: 'notification:unread_count',
        data: { unreadCount },
      },
    );

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

    // Set unread count to 0 in Redis cache
    const cacheKey = `notifications:unread_count:${userId}`;
    await this.redis.set(cacheKey, 0, 60);

    // Publish to Redis PubSub
    await this.pubSub.publish<NotificationPubSubPayload>(
      REDIS_CHANNELS.NOTIFICATIONS,
      {
        target: 'user',
        targetId: userId,
        event: 'notification:all_read',
        data: { count: result.count, readAt: now.toISOString(), unreadCount: 0 },
      },
    );

    await this.pubSub.publish<NotificationPubSubPayload>(
      REDIS_CHANNELS.NOTIFICATIONS,
      {
        target: 'user',
        targetId: userId,
        event: 'notification:unread_count',
        data: { unreadCount: 0 },
      },
    );

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

    const cacheKey = `notifications:unread_count:${userId}`;
    await this.redis.del(cacheKey);
    const unreadCount = await this.getUnreadCount(userId);

    // Publish to Redis PubSub
    await this.pubSub.publish<NotificationPubSubPayload>(
      REDIS_CHANNELS.NOTIFICATIONS,
      {
        target: 'user',
        targetId: userId,
        event: 'notification:deleted',
        data: { notificationId: id, unreadCount },
      },
    );

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
