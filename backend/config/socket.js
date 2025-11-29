const ws = require('ws');

/**
 * Socket.IO server configuration
 */
const socketConfig = {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  wsEngine: ws.Server,
  pingTimeout: 30000, // 30 seconds before a client is considered disconnected
  pingInterval: 10000, // Send ping every 10 seconds
  connectTimeout: 20000, // Connection timeout: 20 seconds
  maxHttpBufferSize: 1e6, // 1MB max payload size
  transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling
  allowEIO3: true, // Allow Engine.IO v3 clients
};

module.exports = socketConfig;
