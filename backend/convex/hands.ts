// Hands - Mutable live player hands
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Set/update player hand (upsert)
export const set = mutation({
  args: {
    gameId: v.id("games"),
    playerAddress: v.string(),
    cardHashes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("hands")
      .withIndex("by_game_player", (q) =>
        q.eq("gameId", args.gameId).eq("playerAddress", args.playerAddress)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        cardHashes: args.cardHashes,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("hands", {
      gameId: args.gameId,
      playerAddress: args.playerAddress,
      cardHashes: args.cardHashes,
      updatedAt: now,
    });
  },
});

// Get player's hand
export const byPlayer = query({
  args: { gameId: v.id("games"), playerAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hands")
      .withIndex("by_game_player", (q) =>
        q.eq("gameId", args.gameId).eq("playerAddress", args.playerAddress)
      )
      .first();
  },
});

// Get all hands for game (server-side only!)
export const allForGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hands")
      .withIndex("by_game_player", (q) => q.eq("gameId", args.gameId))
      .collect();
  },
});

// Add card to hand
export const addCard = mutation({
  args: {
    gameId: v.id("games"),
    playerAddress: v.string(),
    cardHash: v.string(),
  },
  handler: async (ctx, args) => {
    const hand = await ctx.db
      .query("hands")
      .withIndex("by_game_player", (q) =>
        q.eq("gameId", args.gameId).eq("playerAddress", args.playerAddress)
      )
      .first();

    if (!hand) return false;

    await ctx.db.patch(hand._id, {
      cardHashes: [...hand.cardHashes, args.cardHash],
      updatedAt: Date.now(),
    });
    return true;
  },
});

// Remove card from hand
export const removeCard = mutation({
  args: {
    gameId: v.id("games"),
    playerAddress: v.string(),
    cardHash: v.string(),
  },
  handler: async (ctx, args) => {
    const hand = await ctx.db
      .query("hands")
      .withIndex("by_game_player", (q) =>
        q.eq("gameId", args.gameId).eq("playerAddress", args.playerAddress)
      )
      .first();

    if (!hand) return false;

    await ctx.db.patch(hand._id, {
      cardHashes: hand.cardHashes.filter((h) => h !== args.cardHash),
      updatedAt: Date.now(),
    });
    return true;
  },
});

// Delete all hands for game (cleanup)
export const deleteAllForGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const hands = await ctx.db
      .query("hands")
      .withIndex("by_game_player", (q) => q.eq("gameId", args.gameId))
      .collect();

    await Promise.all(hands.map((h) => ctx.db.delete(h._id)));
    return hands.length;
  },
});
