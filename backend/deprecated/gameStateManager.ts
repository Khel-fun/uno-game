import * as fs from "fs";
import * as path from "path";
import {
  Game,
  GameState,
  GameStatesFile,
  GameMetadata,
  CardHashMap,
} from "./types";
import logger from "./logger";

// In-memory storage for game states
// roomId as key
const gameStates = new Map<string, { state: GameState; lastUpdated: number }>();
const cardHashMaps = new Map<string, CardHashMap>();

// Persistent storage configuration
const STORAGE_FILE = path.join(__dirname, "game-states.json");
const MAX_STORED_GAMES = 10;

// Store game metadata for persistence
const gameMetadata = new Map<string, GameMetadata>(); // gameId -> metadata

/**
 * Load game states from JSON file on startup
 */
const loadGameStatesFromFile = (): void => {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, "utf8");
      const parsed: GameStatesFile = JSON.parse(data);

      // Restore game states
      if (parsed.games && Array.isArray(parsed.games)) {
        parsed.games.forEach((game: Game) => {
          gameStates.set(game.roomId, {
            state: game.state,
            lastUpdated: game.lastUpdated,
          });

          if (game.cardHashMap) {
            cardHashMaps.set(game.roomId, game.cardHashMap);
          }

          if (game.metadata) {
            gameMetadata.set(game.gameId, game.metadata);
          }
        });

        logger.info(
          `Loaded ${parsed.games.length} game states from persistent storage`
        );
      }
    }
  } catch (error) {
    logger.error("Error loading game states from file:", error);
  }
};

/**
 * Save game states to JSON file
 */
const saveGameStatesToFile = (): boolean => {
  try {
    const games: Game[] = [];

    // Convert Map to array and sort by last updated (most recent first)
    const sortedGames = Array.from(gameStates.entries())
      .sort((a, b) => b[1].lastUpdated - a[1].lastUpdated)
      .slice(0, MAX_STORED_GAMES); // Keep only last 10 games

    sortedGames.forEach(([roomId, data]) => {
      const gameId = data.state?.id?.toString() || roomId;
      const metadata = gameMetadata.get(gameId) || {
        players: data.state?.players || [],
        startTime: data.state?.lastActionTimestamp || Date.now(),
        lastActivity: data.lastUpdated,
        roomId: roomId,
        isStarted: data.state?.isStarted || false,
        turnCount: data.state?.turnCount || "0",
      };

      games.push({
        roomId,
        gameId,
        state: data.state,
        cardHashMap: cardHashMaps.get(roomId) || {},
        lastUpdated: data.lastUpdated,
        metadata,
      });
    });

    const dataToSave: GameStatesFile = {
      lastSaved: new Date().toISOString(),
      totalGames: games.length,
      games,
    };

    fs.writeFileSync(STORAGE_FILE, JSON.stringify(dataToSave, null, 2), "utf8");
    logger.debug(`Saved ${games.length} game states to persistent storage`);
    return true;
  } catch (error) {
    logger.error("Error saving game states to file:", error);
    return false;
  }
};

/**
 * Save game state for a room
 */
const saveGameState = (
  roomId: string,
  gameState: GameState,
  cardHashMap: CardHashMap | null = null
): boolean => {
  try {
    const now = Date.now();
    gameStates.set(roomId, {
      state: gameState,
      lastUpdated: now,
    });

    if (cardHashMap) {
      cardHashMaps.set(roomId, cardHashMap);
    }

    // Store metadata for persistence
    if (gameState && gameState.id) {
      const gameId = gameState.id.toString();
      gameMetadata.set(gameId, {
        players: gameState.players || [],
        startTime: gameState.lastActionTimestamp || now,
        lastActivity: now,
        roomId: roomId,
        isStarted: gameState.isStarted || false,
        turnCount: gameState.turnCount?.toString() || "0",
      });
    }

    logger.debug(`Game state saved for room ${roomId}`);

    // Persist to file asynchronously (non-blocking)
    setImmediate(() => saveGameStatesToFile());

    return true;
  } catch (error) {
    logger.error(`Error saving game state for room ${roomId}:`, error);
    return false;
  }
};

/**
 * Get game state for a room
 */
const getGameState = (roomId: string): GameState | null => {
  const stored = gameStates.get(roomId);
  if (stored) {
    logger.debug(`Game state retrieved for room ${roomId}`);
    return stored.state;
  }
  logger.debug(`No game state found for room ${roomId}`);
  return null;
};

/**
 * Get game state by game ID (searches across all rooms)
 */
const getGameStateByGameId = (
  gameId: string | number
): {
  roomId: string;
  state: GameState;
  cardHashMap: CardHashMap | null;
  metadata: GameMetadata | undefined;
} | null => {
  for (const [roomId, data] of gameStates.entries()) {
    if (data.state?.id?.toString() === gameId.toString()) {
      logger.debug(
        `Game state retrieved for game ID ${gameId} in room ${roomId}`
      );
      return {
        roomId,
        state: data.state,
        cardHashMap: cardHashMaps.get(roomId) || null,
        metadata: gameMetadata.get(gameId.toString()),
      };
    }
  }
  logger.debug(`No game state found for game ID ${gameId}`);
  return null;
};

/**
 * Get card hash map for a room
 */
const getCardHashMap = (roomId: string): CardHashMap | null => {
  const cardHashMap = cardHashMaps.get(roomId);
  if (cardHashMap) {
    logger.debug(`Card hash map retrieved for room ${roomId}`);
    return cardHashMap;
  }
  return null;
};

/**
 * Delete game state for a room
 */
const deleteGameState = (roomId: string): boolean => {
  const deleted = gameStates.delete(roomId);
  cardHashMaps.delete(roomId);

  if (deleted) {
    logger.info(`Game state deleted for room ${roomId}`);
  }
  return deleted;
};

/**
 * Check if a room has a game state
 */
const hasGameState = (roomId: string): boolean => {
  return gameStates.has(roomId);
};

/**
 * Get all active room IDs
 */
const getActiveRooms = (): string[] => {
  return Array.from(gameStates.keys());
};

/**
 * Clean up old game states
 */
const cleanupOldGameStates = (maxAge: number = 3600000): number => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [roomId, data] of gameStates.entries()) {
    if (now - data.lastUpdated > maxAge) {
      gameStates.delete(roomId);
      cardHashMaps.delete(roomId);
      cleanedCount++;
      logger.info(`Cleaned up old game state for room ${roomId}`);
    }
  }

  if (cleanedCount > 0) {
    logger.info(`Cleaned up ${cleanedCount} old game states`);
  }

  return cleanedCount;
};

/**
 * Get statistics about stored game states
 */
const getStats = (): {
  totalGames: number;
  activeRooms: string[];
  persistedGames: number;
  storageFile: string;
  memoryUsage: NodeJS.MemoryUsage;
} => {
  return {
    totalGames: gameStates.size,
    activeRooms: getActiveRooms(),
    persistedGames: gameMetadata.size,
    storageFile: STORAGE_FILE,
    memoryUsage: process.memoryUsage(),
  };
};

/**
 * Get list of recent games with metadata
 */
const getRecentGames = (): Array<
  GameMetadata & {
    gameId: string;
    hasActiveState: boolean;
  }
> => {
  const games: Array<
    GameMetadata & { gameId: string; hasActiveState: boolean }
  > = [];

  for (const [gameId, metadata] of gameMetadata.entries()) {
    games.push({
      gameId,
      ...metadata,
      hasActiveState: gameStates.has(metadata.roomId),
    });
  }

  // Sort by last activity (most recent first)
  games.sort((a, b) => b.lastActivity - a.lastActivity);

  return games.slice(0, MAX_STORED_GAMES);
};

// Load existing game states on startup
loadGameStatesFromFile();

// Start periodic cleanup (every 5 minutes)
const CLEANUP_INTERVAL = 300000; // 5 minutes
setInterval(() => {
  cleanupOldGameStates();
}, CLEANUP_INTERVAL);

// Periodic save to file (every 30 seconds)
const SAVE_INTERVAL = 30000; // 30 seconds
setInterval(() => {
  saveGameStatesToFile();
}, SAVE_INTERVAL);

// Save on process exit
process.on("SIGINT", () => {
  logger.info("Saving game states before shutdown...");
  saveGameStatesToFile();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Saving game states before shutdown...");
  saveGameStatesToFile();
  process.exit(0);
});

logger.info(
  "Game state manager initialized with persistent storage and periodic cleanup"
);

export {
  saveGameState,
  getGameState,
  getGameStateByGameId,
  getCardHashMap,
  deleteGameState,
  hasGameState,
  getActiveRooms,
  cleanupOldGameStates,
  getStats,
  getRecentGames,
  saveGameStatesToFile,
  loadGameStatesFromFile,
};
