import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
    args: {
        playerAddress: v.string(),
        sessionId: v.string(),
        gameId: v.optional(v.id("games")),
        socketId: v.optional(v.string()),
        active: v.boolean(),
        lastSeen: v.number(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("sessions")
            .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, {
                playerAddress: args.playerAddress,
                gameId: args.gameId,
                socketId: args.socketId,
                active: args.active,
                lastSeen: args.lastSeen,
            });
            return existing._id;
        }
        return await ctx.db.insert("sessions", {
            playerAddress: args.playerAddress,
            sessionId: args.sessionId,
            gameId: args.gameId,
            socketId: args.socketId,
            active: args.active,
            lastSeen: args.lastSeen,
        });
    },
});

export const byPlayer = query({
    args: { playerAddress: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("sessions")
            .withIndex("by_player", q => q.eq("playerAddress", args.playerAddress))
            .collect();
    },
});