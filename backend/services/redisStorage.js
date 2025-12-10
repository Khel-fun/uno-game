const { createRedisClient, getRedisEnabled } = require('../config/redis');
const logger = require('../logger');
const {
  GAME_STATE_TTL_MS,
} = require('../constants');

class RedisStorage {
  constructor() {
    this.enabled = getRedisEnabled();
    if (this.enabled) {
      this.client = createRedisClient('data');
      this.client.connect().catch((err) => {
        logger.error('Redis connect error, disabling Redis: %s', err.message);
        this.enabled = false;
      });
    }
  }

  isEnabled() {
    return this.enabled;
  }

  async set(key, value, ttlMs) {
    if (!this.enabled) return;
    const payload = JSON.stringify(value);
    if (ttlMs) {
      await this.client.set(key, payload, 'PX', ttlMs);
    } else {
      await this.client.set(key, payload);
    }
  }

  async get(key) {
    if (!this.enabled) return null;
    const res = await this.client.get(key);
    return res ? JSON.parse(res) : null;
  }

  async del(key) {
    if (!this.enabled) return;
    await this.client.del(key);
  }

  async sadd(key, member) {
    if (!this.enabled) return;
    await this.client.sadd(key, member);
  }

  async srem(key, member) {
    if (!this.enabled) return;
    await this.client.srem(key, member);
  }

  async smembers(key) {
    if (!this.enabled) return [];
    return this.client.smembers(key);
  }

  async saveGameState(roomId, state) {
    await this.set(`game:state:${roomId}`, state, GAME_STATE_TTL_MS);
  }

  async getGameState(roomId) {
    return this.get(`game:state:${roomId}`);
  }

  async deleteGameState(roomId) {
    await this.del(`game:state:${roomId}`);
    await this.del(`game:cardhash:${roomId}`);
  }

  async saveCardHashMap(roomId, map) {
    await this.set(`game:cardhash:${roomId}`, map, GAME_STATE_TTL_MS);
  }

  async getCardHashMap(roomId) {
    return this.get(`game:cardhash:${roomId}`);
  }

  async saveUser(user) {
    const key = `user:${user.id}`;
    await this.set(key, user, 24 * 60 * 60 * 1000); // 24h
    await this.sadd('users:all', user.id);
    if (user.room) {
      await this.sadd(`room:users:${user.room}`, user.id);
    }
  }

  async removeUser(user) {
    const key = `user:${user.id}`;
    await this.del(key);
    await this.srem('users:all', user.id);
    if (user.room) {
      await this.srem(`room:users:${user.room}`, user.id);
    }
  }

  async getUser(socketId) {
    return this.get(`user:${socketId}`);
  }

  async getUsersInRoom(room) {
    const ids = await this.smembers(`room:users:${room}`);
    const users = await Promise.all(
      ids.map(async (id) => ({ id, ...(await this.get(`user:${id}`)) }))
    );
    return users.filter(Boolean);
  }
}

module.exports = RedisStorage;
