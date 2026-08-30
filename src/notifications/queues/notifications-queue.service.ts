import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue } from 'bullmq';
import { CreateNotificationDto } from '../dto/create-notification.dto';

export const NOTIFICATIONS_QUEUE_NAME = 'notifications-delivery';

@Injectable()
export class NotificationsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsQueueService.name);
  private queue: Queue<CreateNotificationDto>;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const connection = this.resolveBullMQConnection();

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
    const jobName = `notify:${data.type}:${data.userId}`;
    const job = await this.queue.add(jobName, data, {
      priority: data.priority ?? 5,
      ...options,
    });

    this.logger.debug(
      `Enqueued notification job '${job.id}' for User ${data.userId} (Type: ${data.type})`,
    );

    return { jobId: job.id as string };
  }

  /**
   * Resolves Redis connection options strictly conforming to BullMQ requirements (maxRetriesPerRequest: null).
   */
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
