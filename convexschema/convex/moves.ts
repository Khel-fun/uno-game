import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    gameId: v.id("games"),
    playerAddress: v.string(),
    actionType: v.string(),
    cardHash: v.optional(v.string()),
    resultingStateHash: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("moves", args);
  },
});

export const byGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("moves")
      .withIndex("by_game_createdAt", q => q.eq("gameId", args.gameId))
      .collect();
  },
});
