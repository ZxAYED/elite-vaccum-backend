import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationsService } from '../notifications.service';
import { NOTIFICATIONS_QUEUE_NAME } from './notifications-queue.service';

@Injectable()
export class NotificationsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsWorker.name);
  private worker: Worker<CreateNotificationDto>;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    const connection = this.resolveBullMQConnection();

    this.worker = new Worker<CreateNotificationDto>(
      NOTIFICATIONS_QUEUE_NAME,
      async (job: Job<CreateNotificationDto>) => {
        this.logger.debug(
          `[BullMQ Worker] Executing job '${job.id}' for User ${job.data.userId} (Type: ${job.data.type})`,
        );
        return this.notificationsService.processNotification(job.data);
      },
      {
        connection,
        concurrency: 5,
        limiter: {
          max: 25,
          duration: 1000, // 25 jobs/sec max to respect downstream services
        },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`[BullMQ Worker] Notification job '${job.id}' completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `[BullMQ Worker] Notification job '${job?.id}' failed with error: ${err.message}`,
        err.stack,
      );
    });

    this.logger.log(`🛠️ BullMQ Worker for '${NOTIFICATIONS_QUEUE_NAME}' started successfully`);
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log(`BullMQ Worker for '${NOTIFICATIONS_QUEUE_NAME}' stopped`);
    }
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
