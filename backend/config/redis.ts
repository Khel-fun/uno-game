import Redis from 'ioredis';
import log from '../log';

function createRedisClient(role: string = 'data'): Redis {
  const {
    REDIS_URL,
    REDIS_HOST = '127.0.0.1',
    REDIS_PORT = '6379',
    REDIS_PASSWORD,
    REDIS_DB = '0',
  } = process.env;

  const options = REDIS_URL
    ? { lazyConnect: true, maxRetriesPerRequest: 3, enableReadyCheck: true }
    : {
        host: REDIS_HOST,
        port: Number(REDIS_PORT),
        password: REDIS_PASSWORD || undefined,
        db: Number(REDIS_DB),
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
      };

  const client = REDIS_URL ? new Redis(REDIS_URL, options) : new Redis(options);

  client.on('connect', () => log.info(`[redis-${role}] connected`));
  client.on('error', (err) => log.error(`[redis-${role}] error: ${err.message}`));
  client.on('close', () => log.warn(`[redis-${role}] connection closed`));
  client.on('reconnecting', () => log.warn(`[redis-${role}] reconnecting...`));

  return client;
}

function getRedisEnabled(): boolean {
  return String(process.env.REDIS_ENABLED || 'false').toLowerCase() === 'true';
}

export { createRedisClient, getRedisEnabled };
