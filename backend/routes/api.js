const express = require('express');
const os = require('os');
const gameStateManager = require('../gameStateManager');
const RedisStorage = require('../services/redisStorage');

const router = express.Router();

router.get('/health', async (_req, res) => {
  const redis = new RedisStorage();
  const redisEnabled = redis.isEnabled();
  const counts = gameStateManager.counts();

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    gameStates: counts.gameStates,
    activeRooms: counts.activeRooms,
    redisEnabled,
    storageType: redisEnabled ? 'redis' : 'memory',
    memory: process.memoryUsage(),
    loadavg: os.loadavg(),
  });
});

module.exports = router;
