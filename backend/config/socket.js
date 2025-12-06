const ws = require('ws');

/**
 * Socket.IO server configuration
 * 
 * Note: Increased timeout values to handle users staying idle on /play page
 * before joining or creating games. This prevents connection drops when
 * users are browsing available games or waiting to make a decision.
 */
const socketConfig = {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  wsEngine: ws.Server,
  pingTimeout: 120000, // 120 seconds (2 min) before a client is considered disconnected
  pingInterval: 25000, // Send ping every 25 seconds (more lenient than default)
  connectTimeout: 30000, // Connection timeout: 30 seconds
  maxHttpBufferSize: 1e6, // 1MB max payload size
  transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling
  allowEIO3: true, // Allow Engine.IO v3 clients
};

module.exports = socketConfig;
