const logger = require('../logger');
const { markUserDisconnected, removeUser, getUser, getUsersInRoom } = require('../users');

/**
 * Register connection-related socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 * @param {Object} connectionTracker - Object to track active connections
 */
function registerConnectionHandlers(socket, io, connectionTracker) {
  /**
   * Handle new connection
   */
  connectionTracker.count++;
  logger.info(`User ${socket.id} connected. Active connections: ${connectionTracker.count}`);
  io.to(socket.id).emit('server_id', socket.id);

  /**
   * Handle disconnection with grace period for reconnection
   */
  socket.on('disconnect', (reason) => {
    connectionTracker.count--;
    logger.info(`User ${socket.id} disconnected: ${reason}. Active connections: ${connectionTracker.count}`);
    
    // Mark user as temporarily disconnected instead of removing immediately
    const user = markUserDisconnected(socket.id);
    
    if (user) {
      // Notify other players that user is temporarily disconnected
      io.to(user.room).emit('playerDisconnected', {
        userId: socket.id,
        userName: user.name,
        temporary: true,
        reason: reason
      });
      
      // Set timeout to remove user if they don't reconnect (60 second grace period)
      setTimeout(() => {
        const currentUser = getUser(socket.id);
        
        // Only remove if user is still disconnected
        if (currentUser && currentUser.connected === false) {
          const removedUser = removeUser(socket.id);
          
          if (removedUser) {
            logger.info(`User ${socket.id} did not reconnect, removing from room ${removedUser.room}`);
            
            // Update room data
            io.to(removedUser.room).emit('roomData', { 
              room: removedUser.room, 
              users: getUsersInRoom(removedUser.room) 
            });
            
            // Notify that player permanently left
            io.to(removedUser.room).emit('playerLeft', {
              userId: socket.id,
              userName: removedUser.name,
              permanent: true
            });
          }
        } else if (currentUser && currentUser.connected === true) {
          logger.info(`User ${socket.id} reconnected before timeout`);
        }
      }, 60000); // 60 second grace period
    }
  });

  /**
   * Handle socket errors
   */
  socket.on('error', (error) => {
    logger.error(`Socket ${socket.id} error:`, error);
  });
}

module.exports = { registerConnectionHandlers };
