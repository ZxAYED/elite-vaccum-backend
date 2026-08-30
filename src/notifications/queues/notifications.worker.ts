import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { EmailService } from 'src/email/email.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import { NOTIFICATIONS_QUEUE_NAME } from './notifications-queue.service';

@Injectable()
export class NotificationsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsWorker.name);
  private worker: Worker<CreateNotificationDto>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly emailService: EmailService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    const connection = this.resolveBullMQConnection();

    this.worker = new Worker<CreateNotificationDto>(
      NOTIFICATIONS_QUEUE_NAME,
      async (job: Job<CreateNotificationDto>) => {
        return this.processNotificationJob(job);
      },
      {
        connection,
        concurrency: 5,
        limiter: {
          max: 20,
          duration: 1000, // max 20 jobs/sec to respect DB and SMTP rate limits
        },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Notification job '${job.id}' completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Notification job '${job?.id}' failed with error: ${err.message}`,
        err.stack,
      );
    });

    this.logger.log(`🛠️ BullMQ Worker for '${NOTIFICATIONS_QUEUE_NAME}' started`);
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log(`BullMQ Worker for '${NOTIFICATIONS_QUEUE_NAME}' stopped`);
    }
  }

  /**
   * Core worker processor: Persists notification to PostgreSQL, emits WSS event, and dispatches optional email.
   */
  private async processNotificationJob(job: Job<CreateNotificationDto>) {
    const data = job.data;
    this.logger.log(
      `Processing notification for User [${data.userId}] - Title: "${data.title}"`,
    );

    // 1. Verify recipient user exists
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      include: { notificationPreference: true },
    });

    if (!user) {
      this.logger.warn(`Recipient User '${data.userId}' not found. Discarding job.`);
      return { status: 'SKIPPED_USER_NOT_FOUND' };
    }

    // 2. Persist Notification to PostgreSQL Database
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title.trim(),
        message: data.message.trim(),
        ctaLabel: data.ctaLabel?.trim() || null,
        ctaUrl: data.ctaUrl?.trim() || null,
        metadata: data.metadata || undefined,
        isRead: false,
      },
    });

    // 3. Invalidate Redis unread count cache for this user
    await this.redis.del(`notifications:unread_count:${data.userId}`);

    // 4. Calculate fresh unread count
    const unreadCount = await this.prisma.notification.count({
      where: { userId: data.userId, isRead: false },
    });

    // 5. Emit Real-Time WebSocket Event (WSS) to active user sessions
    this.gateway.sendToUser(data.userId, 'notification:new', {
      notification,
      unreadCount,
    });

    this.gateway.sendToUser(data.userId, 'notification:unread_count', {
      unreadCount,
    });

    // 6. Optional Email Delivery (if requested and user has email preferences enabled)
    const shouldSendEmail =
      data.sendEmail ||
      user.notificationPreference?.emailNotifications !== false;

    if (data.sendEmail && user.email && shouldSendEmail) {
      try {
        await this.emailService.sendEmail({
          to: user.email,
          subject: data.title,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #004488; margin-top: 0;">${data.title}</h2>
              <p style="font-size: 16px; color: #333; line-height: 1.5;">${data.message}</p>
              ${
                data.ctaUrl
                  ? `<div style="margin-top: 25px;">
                      <a href="${data.ctaUrl}" style="background-color: #0066cc; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                        ${data.ctaLabel || 'View Details'}
                      </a>
                    </div>`
                  : ''
              }
              <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #888;">Elite Vacuum Service Platform Notification System</p>
            </div>
          `,
        });
        this.logger.debug(`Dispatched email alert to ${user.email}`);
      } catch (emailErr: any) {
        this.logger.warn(
          `Failed to dispatch email alert to ${user.email}: ${emailErr.message}`,
        );
      }
    }

    return {
      status: 'PROCESSED',
      notificationId: notification.id,
      unreadCount,
    };
  }

  private resolveBullMQConnection(): any {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || process.env.REDIS_URL;

    if (redisUrl) {
      const parsed = new URL(redisUrl);
      const isTls = redisUrl.startsWith('rediss://');

      return {
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        tls: isTls ? { rejectUnauthorized: false } : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    }

    return {
      host:
        this.configService.get<string>('REDIS_HOST') ||
        process.env.REDIS_HOST ||
        '127.0.0.1',
      port: Number(
        this.configService.get<number>('REDIS_PORT') ||
          process.env.REDIS_PORT ||
          6379,
      ),
      password:
        this.configService.get<string>('REDIS_PASSWORD') ||
        process.env.REDIS_PASSWORD ||
        undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
}
