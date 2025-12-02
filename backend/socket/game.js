const logger = require('../logger');
const { getUser, getUsersInRoom } = require('../users');
const gameStateManager = require('../gameStateManager');
const { MAX_PLAYERS } = require('../constants');
const gameLogger = require('../gameLogger');

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
  socket.on('gameStarted', (data) => {
    const { newState, cardHashMap, roomId } = data;
    logger.info(`Game started in room ${roomId}`);
    
    // Save game state for reconnection support
    gameStateManager.saveGameState(roomId, newState, cardHashMap);
    
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
  socket.on('playCard', (data) => {
    const { roomId, action, newState } = data;
    logger.info(`Card played in room ${roomId}`);
    
    // Save updated game state for reconnection support
    if (newState) {
      gameStateManager.saveGameState(roomId, newState);
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
  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
    logger.info(`User ${socket.id} left room ${roomId}`);
    io.to(roomId).emit('userLeft', socket.id);
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
  socket.on('updateGameState', (gameState) => {
    try {
      const user = getUser(socket.id);
      if (user) {
        // Save updated game state for reconnection support
        gameStateManager.saveGameState(user.room, gameState);
        
        // Add a timestamp to track latency
        const enhancedGameState = {
          ...gameState,
          _serverTimestamp: Date.now()
        };
        io.to(user.room).emit('updateGameState', enhancedGameState);
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
      for (let i = 1; i <= numPlayers && i <= MAX_PLAYERS; i++) {
        gameState[`player${i}Deck`] = shuffledCards.splice(0, 5);
      }
      
      // Initialize empty decks for unused player slots
      for (let i = numPlayers + 1; i <= MAX_PLAYERS; i++) {
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
