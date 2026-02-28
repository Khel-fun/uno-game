const express = require('express');
const os = require('os');
const gameStateManager = require('../gameStateManager');
const RedisStorage = require('../services/redisStorage');
const trackingService = require('../tracking/service');
const { checkTrackingDbHealth } = require('../config/postgres');
const trackingRouter = require('./tracking');

const router = express.Router();

router.get('/health', async (_req, res) => {
  const redis = new RedisStorage();
  const redisEnabled = redis.isEnabled();
  const counts = gameStateManager.counts();
  const trackingDb = await checkTrackingDbHealth();
  const trackingStatus = trackingService.getStatus();

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    gameStates: counts.gameStates,
    activeRooms: counts.activeRooms,
    gameCodes: counts.gameCodes,
    redisEnabled,
    storageType: redisEnabled ? 'redis' : 'memory',
    tracking: {
      ...trackingStatus,
      db: trackingDb,
    },
    memory: process.memoryUsage(),
    loadavg: os.loadavg(),
  });
});

// Validate a game code via REST (alternative to socket)
router.get('/game/code/:code', (req, res) => {
  const { code } = req.params;
  if (!code) {
    return res.status(400).json({ error: 'Game code is required' });
  }
  const entry = gameStateManager.getGameByCode(code.toUpperCase());
  if (!entry) {
    return res.status(404).json({ error: 'Invalid game code' });
  }
  res.json({ gameId: entry.gameId, isPrivate: entry.isPrivate });
});

// Get game code for a game ID
router.get('/game/:gameId/code', (req, res) => {
  const { gameId } = req.params;
  const code = gameStateManager.getCodeByGameId(gameId);
  if (!code) {
    return res.status(404).json({ error: 'No game code found' });
  }
  res.json({ gameCode: code });
});

router.use('/tracking', trackingRouter);

module.exports = router;
