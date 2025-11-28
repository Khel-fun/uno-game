// Moves - Immutable event ledger
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Record a player action
export const record = mutation({
  args: {
    gameId: v.id("games"),
    turnNumber: v.number(),
    playerAddress: v.string(),
    actionType: v.string(),
    cardHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("moves", {
      gameId: args.gameId,
      turnNumber: args.turnNumber,
      playerAddress: args.playerAddress,
      actionType: args.actionType,
      cardHash: args.cardHash,
      timestamp: Date.now(),
    });
  },
});

// Get all moves for a game (chronological order)
export const byGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("moves")
      .withIndex("by_game_turn", (q) => q.eq("gameId", args.gameId))
      .order("asc")
      .collect();
  },
});

// Get latest N moves for a game
export const latest = query({
  args: {
    gameId: v.id("games"),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const allMoves = await ctx.db
      .query("moves")
      .withIndex("by_game_turn", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .take(args.count);

    return allMoves.reverse();
  },
});
