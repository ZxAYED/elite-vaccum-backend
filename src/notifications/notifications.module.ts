import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from 'src/email/email.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsQueueService } from './queues/notifications-queue.service';
import { NotificationsWorker } from './queues/notifications.worker';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsQueueService,
    NotificationsWorker,
    NotificationsService,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    NotificationsQueueService,
  ],
})
export class NotificationsModule {}
