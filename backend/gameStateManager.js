const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const RedisStorage = require('./services/redisStorage');
const {
  GAME_STATE_TTL_MS,
  FILE_PERSIST_INTERVAL_MS,
  MAX_STORED_GAMES,
  GAME_CODE_LENGTH,
  GAME_CODE_CHARS,
} = require('./constants');

class GameStateManager {
  constructor() {
    this.redisStorage = new RedisStorage();
    this.useRedis = this.redisStorage.isEnabled();
    this.gameStates = new Map(); // roomId -> { state, updatedAt, gameId }
    this.cardHashMaps = new Map(); // roomId -> map
    this.gameCodes = new Map(); // gameCode -> { gameId, roomId, isPrivate, createdAt }
    this.gameIdToCode = new Map(); // gameId -> gameCode
    this.filePath = path.join(__dirname, 'game-states.json');
    this.gameCodesFilePath = path.join(__dirname, 'game-codes.json');

    this.loadFromDisk();
    setInterval(() => this.persistToDisk(), FILE_PERSIST_INTERVAL_MS);
  }

  // --- Game Code Management ---

  generateGameCode() {
    const bytes = crypto.randomBytes(GAME_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < GAME_CODE_LENGTH; i++) {
      code += GAME_CODE_CHARS[bytes[i] % GAME_CODE_CHARS.length];
    }
    // Ensure uniqueness
    if (this.gameCodes.has(code)) {
      return this.generateGameCode();
    }
    return code;
  }

  registerGameCode(gameId, roomId, isPrivate, providedCode) {
    // Use the frontend-provided code if available (matches the on-chain hash),
    // otherwise generate a random one
    const code = providedCode ? providedCode.toUpperCase() : this.generateGameCode();
    const entry = { gameId: String(gameId), roomId, isPrivate, createdAt: Date.now() };
    this.gameCodes.set(code, entry);
    this.gameIdToCode.set(String(gameId), code);
    logger.info('Registered game code %s for game %s (private=%s)', code, gameId, isPrivate);
    // Persist immediately so codes survive restarts
    this.persistGameCodesToDisk();
    return code;
  }

  getGameByCode(code) {
    return this.gameCodes.get(code) || null;
  }

  getCodeByGameId(gameId) {
    return this.gameIdToCode.get(String(gameId)) || null;
  }

  deleteGameCode(gameId) {
    const code = this.gameIdToCode.get(String(gameId));
    if (code) {
      this.gameCodes.delete(code);
      this.gameIdToCode.delete(String(gameId));
      logger.info('Deleted game code %s for game %s', code, gameId);
      this.persistGameCodesToDisk();
    }
  }

  async saveGameState(roomId, state) {
    const payload = {
      state,
      updatedAt: Date.now(),
      gameId: state?.id,
      roomId,
    };
    this.gameStates.set(roomId, payload);
    if (this.useRedis) {
      await this.redisStorage.saveGameState(roomId, payload);
    }
  }

  async saveCardHashMap(roomId, cardHashMap) {
    this.cardHashMaps.set(roomId, cardHashMap);
    if (this.useRedis) {
      await this.redisStorage.saveCardHashMap(roomId, cardHashMap);
    }
  }

  async getGameState(roomId) {
    if (this.useRedis) {
      const redisState = await this.redisStorage.getGameState(roomId);
      if (redisState) return redisState;
    }
    return this.gameStates.get(roomId) || null;
  }

  async getCardHashMap(roomId) {
    if (this.useRedis) {
      const redisMap = await this.redisStorage.getCardHashMap(roomId);
      if (redisMap) return redisMap;
    }
    return this.cardHashMaps.get(roomId) || null;
  }

  async deleteGameState(roomId) {
    this.gameStates.delete(roomId);
    this.cardHashMaps.delete(roomId);
    // Clean up associated game code
    for (const [code, entry] of this.gameCodes.entries()) {
      if (entry.roomId === roomId) {
        this.gameCodes.delete(code);
        this.gameIdToCode.delete(entry.gameId);
        this.persistGameCodesToDisk();
        break;
      }
    }
    if (this.useRedis) {
      await this.redisStorage.deleteGameState(roomId);
    }
  }

  async getByGameId(gameId) {
    // Try in-memory first
    for (const [, value] of this.gameStates.entries()) {
      if (String(value.gameId) === String(gameId)) {
        return value;
      }
    }
    // Redis fallback
    if (this.useRedis) {
      // Inefficient without an index; rely on room lookups from client
      return null;
    }
    return null;
  }

  cleanupOldStates() {
    const now = Date.now();
    for (const [roomId, value] of this.gameStates.entries()) {
      if (now - value.updatedAt > GAME_STATE_TTL_MS) {
        this.gameStates.delete(roomId);
        this.cardHashMaps.delete(roomId);
      }
    }
  }

  persistToDisk() {
    try {
      const entries = Array.from(this.gameStates.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_STORED_GAMES);
      fs.writeFileSync(this.filePath, JSON.stringify(entries, null, 2), 'utf8');
    } catch (err) {
      logger.error('Failed to persist game states: %s', err.message);
    }
    this.persistGameCodesToDisk();
  }

  persistGameCodesToDisk() {
    try {
      const codesData = {
        gameCodes: Array.from(this.gameCodes.entries()),
        gameIdToCode: Array.from(this.gameIdToCode.entries()),
      };
      fs.writeFileSync(this.gameCodesFilePath, JSON.stringify(codesData, null, 2), 'utf8');
    } catch (err) {
      logger.error('Failed to persist game codes: %s', err.message);
    }
  }

  loadFromDisk() {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf8');
      if (!raw) return;
      const entries = JSON.parse(raw);
      entries.forEach((entry) => {
        if (entry.roomId && entry.state) {
          this.gameStates.set(entry.roomId, entry);
        }
      });
    } catch (err) {
      logger.warn('No persisted game states loaded: %s', err.message);
    }

    // Load game codes
    try {
      if (!fs.existsSync(this.gameCodesFilePath)) return;
      const raw = fs.readFileSync(this.gameCodesFilePath, 'utf8');
      if (!raw) return;
      const codesData = JSON.parse(raw);
      if (codesData.gameCodes && Array.isArray(codesData.gameCodes)) {
        codesData.gameCodes.forEach(([code, entry]) => {
          this.gameCodes.set(code, entry);
        });
      }
      if (codesData.gameIdToCode && Array.isArray(codesData.gameIdToCode)) {
        codesData.gameIdToCode.forEach(([gameId, code]) => {
          this.gameIdToCode.set(gameId, code);
        });
      }
      logger.info('Loaded %d game codes from disk', this.gameCodes.size);
    } catch (err) {
      logger.warn('No persisted game codes loaded: %s', err.message);
    }
  }

  counts() {
    return {
      gameStates: this.gameStates.size,
      activeRooms: this.gameStates.size,
      gameCodes: this.gameCodes.size,
    };
  }

  isRedisEnabled() {
    return this.useRedis;
  }
}

module.exports = new GameStateManager();
