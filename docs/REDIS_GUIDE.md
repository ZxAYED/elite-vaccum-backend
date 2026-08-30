# Elite Central Vacuum - Reusable Redis & Real-Time Architecture Guide

This document provides a comprehensive guide for using the **Global Redis Infrastructure** (`RedisModule`) across **Pub/Sub Messaging, Live Chat, Real-Time Notifications, User Presence, BullMQ Queues, and AI Pipelines**.

---

## 🏗️ Architecture Overview

The Redis module is a **Global Dynamic NestJS Module** providing dedicated connection clients and specialized domain services:

```
src/redis/
├── constants/
│   └── redis.constants.ts          # Tokens (REDIS_CLIENT, REDIS_PUB_CLIENT, REDIS_SUB_CLIENT, REDIS_CHANNELS, REDIS_PREFIXES)
├── interfaces/
│   └── redis-options.interface.ts  # Typed options, presence state, and lock configurations
├── redis.config.ts                 # Config resolver & BullMQ connection factory (createBullMQRedisConnection)
├── redis.service.ts                # Core Data Store (Key-Value, JSON, Hashes, Sets, ZSets, Distributed Locks)
├── redis-pubsub.service.ts         # Pub/Sub Engine (Dedicated Subscriber & Publisher connections)
├── redis-presence.service.ts       # Real-Time User Presence & Multi-Device Session Heartbeats
├── redis.module.ts                 # Global Module definition
└── index.ts                        # Barrel export
```

---

## 1. Environment Configuration

Add the following variables to your `.env` file:

```env
# ==========================================
# REDIS (CACHING, PUBSUB, PRESENCE, BULLMQ)
# ==========================================
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""
REDIS_DB=0
REDIS_KEY_PREFIX="elite_vacuum:"

# Or full connection URL (e.g. for Upstash or Cloud Redis):
# REDIS_URL="rediss://default:token@host:6379"
```

---

## 2. Dependency Injection

Since `RedisModule` is registered globally in `AppModule`, you can inject any of the Redis services into any NestJS service or gateway without re-importing the module:

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService, RedisPubSubService, RedisPresenceService } from 'src/redis';

@Injectable()
export class ExampleService {
  constructor(
    private readonly redis: RedisService,
    private readonly pubSub: RedisPubSubService,
    private readonly presence: RedisPresenceService,
  ) {}
}
```

---

## 3. Core Data & Cache Operations (`RedisService`)

### Automatic JSON Serialization & Deserialization
```typescript
// 1. Store Object with 10-minute TTL
await this.redis.set('customer:profile:123', { name: 'Jane', role: 'CUSTOMER' }, 600);

// 2. Retrieve automatically parsed object
const user = await this.redis.get<{ name: string; role: string }>('customer:profile:123');

// 3. Delete key
await this.redis.del('customer:profile:123');
```

### Hashes & Nested State
```typescript
// Store hash field
await this.redis.hset('cart:temp:user_456', 'item_1', { productId: 'prod-1', qty: 2 });

// Retrieve field
const item = await this.redis.hget('cart:temp:user_456', 'item_1');

// Retrieve all fields as a typed object
const fullCart = await this.redis.hgetall('cart:temp:user_456');
```

### Distributed Locks (Preventing Race Conditions)
```typescript
// Acquire lock with 5-second TTL
const lockToken = await this.redis.acquireLock('checkout:order_789', { ttlMs: 5000 });

if (!lockToken) {
  throw new ConflictException('Order checkout is currently being processed by another worker');
}

try {
  // Execute critical atomic business logic (e.g. inventory decrement)
} finally {
  // Safely release lock using atomic Lua script
  await this.redis.releaseLock('checkout:order_789', lockToken);
}
```

---

## 4. Real-Time Pub/Sub Engine (`RedisPubSubService`)

Used for broadcasting events across multiple backend replicas, WebSocket gateways, and microservices.

### Publishing Events
```typescript
import { REDIS_CHANNELS } from 'src/redis';

// Publish chat message
await this.pubSub.publish(REDIS_CHANNELS.CHAT_MESSAGES, {
  roomId: 'order_123',
  senderId: 'user_456',
  message: 'Technician is arriving in 15 minutes',
  timestamp: Date.now(),
});
```

### Subscribing to Events
```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisPubSubService, REDIS_CHANNELS } from 'src/redis';

@Injectable()
export class NotificationListenerService implements OnModuleInit {
  constructor(private readonly pubSub: RedisPubSubService) {}

  onModuleInit() {
    // Listen to chat channel
    this.pubSub.subscribe(REDIS_CHANNELS.CHAT_MESSAGES, (payload, channel) => {
      console.log(`Received message on ${channel}:`, payload);
      // Forward to WebSocket clients or send push notification
    });

    // Pattern-based subscription (e.g. all chat rooms)
    this.pubSub.psubscribe('chat:room:*', (payload, channel, pattern) => {
      console.log(`Pattern match [${pattern}] on [${channel}]:`, payload);
    });
  }
}
```

---

## 5. Real-Time User Presence (`RedisPresenceService`)

Used to track whether customers, admins, or technicians are currently online, active device counts, and last seen timestamps.

### Device Connect & Disconnect (WebSockets)
```typescript
// When a WebSocket client connects
@SubscribeMessage('connect')
async handleConnect(client: Socket, userId: string) {
  await this.presence.trackDeviceConnected(userId, client.id, {
    userAgent: client.handshake.headers['user-agent'],
    ipAddress: client.handshake.address,
  });
}

// When a WebSocket client disconnects
async handleDisconnect(client: Socket, userId: string) {
  await this.presence.trackDeviceDisconnected(userId, client.id);
}
```

### Heartbeats & Status Inquiries
```typescript
// 1. Send periodic heartbeat (refreshes 60s TTL)
await this.presence.heartbeat(userId, { platform: 'web' });

// 2. Check if a user is online
const isOnline = await this.presence.isUserOnline('user_123');

// 3. Get full presence metadata
const presence = await this.presence.getUserPresence('user_123');
// { userId: '...', isOnline: true, lastSeen: 1725000000000, activeDevicesCount: 2 }

// 4. Bulk query presence for a list of technician IDs
const techPresence = await this.presence.getUsersPresenceBulk(['tech_1', 'tech_2', 'tech_3']);

// 5. Total count of online users
const totalOnline = await this.presence.getOnlineUsersCount();
```

---

## 6. BullMQ Queue Integration (`createBullMQRedisConnection`)

BullMQ requires specific connection settings (`maxRetriesPerRequest: null`, `enableReadyCheck: false`). Use the built-in factory when initializing BullMQ queues or workers:

```typescript
import { Queue, Worker } from 'bullmq';
import { createBullMQRedisConnection } from 'src/redis';

// 1. Create BullMQ Queue connection
const connection = createBullMQRedisConnection();

export const emailQueue = new Queue('EMAIL_QUEUE', { connection });

// 2. Add job to queue
await emailQueue.add('SEND_WELCOME_EMAIL', {
  to: 'customer@example.com',
  subject: 'Welcome to Elite Central Vacuum',
});

// 3. Process jobs in worker
export const emailWorker = new Worker(
  'EMAIL_QUEUE',
  async (job) => {
    console.log(`Processing job ${job.id}:`, job.data);
  },
  { connection },
);
```

---

## 7. AI Caching & Session Memory Integration

When integrating Gemini AI conversational agents or structured intake analysis:

```typescript
// Cache AI diagnostic results to avoid redundant API billing
const cacheKey = `ai:diagnostics:${symptomHash}`;
let diagnosticResult = await this.redis.get(cacheKey);

if (!diagnosticResult) {
  diagnosticResult = await this.aiService.analyzeSymptoms(symptoms);
  // Cache for 24 hours
  await this.redis.set(cacheKey, diagnosticResult, 86400);
}
```
