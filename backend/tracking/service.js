const logger = require('../logger');
const { getPool, isTrackingEnabled, getDefaultChainId } = require('../config/postgres');
const TrackingRepository = require('./repository');
const TrackingQueue = require('./queue');

class TrackingService {
  constructor() {
    this.enabled = isTrackingEnabled();
    this.defaultChainId = getDefaultChainId();
    this.queue = null;
    this.repository = null;

    if (this.enabled) {
      const pool = getPool();
      if (!pool) {
        this.enabled = false;
      } else {
        this.repository = new TrackingRepository(pool);
        this.queue = new TrackingQueue({
          flushMs: Number(process.env.TRACKING_QUEUE_FLUSH_MS || 2000),
          batchSize: Number(process.env.TRACKING_QUEUE_BATCH_SIZE || 50),
          processEvent: (event) => this.processEvent(event),
        });
        this.queue.start();
      }
    }

    logger.info('[Tracking] service initialized enabled=%s', this.enabled);
  }

  getStatus() {
    return {
      enabled: this.enabled,
      queueSize: this.queue ? this.queue.getSize() : 0,
      defaultChainId: this.defaultChainId,
    };
  }

  enqueue(type, payload) {
    if (!this.enabled || !this.queue) {
      return { accepted: false, reason: 'tracking_disabled' };
    }

    this.queue.enqueue({ type, payload });
    return { accepted: true };
  }

  enqueueGameSessionUpsert(payload) {
    const normalized = {
      chainId: Number(payload.chainId || this.defaultChainId),
      gameId: String(payload.gameId),
      roomId: payload.roomId,
      ownerAddress: payload.ownerAddress || '0x0000000000000000000000000000000000000000',
      isPrivate: Boolean(payload.isPrivate),
      gameCodeHash: payload.gameCodeHash || null,
      status: payload.status || 'not_started',
    };

    return this.enqueue('UPSERT_GAME_SESSION', normalized);
  }

  enqueueGameStatusUpdate(payload) {
    return this.enqueue('UPDATE_GAME_STATUS', {
      chainId: Number(payload.chainId || this.defaultChainId),
      gameId: String(payload.gameId),
      status: payload.status,
    });
  }

  async upsertProofRecord(payload) {
    if (!this.enabled || !this.repository) {
      const fallbackId = TrackingRepository.newProofRecordId();
      return { trackingSaved: false, proofRecordId: fallbackId };
    }

    try {
      const result = await this.repository.upsertProofRecord({
        id: payload.id || TrackingRepository.newProofRecordId(),
        chainId: Number(payload.chainId || this.defaultChainId),
        gameId: String(payload.gameId),
        roomId: payload.roomId,
        circuitName: payload.circuitName,
        circuitSetupId: payload.circuitSetupId,
        playerAddress: payload.playerAddress || null,
        proofHex: payload.proofHex,
        proofHash: payload.proofHash,
        publicInputs: payload.publicInputs || [],
        localVerified: payload.localVerified,
        kurierJobId: payload.kurierJobId,
        kurierStatus: payload.kurierStatus,
        aggregationId: payload.aggregationId,
        domainId: payload.domainId,
      });
      return { trackingSaved: true, proofRecordId: result.id, proofHash: result.proofHash };
    } catch (error) {
      logger.error('[Tracking] upsertProofRecord failed: %s', error.message);
      return { trackingSaved: false, proofRecordId: payload.id || TrackingRepository.newProofRecordId() };
    }
  }

  async updateKurier(payload) {
    if (!this.enabled || !this.repository) {
      return { trackingSaved: false };
    }

    try {
      await this.repository.updateKurier(payload);
      return { trackingSaved: true };
    } catch (error) {
      logger.error('[Tracking] updateKurier failed: %s', error.message);
      return { trackingSaved: false };
    }
  }

  async upsertAggregationVerification(payload) {
    if (!this.enabled || !this.repository) {
      return { trackingSaved: false };
    }

    try {
      await this.repository.upsertAggregationVerification(payload);
      return { trackingSaved: true };
    } catch (error) {
      logger.error('[Tracking] upsertAggregationVerification failed: %s', error.message);
      return { trackingSaved: false };
    }
  }

  async upsertCircuitSetup(payload) {
    if (!this.enabled || !this.repository) {
      return { trackingSaved: false };
    }

    try {
      await this.repository.upsertCircuitSetup(payload);
      return { trackingSaved: true };
    } catch (error) {
      logger.error('[Tracking] upsertCircuitSetup failed: %s', error.message);
      return { trackingSaved: false };
    }
  }

  async processEvent(event) {
    if (!this.repository) return;

    switch (event.type) {
      case 'UPSERT_GAME_SESSION':
        await this.repository.upsertGameSession(event.payload);
        break;
      case 'UPDATE_GAME_STATUS':
        await this.repository.updateGameStatus(event.payload);
        break;
      default:
        logger.warn('[Tracking] Unknown event type: %s', event.type);
    }
  }
}

module.exports = new TrackingService();
