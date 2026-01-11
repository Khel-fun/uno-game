const {
  USER_CLEANUP_INTERVAL_MS,
  GAME_CLEANUP_INTERVAL_MS,
} = require('../constants');

function setupCleanup({ gameStateManager, userManager }) {
  setInterval(() => userManager.cleanupDisconnected(), USER_CLEANUP_INTERVAL_MS);
  setInterval(() => gameStateManager.cleanupOldStates(), GAME_CLEANUP_INTERVAL_MS);
}

module.exports = { setupCleanup };
