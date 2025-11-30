const logger = require('../logger');
const { addUser, removeUser, getUser, getUsersInRoom } = require('../users');

/**
 * Register lobby and room-related socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
function registerLobbyHandlers(socket, io) {
  /**
   * Join Lobby Handler
   * Handles when a user joins a game lobby/room
   */
  socket.on('join', (payload, callback) => {
    const usersInRoom = getUsersInRoom(payload.room);
    let playerName;

    // 1. If address provided, check if user already exists in room (reconnect/takeover)
    if (payload.address) {
      const existingUser = usersInRoom.find(u => u.address === payload.address);
      if (existingUser) {
        playerName = existingUser.name;
      }
    }

    // 2. If no player name found yet (new user or anonymous), find first available slot
    if (!playerName) {
      for (let i = 1; i <= 6; i++) {
        const potentialName = `Player ${i}`;
        const existingUser = usersInRoom.find(u => u.name === potentialName);
        
        // Available if:
        // - Slot is empty
        // - OR Slot is disconnected AND has no wallet address (anonymous users can be overwritten)
        // - OR Slot is disconnected AND matches our address (handled by step 1, but safe to include)
        if (!existingUser || 
            (!existingUser.connected && (!existingUser.address || existingUser.address === payload.address))) {
          playerName = potentialName;
          break;
        }
      }
    }

    if (!playerName) {
      return callback({ error: 'Room is full' });
    }

    const { error, newUser } = addUser({
      id: socket.id,
      name: playerName,
      room: payload.room,
      address: payload.address,
    });

    if (error) return callback(error);

    socket.join(newUser.room);

    io.to(newUser.room).emit('roomData', { room: newUser.room, users: getUsersInRoom(newUser.room) });
    socket.emit('currentUserData', { name: newUser.name });
    logger.debug(newUser);
    callback();
  });

  /**
   * Quit Room Handler
   * Handles when a user quits a room
   */
  socket.on('quitRoom', () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });
    }
  });

  /**
   * Send Message Handler
   * Handles chat messages in the lobby/room
   */
  socket.on('sendMessage', (payload, callback) => {
    const user = getUser(socket.id);
    if (user) {
      io.to(user.room).emit('message', { user: user.name, text: payload.message });
      callback();
    }
  });
}

module.exports = { registerLobbyHandlers };
