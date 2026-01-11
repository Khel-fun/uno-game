const { RECONNECTION_GRACE_MS } = require('../constants');

const disconnectTimers = new Map(); // userId -> timeout

function scheduleRemoval(userId, fn) {
  clearRemoval(userId);
  const timer = setTimeout(() => {
    disconnectTimers.delete(userId);
    fn();
  }, RECONNECTION_GRACE_MS);
  disconnectTimers.set(userId, timer);
}

function clearRemoval(userId) {
  const timer = disconnectTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(userId);
  }
}

module.exports = { scheduleRemoval, clearRemoval };
