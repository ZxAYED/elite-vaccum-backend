import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue } from 'bullmq';
import { createBullMQRedisConnection } from 'src/redis/redis.config';

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
    const connection = createBullMQRedisConnection(this.configService);

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
    options?: JobsOptions,
  ): Promise<{ jobId: string }> {
    if (!this.queue) {
      this.logger.warn(`Queue '${CHAT_QUEUE_NAME}' is not initialized. Skipping offline check.`);
      return { jobId: 'skipped' };
    }

    try {
      // Delay 2 minutes: if user hasn't read the message in 2 minutes, send an email alert
      const delayMs = 2 * 60 * 1000;

      const job = await this.queue.add('check_offline_read', data, {
        delay: delayMs,
        priority: 2,
        ...options,
      });

      this.logger.debug(
        `[BullMQ] Enqueued offline email alert check for message '${data.messageId}' in conversation '${data.conversationId}' (Delay: 2m)`,
      );

      return { jobId: job.id as string };
    } catch (err: any) {
      this.logger.error(`Failed to enqueue offline alert for chat: ${err.message}`, err.stack);
      throw err;
    }
  }
}
