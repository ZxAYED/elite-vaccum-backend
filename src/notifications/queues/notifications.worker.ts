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
import { createBullMQRedisConnection } from 'src/redis/redis.config';
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
    const connection = createBullMQRedisConnection(this.configService);

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
}
