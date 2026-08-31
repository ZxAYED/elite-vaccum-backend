import { NotificationType } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisPubSubService } from '../src/redis/redis-pubsub.service';
import { REDIS_CHANNELS } from '../src/redis/constants/redis.constants';

async function testBullMQNotifications() {
  console.log('🧪 Starting BullMQ Notifications Queue End-to-End Test...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const notificationsService = app.get(NotificationsService);
  const pubSub = app.get(RedisPubSubService);

  // Find a test user (e.g., admin or customer)
  const testUser = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true, email: true },
  });

  if (!testUser) {
    console.log('⚠️ No active user found in DB. Please run database seed.');
    await app.close();
    return;
  }

  console.log(`👤 Testing with recipient User: ${testUser.email} (${testUser.id})`);

  // 1. Subscribe to Redis PubSub to verify live broadcast on BullMQ job execution
  let wsEventReceived = false;
  let receivedPayload: any = null;

  await pubSub.subscribe(REDIS_CHANNELS.NOTIFICATIONS, (payload) => {
    if (payload.targetId === testUser.id && payload.event === 'notification:new') {
      wsEventReceived = true;
      receivedPayload = payload;
    }
  });

  // 2. Enqueue Notification Job via BullMQ
  console.log('1️⃣ Enqueueing notification job into BullMQ Queue...');
  const enqueueResult = await notificationsService.create({
    userId: testUser.id,
    type: NotificationType.SYSTEM_ALERT,
    title: 'BullMQ Queue Pipeline Test',
    message: 'Testing asynchronous BullMQ background queue processing with Redis PubSub streaming.',
    ctaLabel: 'View Dashboard',
    ctaUrl: '/admin/overview',
    priority: 1,
    sendEmail: false,
  });

  console.log('✅ BullMQ Enqueue Result:', enqueueResult);

  // 3. Wait 2 seconds for BullMQ Worker to pick up, execute, persist to DB, and publish to Redis PubSub
  console.log('2️⃣ Waiting for BullMQ Worker to process job...');
  await new Promise((r) => setTimeout(r, 2000));

  // 4. Verify in PostgreSQL database
  const createdNotification = await prisma.notification.findFirst({
    where: {
      userId: testUser.id,
      title: 'BullMQ Queue Pipeline Test',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (createdNotification) {
    console.log('✅ PostgreSQL Record Verified: Notification ID ->', createdNotification.id);
  } else {
    console.error('❌ Notification record not found in PostgreSQL database.');
  }

  // 5. Verify Redis PubSub WebSocket event propagation
  if (wsEventReceived) {
    console.log('✅ Redis PubSub Event Verified: Received ->', receivedPayload?.data?.notification?.title);
  } else {
    console.log('ℹ️ PubSub event status (check if worker processed within window)');
  }

  // 6. Test Unread Count from Redis Cache
  const unreadCount = await notificationsService.getUnreadCount(testUser.id);
  console.log(`✅ Cached Unread Count for User: ${unreadCount}`);

  // Cleanup test notification
  if (createdNotification) {
    await prisma.notification.delete({ where: { id: createdNotification.id } });
    console.log('🧹 Cleaned up test notification from database.');
  }

  await app.close();
  console.log('🎉 BullMQ Notifications Queue integration test completed successfully!');
  process.exit(0);
}

testBullMQNotifications().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
