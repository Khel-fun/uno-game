const logger = require('../logger');
const { getUsersInRoom } = require('../users');
const gameStateManager = require('../gameStateManager');

/**
 * Register reconnection-related socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
function registerReconnectionHandlers(socket, io) {
  /**
   * Room Rejoin Handler
   * Handles when a user attempts to rejoin a room after disconnection
   */
  socket.on('rejoinRoom', ({ room, gameId }, callback) => {
    try {
      logger.info(`User ${socket.id} attempting to rejoin room ${room}`);
      
      // Check if room has active users
      const roomUsers = getUsersInRoom(room);
      const roomExists = roomUsers.length > 0 || gameStateManager.hasGameState(`game-${gameId}`);
      
      if (roomExists) {
        // Add socket back to room
        socket.join(room);
        socket.join(`game-${gameId}`);
        
        logger.info(`User ${socket.id} successfully rejoined room ${room}`);
        
        // Send success response
        if (callback && typeof callback === 'function') {
          callback({ success: true, room, gameId });
        }
        
        // Notify other players in the room
        socket.to(room).emit('playerReconnected', {
          userId: socket.id,
          room,
          timestamp: Date.now()
        });
        
        // Emit reconnected event to the socket itself
        socket.emit('reconnected', { room, gameId });
        
        // Send updated room data to all users in the room (including the reconnected user)
        // Only emit roomData for lobby rooms, not game rooms
        if (!room.startsWith('game-')) {
          const updatedRoomUsers = getUsersInRoom(room);
          io.to(room).emit('roomData', { room, users: updatedRoomUsers });
          logger.info(`Sent updated room data to room ${room} with ${updatedRoomUsers.length} users`);
        }
      } else {
        logger.warn(`Room ${room} not found for rejoin`);
        if (callback && typeof callback === 'function') {
          callback({ success: false, error: 'Room not found' });
        }
      }
    } catch (error) {
      logger.error(`Error rejoining room ${room}:`, error);
      if (callback && typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Game State Sync Handler
   * Handles requests to sync game state after reconnection or page refresh
   */
  socket.on('requestGameStateSync', ({ roomId, gameId }) => {
    try {
      logger.info(`User ${socket.id} requesting game state sync for room ${roomId}, game ${gameId}`);
      
      // Try to fetch by roomId first
      let gameState = gameStateManager.getGameState(roomId);
      let cardHashMap = gameStateManager.getCardHashMap(roomId);
      
      // If not found by roomId, try by gameId
      if (!gameState && gameId) {
        logger.info(`Attempting to restore game state by game ID ${gameId}`);
        const gameData = gameStateManager.getGameStateByGameId(gameId);
        if (gameData) {
          gameState = gameData.state;
          cardHashMap = gameData.cardHashMap;
          logger.info(`Game state restored from persistent storage for game ${gameId}`);
        }
      }
      
      if (gameState) {
        // Check if this is the old multiplayer format (has 'turn' property)
        // If so, add isStarted flag so client knows to render the game
        if (gameState.turn && !gameState.isStarted) {
          logger.info(`Adding isStarted flag to multiplayer game state for room ${roomId}`);
          gameState = {
            ...gameState,
            isStarted: true // Mark as started so client renders the game board
          };
        }
        
        // Send state back to the requesting client
        socket.emit(`gameStateSync-${roomId}`, {
          newState: gameState,
          cardHashMap: cardHashMap || {},
          restored: true
        });
        logger.info(`Game state synced for user ${socket.id} in room ${roomId}`);
      } else {
        logger.warn(`No game state found for room ${roomId} or game ${gameId}`);
        socket.emit(`gameStateSync-${roomId}`, {
          error: 'Game state not found'
        });
      }
    } catch (error) {
      logger.error(`Error syncing game state for room ${roomId}:`, error);
      socket.emit(`gameStateSync-${roomId}`, {
        error: error.message
      });
    }
  });
}

module.exports = { registerReconnectionHandlers };
