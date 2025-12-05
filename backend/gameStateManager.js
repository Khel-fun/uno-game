const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const redisStorage = require('./services/redisStorage');
const { isRedisEnabled } = require('./config/redis');

// In-memory storage for game states (fallback when Redis is disabled)
// This is now only used when Redis is not available
const gameStates = new Map();
const cardHashMaps = new Map();

// Persistent storage configuration (file-based fallback)
const STORAGE_FILE = path.join(__dirname, 'game-states.json');
const MAX_STORED_GAMES = 10;

// Store game metadata for persistence
const gameMetadata = new Map(); // gameId -> { players, startTime, lastActivity, roomId }

/**
 * Load game states from JSON file on startup (fallback storage)
 */
const loadGameStatesFromFile = () => {
    // Skip file loading if Redis is enabled
    if (isRedisEnabled()) {
        logger.info('Redis is enabled, skipping file-based game state loading');
        return;
    }

    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const data = fs.readFileSync(STORAGE_FILE, 'utf8');
            const parsed = JSON.parse(data);
            
            // Restore game states
            if (parsed.games && Array.isArray(parsed.games)) {
                parsed.games.forEach(game => {
                    gameStates.set(game.roomId, {
                        state: game.state,
                        lastUpdated: game.lastUpdated
                    });
                    
                    if (game.cardHashMap) {
                        cardHashMaps.set(game.roomId, game.cardHashMap);
                    }
                    
                    if (game.metadata) {
                        gameMetadata.set(game.gameId, game.metadata);
                    }
                });
                
                logger.info(`Loaded ${parsed.games.length} game states from persistent storage`);
            }
        }
    } catch (error) {
        logger.error('Error loading game states from file:', error);
    }
};

/**
 * Save game states to JSON file (fallback storage)
 */
const saveGameStatesToFile = () => {
    // Skip file saving if Redis is enabled
    if (isRedisEnabled()) {
        return true;
    }

    try {
        const games = [];
        
        // Convert Map to array and sort by last updated (most recent first)
        const sortedGames = Array.from(gameStates.entries())
            .sort((a, b) => b[1].lastUpdated - a[1].lastUpdated)
            .slice(0, MAX_STORED_GAMES); // Keep only last 10 games
        
        sortedGames.forEach(([roomId, data]) => {
            const gameId = data.state?.id?.toString() || roomId;
            const metadata = gameMetadata.get(gameId) || {
                players: data.state?.players || [],
                startTime: data.state?.lastActionTimestamp || Date.now(),
                lastActivity: data.lastUpdated,
                roomId: roomId
            };
            
            games.push({
                roomId,
                gameId,
                state: data.state,
                cardHashMap: cardHashMaps.get(roomId),
                lastUpdated: data.lastUpdated,
                metadata
            });
        });
        
        const dataToSave = {
            lastSaved: new Date().toISOString(),
            totalGames: games.length,
            games
        };
        
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
        logger.debug(`Saved ${games.length} game states to persistent storage`);
        return true;
    } catch (error) {
        logger.error('Error saving game states to file:', error);
        return false;
    }
};

/**
 * Save game state for a room
 * Uses Redis if enabled, falls back to in-memory + file storage
 * @param {string} roomId - The room identifier
 * @param {object} gameState - The game state object
 * @param {object} cardHashMap - Optional card hash map
 */
const saveGameState = (roomId, gameState, cardHashMap = null) => {
    // Use Redis storage if enabled
    if (isRedisEnabled()) {
        // Fire and forget - don't await to maintain sync API
        redisStorage.saveGameState(roomId, gameState, cardHashMap).catch(err => {
            logger.error(`Error saving game state to Redis for room ${roomId}:`, err);
        });
        return true;
    }

    // Fallback to in-memory storage
    try {
        const now = Date.now();
        gameStates.set(roomId, {
            state: gameState,
            lastUpdated: now
        });
        
        if (cardHashMap) {
            cardHashMaps.set(roomId, cardHashMap);
        }
        
        // Store metadata for persistence
        if (gameState && gameState.id) {
            const gameId = gameState.id.toString();
            gameMetadata.set(gameId, {
                players: gameState.players || [],
                startTime: gameState.lastActionTimestamp || now,
                lastActivity: now,
                roomId: roomId,
                isStarted: gameState.isStarted || false,
                turnCount: gameState.turnCount?.toString() || '0'
            });
        }
        
        logger.debug(`Game state saved for room ${roomId}`);
        
        // Persist to file asynchronously (non-blocking)
        setImmediate(() => saveGameStatesToFile());
        
        return true;
    } catch (error) {
        logger.error(`Error saving game state for room ${roomId}:`, error);
        return false;
    }
};

/**
 * Get game state for a room
 * Uses Redis if enabled, falls back to in-memory storage
 * @param {string} roomId - The room identifier
 * @returns {Promise<object|null>} The game state or null if not found
 */
const getGameState = async (roomId) => {
    // Use Redis storage if enabled (async operation)
    if (isRedisEnabled()) {
        return redisStorage.getGameState(roomId);
    }

    // Fallback to in-memory storage
    const stored = gameStates.get(roomId);
    if (stored) {
        logger.debug(`Game state retrieved for room ${roomId}`);
        return stored.state;
    }
    logger.debug(`No game state found for room ${roomId}`);
    return null;
};

/**
 * Get game state by game ID (searches across all rooms)
 * Uses Redis if enabled, falls back to in-memory storage
 * @param {string} gameId - The game identifier
 * @returns {Promise<object|null>} The game state or null if not found
 */
const getGameStateByGameId = async (gameId) => {
    // Use Redis storage if enabled
    if (isRedisEnabled()) {
        return redisStorage.getGameStateByGameId(gameId);
    }

    // Fallback to in-memory storage
    for (const [roomId, data] of gameStates.entries()) {
        if (data.state?.id?.toString() === gameId.toString()) {
            logger.debug(`Game state retrieved for game ID ${gameId} in room ${roomId}`);
            return {
                roomId,
                state: data.state,
                cardHashMap: cardHashMaps.get(roomId),
                metadata: gameMetadata.get(gameId.toString())
            };
        }
    }
    logger.debug(`No game state found for game ID ${gameId}`);
    return null;
};

/**
 * Get card hash map for a room
 * Uses Redis if enabled, falls back to in-memory storage
 * @param {string} roomId - The room identifier
 * @returns {Promise<object|null>} The card hash map or null if not found
 */
const getCardHashMap = async (roomId) => {
    // Use Redis storage if enabled
    if (isRedisEnabled()) {
        return redisStorage.getCardHashMap(roomId);
    }

    // Fallback to in-memory storage
    const cardHashMap = cardHashMaps.get(roomId);
    if (cardHashMap) {
        logger.debug(`Card hash map retrieved for room ${roomId}`);
        return cardHashMap;
    }
    return null;
};

/**
 * Delete game state for a room
 * Uses Redis if enabled, falls back to in-memory storage
 * @param {string} roomId - The room identifier
 * @returns {Promise<boolean>} Success status
 */
const deleteGameState = async (roomId) => {
    // Use Redis storage if enabled
    if (isRedisEnabled()) {
        try {
            await redisStorage.deleteGameState(roomId);
            return true;
        } catch (err) {
            logger.error(`Error deleting game state from Redis for room ${roomId}:`, err);
            return false;
        }
    }

    // Fallback to in-memory storage
    const deleted = gameStates.delete(roomId);
    cardHashMaps.delete(roomId);
    
    if (deleted) {
        logger.info(`Game state deleted for room ${roomId}`);
    }
    return deleted;
};

/**
 * Check if a room has a game state
 * Uses Redis if enabled, falls back to in-memory storage
 * @param {string} roomId - The room identifier
 * @returns {Promise<boolean>}
 */
const hasGameState = async (roomId) => {
    // Use Redis storage if enabled
    if (isRedisEnabled()) {
        return redisStorage.hasGameState(roomId);
    }

    // Fallback to in-memory storage
    return gameStates.has(roomId);
};

/**
 * Get all active room IDs
 * Uses Redis if enabled, falls back to in-memory storage
 * @returns {Promise<string[]>} Array of room IDs
 */
const getActiveRooms = async () => {
    // Use Redis storage if enabled
    if (isRedisEnabled()) {
        return redisStorage.getActiveRooms();
    }

    // Fallback to in-memory storage
    return Array.from(gameStates.keys());
};

/**
 * Clean up old game states
 * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
 */
const cleanupOldGameStates = (maxAge = 3600000) => {
    // Redis handles TTL automatically, skip cleanup if Redis is enabled
    if (isRedisEnabled()) {
        logger.debug('Redis handles TTL automatically, skipping manual cleanup');
        return 0;
    }

    // Fallback to in-memory cleanup
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
 * Uses Redis if enabled, falls back to in-memory storage
 * @returns {object} Statistics object
 */
const getStats = async () => {
    // Use Redis storage if enabled
    if (isRedisEnabled()) {
        const stats = await redisStorage.getStats();
        return {
            ...stats,
            memoryUsage: process.memoryUsage()
        };
    }

    // Fallback to in-memory storage
    return {
        totalGames: gameStates.size,
        activeRooms: Array.from(gameStates.keys()),
        persistedGames: gameMetadata.size,
        storageFile: STORAGE_FILE,
        storageType: 'memory',
        redisEnabled: false,
        memoryUsage: process.memoryUsage()
    };
};

/**
 * Get list of recent games with metadata
 * @returns {Array} Array of recent game metadata
 */
const getRecentGames = () => {
    // Note: Redis doesn't store recent games list separately
    // This function uses in-memory metadata
    const games = [];
    
    for (const [gameId, metadata] of gameMetadata.entries()) {
        games.push({
            gameId,
            ...metadata,
            hasActiveState: gameStates.has(metadata.roomId)
        });
    }
    
    // Sort by last activity (most recent first)
    games.sort((a, b) => b.lastActivity - a.lastActivity);
    
    return games.slice(0, MAX_STORED_GAMES);
};

// Load existing game states on startup (only if Redis is disabled)
loadGameStatesFromFile();

// Start periodic cleanup (every 5 minutes) - only needed for in-memory storage
const CLEANUP_INTERVAL = 300000; // 5 minutes
setInterval(() => {
    cleanupOldGameStates();
}, CLEANUP_INTERVAL);

// Periodic save to file (every 30 seconds) - only needed for in-memory storage
const SAVE_INTERVAL = 30000; // 30 seconds
setInterval(() => {
    saveGameStatesToFile();
}, SAVE_INTERVAL);

// Save on process exit (only needed for in-memory storage)
process.on('SIGINT', () => {
    if (!isRedisEnabled()) {
        logger.info('Saving game states before shutdown...');
        saveGameStatesToFile();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (!isRedisEnabled()) {
        logger.info('Saving game states before shutdown...');
        saveGameStatesToFile();
    }
    process.exit(0);
});

const storageMode = isRedisEnabled() ? 'Redis' : 'file-based';
logger.info(`Game state manager initialized with ${storageMode} storage and periodic cleanup`);

module.exports = {
    saveGameState,
    getGameState,
    getGameStateByGameId,
    getCardHashMap,
    deleteGameState,
    hasGameState,
    getActiveRooms,
    cleanupOldGameStates,
    getStats,
    getRecentGames,
    saveGameStatesToFile,
    loadGameStatesFromFile
};
