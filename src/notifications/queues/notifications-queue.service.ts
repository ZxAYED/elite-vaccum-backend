import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue } from 'bullmq';
import { createBullMQRedisConnection } from 'src/redis/redis.config';
import { CreateNotificationDto } from '../dto/create-notification.dto';

export const NOTIFICATIONS_QUEUE_NAME = 'notifications-delivery';

@Injectable()
export class NotificationsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsQueueService.name);
  private queue: Queue<CreateNotificationDto>;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const connection = createBullMQRedisConnection(this.configService);

    this.queue = new Queue<CreateNotificationDto>(NOTIFICATIONS_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1500,
        },
        removeOnComplete: {
          age: 3600 * 24, // keep completed jobs for 24h
          count: 1000,
        },
        removeOnFail: {
          age: 3600 * 48, // keep failed jobs for 48h
          count: 5000,
        },
      },
    });

    this.logger.log(
      `🚀 BullMQ Queue '${NOTIFICATIONS_QUEUE_NAME}' initialized successfully`,
    );
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
      this.logger.log(`BullMQ Queue '${NOTIFICATIONS_QUEUE_NAME}' closed`);
    }
  }

  /**
   * Enqueues a notification for asynchronous, resilient background delivery.
   */
  async enqueue(
    data: CreateNotificationDto,
    options?: JobsOptions,
  ): Promise<{ jobId: string }> {
    if (!this.queue) {
      this.logger.warn(
        `BullMQ Queue '${NOTIFICATIONS_QUEUE_NAME}' is not initialized. Skipping queue delivery.`,
      );
      return { jobId: 'skipped' };
    }

    try {
      const job = await this.queue.add('deliver_notification', data, {
        priority: data.priority || 3,
        ...options,
      });

      this.logger.debug(
        `[BullMQ] Enqueued notification job '${job.id}' for User ${data.userId} (Type: ${data.type})`,
      );

      return { jobId: job.id as string };
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue notification job for User ${data.userId}: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}
