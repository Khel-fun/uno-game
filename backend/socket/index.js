const { registerConnectionHandlers } = require('./connection');
const { registerReconnectionHandlers } = require('./reconnection');
const { registerGameHandlers } = require('./game');
const { registerLobbyHandlers } = require('./lobby');

/**
 * Initialize all socket event handlers
 * @param {Server} io - Socket.IO server instance
 * @param {Object} connectionTracker - Object to track active connections
 */
function initializeSocketHandlers(io, connectionTracker) {
  io.on('connection', (socket) => {
    // Register all handler categories
    registerConnectionHandlers(socket, io, connectionTracker);
    registerReconnectionHandlers(socket, io);
    registerGameHandlers(socket, io);
    registerLobbyHandlers(socket, io);
  });
}

module.exports = { initializeSocketHandlers };
