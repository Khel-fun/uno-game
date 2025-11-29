const logger = require('../logger');
const { cleanupDisconnectedUsers } = require('../users');

/**
 * Start periodic cleanup of disconnected users
 * @param {number} interval - Cleanup interval in milliseconds (default: 30000)
 * @param {number} maxDisconnectTime - Max disconnect time before removal in ms (default: 60000)
 */
function startPeriodicCleanup(interval = 30000, maxDisconnectTime = 60000) {
  setInterval(() => {
    const removed = cleanupDisconnectedUsers(maxDisconnectTime);
    if (removed.length > 0) {
      logger.info(`Periodic cleanup removed ${removed.length} disconnected users`);
    }
  }, interval);
  
  logger.info(`Started periodic cleanup task (interval: ${interval}ms, max disconnect: ${maxDisconnectTime}ms)`);
}

/**
 * Graceful shutdown handler
 * @param {Server} server - HTTP server instance
 */
function setupGracefulShutdown(server) {
  function gracefulShutdown() {
    logger.info('Shutting down gracefully...');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  logger.info('Graceful shutdown handlers registered');
}

/**
 * Setup global error handlers
 */
function setupGlobalErrorHandlers() {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Keep the process running despite the error
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    // Keep the process running despite the rejection
  });
  
  logger.info('Global error handlers registered');
}

module.exports = {
  startPeriodicCleanup,
  setupGracefulShutdown,
  setupGlobalErrorHandlers
};
