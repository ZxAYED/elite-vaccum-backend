import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  REDIS_CLIENT,
  REDIS_MODULE_OPTIONS,
  REDIS_PUB_CLIENT,
  REDIS_SUB_CLIENT,
} from './constants/redis.constants';
import {
  RedisModuleAsyncOptions,
  RedisModuleOptions,
  RedisOptionsFactory,
} from './interfaces/redis-options.interface';
import { createRedisClient, resolveRedisOptions } from './redis.config';
import { RedisPresenceService } from './redis-presence.service';
import { RedisPubSubService } from './redis-pubsub.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const options = resolveRedisOptions(configService);
        return createRedisClient(options, 'Main');
      },
    },
    {
      provide: REDIS_PUB_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const options = resolveRedisOptions(configService);
        return createRedisClient(options, 'Publisher');
      },
    },
    {
      provide: REDIS_SUB_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const options = resolveRedisOptions(configService);
        return createRedisClient(options, 'Subscriber');
      },
    },
    RedisService,
    RedisPubSubService,
    RedisPresenceService,
  ],
  exports: [
    REDIS_CLIENT,
    REDIS_PUB_CLIENT,
    REDIS_SUB_CLIENT,
    RedisService,
    RedisPubSubService,
    RedisPresenceService,
  ],
})
export class RedisModule {
  /**
   * Static registration with synchronous custom options.
   */
  static forRoot(options: RedisModuleOptions = {}): DynamicModule {
    const optionsProvider: Provider = {
      provide: REDIS_MODULE_OPTIONS,
      useValue: options,
    };

    const redisClientProvider: Provider = {
      provide: REDIS_CLIENT,
      inject: [REDIS_MODULE_OPTIONS, ConfigService],
      useFactory: (opts: RedisModuleOptions, configService: ConfigService) => {
        const base = resolveRedisOptions(configService);
        return createRedisClient({ ...base, ...opts }, 'Main');
      },
    };

    const pubClientProvider: Provider = {
      provide: REDIS_PUB_CLIENT,
      inject: [REDIS_MODULE_OPTIONS, ConfigService],
      useFactory: (opts: RedisModuleOptions, configService: ConfigService) => {
        const base = resolveRedisOptions(configService);
        return createRedisClient({ ...base, ...opts }, 'Publisher');
      },
    };

    const subClientProvider: Provider = {
      provide: REDIS_SUB_CLIENT,
      inject: [REDIS_MODULE_OPTIONS, ConfigService],
      useFactory: (opts: RedisModuleOptions, configService: ConfigService) => {
        const base = resolveRedisOptions(configService);
        return createRedisClient({ ...base, ...opts }, 'Subscriber');
      },
    };

    return {
      global: options.isGlobal ?? true,
      module: RedisModule,
      providers: [
        optionsProvider,
        redisClientProvider,
        pubClientProvider,
        subClientProvider,
        RedisService,
        RedisPubSubService,
        RedisPresenceService,
      ],
      exports: [
        REDIS_CLIENT,
        REDIS_PUB_CLIENT,
        REDIS_SUB_CLIENT,
        RedisService,
        RedisPubSubService,
        RedisPresenceService,
      ],
    };
  }

  /**
   * Dynamic async registration with ConfigService or custom Factory.
   */
  static forRootAsync(options: RedisModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    const redisClientProvider: Provider = {
      provide: REDIS_CLIENT,
      inject: [REDIS_MODULE_OPTIONS, ConfigService],
      useFactory: (opts: RedisModuleOptions, configService: ConfigService) => {
        const base = resolveRedisOptions(configService);
        return createRedisClient({ ...base, ...opts }, 'Main');
      },
    };

    const pubClientProvider: Provider = {
      provide: REDIS_PUB_CLIENT,
      inject: [REDIS_MODULE_OPTIONS, ConfigService],
      useFactory: (opts: RedisModuleOptions, configService: ConfigService) => {
        const base = resolveRedisOptions(configService);
        return createRedisClient({ ...base, ...opts }, 'Publisher');
      },
    };

    const subClientProvider: Provider = {
      provide: REDIS_SUB_CLIENT,
      inject: [REDIS_MODULE_OPTIONS, ConfigService],
      useFactory: (opts: RedisModuleOptions, configService: ConfigService) => {
        const base = resolveRedisOptions(configService);
        return createRedisClient({ ...base, ...opts }, 'Subscriber');
      },
    };

    return {
      global: options.isGlobal ?? true,
      module: RedisModule,
      imports: options.imports || [],
      providers: [
        ...asyncProviders,
        redisClientProvider,
        pubClientProvider,
        subClientProvider,
        RedisService,
        RedisPubSubService,
        RedisPresenceService,
      ],
      exports: [
        REDIS_CLIENT,
        REDIS_PUB_CLIENT,
        REDIS_SUB_CLIENT,
        RedisService,
        RedisPubSubService,
        RedisPresenceService,
      ],
    };
  }

  private static createAsyncProviders(options: RedisModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: REDIS_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }

    const useClass = options.useClass || options.useExisting;
    if (!useClass) {
      return [
        {
          provide: REDIS_MODULE_OPTIONS,
          useValue: {},
        },
      ];
    }

    return [
      {
        provide: REDIS_MODULE_OPTIONS,
        useFactory: async (optionsFactory: RedisOptionsFactory) =>
          await optionsFactory.createRedisOptions(),
        inject: [useClass],
      },
      ...(options.useClass ? [{ provide: useClass, useClass }] : []),
    ];
  }
}
