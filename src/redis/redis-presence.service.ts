import { Injectable, Logger } from '@nestjs/common';
import { REDIS_CHANNELS, REDIS_PREFIXES } from './constants/redis.constants';
import { DeviceSessionState, UserPresenceState } from './interfaces/redis-options.interface';
import { RedisPubSubService } from './redis-pubsub.service';
import { RedisService } from './redis.service';

@Injectable()
export class RedisPresenceService {
  private readonly logger = new Logger(RedisPresenceService.name);

  // Default heartbeat TTL: 60 seconds
  private readonly DEFAULT_HEARTBEAT_TTL_SEC = 60;

  constructor(
    private readonly redis: RedisService,
    private readonly pubSub: RedisPubSubService,
  ) {}

  /**
   * Records a user heartbeat with optional device metadata.
   * Auto-refreshes the user's online TTL in Redis.
   */
  async heartbeat(
    userId: string,
    metadata?: Record<string, any>,
    ttlSeconds = this.DEFAULT_HEARTBEAT_TTL_SEC,
  ): Promise<void> {
    const userKey = `${REDIS_PREFIXES.PRESENCE}${userId}`;
    const wasOnline = await this.isUserOnline(userId);

    const presence: UserPresenceState = {
      userId,
      isOnline: true,
      lastSeen: Date.now(),
      activeDevicesCount: await this.getUserActiveDevicesCount(userId),
      metadata,
    };

    await this.redis.set(userKey, presence, ttlSeconds);
    await this.redis.sadd(`${REDIS_PREFIXES.PRESENCE}online_set`, userId);

    // If user just came online, broadcast presence update event
    if (!wasOnline) {
      await this.pubSub.publish(REDIS_CHANNELS.PRESENCE_UPDATES, {
        userId,
        status: 'ONLINE',
        lastSeen: presence.lastSeen,
        metadata,
      });
    }
  }

  /**
   * Tracks a new socket connection / device session for a user.
   */
  async trackDeviceConnected(
    userId: string,
    socketId: string,
    deviceInfo?: { userAgent?: string; ipAddress?: string; metadata?: Record<string, any> },
  ): Promise<void> {
    const userDevicesKey = `${REDIS_PREFIXES.DEVICE_SESSION}${userId}`;
    const deviceState: DeviceSessionState = {
      socketId,
      userId,
      connectedAt: Date.now(),
      userAgent: deviceInfo?.userAgent,
      ipAddress: deviceInfo?.ipAddress,
      metadata: deviceInfo?.metadata,
    };

    await this.redis.hset(userDevicesKey, socketId, deviceState);
    await this.heartbeat(userId, deviceInfo?.metadata);
  }

  /**
   * Removes a disconnected socket session. If no active devices remain, sets user offline.
   */
  async trackDeviceDisconnected(userId: string, socketId: string): Promise<void> {
    const userDevicesKey = `${REDIS_PREFIXES.DEVICE_SESSION}${userId}`;
    await this.redis.hdel(userDevicesKey, socketId);

    const remainingDevices = await this.getUserActiveDevicesCount(userId);
    if (remainingDevices === 0) {
      await this.setUserOffline(userId);
    }
  }

  /**
   * Explicitly sets a user status to Offline and broadcasts event.
   */
  async setUserOffline(userId: string): Promise<void> {
    const userKey = `${REDIS_PREFIXES.PRESENCE}${userId}`;
    const lastSeen = Date.now();

    // Set offline record with 30-day retention for lastSeen lookups
    const offlineState: UserPresenceState = {
      userId,
      isOnline: false,
      lastSeen,
      activeDevicesCount: 0,
    };

    await this.redis.set(userKey, offlineState, 30 * 24 * 60 * 60);
    await this.redis.srem(`${REDIS_PREFIXES.PRESENCE}online_set`, userId);
    await this.redis.del(`${REDIS_PREFIXES.DEVICE_SESSION}${userId}`);

    await this.pubSub.publish(REDIS_CHANNELS.PRESENCE_UPDATES, {
      userId,
      status: 'OFFLINE',
      lastSeen,
    });
  }

  /**
   * Checks if a user is currently online.
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const state = await this.redis.get<UserPresenceState>(`${REDIS_PREFIXES.PRESENCE}${userId}`);
    return !!state && state.isOnline;
  }

  /**
   * Retrieves full presence state (online status, last seen, device count) for a user.
   */
  async getUserPresence(userId: string): Promise<UserPresenceState | null> {
    return this.redis.get<UserPresenceState>(`${REDIS_PREFIXES.PRESENCE}${userId}`);
  }

  /**
   * Retrieves presence for multiple users in bulk.
   */
  async getUsersPresenceBulk(userIds: string[]): Promise<Record<string, UserPresenceState>> {
    const result: Record<string, UserPresenceState> = {};
    if (userIds.length === 0) return result;

    await Promise.all(
      userIds.map(async (uid) => {
        const state = await this.getUserPresence(uid);
        if (state) {
          result[uid] = state;
        } else {
          result[uid] = {
            userId: uid,
            isOnline: false,
            lastSeen: 0,
            activeDevicesCount: 0,
          };
        }
      }),
    );

    return result;
  }

  /**
   * Gets list of all currently active online user IDs.
   */
  async getOnlineUserIds(): Promise<string[]> {
    return this.redis.smembers(`${REDIS_PREFIXES.PRESENCE}online_set`);
  }

  /**
   * Gets the total count of online users.
   */
  async getOnlineUsersCount(): Promise<number> {
    return this.redis.scard(`${REDIS_PREFIXES.PRESENCE}online_set`);
  }

  /**
   * Gets active device sessions for a user.
   */
  async getUserDevices(userId: string): Promise<Record<string, DeviceSessionState>> {
    return this.redis.hgetall<DeviceSessionState>(`${REDIS_PREFIXES.DEVICE_SESSION}${userId}`);
  }

  /**
   * Counts active device socket connections for a user.
   */
  async getUserActiveDevicesCount(userId: string): Promise<number> {
    return this.redis.hlen(`${REDIS_PREFIXES.DEVICE_SESSION}${userId}`);
  }
}
