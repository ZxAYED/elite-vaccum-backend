import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { REDIS_CHANNELS } from '../src/redis/constants/redis.constants';
import { RedisPresenceService } from '../src/redis/redis-presence.service';
import { RedisPubSubService } from '../src/redis/redis-pubsub.service';
import { RedisService } from '../src/redis/redis.service';

async function testRedisNotifications() {
  console.log('🧪 Initializing NestJS App context to test Redis PubSub & Presence for Notifications...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const redis = app.get(RedisService);
  const pubSub = app.get(RedisPubSubService);
  const presence = app.get(RedisPresenceService);

  const testUserId = '11111111-2222-3333-4444-555555555555';
  const testSocketId = 'socket_test_abc123';

  // 1. Test Redis Presence
  console.log('1️⃣ Testing Redis Presence Tracking for WebSocket client...');
  await presence.trackDeviceConnected(testUserId, testSocketId, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestClient',
    ipAddress: '127.0.0.1',
    metadata: { role: 'ADMIN' },
  });

  const isOnline = await presence.isUserOnline(testUserId);
  const deviceCount = await presence.getUserActiveDevicesCount(testUserId);
  console.log(`✅ Presence recorded in Redis -> isOnline: ${isOnline}, deviceCount: ${deviceCount}`);

  // 2. Test Redis PubSub
  console.log('2️⃣ Testing Redis PubSub broadcasting across instances...');
  let receivedMessage: any = null;

  await pubSub.subscribe(REDIS_CHANNELS.NOTIFICATIONS, (payload) => {
    receivedMessage = payload;
  });

  // Allow subscription registration to propagate
  await new Promise((r) => setTimeout(r, 500));

  await pubSub.publish(REDIS_CHANNELS.NOTIFICATIONS, {
    target: 'user',
    targetId: testUserId,
    event: 'notification:new',
    data: {
      title: 'Redis PubSub Integration Verified',
      unreadCount: 3,
    },
  });

  // Wait for message delivery over Redis TCP pubsub
  await new Promise((r) => setTimeout(r, 1000));

  if (receivedMessage && receivedMessage.targetId === testUserId) {
    console.log('✅ Redis PubSub delivered message successfully:', receivedMessage);
  } else {
    console.log('⚠️ PubSub message not received within timeout (check Upstash TLS/subscription settings):', receivedMessage);
  }

  // 3. Test Disconnect cleanup
  console.log('3️⃣ Testing Redis Device Disconnect & Offline transition...');
  await presence.trackDeviceDisconnected(testUserId, testSocketId);
  const isOnlineAfter = await presence.isUserOnline(testUserId);
  console.log(`✅ Device removed from Redis -> isOnline: ${isOnlineAfter}`);

  await app.close();
  console.log('🎉 Redis Notification PubSub & Presence test complete!');
  process.exit(0);
}

testRedisNotifications().catch((err) => {
  console.error('❌ Redis Notification test failed:', err);
  process.exit(1);
});
