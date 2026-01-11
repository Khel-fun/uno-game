import fs from "fs";
import path from "path";
import log from "../../log";
import {
  GAME_STATE_TTL_MS,
  FILE_PERSIST_INTERVAL_MS,
  MAX_STORED_GAMES,
} from "../../constants";
import BaseRedisStorage from "./baseRedisStorage";

/**
 * GameStorage handles all game state persistence with Redis as primary storage
 * and in-memory as fallback (for testing or when Redis is unavailable).
 * Also persists to disk periodically for durability.
 *
 * Redis Keys:
 *   game:state:${roomId}    - Game state payload
 *   game:cardhash:${roomId} - Card hash map for the game
 *   game:index:${gameId}    - roomId (for reverse lookup by gameId)
 */

interface GameStatePayload {
  state: any;
  updatedAt: number;
  gameId?: string | number;
  roomId: string;
}

class GameStorage extends BaseRedisStorage {
  // In-memory storage (used both as fallback and cache)
  private gameStates: Map<string, GameStatePayload>;
  private cardHashMaps: Map<string, unknown>;
  private filePath: string;

  constructor() {
    super("data");
    this.gameStates = new Map();
    this.cardHashMaps = new Map();
    this.filePath = path.join(__dirname, "../../game-states.json");

    this.loadFromDisk();
    setInterval(() => this.persistToDisk(), FILE_PERSIST_INTERVAL_MS);

    if (!this.isEnabled()) {
      log.warn("Redis disabled; falling back to in-memory game state store");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  async saveGameState(roomId: string, state: unknown): Promise<void> {
    const payload: GameStatePayload = {
      state,
      updatedAt: Date.now(),
      gameId: (state as Record<string, unknown>)?.id as
        | string
        | number
        | undefined,
      roomId,
    };

    // Always update memory cache
    this.gameStates.set(roomId, payload);

    // Persist to Redis if enabled
    if (this.isEnabled()) {
      await this.set(`game:state:${roomId}`, payload, GAME_STATE_TTL_MS);

      // Create reverse index: gameId -> roomId
      if (payload.gameId) {
        await this.set(
          `game:index:${payload.gameId}`,
          roomId,
          GAME_STATE_TTL_MS
        );
      }
    }
  }

  async getGameState(roomId: string): Promise<GameStatePayload | null> {
    if (this.isEnabled()) {
      return this.get<GameStatePayload>(`game:state:${roomId}`);
    }
    return this.gameStates.get(roomId) || null;
  }

  async deleteGameState(roomId: string): Promise<void> {
    // Get gameId before deleting to clean up index
    const existing = this.gameStates.get(roomId);
    const gameId = existing?.gameId;

    this.gameStates.delete(roomId);
    this.cardHashMaps.delete(roomId);

    if (this.isEnabled()) {
      await this.del(`game:state:${roomId}`);
      await this.del(`game:cardhash:${roomId}`);

      // Clean up reverse index
      if (gameId) {
        await this.del(`game:index:${gameId}`);
      }
    }
  }

  async saveCardHashMap(roomId: string, cardHashMap: unknown): Promise<void> {
    this.cardHashMaps.set(roomId, cardHashMap);

    if (this.isEnabled()) {
      await this.set(`game:cardhash:${roomId}`, cardHashMap, GAME_STATE_TTL_MS);
    }
  }

  async getCardHashMap(roomId: string): Promise<unknown | null> {
    if (this.isEnabled()) {
      return this.get(`game:cardhash:${roomId}`);
    }
    return this.cardHashMaps.get(roomId) || null;
  }

  async getByGameId(gameId: string | number): Promise<GameStatePayload | null> {
    // Try Redis index first
    if (this.isEnabled()) {
      const roomId = await this.get<string>(`game:index:${gameId}`);
      if (roomId) {
        return this.getGameState(roomId);
      }
    }

    // Fall back to in-memory search
    for (const [, value] of this.gameStates.entries()) {
      if (String(value.gameId) === String(gameId)) {
        return value;
      }
    }

    return null;
  }

  cleanupOldStates(): void {
    const now = Date.now();
    for (const [roomId, value] of this.gameStates.entries()) {
      if (now - value.updatedAt > GAME_STATE_TTL_MS) {
        this.gameStates.delete(roomId);
        this.cardHashMaps.delete(roomId);
      }
    }
  }

  counts(): { gameStates: number; activeRooms: number } {
    return {
      gameStates: this.gameStates.size,
      activeRooms: this.gameStates.size,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Disk Persistence
  // ─────────────────────────────────────────────────────────────────────────────

  persistToDisk(): void {
    try {
      const entries = Array.from(this.gameStates.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_STORED_GAMES);
      fs.writeFileSync(this.filePath, JSON.stringify(entries, null, 2), "utf8");
    } catch (err: unknown) {
      const error = err as Error;
      log.error("Failed to persist game states: %s", error.message);
    }
  }

  loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, "utf8");
      if (!raw) return;
      const entries = JSON.parse(raw);
      entries.forEach((entry: GameStatePayload) => {
        if (entry.roomId && entry.state) {
          this.gameStates.set(entry.roomId, entry);
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      log.warn("No persisted game states loaded: %s", error.message);
    }
  }
}

// Singleton instance
const gameStorage = new GameStorage();
export default gameStorage;
export { GameStorage };
export type { GameStatePayload };
