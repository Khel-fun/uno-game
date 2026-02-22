const logger = require('../logger');
const prisma = require('./prisma');

const trackingEnabled = (process.env.TRACKING_DB_ENABLED || 'false').toLowerCase() === 'true';
const postgresUrl = process.env.POSTGRES_URL || '';

function getDefaultChainId() {
  const parsed = Number(process.env.TRACKING_DEFAULT_CHAIN_ID || 84532);
  return Number.isFinite(parsed) ? parsed : 84532;
}

function isTrackingEnabled() {
  return trackingEnabled && !!postgresUrl;
}

function getPool() {
  // Compatibility method name retained for existing service wiring.
  if (!isTrackingEnabled()) return null;
  return prisma;
}

async function checkTrackingDbHealth() {
  if (!isTrackingEnabled()) {
    return { enabled: false, healthy: false, reason: 'disabled' };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return { enabled: true, healthy: true };
  } catch (error) {
    logger.error('[TrackingDB] Health check failed: %s', error.message);
    return { enabled: true, healthy: false, reason: error.message };
  }
}

module.exports = {
  getPool,
  isTrackingEnabled,
  checkTrackingDbHealth,
  getDefaultChainId,
};
