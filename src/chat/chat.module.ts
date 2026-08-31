import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from 'src/email/email.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { StorageModule } from 'src/storage/storage.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './gateways/chat.gateway';
import { ChatQueueService } from './queues/chat-queue.service';
import { ChatWorker } from './queues/chat.worker';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    EmailModule,
    StorageModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ChatQueueService, ChatWorker],
  exports: [ChatService, ChatGateway, ChatQueueService],
})
export class ChatModule {}
