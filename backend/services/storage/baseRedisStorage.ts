import type Redis from "ioredis";
import { createRedisClient, getRedisEnabled } from "../../config/redis";
import log from "../../log";

/**
 * Base class for Redis storage with shared client and basic operations.
 * All basic Redis operations (set, get, del, sadd, srem, smembers) are here.
 * Domain-specific classes should extend this and add their own methods.
 */
class BaseRedisStorage {
  private static sharedClient: Redis | null = null;
  private static initialized: boolean = false;
  private static enabled: boolean = false;

  protected constructor(role: string = "data") {
    BaseRedisStorage.initializeClient(role);
  }

  private static initializeClient(role: string): void {
    if (this.initialized) return;

    this.enabled = getRedisEnabled();
    if (this.enabled) {
      const client = createRedisClient(role);
      client.connect().catch((err) => {
        log.error(`Redis connect error, disabling Redis: ${err.message}`);
        this.enabled = false;
        this.sharedClient = null;
      });
      this.sharedClient = client;
    }

    this.initialized = true;
  }

  protected hasClient(): boolean {
    return Boolean(BaseRedisStorage.sharedClient) && BaseRedisStorage.enabled;
  }

  protected async runWithClient<T>(
    fn: (client: Redis) => Promise<T>
  ): Promise<T | null> {
    if (!this.hasClient()) return null;
    return fn(BaseRedisStorage.sharedClient!);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Basic Redis Operations (universal to all storage classes)
  // ─────────────────────────────────────────────────────────────────────────────

  isEnabled(): boolean {
    return BaseRedisStorage.enabled;
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    await this.runWithClient(async (client) => {
      const payload = JSON.stringify(value);
      if (ttlMs) {
        await client.set(key, payload, "PX", ttlMs);
      } else {
        await client.set(key, payload);
      }
    });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const res = await this.runWithClient(async (client) => client.get(key));
    if (!res) return null;
    try {
      return JSON.parse(res) as T;
    } catch {
      return null;
    }
  }

  async del(key: string): Promise<void> {
    await this.runWithClient(async (client) => {
      await client.del(key);
    });
  }

  async sadd(key: string, member: string): Promise<void> {
    await this.runWithClient(async (client) => {
      await client.sadd(key, member);
    });
  }

  async srem(key: string, member: string): Promise<void> {
    await this.runWithClient(async (client) => {
      await client.srem(key, member);
    });
  }

  async smembers(key: string): Promise<string[]> {
    const result = await this.runWithClient(async (client) =>
      client.smembers(key)
    );
    return result || [];
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.runWithClient(async (client) =>
      client.exists(key)
    );
    return result === 1;
  }
}

export default BaseRedisStorage;
