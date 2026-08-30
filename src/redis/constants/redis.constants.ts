export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_PUB_CLIENT = 'REDIS_PUB_CLIENT';
export const REDIS_SUB_CLIENT = 'REDIS_SUB_CLIENT';
export const REDIS_MODULE_OPTIONS = 'REDIS_MODULE_OPTIONS';

export const REDIS_DEFAULT_KEY_PREFIX = 'elite_vacuum:';

export const REDIS_CHANNELS = {
  CHAT_MESSAGES: 'chat:messages',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ_RECEIPT: 'chat:read_receipt',
  NOTIFICATIONS: 'notifications:events',
  SERVICE_EVENTS: 'services:events',
  ORDER_EVENTS: 'orders:events',
  TECHNICIAN_LOCATION: 'technicians:location',
  PRESENCE_UPDATES: 'presence:updates',
} as const;

export const REDIS_PREFIXES = {
  CACHE: 'cache:',
  PRESENCE: 'presence:',
  DEVICE_SESSION: 'devices:',
  LOCK: 'locks:',
  CHAT: 'chat:',
  RATE_LIMIT: 'ratelimit:',
  IDEMPOTENCY: 'idempotency:',
  QUEUE: 'bullmq:',
} as const;
