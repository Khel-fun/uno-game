const convexClient = require('./convexClient');
const logger = require('../logger');

/**
 * Convex Storage Service
 * Handles all write operations to Convex database
 * NO READ OPERATIONS - only stores data
 */
class ConvexStorageService {
  /**
   * Store game creation with full initial state
   * @param {string} roomId - Room/Game ID
   * @param {object} gameState - Full game state object
   */
  async storeGameCreation(roomId, gameState) {
    if (!convexClient.isEnabled()) return null;

    try {
      const result = await convexClient.mutation('games:create', {
        roomId,
        players: gameState.players || [],
      });
      logger.info(`Game ${roomId} stored in Convex`);
      return result;
    } catch (error) {
      logger.error(`Failed to store game creation for ${roomId}:`, error);
      return null;
    }
  }

  /**
   * Store game start event with full state
   * @param {string} gameId - Convex game ID
   * @param {object} gameState - Full game state object
   */
  async storeGameStart(gameId, gameState) {
    if (!convexClient.isEnabled()) return null;

    try {
      // First mark game as started
      await convexClient.mutation('games:startGame', {
        gameId,
      });
      
      // Then update with full game state
      await convexClient.mutation('games:updateState', {
        gameId,
        currentPlayerIndex: Number(gameState.currentPlayerIndex),
        turnCount: Number(gameState.turnCount) || 0,
        directionClockwise: Boolean(gameState.directionClockwise),
        currentColor: gameState.currentColor,
        currentValue: gameState.currentValue,
        currentCard: gameState.currentCard,
        lastPlayedCardHash: gameState.lastPlayedCardHash,
        deckHash: gameState.deckHash,
        discardPileHash: gameState.discardPileHash,
        isActive: gameState.isActive,
        isStarted: gameState.isStarted,
        playerHandsHash: gameState.playerHandsHash ? JSON.stringify(gameState.playerHandsHash) : undefined,
        playerHands: gameState.playerHands ? JSON.stringify(gameState.playerHands) : undefined,
        stateHash: gameState.stateHash,
        cardHashMap: gameState.cardHashMap ? JSON.stringify(gameState.cardHashMap) : undefined,
      });
      
      logger.info(`Game ${gameId} start with full state stored in Convex`);
      return true;
    } catch (error) {
      logger.error(`Failed to store game start for ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Store game state update
   * @param {string} gameId - Convex game ID
   * @param {object} stateUpdates - State changes to store
   */
  async storeGameStateUpdate(gameId, stateUpdates) {
    if (!convexClient.isEnabled()) return null;

    try {
      // Ensure numeric and boolean values are properly typed
      const typedUpdates = {
        gameId,
        currentPlayerIndex: stateUpdates.currentPlayerIndex !== undefined ? Number(stateUpdates.currentPlayerIndex) : undefined,
        turnCount: stateUpdates.turnCount !== undefined ? Number(stateUpdates.turnCount) : undefined,
        directionClockwise: stateUpdates.directionClockwise !== undefined ? Boolean(stateUpdates.directionClockwise) : undefined,
        currentColor: stateUpdates.currentColor,
        currentValue: stateUpdates.currentValue,
        currentCard: stateUpdates.currentCard,
        lastPlayedCardHash: stateUpdates.lastPlayedCardHash,
        deckHash: stateUpdates.deckHash,
        discardPileHash: stateUpdates.discardPileHash,
        isActive: stateUpdates.isActive,
        isStarted: stateUpdates.isStarted,
        playerHandsHash: stateUpdates.playerHandsHash,
        playerHands: stateUpdates.playerHands,
        stateHash: stateUpdates.stateHash,
        cardHashMap: stateUpdates.cardHashMap,
      };
      
      // Remove undefined values
      Object.keys(typedUpdates).forEach(key => 
        typedUpdates[key] === undefined && delete typedUpdates[key]
      );
      
      const result = await convexClient.mutation('games:updateState', typedUpdates);
      logger.debug(`Game ${gameId} state updated in Convex`);
      return result;
    } catch (error) {
      logger.error(`Failed to store game state update for ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Store player move/action
   * @param {string} gameId - Convex game ID
   * @param {number} turnNumber - Current turn number
   * @param {string} playerAddress - Player wallet address
   * @param {string} actionType - Type of action (playCard, drawCard, etc.)
   * @param {string} cardHash - Card hash (if applicable)
   */
  async storeMove(gameId, turnNumber, playerAddress, actionType, cardHash = null) {
    if (!convexClient.isEnabled()) return null;

    try {
      const result = await convexClient.mutation('moves:record', {
        gameId,
        turnNumber,
        playerAddress,
        actionType,
        cardHash,
      });
      logger.debug(`Move stored in Convex: ${actionType} by ${playerAddress}`);
      return result;
    } catch (error) {
      logger.error(`Failed to store move:`, error);
      return null;
    }
  }

  /**
   * Store game state snapshot
   * @param {string} gameId - Convex game ID
   * @param {number} turnNumber - Turn number for this snapshot
   * @param {object} stateData - Complete state data
   */
  async storeGameStateSnapshot(gameId, turnNumber, stateData) {
    if (!convexClient.isEnabled()) {
      logger.warn('Convex not enabled, skipping game state snapshot');
      return null;
    }

    try {
      logger.info(`Storing game state snapshot - gameId: ${gameId}, turn: ${turnNumber}`);
      const result = await convexClient.mutation('states:insert', {
        gameId,
        turnNumber: Number(turnNumber),
        stateHash: stateData.stateHash || '',
        currentPlayerIndex: Number(stateData.currentPlayerIndex),
        directionClockwise: Boolean(stateData.directionClockwise),
        currentColor: stateData.currentColor,
        currentValue: stateData.currentValue,
        lastPlayedCardHash: stateData.lastPlayedCardHash,
        deckHash: stateData.deckHash,
      });
      logger.info(`✓ Game state snapshot stored successfully for turn ${turnNumber}`);
      return result;
    } catch (error) {
      logger.error(`✗ Failed to store game state snapshot for turn ${turnNumber}:`, error);
      return null;
    }
  }

  /**
   * Store player hand update
   * @param {string} gameId - Convex game ID
   * @param {string} playerAddress - Player wallet address
   * @param {string[]} cardHashes - Array of card hashes
   */
  async storePlayerHand(gameId, playerAddress, cardHashes) {
    if (!convexClient.isEnabled()) return null;

    try {
      const result = await convexClient.mutation('hands:set', {
        gameId,
        playerAddress,
        cardHashes,
      });
      logger.debug(`Player hand stored for ${playerAddress} (${cardHashes.length} cards)`);
      return result;
    } catch (error) {
      logger.error(`Failed to store player hand:`, error);
      return null;
    }
  }

  /**
   * Store card mappings for a game
   * @param {string} gameId - Convex game ID
   * @param {object} cardHashMap - Map of card hashes to card data
   */
  async storeCardMappings(gameId, cardHashMap) {
    if (!convexClient.isEnabled()) return null;

    try {
      // Convert card hash map to array of mappings
      const mappings = Object.entries(cardHashMap).map(([hash, card]) => {
        // Handle different card formats
        let color, value;
        
        if (typeof card === 'object') {
          color = card.color;
          value = card.value;
        } else if (typeof card === 'string') {
          // Format: "5R" or similar
          value = card.charAt(0);
          color = card.charAt(1);
        }
        
        return {
          cardHash: hash,
          color: color || 'unknown',
          value: value || 'unknown',
        };
      });

      const result = await convexClient.mutation('cardMappings:bulkInsert', {
        gameId,
        mappings,
      });
      logger.debug(`${mappings.length} card mappings stored for game ${gameId}`);
      return result;
    } catch (error) {
      logger.error(`Failed to store card mappings:`, error);
      return null;
    }
  }

  /**
   * Store game end event
   * @param {string} gameId - Convex game ID
   */
  async storeGameEnd(gameId) {
    if (!convexClient.isEnabled()) return null;

    try {
      const result = await convexClient.mutation('games:endGame', {
        gameId,
      });
      logger.info(`Game ${gameId} end stored in Convex`);
      return result;
    } catch (error) {
      logger.error(`Failed to store game end for ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Store game-player relationships
   * @param {string} gameId - Convex game ID
   * @param {string[]} players - Array of player wallet addresses
   */
  async storeGamePlayers(gameId, players) {
    if (!convexClient.isEnabled()) return null;

    try {
      const promises = players.map((playerAddress, index) => 
        convexClient.mutation('gamePlayers:addPlayer', {
          gameId,
          walletAddress: playerAddress,
          seatIndex: index + 1,
        })
      );
      
      await Promise.all(promises);
      logger.debug(`Game players stored for game ${gameId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to store game players:`, error);
      return null;
    }
  }

  /**
   * Store player connection
   * @param {string} walletAddress - Player wallet address
   * @param {string} socketId - Socket.IO connection ID
   * @param {string} displayName - Player display name (optional)
   */
  async storePlayerConnection(walletAddress, socketId, displayName = null) {
    if (!convexClient.isEnabled()) return null;

    try {
      const result = await convexClient.mutation('players:upsert', {
        walletAddress,
        socketId,
        displayName,
        connected: true,
      });
      logger.debug(`Player connection stored: ${walletAddress}`);
      return result;
    } catch (error) {
      logger.error(`Failed to store player connection:`, error);
      return null;
    }
  }

  /**
   * Store player disconnection
   * @param {string} walletAddress - Player wallet address
   */
  async storePlayerDisconnection(walletAddress) {
    if (!convexClient.isEnabled()) return null;

    try {
      const result = await convexClient.mutation('players:disconnect', {
        walletAddress,
      });
      logger.debug(`Player disconnection stored: ${walletAddress}`);
      return result;
    } catch (error) {
      logger.error(`Failed to store player disconnection:`, error);
      return null;
    }
  }
}

// Singleton instance
const convexStorage = new ConvexStorageService();

module.exports = convexStorage;
