import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT, REDIS_PREFIXES } from './constants/redis.constants';
import { DistributedLockOptions } from './interfaces/redis-options.interface';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  // Lua script for safe atomic lock release (only releases if the token matches)
  private readonly RELEASE_LOCK_LUA = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
  ) {}

  async onModuleInit() {
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
    } catch (err: any) {
      this.logger.warn(`Initial Redis connection deferred: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      if (this.client.status === 'ready' || this.client.status === 'connecting') {
        await this.client.quit();
        this.logger.log('Redis client gracefully disconnected');
      }
    } catch (err: any) {
      this.logger.error(`Error closing Redis client: ${err.message}`);
    }
  }

  /**
   * Returns the underlying raw ioredis instance.
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Checks if Redis connection is currently healthy and responsive.
   */
  async ping(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  // ==========================================
  // BASIC KEY-VALUE & JSON OPERATIONS
  // ==========================================

  /**
   * Get parsed JSON or string value by key.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      try {
        return JSON.parse(data) as T;
      } catch {
        return data as unknown as T;
      }
    } catch (err: any) {
      this.logger.error(`Redis GET failed for key '${key}': ${err.message}`);
      return null;
    }
  }

  /**
   * Set a key-value pair with optional TTL in seconds.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, payload, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, payload);
      }
      return true;
    } catch (err: any) {
      this.logger.error(`Redis SET failed for key '${key}': ${err.message}`);
      return false;
    }
  }

  /**
   * Delete one or more keys.
   */
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    try {
      return await this.client.del(...keys);
    } catch (err: any) {
      this.logger.error(`Redis DEL failed: ${err.message}`);
      return 0;
    }
  }

  /**
   * Check if one or more keys exist.
   */
  async exists(...keys: string[]): Promise<boolean> {
    if (keys.length === 0) return false;
    try {
      const count = await this.client.exists(...keys);
      return count > 0;
    } catch (err: any) {
      this.logger.error(`Redis EXISTS failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Set expiration TTL in seconds on a key.
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const res = await this.client.expire(key, ttlSeconds);
      return res === 1;
    } catch (err: any) {
      this.logger.error(`Redis EXPIRE failed for key '${key}': ${err.message}`);
      return false;
    }
  }

  /**
   * Get remaining TTL in seconds for a key (-1 = no expiry, -2 = key does not exist).
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (err: any) {
      this.logger.error(`Redis TTL failed for key '${key}': ${err.message}`);
      return -2;
    }
  }

  /**
   * Find keys matching a glob-style pattern.
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (err: any) {
      this.logger.error(`Redis KEYS failed for pattern '${pattern}': ${err.message}`);
      return [];
    }
  }

  /**
   * Deletes all keys matching a glob-style pattern (e.g. 'store:products:*').
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const matchedKeys = await this.client.keys(pattern);
      if (!matchedKeys || matchedKeys.length === 0) return 0;

      const prefix = (this.client.options as any).keyPrefix || '';
      const cleanKeys = matchedKeys.map((k) =>
        prefix && k.startsWith(prefix) ? k.slice(prefix.length) : k,
      );

      return await this.client.del(...cleanKeys);
    } catch (err: any) {
      this.logger.error(`Redis deleteByPattern failed for '${pattern}': ${err.message}`);
      return 0;
    }
  }

  /**
   * Atomic increment.
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Atomic increment by specific integer.
   */
  async incrby(key: string, amount: number): Promise<number> {
    return this.client.incrby(key, amount);
  }

  /**
   * Atomic decrement.
   */
  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  // ==========================================
  // HASH OPERATIONS
  // ==========================================

  async hget<T>(hash: string, field: string): Promise<T | null> {
    try {
      const data = await this.client.hget(hash, field);
      if (!data) return null;
      try {
        return JSON.parse(data) as T;
      } catch {
        return data as unknown as T;
      }
    } catch (err: any) {
      this.logger.error(`Redis HGET failed on '${hash}:${field}': ${err.message}`);
      return null;
    }
  }

  async hset(hash: string, field: string, value: any): Promise<number> {
    try {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      return await this.client.hset(hash, field, payload);
    } catch (err: any) {
      this.logger.error(`Redis HSET failed on '${hash}:${field}': ${err.message}`);
      return 0;
    }
  }

  async hmset(hash: string, data: Record<string, any>): Promise<boolean> {
    try {
      const serialized: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) {
        serialized[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
      await this.client.hmset(hash, serialized);
      return true;
    } catch (err: any) {
      this.logger.error(`Redis HMSET failed on '${hash}': ${err.message}`);
      return false;
    }
  }

  async hgetall<T = any>(hash: string): Promise<Record<string, T>> {
    try {
      const raw = await this.client.hgetall(hash);
      const result: Record<string, T> = {};
      for (const [k, v] of Object.entries(raw)) {
        try {
          result[k] = JSON.parse(v) as T;
        } catch {
          result[k] = v as unknown as T;
        }
      }
      return result;
    } catch (err: any) {
      this.logger.error(`Redis HGETALL failed on '${hash}': ${err.message}`);
      return {};
    }
  }

  async hdel(hash: string, ...fields: string[]): Promise<number> {
    if (fields.length === 0) return 0;
    try {
      return await this.client.hdel(hash, ...fields);
    } catch (err: any) {
      this.logger.error(`Redis HDEL failed on '${hash}': ${err.message}`);
      return 0;
    }
  }

  async hexists(hash: string, field: string): Promise<boolean> {
    try {
      const res = await this.client.hexists(hash, field);
      return res === 1;
    } catch (err: any) {
      this.logger.error(`Redis HEXISTS failed on '${hash}:${field}': ${err.message}`);
      return false;
    }
  }

  async hlen(hash: string): Promise<number> {
    try {
      return await this.client.hlen(hash);
    } catch (err: any) {
      this.logger.error(`Redis HLEN failed on '${hash}': ${err.message}`);
      return 0;
    }
  }

  // ==========================================
  // SETS OPERATIONS
  // ==========================================

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    try {
      return await this.client.sadd(key, ...members);
    } catch (err: any) {
      this.logger.error(`Redis SADD failed on '${key}': ${err.message}`);
      return 0;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    try {
      return await this.client.srem(key, ...members);
    } catch (err: any) {
      this.logger.error(`Redis SREM failed on '${key}': ${err.message}`);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (err: any) {
      this.logger.error(`Redis SMEMBERS failed on '${key}': ${err.message}`);
      return [];
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const res = await this.client.sismember(key, member);
      return res === 1;
    } catch (err: any) {
      this.logger.error(`Redis SISMEMBER failed on '${key}': ${err.message}`);
      return false;
    }
  }

  async scard(key: string): Promise<number> {
    try {
      return await this.client.scard(key);
    } catch (err: any) {
      this.logger.error(`Redis SCARD failed on '${key}': ${err.message}`);
      return 0;
    }
  }

  // ==========================================
  // SORTED SETS (ZSET)
  // ==========================================

  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.client.zadd(key, score, member);
    } catch (err: any) {
      this.logger.error(`Redis ZADD failed on '${key}': ${err.message}`);
      return 0;
    }
  }

  async zrange(key: string, start = 0, stop = -1): Promise<string[]> {
    try {
      return await (this.client as any).zrange(key, start, stop);
    } catch (err: any) {
      this.logger.error(`Redis ZRANGE failed on '${key}': ${err.message}`);
      return [];
    }
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    try {
      return await this.client.zrem(key, ...members);
    } catch (err: any) {
      this.logger.error(`Redis ZREM failed on '${key}': ${err.message}`);
      return 0;
    }
  }

  async zcard(key: string): Promise<number> {
    try {
      return await this.client.zcard(key);
    } catch (err: any) {
      this.logger.error(`Redis ZCARD failed on '${key}': ${err.message}`);
      return 0;
    }
  }

  // ==========================================
  // DISTRIBUTED LOCKS PRIMITIVE
  // ==========================================

  /**
   * Acquires a distributed lock using Redis `SET key value NX PX ttlMs`.
   * Returns a unique lock token if acquired, or null if already locked.
   */
  async acquireLock(
    lockName: string,
    options: DistributedLockOptions = {},
  ): Promise<string | null> {
    const ttlMs = options.ttlMs || 10000; // 10s default
    const retryCount = options.retryCount || 0;
    const retryDelayMs = options.retryDelayMs || 100;

    const fullKey = `${REDIS_PREFIXES.LOCK}${lockName}`;
    const token = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const result = await this.client.set(fullKey, token, 'PX', ttlMs, 'NX');
        if (result === 'OK') {
          return token;
        }
      } catch (err: any) {
        this.logger.error(`Error attempting lock on '${fullKey}': ${err.message}`);
      }

      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    return null;
  }

  /**
   * Releases a distributed lock safely using Lua script to verify token ownership.
   */
  async releaseLock(lockName: string, token: string): Promise<boolean> {
    const fullKey = `${REDIS_PREFIXES.LOCK}${lockName}`;
    try {
      const result = await (this.client as any).eval(this.RELEASE_LOCK_LUA, 1, fullKey, token);
      return result === 1;
    } catch (err: any) {
      this.logger.error(`Error releasing lock on '${fullKey}': ${err.message}`);
      return false;
    }
  }
}
