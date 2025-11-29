const express = require('express');
const router = express.Router();
const { createClaimableBalance } = require('../diamnetService');
const logger = require('../logger');
const gameStateManager = require('../gameStateManager');

/**
 * API endpoint for creating claimable balances
 */
router.post('/create-claimable-balance', async (req, res) => {
  try {
    const { winnerAddress, gameId } = req.body;
    
    // Validate the request
    if (!winnerAddress) {
      return res.status(400).json({ error: 'Winner address is required' });
    }
    
    // Create the claimable balance
    const result = await createClaimableBalance(winnerAddress);
    
    // Return success response
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error creating claimable balance:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create claimable balance' 
    });
  }
});

/**
 * API endpoint to get game state by game ID
 */
router.get('/game-state/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    
    if (!gameId) {
      return res.status(400).json({ error: 'Game ID is required' });
    }
    
    const gameData = gameStateManager.getGameStateByGameId(gameId);
    
    if (gameData) {
      logger.info(`Game state retrieved for game ID ${gameId}`);
      res.status(200).json({
        success: true,
        gameId,
        roomId: gameData.roomId,
        state: gameData.state,
        cardHashMap: gameData.cardHashMap,
        metadata: gameData.metadata
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Game state not found'
      });
    }
  } catch (error) {
    logger.error(`Error retrieving game state for game ID ${req.params.gameId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve game state'
    });
  }
});

/**
 * API endpoint to get list of recent games
 */
router.get('/recent-games', (req, res) => {
  try {
    const recentGames = gameStateManager.getRecentGames();
    res.status(200).json({
      success: true,
      games: recentGames,
      count: recentGames.length
    });
  } catch (error) {
    logger.error('Error retrieving recent games:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent games'
    });
  }
});

/**
 * Health check endpoint for Cloud Run
 * Note: Connection count is tracked in the main index.js
 */
router.get('/health', (req, res) => {
  const gameStats = gameStateManager.getStats();
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    gameStates: gameStats.totalGames,
    activeRooms: gameStats.activeRooms.length
  });
});

module.exports = router;
