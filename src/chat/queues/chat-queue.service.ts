import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue } from 'bullmq';

export const CHAT_QUEUE_NAME = 'chat-messages';

export interface ChatMessageJobData {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

@Injectable()
export class ChatQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatQueueService.name);
  private queue: Queue<ChatMessageJobData>;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const connection = this.resolveBullMQConnection();

    this.queue = new Queue<ChatMessageJobData>(CHAT_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600 * 24,
          count: 2000,
        },
        removeOnFail: {
          age: 3600 * 48,
          count: 5000,
        },
      },
    });

    this.logger.log(`🚀 BullMQ Queue '${CHAT_QUEUE_NAME}' initialized successfully`);
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
      this.logger.log(`BullMQ Queue '${CHAT_QUEUE_NAME}' closed`);
    }
  }

  async enqueueOfflineAlert(
    data: ChatMessageJobData,
    delayMs = 120000, // 2 minutes delayed check
    options?: JobsOptions,
  ): Promise<{ jobId: string }> {
    const job = await this.queue.add('offline-notification-check', data, {
      delay: delayMs,
      ...options,
    });

    return { jobId: job.id as string };
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
