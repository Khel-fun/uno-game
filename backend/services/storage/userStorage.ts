import { MAX_PLAYERS, RECONNECTION_GRACE_MS } from "../../constants";
import BaseRedisStorage from "./baseRedisStorage";
import { v4 as uuidv4 } from "uuid";
import log from "../../log";
import type {
  User,
  UserStatus,
  AddUserParams,
  AddUserResult,
  ReconnectParams,
} from "../../types/users";

const USERS_SET_KEY = "users:all";

/**
 * UserStorage handles all user persistence with Redis as primary storage
 * and in-memory as fallback (for testing or when Redis is unavailable).
 *
 * Redis Keys:
 *   user:${userId}       - User object
 *   users:all            - Set of all user IDs
 *   room:users:${roomId} - Array of user IDs in seat order (JSON)
 */
class UserStorage extends BaseRedisStorage {
  // In-memory fallback storage
  private memoryUsers: Map<string, User>;
  private memoryRoomSlots: Map<string, (string | null)[]>;

  constructor() {
    super("data");
    this.memoryUsers = new Map();
    this.memoryRoomSlots = new Map();

    if (!this.isEnabled()) {
      log.warn("Redis disabled; falling back to in-memory user store");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API - These methods work with either Redis or Memory
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Register or login user by wallet address.
   * Creates a new global user account (when wallet connects for first time)
   * or returns existing user if wallet already registered.
   */
  async registerOrLoginUser(walletAddress: string): Promise<User> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) {
      throw new Error("Wallet address is required");
    }

    // Check if user with this wallet already exists
    const existingUser = await this.getUserByWallet(wallet);
    if (existingUser) {
      log.info(
        `User logged in (existing account) - userId: ${existingUser.id}, wallet: ${wallet}`
      );
      return existingUser;
    }

    // Create new user with UUID
    const userId = uuidv4();
    const user: User = {
      id: userId,
      socketId: null,
      room: null,
      walletAddress: wallet,
      name: `User ${userId.substring(0, 8)}`,
      status: "active",
      lastSeenAt: Date.now(),
    };

    await this.saveUser(user);
    log.info(
      `✓ New user registered (first time) - userId: ${userId}, wallet: ${wallet}`
    );

    return user;
  }

  /**
   * Get user by wallet address
   */
  async getUserByWallet(walletAddress: string): Promise<User | null> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return null;

    const allUserIds = await this.getAllUserIds();

    for (const userId of allUserIds) {
      const user = await this.getUser(userId);
      if (user && user.walletAddress?.toLowerCase() === wallet) {
        return user;
      }
    }

    return null;
  }

  /**
   * Get user by socket ID
   */
  async getUserBySocketId(socketId: string): Promise<User | null> {
    const allUserIds = await this.getAllUserIds();

    for (const userId of allUserIds) {
      const user = await this.getUser(userId);
      if (user && user.socketId === socketId) {
        return user;
      }
    }

    return null;
  }

  /**
   * Join a room with existing user account (identified by wallet)
   * Updates the user's room and adds them to room slots
   */
  async joinRoomWithUser(
    walletAddress: string,
    room: string,
    socketId: string
  ): Promise<AddUserResult> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) {
      return { error: "Wallet address required" };
    }

    // Get the user by wallet (should exist from registration)
    let user = await this.getUserByWallet(wallet);
    if (!user) {
      return { error: "User not registered. Please connect wallet first." };
    }

    // Check if user is already in this room
    const usersInRoom = await this.getUsersInRoom(room);
    const existingInRoom = usersInRoom.find((u) => u.id === user!.id);

    if (existingInRoom) {
      // User already in room, just update status and socketId
      user.socketId = socketId;
      user.status = "active";
      user.lastSeenAt = Date.now();
      await this.saveUser(user);

      log.info(`User ${user.name} rejoined room ${room} (already in room)`);
      return { user, reused: true };
    }

    // Add user to room
    try {
      const seatIndex = await this.addUserToRoom(room, user.id, MAX_PLAYERS);

      // Update user with room info and socketId
      user.socketId = socketId;
      user.room = room;
      user.status = "active";
      user.lastSeenAt = Date.now();
      user.name = user.name || `Player ${seatIndex + 1}`;
      await this.saveUser(user);

      log.info(
        `User ${user.name} (${user.id}) joined room ${room} at seat ${seatIndex}`
      );
      return { user, reused: false };
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message === "Room full") {
        log.warn(`joinRoomWithUser: room full - ${room}`);
        return { error: "Room full" };
      }
      throw err;
    }
  }

  async addOrReuseUser(params: AddUserParams): Promise<AddUserResult> {
    const wallet = this.normalizeWallet(params.walletAddress);
    const usersInRoom: User[] = await this.getUsersInRoom(params.room);

    const findByWallet = (status?: UserStatus) =>
      wallet
        ? usersInRoom.find(
            (user) =>
              user.walletAddress &&
              user.walletAddress.toLowerCase() === wallet &&
              (!status || user.status === status)
          )
        : undefined;

    // Try to reuse disconnected user first
    const existingDisconnected = findByWallet("disconnected");
    if (existingDisconnected) {
      const user = await this.reuseExistingUser(
        params.room,
        existingDisconnected,
        params.id
      );
      return { user, reused: true };
    }

    // Then try to reuse any existing user with same wallet
    const existingConnected = findByWallet();
    if (existingConnected) {
      const user = await this.reuseExistingUser(
        params.room,
        existingConnected,
        params.id
      );
      return { user, reused: true };
    }

    // Create new user
    try {
      const seatIndex = await this.addUserToRoom(
        params.room,
        params.id,
        MAX_PLAYERS
      );
      const user: User = {
        id: params.id,
        socketId: params.id, // For legacy addOrReuseUser, socket.id is used as user.id
        room: params.room,
        walletAddress: wallet,
        name: `Player ${seatIndex + 1}`,
        status: "active",
        lastSeenAt: Date.now(),
      };
      await this.saveUser(user);
      return { user, reused: false };
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message === "Room full") {
        log.warn(`addOrReuseUser: room full - ${params.room}`);
        return { error: "Room full" };
      }
      throw err;
    }
  }

  async getUser(userId: string): Promise<User | null> {
    if (this.isEnabled()) {
      return this.get<User>(`user:${userId}`);
    }
    return this.memoryUsers.get(userId) || null;
  }

  async getUsersInRoom(room: string): Promise<User[]> {
    const slots = await this.getRoomUserSlots(room);
    const users = await Promise.all(
      slots.map(async (userId) => (userId ? this.getUser(userId) : null))
    );
    //returning valid users
    return users.filter((user): user is User => Boolean(user));
  }

  async markDisconnected(userId: string): Promise<User | null> {
    const user = await this.getUser(userId);
    if (!user) return null;

    const updated: User = {
      ...user,
      status: "disconnected",
      lastSeenAt: Date.now(),
    };

    await this.saveUser(updated);
    return updated;
  }

  async removeUser(userId: string): Promise<User | null> {
    const user = await this.getUser(userId);
    if (!user) return null;

    if (user.room) {
      await this.removeUserFromRoom(user.room, userId);
    }
    await this.deleteUser(userId);
    return user;
  }

  async reconnectUser(params: ReconnectParams): Promise<User | null> {
    const wallet = this.normalizeWallet(params.walletAddress);
    const users = await this.getUsersInRoom(params.room);

    let match: User | undefined;
    if (wallet) {
      match = users.find(
        (user) =>
          user.walletAddress && user.walletAddress.toLowerCase() === wallet
      );
    }
    if (!match) {
      match = users.find((user) => user.status === "disconnected");
    }
    if (!match) return null;

    return this.reuseExistingUser(params.room, match, params.newId);
  }

  async cleanupDisconnected(): Promise<void> {
    const now = Date.now();

    if (this.isEnabled()) {
      const ids = await this.getAllUserIds();
      await Promise.all(
        ids.map(async (userId) => {
          const user = await this.getUser(userId);
          if (
            user &&
            user.status === "disconnected" &&
            user.lastSeenAt &&
            now - user.lastSeenAt > RECONNECTION_GRACE_MS
          ) {
            if (user.room) {
              await this.removeUserFromRoom(user.room, userId);
            }
            await this.deleteUser(userId);
          }
        })
      );
    } else {
      for (const [id, user] of this.memoryUsers.entries()) {
        if (
          user.status === "disconnected" &&
          user.lastSeenAt &&
          now - user.lastSeenAt > RECONNECTION_GRACE_MS
        ) {
          if (user.room) {
            this.removeSeatMemory(user.room, id);
          }
          this.memoryUsers.delete(id);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private normalizeWallet(walletAddress?: string): string | null {
    return walletAddress ? walletAddress.toLowerCase() : null;
  }

  private async reuseExistingUser(
    room: string,
    existing: User,
    nextId: string
  ): Promise<User> {
    const seatIndex = await this.replaceRoomUser(room, existing.id, nextId);
    if (seatIndex === null) {
      throw new Error("User not found in room during reuse");
    }
    await this.deleteUser(existing.id);

    const updated: User = {
      ...existing,
      id: nextId,
      status: "active",
      lastSeenAt: Date.now(),
      name: existing.name || `Player ${seatIndex + 1}`,
    };
    await this.saveUser(updated);
    return updated;
  }

  /**
   * Update an existing user
   */
  async updateUser(user: User): Promise<void> {
    await this.saveUser(user);
  }

  private async saveUser(user: User): Promise<void> {
    if (this.isEnabled()) {
      await this.set(`user:${user.id}`, user);
      await this.sadd(USERS_SET_KEY, user.id);
      log.info(
        `✓ Redis: Saved user:${user.id} (wallet: ${
          user.walletAddress || "none"
        }, room: ${user.room || "none"})`
      );
    } else {
      this.memoryUsers.set(user.id, user);
      log.info(`✓ Memory: Saved user (userId: ${user.id})`);
    }
  }

  private async deleteUser(userId: string): Promise<void> {
    if (this.isEnabled()) {
      await this.del(`user:${userId}`);
      await this.srem(USERS_SET_KEY, userId);
    } else {
      this.memoryUsers.delete(userId);
    }
  }

  private async getAllUserIds(): Promise<string[]> {
    if (this.isEnabled()) {
      return this.smembers(USERS_SET_KEY);
    }
    return Array.from(this.memoryUsers.keys());
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Room Slot Management
  // ─────────────────────────────────────────────────────────────────────────────

  private async getRoomUserSlots(roomId: string): Promise<(string | null)[]> {
    if (this.isEnabled()) {
      const raw = await this.runWithClient(async (client) =>
        client.get(`room:users:${roomId}`)
      );
      return this.parseRoomUsers(raw);
    }
    return this.getMemoryRoomSlots(roomId);
  }

  private async saveRoomUserSlots(
    roomId: string,
    slots: (string | null)[]
  ): Promise<void> {
    if (this.isEnabled()) {
      await this.runWithClient(async (client) => {
        await client.set(`room:users:${roomId}`, JSON.stringify(slots));
      });
    } else {
      this.memoryRoomSlots.set(roomId, slots);
    }
  }

  private async addUserToRoom(
    roomId: string,
    userId: string,
    maxPlayers: number
  ): Promise<number> {
    const slots = await this.getRoomUserSlots(roomId);
    const existingIndex = slots.findIndex((value) => value === userId);
    if (existingIndex !== -1) {
      return existingIndex;
    }

    let availableIndex = slots.findIndex((value) => value == null);
    if (availableIndex === -1) {
      if (slots.length >= maxPlayers) {
        throw new Error("Room full");
      }
      slots.push(userId);
      availableIndex = slots.length - 1;
    } else {
      slots[availableIndex] = userId;
    }

    await this.saveRoomUserSlots(roomId, slots);
    return availableIndex;
  }

  private async replaceRoomUser(
    roomId: string,
    previousUserId: string,
    nextUserId: string
  ): Promise<number | null> {
    const slots = await this.getRoomUserSlots(roomId);
    const index = slots.findIndex((value) => value === previousUserId);
    if (index === -1) return null;
    slots[index] = nextUserId;
    await this.saveRoomUserSlots(roomId, slots);
    return index;
  }

  private async removeUserFromRoom(
    roomId: string,
    userId: string
  ): Promise<void> {
    const slots = await this.getRoomUserSlots(roomId);
    let changed = false;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] === userId) {
        slots[i] = null;
        changed = true;
      }
    }
    if (changed) {
      await this.saveRoomUserSlots(roomId, slots);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Memory-only helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private getMemoryRoomSlots(room: string): (string | null)[] {
    if (!this.memoryRoomSlots.has(room)) {
      this.memoryRoomSlots.set(room, []);
    }
    return this.memoryRoomSlots.get(room)!;
  }

  private removeSeatMemory(room: string, userId: string): void {
    const slots = this.getMemoryRoomSlots(room);
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] === userId) {
        slots[i] = null;
      }
    }
  }

  private parseRoomUsers(raw: string | null): (string | null)[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((value) =>
          typeof value === "string" ? value : null
        );
      }
    } catch (err: unknown) {
      const error = err as Error;
      log.warn(`Failed to parse room users payload: ${error.message}`);
    }
    return [];
  }
}

// Singleton instance
const userStorage = new UserStorage();
export default userStorage;
export { UserStorage };
