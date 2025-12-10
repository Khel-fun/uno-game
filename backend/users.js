const logger = require('./logger');
const { MAX_PLAYERS, RECONNECTION_GRACE_MS } = require('./constants');

class UserManager {
  constructor() {
    this.users = new Map(); // socketId -> user
  }

  getUsersInRoom(room) {
    return Array.from(this.users.values()).filter((u) => u.room === room);
  }

  getUser(id) {
    return this.users.get(id);
  }

  nextPlayerNumber(room) {
    const present = new Set(
      this.getUsersInRoom(room)
        .filter((u) => u.playerNumber != null)
        .map((u) => u.playerNumber)
    );
    for (let i = 1; i <= MAX_PLAYERS; i++) {
      if (!present.has(i)) return i;
    }
    return null;
  }

  addOrReuseUser({ id, room, walletAddress }) {
    logger.info('addOrReuseUser: incoming', { id, room, walletAddress });
    
    const existingDisconnected = this.getUsersInRoom(room).find(
      (u) =>
        u.walletAddress &&
        walletAddress &&
        u.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
        !u.connected
    );
    logger.info('addOrReuseUser: existingDisconnected?', { found: !!existingDisconnected, existingDisconnected });

    if (existingDisconnected) {
      existingDisconnected.id = id;
      existingDisconnected.connected = true;
      existingDisconnected.disconnectedAt = null;
      this.users.set(id, existingDisconnected);
      logger.info('addOrReuseUser: reused disconnected user', { id, room, walletAddress });
      return { user: existingDisconnected, reused: true };
    }

    const existingConnected = this.getUsersInRoom(room).find(
      (u) =>
        u.walletAddress &&
        walletAddress &&
        u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (existingConnected) {
      existingConnected.id = id;
      existingConnected.connected = true;
      existingConnected.disconnectedAt = null;
      logger.info('addOrReuseUser: reused connected user', { id, room, walletAddress });
      return { user: existingConnected, reused: true };
    }

    // Enforce capacity
    const usersInRoom = this.getUsersInRoom(room).filter((u) => u.connected);
    if (usersInRoom.length >= MAX_PLAYERS) {
      logger.warn('addOrReuseUser: room full', { room, usersInRoom: usersInRoom.length });
      return { error: 'Room full' };
    }

    const playerNumber = this.nextPlayerNumber(room);
    logger.info('addOrReuseUser: assigning playerNumber', { room, playerNumber });

    const user = {
      id,
      name: `Player ${playerNumber}`,
      playerNumber,
      room,
      walletAddress: walletAddress || null,
      connected: true,
      disconnectedAt: null,
    };
    this.users.set(id, user);
    logger.info('addOrReuseUser: created new user', { id, room, walletAddress, playerNumber });
    return { user, reused: false };
  }

  markDisconnected(id) {
    const user = this.users.get(id);
    if (!user) return null;
    user.connected = false;
    user.disconnectedAt = Date.now();
    return user;
  }

  removeUser(id) {
    const user = this.users.get(id);
    if (!user) return null;
    this.users.delete(id);
    return user;
  }

  cleanupDisconnected() {
    const now = Date.now();
    for (const [id, user] of this.users.entries()) {
      if (!user.connected && user.disconnectedAt && now - user.disconnectedAt > RECONNECTION_GRACE_MS) {
        this.users.delete(id);
      }
    }
  }

  reconnectUser({ room, walletAddress, newId }) {
    const candidates = this.getUsersInRoom(room).filter((u) => !u.connected);

    let match = null;
    if (walletAddress) {
      match = candidates.find(
        (u) =>
          u.walletAddress &&
          u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
    }
    if (!match) {
      match = candidates[0];
    }

    if (!match) return null;

    // Reassign id and mark connected
    this.users.delete(match.id);
    match.id = newId;
    match.connected = true;
    match.disconnectedAt = null;
    this.users.set(newId, match);
    return match;
  }
}

module.exports = new UserManager();
