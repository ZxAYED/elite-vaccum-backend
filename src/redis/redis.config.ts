import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { REDIS_DEFAULT_KEY_PREFIX } from './constants/redis.constants';
import { RedisModuleOptions } from './interfaces/redis-options.interface';

const logger = new Logger('RedisConfig');

/**
 * Resolves Redis options from NestJS ConfigService or environment variables.
 */
export function resolveRedisOptions(configService?: ConfigService): RedisModuleOptions {
  const redisUrl = configService?.get<string>('REDIS_URL') || process.env.REDIS_URL;

  const keyPrefix =
    configService?.get<string>('REDIS_KEY_PREFIX') ||
    process.env.REDIS_KEY_PREFIX ||
    REDIS_DEFAULT_KEY_PREFIX;

  const commonOptions: RedisOptions = {
    keyPrefix,
    lazyConnect: true,
    autoResubscribe: true,
    autoResendUnfulfilledCommands: true,
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
    retryStrategy(times) {
      const delay = Math.min(times * 150, 3000);
      logger.warn(`Redis connection lost. Retrying in ${delay}ms... (Attempt ${times})`);
      return delay;
    },
  };

  if (redisUrl) {
    return {
      url: redisUrl,
      ...commonOptions,
    };
  }

  const host = configService?.get<string>('REDIS_HOST') || process.env.REDIS_HOST || '127.0.0.1';
  const port = Number(configService?.get<number>('REDIS_PORT') || process.env.REDIS_PORT || 6379);
  const password = configService?.get<string>('REDIS_PASSWORD') || process.env.REDIS_PASSWORD || undefined;
  const db = Number(configService?.get<number>('REDIS_DB') || process.env.REDIS_DB || 0);

  return {
    host,
    port,
    password,
    db,
    ...commonOptions,
  };
}

/**
 * Creates an instantiated ioredis Client given RedisModuleOptions.
 */
export function createRedisClient(options: RedisModuleOptions, label = 'Main'): Redis {
  let client: Redis;

  if (options.url) {
    client = new Redis(options.url, options);
  } else {
    client = new Redis(options);
  }

  client.on('connect', () => {
    logger.log(`Redis [${label}] connected successfully`);
  });

  client.on('ready', () => {
    logger.log(`Redis [${label}] ready to accept commands`);
  });

  client.on('error', (err) => {
    logger.error(`Redis [${label}] error: ${err.message}`, err.stack);
  });

  client.on('close', () => {
    logger.warn(`Redis [${label}] connection closed`);
  });

  return client;
}

/**
 * Creates a BullMQ-compatible Redis connection object.
 * BullMQ requires `maxRetriesPerRequest: null` and `enableReadyCheck: false`.
 */
export function createBullMQRedisConnection(
  configService?: ConfigService,
  customOptions?: Partial<RedisOptions>,
): Redis {
  const baseOptions = resolveRedisOptions(configService);

  const bullOptions: RedisModuleOptions = {
    ...baseOptions,
    ...customOptions,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  return createRedisClient(bullOptions, 'BullMQ');
}
