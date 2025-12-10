const Redis = require('ioredis');
const logger = require('../logger');

function createRedisClient(role = 'data') {
  const {
    REDIS_URL,
    REDIS_HOST = '127.0.0.1',
    REDIS_PORT = 6379,
    REDIS_PASSWORD = undefined,
    REDIS_DB = 0,
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

  const client = new Redis(REDIS_URL || options);

  client.on('connect', () => logger.info(`[redis-${role}] connected`));
  client.on('error', (err) => logger.error(`[redis-${role}] error: ${err.message}`));
  client.on('close', () => logger.warn(`[redis-${role}] connection closed`));
  client.on('reconnecting', () => logger.warn(`[redis-${role}] reconnecting...`));

  return client;
}

function getRedisEnabled() {
  return String(process.env.REDIS_ENABLED || 'false').toLowerCase() === 'true';
}

module.exports = { createRedisClient, getRedisEnabled };
