import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_PUB_CLIENT, REDIS_SUB_CLIENT } from './constants/redis.constants';

type MessageHandler<T = any> = (data: T, channel: string) => void;
type PatternMessageHandler<T = any> = (data: T, channel: string, pattern: string) => void;

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubService.name);

  // In-memory mapping of channel -> Handler set
  private readonly channelHandlers = new Map<string, Set<MessageHandler>>();
  private readonly patternHandlers = new Map<string, Set<PatternMessageHandler>>();

  constructor(
    @Inject(REDIS_PUB_CLIENT) private readonly pubClient: Redis,
    @Inject(REDIS_SUB_CLIENT) private readonly subClient: Redis,
  ) {}

  async onModuleInit() {
    this.setupSubscriberListeners();
  }

  async onModuleDestroy() {
    try {
      if (this.pubClient.status === 'ready' || this.pubClient.status === 'connecting') {
        await this.pubClient.quit();
      }
      if (this.subClient.status === 'ready' || this.subClient.status === 'connecting') {
        await this.subClient.quit();
      }
      this.channelHandlers.clear();
      this.patternHandlers.clear();
      this.logger.log('Redis PubSub connections cleanly closed');
    } catch (err: any) {
      this.logger.error(`Error closing Redis PubSub clients: ${err.message}`);
    }
  }

  /**
   * Internal router for incoming Redis Pub/Sub events.
   */
  private setupSubscriberListeners() {
    this.subClient.on('message', (channel: string, message: string) => {
      const handlers = this.channelHandlers.get(channel);
      if (!handlers || handlers.size === 0) return;

      let parsed: any;
      try {
        parsed = JSON.parse(message);
      } catch {
        parsed = message;
      }

      handlers.forEach((handler) => {
        try {
          handler(parsed, channel);
        } catch (err: any) {
          this.logger.error(`Error in PubSub handler for channel '${channel}': ${err.message}`, err.stack);
        }
      });
    });

    this.subClient.on('pmessage', (pattern: string, channel: string, message: string) => {
      const handlers = this.patternHandlers.get(pattern);
      if (!handlers || handlers.size === 0) return;

      let parsed: any;
      try {
        parsed = JSON.parse(message);
      } catch {
        parsed = message;
      }

      handlers.forEach((handler) => {
        try {
          handler(parsed, channel, pattern);
        } catch (err: any) {
          this.logger.error(`Error in PubSub pattern handler for pattern '${pattern}': ${err.message}`, err.stack);
        }
      });
    });
  }

  /**
   * Publishes a message to a Redis channel.
   * Accepts object or string, automatically serializes to JSON.
   */
  async publish<T = any>(channel: string, message: T): Promise<number> {
    try {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      return await this.pubClient.publish(channel, payload);
    } catch (err: any) {
      this.logger.error(`Redis PUBLISH failed on channel '${channel}': ${err.message}`);
      return 0;
    }
  }

  /**
   * Subscribes a local handler to a specific Redis channel.
   */
  async subscribe<T = any>(channel: string, handler: MessageHandler<T>): Promise<void> {
    if (!this.channelHandlers.has(channel)) {
      this.channelHandlers.set(channel, new Set());
      await this.subClient.subscribe(channel);
      this.logger.debug(`Subscribed to Redis channel: '${channel}'`);
    }
    this.channelHandlers.get(channel)!.add(handler);
  }

  /**
   * Unsubscribes a specific handler or all handlers from a channel.
   */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    if (!this.channelHandlers.has(channel)) return;

    if (handler) {
      this.channelHandlers.get(channel)!.delete(handler);
      if (this.channelHandlers.get(channel)!.size === 0) {
        this.channelHandlers.delete(channel);
        await this.subClient.unsubscribe(channel);
        this.logger.debug(`Unsubscribed from Redis channel: '${channel}'`);
      }
    } else {
      this.channelHandlers.delete(channel);
      await this.subClient.unsubscribe(channel);
      this.logger.debug(`Unsubscribed all handlers from Redis channel: '${channel}'`);
    }
  }

  /**
   * Subscribes to channels matching a glob-style pattern (e.g. `chat:*`, `users:*:events`).
   */
  async psubscribe<T = any>(pattern: string, handler: PatternMessageHandler<T>): Promise<void> {
    if (!this.patternHandlers.has(pattern)) {
      this.patternHandlers.set(pattern, new Set());
      await this.subClient.psubscribe(pattern);
      this.logger.debug(`Subscribed to Redis pattern: '${pattern}'`);
    }
    this.patternHandlers.get(pattern)!.add(handler);
  }

  /**
   * Unsubscribes from pattern-based channels.
   */
  async punsubscribe(pattern: string): Promise<void> {
    if (!this.patternHandlers.has(pattern)) return;
    this.patternHandlers.delete(pattern);
    await this.subClient.punsubscribe(pattern);
    this.logger.debug(`Unsubscribed from Redis pattern: '${pattern}'`);
  }
}
