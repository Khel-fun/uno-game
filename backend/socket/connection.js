const logger = require('../logger');
const { scheduleRemoval } = require('./timers');

module.exports = function connectionHandler(io, socket, { userManager }) {
  // Send server socket id
  socket.emit('server_id', socket.id);

  socket.on('disconnect', (reason) => {
    const user = userManager.markDisconnected(socket.id);
    if (user) {
      logger.info('User disconnected %s (%s)', user.name, reason);
      // notify room
      io.to(user.room).emit('playerDisconnected', {
        userId: user.id,
        userName: user.name,
        temporary: true,
        reason,
      });

      scheduleRemoval(user.id, () => {
        const removed = userManager.removeUser(user.id);
        if (removed) {
          io.to(user.room).emit('playerLeft', {
            userId: removed.id,
            userName: removed.name,
            permanent: true,
          });
          const updated = userManager.getUsersInRoom(user.room);
          io.to(user.room).emit('roomData', { room: user.room, users: updated });
        }
      });
    }
  });
};
