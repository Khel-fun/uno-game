import { RECONNECTION_GRACE_MS } from "../constants";
import log from "../log";

const disconnectTimers = new Map<string, NodeJS.Timeout>(); // userId -> timeout

function scheduleRemoval(userId: string, fn: () => Promise<void> | void): void {
  clearRemoval(userId);
  const timer = setTimeout(() => {
    disconnectTimers.delete(userId);
    Promise.resolve(fn()).catch((err) => {
      log.error(
        `Failed to run scheduled removal for ${userId}: ${err?.message || err}`
      );
    });
  }, RECONNECTION_GRACE_MS);
  disconnectTimers.set(userId, timer);
}

function clearRemoval(userId: string): void {
  const timer = disconnectTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(userId);
  }
}

export { scheduleRemoval, clearRemoval };
