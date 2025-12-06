const Redis = require('ioredis');
const logger = require('../logger');
const dotenv = require("dotenv")

dotenv.config({ path: ".env" })

// Redis configuration with fallbacks
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB, 10) || 0;
const REDIS_URL = process.env.REDIS_URL || null;

// Flag to enable/disable Redis - defaults to false (disabled)
const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';

// Redis connection options
const redisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis connection retry attempt ${times}, next retry in ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true, // Don't connect immediately
};

// If REDIS_URL is provided, parse it (useful for cloud deployments)
const getRedisConfig = () => {
  if (REDIS_URL) {
    return REDIS_URL;
  }
  return redisOptions;
};

/**
 * Create a new Redis client instance
 * @param {string} purpose - Description of the client's purpose (for logging)
 * @returns {Redis|null} Redis client instance or null if Redis is disabled
 */
const createRedisClient = (purpose = 'general') => {
  if (!REDIS_ENABLED) {
    logger.info(`Redis ${purpose} client not created - Redis is disabled`);
    return null;
  }

  try {
    const client = new Redis(getRedisConfig());

    client.on('connect', () => {
      logger.info(`Redis ${purpose} client connected to ${REDIS_HOST}:${REDIS_PORT}`);
    });

    client.on('ready', () => {
      logger.info(`Redis ${purpose} client ready`);
    });

    client.on('error', (err) => {
      logger.error(`Redis ${purpose} client error:`, err.message);
    });

    client.on('close', () => {
      logger.warn(`Redis ${purpose} client connection closed`);
    });

    client.on('reconnecting', () => {
      logger.info(`Redis ${purpose} client reconnecting...`);
    });

    return client;
  } catch (error) {
    logger.error(`Failed to create Redis ${purpose} client:`, error.message);
    return null;
  }
};

// Singleton clients for pub/sub and data operations
let pubClient = null;
let subClient = null;
let dataClient = null;

/**
 * Get the publisher Redis client (creates if not exists)
 * @returns {Redis|null} Redis publisher client or null if disabled
 */
const getPubClient = () => {
  if (!REDIS_ENABLED) return null;
  if (!pubClient) {
    pubClient = createRedisClient('publisher');
  }
  return pubClient;
};

/**
 * Get the subscriber Redis client (creates if not exists)
 * @returns {Redis|null} Redis subscriber client or null if disabled
 */
const getSubClient = () => {
  if (!REDIS_ENABLED) return null;
  if (!subClient) {
    subClient = createRedisClient('subscriber');
  }
  return subClient;
};

/**
 * Get the data Redis client (creates if not exists)
 * @returns {Redis|null} Redis data client or null if disabled
 */
const getDataClient = () => {
  if (!REDIS_ENABLED) return null;
  if (!dataClient) {
    dataClient = createRedisClient('data');
  }
  return dataClient;
};

/**
 * Connect all Redis clients
 * @returns {Promise<boolean>} True if connected successfully, false otherwise
 */
const connectRedis = async () => {
  if (!REDIS_ENABLED) {
    logger.info('Redis is disabled, skipping connection');
    return false;
  }

  try {
    const pub = getPubClient();
    const sub = getSubClient();
    const data = getDataClient();

    if (pub) await pub.connect();
    if (sub) await sub.connect();
    if (data) await data.connect();

    logger.info('All Redis clients connected successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect Redis clients:', error.message);
    return false;
  }
};

/**
 * Disconnect all Redis clients
 * @returns {Promise<void>}
 */
const disconnectRedis = async () => {
  if (!REDIS_ENABLED) return;

  try {
    if (pubClient) {
      await pubClient.quit();
      pubClient = null;
    }
    if (subClient) {
      await subClient.quit();
      subClient = null;
    }
    if (dataClient) {
      await dataClient.quit();
      dataClient = null;
    }
    logger.info('All Redis clients disconnected');
  } catch (error) {
    logger.error('Error disconnecting Redis clients:', error.message);
  }
};

/**
 * Check if Redis is enabled
 * @returns {boolean}
 */
const isRedisEnabled = () => REDIS_ENABLED;

module.exports = {
  createRedisClient,
  getPubClient,
  getSubClient,
  getDataClient,
  connectRedis,
  disconnectRedis,
  isRedisEnabled,
  redisOptions,
  getRedisConfig,
};
