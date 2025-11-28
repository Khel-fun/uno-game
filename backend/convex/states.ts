// Game States - Immutable state snapshots
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Insert state snapshot after move
export const insert = mutation({
  args: {
    gameId: v.id("games"),
    turnNumber: v.number(),
    stateHash: v.string(),
    currentPlayerIndex: v.number(),
    directionClockwise: v.boolean(),
    deckHash: v.optional(v.string()),
    currentColor: v.optional(v.string()),
    currentValue: v.optional(v.string()),
    lastPlayedCardHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("gameStates", {
      gameId: args.gameId,
      turnNumber: args.turnNumber,
      stateHash: args.stateHash,
      currentPlayerIndex: args.currentPlayerIndex,
      directionClockwise: args.directionClockwise,
      deckHash: args.deckHash,
      currentColor: args.currentColor,
      currentValue: args.currentValue,
      lastPlayedCardHash: args.lastPlayedCardHash,
      createdAt: Date.now(),
    });
  },
});

// Get latest state for a game
export const latestByGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gameStates")
      .withIndex("by_game_turn", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .first();
  },
});

// Get state at specific turn
export const atTurn = query({
  args: {
    gameId: v.id("games"),
    turnNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const states = await ctx.db
      .query("gameStates")
      .withIndex("by_game_turn", (q) => q.eq("gameId", args.gameId))
      .collect();

    return states.find((s) => s.turnNumber === args.turnNumber);
  },
});

// Get all states for a game
export const allForGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gameStates")
      .withIndex("by_game_turn", (q) => q.eq("gameId", args.gameId))
      .order("asc")
      .collect();
  },
});
