import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const set = mutation({
  args: {
    gameId: v.id("games"),
    playerAddress: v.string(),
    cardHashes: v.array(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("hands")
      .withIndex("by_game_player", q => q.eq("gameId", args.gameId).eq("playerAddress", args.playerAddress))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        cardHashes: args.cardHashes,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("hands", args);
  },
});

export const byPlayer = query({
  args: { gameId: v.id("games"), playerAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hands")
      .withIndex("by_game_player", q => q.eq("gameId", args.gameId).eq("playerAddress", args.playerAddress))
      .first();
  },
});
