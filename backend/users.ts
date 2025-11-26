/**
 * =============================================================================
 * USER MANAGEMENT SYSTEM
 * =============================================================================
 *
 * This module manages user connections in Socket.IO rooms with reconnection support.
 *
 * Key Features:
 * - Tracks users across Socket.IO rooms (game lobbies)
 * - Handles disconnection/reconnection gracefully
 * - Supports reconnection by name OR Ethereum address
 * - Automatic cleanup of long-disconnected users
 * - Room capacity management (max 6 players per room)
 *
 * Connection Flow:
 * 1. User joins → addUser() → Added to room if not full
 * 2. User disconnects temporarily → markUserDisconnected()
 * 3. User reconnects → addUser() recognizes them and restores their slot
 * 4. User disconnected too long → cleanupDisconnectedUsers() removes them
 *
 * Reconnection Strategy:
 * - Users can reconnect by matching (name + room) OR (address + room)
 * - Address-based matching handles browser refresh scenarios where socket ID changes
 * - Grace period before permanent removal allows temporary connection issues
 */

import logger from "./logger";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Represents a connected or recently disconnected user in a game room.
 *
 * @property id - Socket.IO socket ID (unique per connection, changes on reconnect)
 * @property name - User's display name (chosen by player)
 * @property room - Room/game ID the user is in
 * @property address - Ethereum wallet address (0x...) for blockchain integration
 * @property connected - Whether the user is currently connected (false = temporarily disconnected)
 * @property disconnectedAt - Unix timestamp (ms) when user disconnected, null if connected
 *
 * @example
 * {
 *   id: "socket_abc123",
 *   name: "Alice",
 *   room: "game-456",
 *   address: "0x1234567890abcdef1234567890abcdef12345678",
 *   connected: true,
 *   disconnectedAt: null
 * }
 *
 * Disconnected user example:
 * {
 *   id: "socket_abc123",
 *   name: "Bob",
 *   room: "game-789",
 *   address: "0xabcdef...",
 *   connected: false,
 *   disconnectedAt: 1700550420000  // Can reconnect before cleanup
 * }
 */
export interface User {
  id: string;
  name: string;
  room: string;
  address: string;
  connected: boolean;
  disconnectedAt: number | null;
}

/**
 * Parameters for adding a new user to a room.
 *
 * @property id - Socket.IO socket ID
 * @property name - Display name
 * @property room - Room/game ID
 * @property address - Ethereum wallet address
 */
interface AddUserParams {
  id: string;
  name: string;
  room: string;
  address: string;
}

/**
 * Return type for addUser function.
 *
 * @property newUser - The user object (either newly created or reconnected)
 * @property error - Error message if operation failed (e.g., room full)
 * @property reconnected - True if this was a reconnection, undefined for new user
 */
interface AddUserResult {
  newUser?: User;
  error?: string;
  reconnected?: boolean;
}

// =============================================================================
// IN-MEMORY USER STORAGE
// =============================================================================

/**
 * In-memory array storing all users across all rooms.
 *
 * Note: In production, consider using Redis for:
 * - Persistence across server restarts
 * - Horizontal scaling across multiple server instances
 * - Faster lookup with hash-based data structures
 */
const users: User[] = [];

// =============================================================================
// USER MANAGEMENT FUNCTIONS
// =============================================================================

/**
 * Add a user to a room or reconnect an existing user.
 *
 * This function handles both new user joins and reconnections:
 * - Checks if room is full (max 6 players)
 * - Searches for existing disconnected user by name OR address
 * - If found, reconnects them with new socket ID
 * - If not found, creates new user entry
 *
 * Reconnection Logic:
 * 1. First tries to find by (name + room) - handles normal reconnects
 * 2. If not found, tries (address + room) - handles page refresh
 * 3. Updates socket ID and marks as connected
 *
 * @param params - Object containing id, name, room, and address
 * @returns Object with newUser (the user), error (if failed), or reconnected flag
 *
 * @example
 * // New user joining
 * const result = addUser({
 *   id: "socket_123",
 *   name: "Alice",
 *   room: "game-456",
 *   address: "0x1234..."
 * });
 * // Returns: { newUser: {...} }
 *
 * // Room full
 * const result = addUser({ ... });
 * // Returns: { error: "Room full" }
 *
 * // User reconnecting
 * const result = addUser({
 *   id: "socket_789",  // New socket ID
 *   name: "Alice",     // Same name
 *   room: "game-456",  // Same room
 *   address: "0x1234..."
 * });
 * // Returns: { newUser: {...}, reconnected: true }
 */
const addUser = ({ id, name, room, address }: AddUserParams): AddUserResult => {
  // Count currently connected users in the target room
  const numberOfUsersInRoom = users.filter(
    (user) => user.room === room && user.connected !== false
  ).length;

  // Enforce room capacity limit
  if (numberOfUsersInRoom === 6) {
    logger.info(`Room ${room} is full, user ${id} rejected`);
    return { error: "Room full" };
  }

  // Check if user is reconnecting (same name in same room OR same address in same room)
  let existingUser = users.find(
    (u) => u.name === name && u.room === room && u.connected === false
  );

  // If not found by name, try by address (for page refresh scenarios)
  if (!existingUser && address) {
    existingUser = users.find(
      (u) => u.address === address && u.room === room && u.connected === false
    );
  }

  if (existingUser) {
    // User is reconnecting, update their socket ID
    existingUser.id = id;
    existingUser.connected = true;
    existingUser.disconnectedAt = null;
    if (address && !existingUser.address) {
      existingUser.address = address;
    }
    logger.info(
      `User ${name} reconnected to room ${room} with new socket ${id}`
    );
    return { newUser: existingUser, reconnected: true };
  }

  // New user - create and add to users array
  const newUser: User = {
    id,
    name,
    room,
    address,
    connected: true,
    disconnectedAt: null,
  };
  users.push(newUser);
  logger.info(
    `User ${id} added to room ${room} as ${name} with address ${address}`
  );
  return { newUser };
};

/**
 * Permanently remove a user from the system.
 *
 * This completely deletes the user from memory. Use markUserDisconnected()
 * instead if you want to allow reconnection.
 *
 * @param id - Socket.IO socket ID of the user to remove
 * @returns The removed user object, or null if user not found
 *
 * @example
 * const removedUser = removeUser("socket_123");
 * // Returns: { id: "socket_123", name: "Alice", ... }
 */
const removeUser = (id: string): User | null => {
  const removeIndex = users.findIndex((user) => user.id === id);

  if (removeIndex !== -1) {
    const removedUser = users.splice(removeIndex, 1)[0];
    logger.info(`User ${id} removed from room ${removedUser.room}`);
    return removedUser;
  }
  logger.debug(`Attempted to remove non-existent user ${id}`);
  return null;
};

/**
 * Mark a user as disconnected without removing them.
 *
 * This allows the user to reconnect and resume their game. The user
 * remains in the users array but is marked as disconnected with a timestamp.
 *
 * Use this instead of removeUser() to handle temporary disconnections
 * like network hiccups or brief browser issues.
 *
 * @param id - Socket.IO socket ID of the disconnecting user
 * @returns The user object with updated disconnection status, or null if not found
 *
 * @example
 * const user = markUserDisconnected("socket_123");
 * // User.connected = false, User.disconnectedAt = 1700550420000
 */
const markUserDisconnected = (id: string): User | null => {
  const user = users.find((user) => user.id === id);
  if (user) {
    user.connected = false;
    user.disconnectedAt = Date.now();
    logger.info(`User ${id} marked as disconnected in room ${user.room}`);
    return user;
  }
  return null;
};

/**
 * Remove users who have been disconnected for too long.
 *
 * This function is typically called periodically to clean up users who
 * disconnected and never reconnected. It prevents memory leaks and stale
 * user data from accumulating.
 *
 * Default timeout: 60 seconds (60000ms)
 *
 * @param maxDisconnectTime - Maximum time (ms) a user can be disconnected before removal
 * @returns Array of users that were cleaned up
 *
 * @example
 * // Clean up users disconnected for more than 5 minutes
 * const cleaned = cleanupDisconnectedUsers(5 * 60 * 1000);
 * console.log(`Removed ${cleaned.length} stale users`);
 *
 * // Use default 60 second timeout
 * const cleaned = cleanupDisconnectedUsers();
 */
const cleanupDisconnectedUsers = (maxDisconnectTime: number = 60000): User[] => {
  const now = Date.now();
  const toRemove = users.filter(
    (user) =>
      user.connected === false &&
      user.disconnectedAt &&
      now - user.disconnectedAt > maxDisconnectTime
  );

  toRemove.forEach((user) => {
    const index = users.findIndex((u) => u.id === user.id);
    if (index !== -1) {
      users.splice(index, 1);
      logger.info(
        `Cleaned up disconnected user ${user.id} from room ${user.room}`
      );
    }
  });

  return toRemove;
};

/**
 * Find a user by their display name and room.
 *
 * Used for reconnection scenarios where we need to match a returning
 * user to their previous session.
 *
 * @param name - User's display name
 * @param room - Room/game ID
 * @returns User object if found, undefined otherwise
 *
 * @example
 * const user = findUserByNameAndRoom("Alice", "game-456");
 * if (user && !user.connected) {
 *   // User exists but is disconnected - can reconnect
 * }
 */
const findUserByNameAndRoom = (name: string, room: string): User | undefined => {
  return users.find((user) => user.name === name && user.room === room);
};

/**
 * Find a user by their Ethereum address and room.
 *
 * Used for reconnection after page refresh, where the user's name might
 * not be immediately available but their wallet address is still known.
 *
 * @param address - Ethereum wallet address (0x...)
 * @param room - Room/game ID
 * @returns User object if found, null if address not provided, undefined if not found
 *
 * @example
 * const user = findUserByAddressAndRoom("0x1234...", "game-456");
 * if (user) {
 *   // Found the user, can reconnect them
 * }
 */
const findUserByAddressAndRoom = (
  address: string,
  room: string
): User | undefined | null => {
  if (!address) return null;
  return users.find((user) => user.address === address && user.room === room);
};

/**
 * Get a user by their socket ID.
 *
 * Primary lookup method when you have the socket ID from a Socket.IO event.
 *
 * @param id - Socket.IO socket ID
 * @returns User object if found, undefined otherwise
 *
 * @example
 * socket.on("playCard", () => {
 *   const user = getUser(socket.id);
 *   if (user) {
 *     // Process the card play for this user
 *   }
 * });
 */
const getUser = (id: string): User | undefined => {
  return users.find((user) => user.id === id);
};

/**
 * Get all users in a specific room.
 *
 * Returns both connected and disconnected users. Filter by user.connected
 * if you only want active users.
 *
 * @param room - Room/game ID
 * @returns Array of users in the room (may be empty)
 *
 * @example
 * const allUsers = getUsersInRoom("game-456");
 * const activeUsers = allUsers.filter(u => u.connected);
 * console.log(`Room has ${activeUsers.length} active players`);
 */
const getUsersInRoom = (room: string): User[] => {
  return users.filter((user) => user.room === room);
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
  markUserDisconnected,
  cleanupDisconnectedUsers,
  findUserByNameAndRoom,
  findUserByAddressAndRoom,
};
