import { internalMutation } from "../_generated/server";

// Migration to remove gameNumericId field from existing games
export const removeGameNumericIdField = internalMutation({
  args: {},
  handler: async (ctx) => {
    const games = await ctx.db.query("games").collect();
    
    let updated = 0;
    for (const game of games) {
      // @ts-ignore - accessing field that may not exist in type
      if (game.gameNumericId !== undefined) {
        // Patch to remove the field by setting all other fields
        const { gameNumericId, ...rest } = game as any;
        await ctx.db.replace(game._id, rest);
        updated++;
      }
    }
    
    console.log(`Migration complete: Updated ${updated} games`);
    return { success: true, updated };
  },
});
