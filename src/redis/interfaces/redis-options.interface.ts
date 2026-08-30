import { ModuleMetadata, Type } from '@nestjs/common';
import { RedisOptions as IORedisOptions } from 'ioredis';

export interface RedisModuleOptions extends IORedisOptions {
  url?: string;
  isGlobal?: boolean;
  keyPrefix?: string;
  maxRetriesPerRequest?: number | null;
  enableReadyCheck?: boolean;
}

export interface RedisModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<RedisOptionsFactory>;
  useClass?: Type<RedisOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<RedisModuleOptions> | RedisModuleOptions;
  inject?: any[];
  isGlobal?: boolean;
}

export interface RedisOptionsFactory {
  createRedisOptions(): Promise<RedisModuleOptions> | RedisModuleOptions;
}

export interface UserPresenceState {
  userId: string;
  isOnline: boolean;
  lastSeen: number; // Unix timestamp ms
  activeDevicesCount: number;
  metadata?: Record<string, any>;
}

export interface DeviceSessionState {
  socketId: string;
  userId: string;
  connectedAt: number;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export interface DistributedLockOptions {
  ttlMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}
