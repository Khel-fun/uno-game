const logger = require('./logger');

// In-memory storage for game states
// In production, consider using Redis or a database
const gameStates = new Map();
const cardHashMaps = new Map();

/**
 * Save game state for a room
 * @param {string} roomId - The room identifier
 * @param {object} gameState - The game state object
 * @param {object} cardHashMap - Optional card hash map
 */
const saveGameState = (roomId, gameState, cardHashMap = null) => {
    try {
        gameStates.set(roomId, {
            state: gameState,
            lastUpdated: Date.now()
        });
        
        if (cardHashMap) {
            cardHashMaps.set(roomId, cardHashMap);
        }
        
        logger.debug(`Game state saved for room ${roomId}`);
        return true;
    } catch (error) {
        logger.error(`Error saving game state for room ${roomId}:`, error);
        return false;
    }
};

/**
 * Get game state for a room
 * @param {string} roomId - The room identifier
 * @returns {object|null} The game state or null if not found
 */
const getGameState = (roomId) => {
    const stored = gameStates.get(roomId);
    if (stored) {
        logger.debug(`Game state retrieved for room ${roomId}`);
        return stored.state;
    }
    logger.debug(`No game state found for room ${roomId}`);
    return null;
};

/**
 * Get card hash map for a room
 * @param {string} roomId - The room identifier
 * @returns {object|null} The card hash map or null if not found
 */
const getCardHashMap = (roomId) => {
    const cardHashMap = cardHashMaps.get(roomId);
    if (cardHashMap) {
        logger.debug(`Card hash map retrieved for room ${roomId}`);
        return cardHashMap;
    }
    return null;
};

/**
 * Delete game state for a room
 * @param {string} roomId - The room identifier
 */
const deleteGameState = (roomId) => {
    const deleted = gameStates.delete(roomId);
    cardHashMaps.delete(roomId);
    
    if (deleted) {
        logger.info(`Game state deleted for room ${roomId}`);
    }
    return deleted;
};

/**
 * Check if a room has a game state
 * @param {string} roomId - The room identifier
 * @returns {boolean}
 */
const hasGameState = (roomId) => {
    return gameStates.has(roomId);
};

/**
 * Get all active room IDs
 * @returns {string[]} Array of room IDs
 */
const getActiveRooms = () => {
    return Array.from(gameStates.keys());
};

/**
 * Clean up old game states
 * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
 */
const cleanupOldGameStates = (maxAge = 3600000) => {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [roomId, data] of gameStates.entries()) {
        if (now - data.lastUpdated > maxAge) {
            gameStates.delete(roomId);
            cardHashMaps.delete(roomId);
            cleanedCount++;
            logger.info(`Cleaned up old game state for room ${roomId}`);
        }
    }
    
    if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old game states`);
    }
    
    return cleanedCount;
};

/**
 * Get statistics about stored game states
 * @returns {object} Statistics object
 */
const getStats = () => {
    return {
        totalGames: gameStates.size,
        activeRooms: getActiveRooms(),
        memoryUsage: process.memoryUsage()
    };
};

// Start periodic cleanup (every 5 minutes)
const CLEANUP_INTERVAL = 300000; // 5 minutes
setInterval(() => {
    cleanupOldGameStates();
}, CLEANUP_INTERVAL);

logger.info('Game state manager initialized with periodic cleanup');

module.exports = {
    saveGameState,
    getGameState,
    getCardHashMap,
    deleteGameState,
    hasGameState,
    getActiveRooms,
    cleanupOldGameStates,
    getStats
};
