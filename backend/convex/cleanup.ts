import { mutation } from "./_generated/server";

// Delete all games (use with caution!)
export const deleteAllGames = mutation({
  args: {},
  handler: async (ctx) => {
    const games = await ctx.db.query("games").collect();
    
    for (const game of games) {
      await ctx.db.delete(game._id);
    }
    
    return { deleted: games.length };
  },
});

// Delete games with old gameNumericId field
export const deleteGamesWithNumericId = mutation({
  args: {},
  handler: async (ctx) => {
    const games = await ctx.db.query("games").collect();
    
    let deleted = 0;
    for (const game of games) {
      // @ts-ignore
      if (game.gameNumericId !== undefined) {
        await ctx.db.delete(game._id);
        deleted++;
      }
    }
    
    return { deleted };
  },
});

// Delete all gamePlayers records
export const deleteAllGamePlayers = mutation({
  args: {},
  handler: async (ctx) => {
    const gamePlayers = await ctx.db.query("gamePlayers").collect();
    
    for (const gp of gamePlayers) {
      await ctx.db.delete(gp._id);
    }
    
    return { deleted: gamePlayers.length };
  },
});
