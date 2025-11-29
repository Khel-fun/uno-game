const { ConvexHttpClient } = require('convex/browser');
const logger = require('../logger');

/**
 * Convex HTTP Client for server-side write operations
 * This client is used ONLY for storing data, not fetching
 */
class ConvexClientService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Convex client with deployment URL
   */
  initialize() {
    const convexUrl = process.env.CONVEX_URL;
    
    if (!convexUrl) {
      logger.warn('CONVEX_URL not set in environment variables. Convex integration disabled.');
      return false;
    }

    try {
      this.client = new ConvexHttpClient(convexUrl);
      this.isInitialized = true;
      logger.info(`Convex client initialized with URL: ${convexUrl}`);
      return true;
    } catch (error) {
      logger.error('Failed to initialize Convex client:', error);
      return false;
    }
  }

  /**
   * Get the Convex client instance
   */
  getClient() {
    if (!this.isInitialized) {
      logger.warn('Convex client not initialized. Call initialize() first.');
      return null;
    }
    return this.client;
  }

  /**
   * Check if Convex is enabled and initialized
   */
  isEnabled() {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Execute a Convex mutation (write operation)
   * @param {string} mutationName - Name of the mutation (e.g., 'games:create')
   * @param {object} args - Arguments for the mutation
   * @returns {Promise<any>} Result of the mutation
   */
  async mutation(mutationName, args) {
    if (!this.isEnabled()) {
      logger.debug(`Convex disabled, skipping mutation: ${mutationName}`);
      return null;
    }

    try {
      const result = await this.client.mutation(mutationName, args);
      logger.debug(`Convex mutation ${mutationName} executed successfully`);
      return result;
    } catch (error) {
      logger.error(`Convex mutation ${mutationName} failed:`, error);
      // Don't throw - allow game to continue even if Convex fails
      return null;
    }
  }
}

// Singleton instance
const convexClient = new ConvexClientService();

module.exports = convexClient;
