import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { EmailService } from 'src/email/email.service';
import { EmailTemplateKey } from 'src/email/types/email.types';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisPresenceService } from 'src/redis/redis-presence.service';
import {
  CHAT_QUEUE_NAME,
  ChatMessageJobData,
} from './chat-queue.service';

@Injectable()
export class ChatWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatWorker.name);
  private worker: Worker<ChatMessageJobData>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly presenceService: RedisPresenceService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    const connection = this.resolveBullMQConnection();

    this.worker = new Worker<ChatMessageJobData>(
      CHAT_QUEUE_NAME,
      async (job: Job<ChatMessageJobData>) => {
        return this.processJob(job);
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Chat job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Chat job ${job?.id} failed: ${err.message}`, err.stack);
    });

    this.logger.log(`👷 BullMQ Worker for '${CHAT_QUEUE_NAME}' started`);
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log(`BullMQ Worker for '${CHAT_QUEUE_NAME}' closed`);
    }
  }

  private async processJob(job: Job<ChatMessageJobData>) {
    const { messageId, conversationId, senderId, content } = job.data;

    // Check if the message is still unread
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: true },
            },
          },
        },
        sender: true,
      },
    });

    if (!message || message.isRead) {
      return { skipped: true, reason: 'Message was already read' };
    }

    // Find recipient participants who are not the sender
    const recipients = message.conversation.participants.filter(
      (p) => p.userId !== senderId,
    );

    for (const recipient of recipients) {
      // Check if recipient is online in Redis
      const isOnline = await this.presenceService.isUserOnline(recipient.userId);

      if (!isOnline && recipient.user?.email) {
        // Send email alert for offline user
        await this.emailService
          .sendTemplateEmail({
            to: recipient.user.email,
            template: EmailTemplateKey.ACCOUNT_EVENT,
            payload: {
              subject: `New message from ${message.sender.firstName || 'Support'}`,
              message: `You have an unread message: "${content.substring(0, 120)}..."`,
              ctaUrl: `/chat?conversation=${conversationId}`,
              ctaLabel: 'Reply in Chat',
            },
          })
          .catch((err) => {
            this.logger.warn(
              `Failed to send offline chat email alert to ${recipient.user.email}: ${err.message}`,
            );
          });

        this.logger.log(
          `Dispatched offline chat email alert to ${recipient.user.email}`,
        );
      }
    }

    return { success: true, processedRecipients: recipients.length };
  }

  private resolveBullMQConnection() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ||
      this.configService.get<string>('UPSTASH_REDIS_URL');

    if (redisUrl) {
      try {
        const parsed = new URL(redisUrl);
        return {
          host: parsed.hostname,
          port: Number(parsed.port) || 6379,
          username: parsed.username || 'default',
          password: parsed.password || undefined,
          tls: parsed.protocol === 'rediss:' ? {} : undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        };
      } catch {
        // fallback
      }
    }

    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = Number(this.configService.get<number>('REDIS_PORT', 6379));
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const tlsEnabled = this.configService.get<string>('REDIS_TLS') === 'true';

    return {
      host,
      port,
      password: password || undefined,
      tls: tlsEnabled ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
}
