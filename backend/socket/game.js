const logger = require('../logger');
const gameLogger = require('../gameLogger');
const gameStateManager = require('../gameStateManager');
const { getUser, getUsersInRoom } = require('../users');
const convexStorage = require('../services/convexStorage');

// In-memory map of roomId -> convexGameId
const roomToConvexGameId = new Map();

/**
 * Register game-related socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
function registerGameHandlers(socket, io) {
  /**
   * Join Room Handler
   * Handles when a user joins a specific game room
   */
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    logger.info(`User ${socket.id} joined room ${roomId}`);
    io.to(roomId).emit('userJoined', socket.id);
  });

  /**
   * Create Game Room Handler
   * Handles game room creation
   */
  socket.on('createGameRoom', () => {
    logger.info('Game room created by user');
    io.emit('gameRoomCreated');
  });

  /**
   * Game Started Handler
   * Handles when a game starts and broadcasts to all players
   */
  socket.on('gameStarted', async (data) => {
    const { newState, cardHashMap, roomId } = data;
    logger.info(`Game started in room ${roomId}`);
    
    // Save game state for reconnection support
    gameStateManager.saveGameState(roomId, newState, cardHashMap);
    
    // Store in Convex (write-only, non-blocking)
    let convexGameId = null;
    if (newState && newState.players) {
      // Store game creation
      convexGameId = await convexStorage.storeGameCreation(roomId, newState);
      
      // Store game start with full state
      if (convexGameId) {
        // Get current card from playedCardsPile (last card played)
        const currentCard = newState.playedCardsPile && newState.playedCardsPile.length > 0 
          ? newState.playedCardsPile[newState.playedCardsPile.length - 1] 
          : null;
          
        // Extract player hands for initial storage
        const playerHands = {};
        Object.keys(newState).forEach(key => {
          if (key.match(/player\d+Deck/)) {
            playerHands[key] = newState[key];
          }
        });
          
        // Pass cardHashMap in the state object for storage
        const fullState = {
          ...newState,
          cardHashMap: cardHashMap,
          currentCard: currentCard,
          playerHands: playerHands
        };
        
        await convexStorage.storeGameStart(convexGameId, fullState);
        
        // Store game-player relationships in gamePlayers table
        await convexStorage.storeGamePlayers(convexGameId, newState.players);
        
        // Store card mappings in cardMappings table if available
        if (cardHashMap) {
          await convexStorage.storeCardMappings(convexGameId, cardHashMap);
        }
        
        // Store initial player hands in hands table
        if (newState.playerHands) {
          for (const [playerAddress, cardHashes] of Object.entries(newState.playerHands)) {
            await convexStorage.storePlayerHand(convexGameId, playerAddress, cardHashes);
          }
        }
        
        // Store mapping for future moves
        roomToConvexGameId.set(roomId, convexGameId);
        
        logger.info(`Convex game ID ${convexGameId} stored for room ${roomId}`);
      }
    }
    
    // Log game start with all details
    if (newState) {
      gameLogger.logGameStart(newState.id, newState.players);
      
      // Log the first card
      if (newState.currentColor && newState.currentValue) {
        gameLogger.log({
          timestamp: new Date().toISOString(),
          gameId: newState.id.toString(),
          turnNumber: 0,
          player: 'SYSTEM',
          action: 'startGame',
          cardDetails: `First card: ${newState.currentColor} ${newState.currentValue}`,
          currentColor: newState.currentColor,
          currentValue: newState.currentValue,
          nextPlayer: newState.players[newState.currentPlayerIndex]
        });
      }
    }

    // Emit the gameStarted event to all clients in the room with a room-specific event name
    io.to(roomId).emit(`gameStarted-${roomId}`, { newState, cardHashMap });
  });

  /**
   * Play Card Handler
   * Handles when a player plays a card
   */
  socket.on('playCard', async (data) => {
    const { roomId, action, newState } = data;
    logger.info(`Card played in room ${roomId}`);
    
    // Save updated game state for reconnection support
    if (newState) {
      gameStateManager.saveGameState(roomId, newState);
    }
    
    // Get convexGameId from our mapping
    const convexGameId = roomToConvexGameId.get(roomId);
    
    if (!convexGameId) {
      logger.warn(`No Convex game ID found for room ${roomId}. Available rooms: ${Array.from(roomToConvexGameId.keys()).join(', ')}`);
    }
    
    // Store move in Convex (write-only, non-blocking)
    if (action && newState && convexGameId) {
      logger.debug(`Storing move for room ${roomId}, convexGameId: ${convexGameId}, turn: ${newState.turnCount}`);
      // Store the move/action
      await convexStorage.storeMove(
        convexGameId,
        Number(newState.turnCount),
        action.player,
        action.type,
        action.cardHash
      );
      
      // Store updated player hands
      if (newState.playerHands) {
        for (const [playerAddress, cardHashes] of Object.entries(newState.playerHands)) {
          await convexStorage.storePlayerHand(convexGameId, playerAddress, cardHashes);
        }
      }
      
      // Store state snapshot
      await convexStorage.storeGameStateSnapshot(convexGameId, Number(newState.turnCount), {
        stateHash: newState.stateHash || '',
        currentPlayerIndex: newState.currentPlayerIndex,
        directionClockwise: newState.directionClockwise,
        currentColor: newState.currentColor,
        currentValue: newState.currentValue,
        lastPlayedCardHash: newState.lastPlayedCardHash,
        deckHash: newState.deckHash,
      });
      
      // Update game state in Convex
      await convexStorage.storeGameStateUpdate(convexGameId, {
        currentPlayerIndex: newState.currentPlayerIndex,
        turnCount: Number(newState.turnCount),
        directionClockwise: newState.directionClockwise,
        currentColor: newState.currentColor,
        currentValue: newState.currentValue,
        lastPlayedCardHash: newState.lastPlayedCardHash,
      });
    }
    
    // Log card play action
    if (action && newState) {
      const nextPlayerIndex = (newState.currentPlayerIndex) % newState.players.length;
      
      if (action.type === 'playCard' && action.cardHash) {
        gameLogger.logCardPlay(
          newState.id.toString(),
          Number(newState.turnCount),
          action.player,
          action.cardHash,
          `${newState.currentColor} ${newState.currentValue}`,
          newState.currentColor,
          newState.currentValue,
          newState.players[nextPlayerIndex]
        );
      } else if (action.type === 'drawCard') {
        // Log draw action
        gameLogger.log({
          timestamp: new Date().toISOString(),
          gameId: newState.id.toString(),
          turnNumber: Number(newState.turnCount),
          player: action.player,
          action: 'drawCard',
          nextPlayer: newState.players[nextPlayerIndex]
        });
      }
    }

    // Broadcast the cardPlayed event to all clients in the room
    io.to(roomId).emit(`cardPlayed-${roomId}`, { action, newState });
  });

  /**
   * Leave Room Handler
   * Handles when a user leaves a room
   */
  socket.on('leaveRoom', async (roomId) => {
    socket.leave(roomId);
    logger.info(`User ${socket.id} left room ${roomId}`);
    io.to(roomId).emit('userLeft', socket.id);
    
    // Check if room is empty and cleanup Convex mapping
    const usersInRoom = getUsersInRoom(roomId);
    if (usersInRoom.length === 0) {
      // Mark game as ended in Convex if it exists
      const convexGameId = roomToConvexGameId.get(roomId);
      if (convexGameId) {
        await convexStorage.storeGameEnd(convexGameId);
        roomToConvexGameId.delete(roomId);
        logger.info(`Cleaned up Convex mapping for room ${roomId}`);
      }
    }
  });

  /**
   * Initialize Game State Handler
   * Handles game state initialization from client
   */
  socket.on('initGameState', (gameState) => {
    const user = getUser(socket.id);
    if (user) {
      // Save game state for reconnection support
      gameStateManager.saveGameState(user.room, gameState);
      
      // Broadcast the game state to all players in the room
      io.to(user.room).emit('initGameState', gameState);
      logger.info(`Game initialized in room ${user.room} with ${Object.keys(gameState).filter(k => k.includes('Deck')).length} players`);
    }
  });

  /**
   * Update Game State Handler
   * Handles game state updates during gameplay
   */
  socket.on('updateGameState', async (gameState) => {
    try {
      const user = getUser(socket.id);
      if (user) {
        // Retrieve current state first to prevent overwriting with partial data
        // This handles cases where frontend only sends partial updates (e.g. missing some player hands)
        const gameRoomId = user.room.includes("game-") ? user.room : `game-${user.room}`;
        const currentState = gameStateManager.getGameState(gameRoomId) || {};
        
        // Merge new state on top of current state
        const mergedState = { ...currentState, ...gameState };
        
        // Save updated game state for reconnection support
        gameStateManager.saveGameState(gameRoomId, mergedState);
        
        let convexGameId;
        if (user.room.includes('game-')) {
          // Get convexGameId from our mapping
          convexGameId = roomToConvexGameId.get(user.room);
          logger.info(`Convex game ID: ${convexGameId}, user.room: ${gameRoomId}, gameState.turn: ${mergedState.turn}`);
        }else{
          convexGameId = roomToConvexGameId.get(`game-${user.room}`);
          logger.info(`Convex game ID: ${convexGameId}, user.room: ${gameRoomId}, gameState.turn: ${mergedState.turn}`);
        }
        
        const turnNumber = Number(mergedState.turn.trim().split(" ")[-1]);
        logger.info(`Turn split result: ${mergedState.turn.trim().split(" ")}, turnNumber: ${turnNumber}`);
        // Store in Convex if available
        if (convexGameId && mergedState.turn !== undefined) {
          logger.debug(`Storing game state update for room ${gameRoomId}, turn: ${mergedState.turn}`);
          
          // Get current card from playedCardsPile (last card played)
          const currentCard = mergedState.playedCardsPile && mergedState.playedCardsPile.length > 0 
            ? mergedState.playedCardsPile[mergedState.playedCardsPile.length - 1] 
            : null;
            
          // Extract player hands
          const playerHands = {};
          Object.keys(mergedState).forEach(key => {
            if (key.match(/player\d+Deck/)) {
              playerHands[key] = mergedState[key];
            }
          });
            
          // Derive currentPlayerIndex from turn (e.g. "Player 1" -> 0)
          const currentPlayerIndex = turnNumber > 0 ? turnNumber - 1 : 0;
          
          // Extract direction if available, default to undefined (will keep existing value in DB)
          const directionClockwise = mergedState.directionClockwise !== undefined ? mergedState.directionClockwise : undefined;
          
          // Update current game state in games table
          // We only update the current state, avoiding snapshot creation for every move as requested
          logger.info(`Updating Convex game state with: currentPlayerIndex=${currentPlayerIndex}, turnCount=${turnNumber}, clockwise=${directionClockwise}, color=${mergedState.currentColor}, value=${mergedState.currentNumber || mergedState.currentValue}, currentCard=${currentCard}`);
          
          await convexStorage.storeGameStateUpdate(convexGameId, {
            currentPlayerIndex: currentPlayerIndex,
            turnCount: turnNumber,
            directionClockwise: directionClockwise,
            currentColor: mergedState.currentColor,
            currentValue: mergedState.currentNumber || mergedState.currentValue, // Frontend sends currentNumber
            currentCard: currentCard,
            lastPlayedCardHash: mergedState.lastPlayedCardHash || '',
            deckHash: mergedState.deckHash || '',
            playerHands: JSON.stringify(playerHands)
          });
        }
        
        // Add a timestamp to track latency
        const enhancedGameState = {
          ...mergedState,
          _serverTimestamp: Date.now(),
          _room: gameRoomId
        };
        io.to(gameRoomId).emit('updateGameState', enhancedGameState);
      }
    } catch (error) {
      logger.error(`Error updating game state for socket ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to update game state' });
    }
  });

  /**
   * Request Game Init Handler
   * Handles game initialization request (server-side game setup)
   */
  socket.on('requestGameInit', (payload) => {
    const user = getUser(socket.id);
    if (user) {
      const roomUsers = getUsersInRoom(user.room);
      const numPlayers = roomUsers.length;
      
      logger.info(`Initializing game in room ${user.room} with ${numPlayers} players`);
      
      // Import required utilities
      const PACK_OF_CARDS = require('../packOfCards');
      const shuffleArray = (array) => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      };
      
      const shuffledCards = shuffleArray(PACK_OF_CARDS);
      const gameState = {
        gameOver: false,
        turn: 'Player 1',
        currentColor: '',
        currentNumber: '',
        playedCardsPile: [],
        drawCardPile: [],
      };
      
      // Deal 5 cards to each player
      for (let i = 1; i <= numPlayers && i <= 6; i++) {
        gameState[`player${i}Deck`] = shuffledCards.splice(0, 5);
      }
      
      // Initialize empty decks for unused player slots
      for (let i = numPlayers + 1; i <= 6; i++) {
        gameState[`player${i}Deck`] = [];
      }
      
      // Find a non-action starting card
      const ACTION_CARDS = ['skipR', 'skipG', 'skipB', 'skipY', 'D2R', 'D2G', 'D2B', 'D2Y', 'W', 'D4W'];
      let startingCardIndex = Math.floor(Math.random() * shuffledCards.length);
      while (ACTION_CARDS.includes(shuffledCards[startingCardIndex])) {
        startingCardIndex = Math.floor(Math.random() * shuffledCards.length);
      }
      
      const startingCard = shuffledCards.splice(startingCardIndex, 1)[0];
      gameState.playedCardsPile = [startingCard];
      gameState.currentColor = startingCard.charAt(1);
      gameState.currentNumber = startingCard.charAt(0);
      gameState.drawCardPile = shuffledCards;
      
      // Broadcast to all players in the room
      io.to(user.room).emit('initGameState', gameState);
    }
  });
}

module.exports = { registerGameHandlers };
