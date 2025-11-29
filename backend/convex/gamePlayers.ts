import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Add a player to a game
export const addPlayer = mutation({
  args: {
    gameId: v.id("games"),
    walletAddress: v.string(),
    seatIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if player already exists in this game
    const existing = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game_wallet", (q) =>
        q.eq("gameId", args.gameId).eq("walletAddress", args.walletAddress)
      )
      .first();

    if (existing) {
      // Reactivate if they were previously inactive
      await ctx.db.patch(existing._id, {
        isActive: true,
        leftAt: undefined,
      });
      return existing._id;
    }

    // Insert new game player record
    return await ctx.db.insert("gamePlayers", {
      gameId: args.gameId,
      walletAddress: args.walletAddress,
      seatIndex: args.seatIndex,
      joinedAt: now,
      isActive: true,
    });
  },
});

// Remove a player from a game
export const removePlayer = mutation({
  args: {
    gameId: v.id("games"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const gamePlayer = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game_wallet", (q) =>
        q.eq("gameId", args.gameId).eq("walletAddress", args.walletAddress)
      )
      .first();

    if (gamePlayer) {
      await ctx.db.patch(gamePlayer._id, {
        isActive: false,
        leftAt: Date.now(),
      });
      return true;
    }
    return false;
  },
});

// Get all players in a game
export const byGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Get all games for a player
export const byWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gamePlayers")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .collect();
  },
});

// Get active games for a player
export const activeGamesByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gamePlayers")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Check if a player is in a specific game
export const isPlayerInGame = query({
  args: {
    gameId: v.id("games"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const gamePlayer = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game_wallet", (q) =>
        q.eq("gameId", args.gameId).eq("walletAddress", args.walletAddress)
      )
      .first();

    return gamePlayer?.isActive ?? false;
  },
});
