// Players - User profiles + connection state
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create or update player (upsert)
export const upsert = mutation({
  args: {
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    currentGameId: v.optional(v.id("games")),
    socketId: v.optional(v.string()),
    connected: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        currentGameId: args.currentGameId,
        socketId: args.socketId,
        connected: args.connected,
        lastSeen: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("players", {
      walletAddress: args.walletAddress,
      displayName: args.displayName,
      currentGameId: args.currentGameId,
      socketId: args.socketId,
      connected: args.connected,
      lastSeen: now,
    });
  },
});

// Get player by wallet address
export const byWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();
  },
});

// Get player by socket ID
export const bySocketId = query({
  args: { socketId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_socketId", (q) => q.eq("socketId", args.socketId))
      .first();
  },
});

// Get all players in a game
export const inGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_currentGame", (q) => q.eq("currentGameId", args.gameId))
      .collect();
  },
});

// Update connection status
export const setConnected = mutation({
  args: {
    walletAddress: v.string(),
    connected: v.boolean(),
    socketId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) return false;

    await ctx.db.patch(player._id, {
      connected: args.connected,
      socketId: args.socketId,
      lastSeen: Date.now(),
    });

    return true;
  },
});

// Update game stats
export const updateStats = mutation({
  args: {
    walletAddress: v.string(),
    won: v.boolean(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) return false;

    await ctx.db.patch(player._id, {
      gamesPlayed: (player.gamesPlayed || 0) + 1,
      gamesWon: (player.gamesWon || 0) + (args.won ? 1 : 0),
    });

    return true;
  },
});

// Clear current game for player
export const leaveGame = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) return false;

    await ctx.db.patch(player._id, {
      currentGameId: undefined,
      lastSeen: Date.now(),
    });

    return true;
  },
});

// Join a game (replaces socket.emit("join"))
export const joinGame = mutation({
  args: {
    roomId: v.string(),
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find or create game (roomId IS the blockchain game ID)
    let game = await ctx.db
      .query("games")
      .withIndex("by_roomId", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!game) {
      // Create new game - use roomId as both roomId and gameNumericId
      // since roomId = blockchain game ID from the URL
      const gameId = await ctx.db.insert("games", {
        roomId: args.roomId,
        gameNumericId: args.roomId, // Use roomId (blockchain game ID) directly
        players: [],
        createdAt: Date.now(),
        status: "NotStarted",
        currentPlayerIndex: 0,
        turnCount: 0,
        playDirection: "clockwise",
        lastActionTimestamp: Date.now(),
      });
      game = await ctx.db.get(gameId);
    }

    if (!game) return null;

    // Upsert player
    await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first()
      .then(async (existing) => {
        if (existing) {
          await ctx.db.patch(existing._id, {
            currentGameId: game!._id,
            displayName: args.displayName || existing.displayName,
            connected: true,
            lastSeen: Date.now(),
          });
        } else {
          await ctx.db.insert("players", {
            walletAddress: args.walletAddress,
            displayName: args.displayName,
            currentGameId: game!._id,
            connected: true,
            lastSeen: Date.now(),
          });
        }
      });

    // Add player to game if not already in it
    if (!game.players.includes(args.walletAddress)) {
      await ctx.db.patch(game._id, {
        players: [...game.players, args.walletAddress],
      });
    }

    return {
      gameId: game._id,
      playerNumber: game.players.length,
    };
  },
});

// Get all players in a room (replaces socket.on("roomData"))
export const inRoom = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_roomId", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!game) return [];

    const players = await ctx.db
      .query("players")
      .withIndex("by_currentGame", (q) => q.eq("currentGameId", game._id))
      .collect();

    return players.map((p, index) => ({
      id: p._id,
      name: `Player ${index + 1}`,
      walletAddress: p.walletAddress,
      displayName: p.displayName,
      connected: p.connected,
      room: args.roomId,
    }));
  },
});
