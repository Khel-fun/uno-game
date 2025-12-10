const logger = require('../logger');
const { clearRemoval } = require('./timers');

module.exports = function reconnectionHandler(io, socket, { userManager, gameStateManager }) {
  socket.on('rejoinRoom', ({ room, gameId, walletAddress }, callback) => {
    const match = userManager.reconnectUser({
      room,
      walletAddress,
      newId: socket.id,
    });

    if (!match) {
      callback?.({ success: false, error: 'Room not found' });
      return;
    }

    clearRemoval(match.id);
    socket.join(room);
    logger.info('User reconnected to room %s as %s', room, match.name);

    socket.emit('reconnected', { room, gameId });
    io.to(room).emit('playerReconnected', {
      userId: match.id,
      room,
      timestamp: Date.now(),
    });

    const users = userManager.getUsersInRoom(room);
    io.to(room).emit('roomData', { room, users });

    callback?.({ success: true, room, gameId });
  });
};
