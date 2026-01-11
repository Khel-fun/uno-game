import {
  USER_CLEANUP_INTERVAL_MS,
  GAME_CLEANUP_INTERVAL_MS,
} from "../constants";
import type { GameStorage } from "../services/storage/gameStorage";
import type { UserStorage } from "../services/storage/userStorage";

interface CleanupDependencies {
  gameStorage: GameStorage;
  userStorage: UserStorage;
}

function setupCleanup({ gameStorage, userStorage }: CleanupDependencies): void {
  setInterval(() => {
    void userStorage.cleanupDisconnected();
  }, USER_CLEANUP_INTERVAL_MS);
  setInterval(() => gameStorage.cleanupOldStates(), GAME_CLEANUP_INTERVAL_MS);
}

export { setupCleanup };
