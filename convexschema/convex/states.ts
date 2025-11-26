import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const latestByGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gameStates")
      .withIndex("by_game_createdAt", q => q.eq("gameId", args.gameId))
      .order("desc")
      .first();
  },
});

export const insert = mutation({
  args: {
    gameId: v.id("games"),
    stateHash: v.string(),
    currentPlayerIndex: v.number(),
    turnCount: v.number(),
    directionClockwise: v.boolean(),
    deckHash: v.optional(v.string()),
    discardPileHash: v.optional(v.string()),
    currentColor: v.optional(v.string()),
    currentValue: v.optional(v.string()),
    lastPlayedCardHash: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("gameStates", args);
  },
});
