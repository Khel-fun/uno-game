import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    roomId: v.string(),
    gameNumericId: v.string(),
    players: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const _id = await ctx.db.insert("games", {
      roomId: args.roomId,
      gameNumericId: args.gameNumericId,
      status: "notStarted",
      createdAt: now,
      players: args.players,
      currentPlayerIndex: 0,
      turnCount: 0,
      directionClockwise: true,
      lastActionTimestamp: now,
      isStarted: false,
    });
    return _id;
  },
});

export const byNumericId = query({
  args: { gameNumericId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("games")
      .withIndex("by_numericId", q => q.eq("gameNumericId", args.gameNumericId))
      .first();
  },
});

export const addPlayer = mutation({
  args: { gameId: v.id("games"), playerAddress: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;
    const players = [...game.players, args.playerAddress];
    await ctx.db.patch(args.gameId, { players });
    return args.gameId;
  },
});
