const logger = require('../logger');
const { clearRemoval } = require('./timers');

module.exports = function gameHandler(io, socket, { gameStateManager, userManager }) {
  // Join a specific game room (socket.io room)
  socket.on('joinRoom', (roomId) => {
    const user = userManager.getUser(socket.id);
    if (user) clearRemoval(user.id);
    socket.join(roomId);
    io.to(roomId).emit('userJoined', socket.id);
  });

  // Create a new game room (broadcast)
  socket.on('createGameRoom', () => {
    io.emit('gameRoomCreated');
  });

  // Game started: save state and broadcast
  socket.on('gameStarted', async ({ roomId, newState, cardHashMap }) => {
    try {
      await gameStateManager.saveGameState(roomId, newState);
      if (cardHashMap) {
        await gameStateManager.saveCardHashMap(roomId, cardHashMap);
      }
      io.to(roomId).emit(`gameStarted-${roomId}`, { newState, cardHashMap });
    } catch (err) {
      logger.error('Error handling gameStarted: %s', err.message);
    }
  });

  // Card play / draw update
  socket.on('playCard', async ({ roomId, action, newState }) => {
    try {
      await gameStateManager.saveGameState(roomId, newState);
      io.to(roomId).emit(`cardPlayed-${roomId}`, { action, newState });
    } catch (err) {
      logger.error('Error handling playCard: %s', err.message);
    }
  });

  // Generic state update with timestamp
  socket.on('updateGameState', async (gameState) => {
    const roomId = gameState?.roomId;
    if (!roomId) return;
    const stateWithTs = { ...gameState, _serverTimestamp: Date.now() };
    await gameStateManager.saveGameState(roomId, stateWithTs);
    io.to(roomId).emit('updateGameState', stateWithTs);
  });

  // Request server-side init (optional deck shuffle)
  socket.on('requestGameInit', (payload = {}) => {
    // For now just echo; deck generation could go here
    io.to(payload.roomId || socket.id).emit('initGameState', payload);
  });

  // Leave a game room
  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
    io.to(roomId).emit('userLeft', socket.id);
  });

  // Request game state sync (reconnection)
  socket.on('requestGameStateSync', async ({ roomId, gameId }) => {
    let saved = null;
    if (roomId) {
      saved = await gameStateManager.getGameState(roomId);
    }
    if (!saved && gameId) {
      saved = await gameStateManager.getByGameId(gameId);
      if (saved?.roomId) {
        roomId = saved.roomId;
      }
    }
    const cardHashMap = await gameStateManager.getCardHashMap(roomId);
    if (!saved) {
      socket.emit(`gameStateSync-${roomId}`, { error: 'Game state not found' });
      return;
    }
    socket.emit(`gameStateSync-${roomId}`, {
      newState: saved.state || saved,
      cardHashMap,
      restored: true,
    });
  });

  // Init game state (bidirectional support)
  socket.on('initGameState', (gameState) => {
    const roomId = gameState?.roomId;
    if (!roomId) return;
    io.to(roomId).emit('initGameState', gameState);
  });
};
