// Card Mappings - Hash to card decoder for security
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Insert all card mappings when game starts
export const bulkInsert = mutation({
  args: {
    gameId: v.id("games"),
    mappings: v.array(
      v.object({
        cardHash: v.string(),
        color: v.string(),
        value: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const promises = args.mappings.map((mapping) =>
      ctx.db.insert("cardMappings", {
        gameId: args.gameId,
        cardHash: mapping.cardHash,
        color: mapping.color,
        value: mapping.value,
      })
    );
    await Promise.all(promises);
    return { count: promises.length };
  },
});

// Decode a card hash to actual card
export const getByHash = query({
  args: {
    gameId: v.id("games"),
    cardHash: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cardMappings")
      .withIndex("by_game_hash", (q) =>
        q.eq("gameId", args.gameId).eq("cardHash", args.cardHash)
      )
      .first();
  },
});

// Get all card mappings for a game (for replay/debug)
export const getAllForGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cardMappings")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
  },
});

// Delete all card mappings for a game (cleanup)
export const deleteAllForGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const mappings = await ctx.db
      .query("cardMappings")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    await Promise.all(mappings.map((m) => ctx.db.delete(m._id)));
    return { deletedCount: mappings.length };
  },
});
