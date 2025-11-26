import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    currentGameId: v.optional(v.id("games")),
    seatIndex: v.optional(v.number()),
    connected: v.boolean(),
    lastSeen: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_wallet", q => q.eq("walletAddress", args.walletAddress))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        currentGameId: args.currentGameId,
        seatIndex: args.seatIndex,
        connected: args.connected,
        lastSeen: args.lastSeen,
      });
      return existing._id;
    }
    return await ctx.db.insert("players", {
      walletAddress: args.walletAddress,
      displayName: args.displayName,
      currentGameId: args.currentGameId,
      seatIndex: args.seatIndex,
      connected: args.connected,
      lastSeen: args.lastSeen,
    });
  },
});

export const byWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_wallet", q => q.eq("walletAddress", args.walletAddress))
      .first();
  },
});
