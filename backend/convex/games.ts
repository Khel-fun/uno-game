// Games - Game header + current state
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create new game
export const create = mutation({
  args: {
    roomId: v.string(),
    players: v.array(v.string()), // Wallet addresses
    gameNumericId: v.optional(v.string()), // Optional blockchain game ID
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    let numericId: string;
    
    if (args.gameNumericId) {
      // Use provided blockchain game ID
      numericId = args.gameNumericId;
    } else {
      // Auto-generate ID (fallback for old code)
      const lastGame = await ctx.db
        .query("games")
        .withIndex("by_numericId")
        .order("desc")
        .first();
      numericId = lastGame ? (parseInt(lastGame.gameNumericId) + 1).toString() : "1";
    }

    return await ctx.db.insert("games", {
      roomId: args.roomId,
      gameNumericId: numericId,
      players: args.players,
      createdAt: now,
      status: "NotStarted",
      currentPlayerIndex: 0,
      turnCount: 0,
      playDirection: "clockwise", // initially
      lastActionTimestamp: now,
    });
  },
});

// Get game by numeric ID
export const byNumericId = query({
  args: { numericId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("games")
      .withIndex("by_numericId", (q) =>
        q.eq("gameNumericId", args.numericId.toString())
      )
      .first();
  },
});

// Get game by room ID
export const byRoomId = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("games")
      .withIndex("by_roomId", (q) => q.eq("roomId", args.roomId))
      .first();
  },
});

// Get game by Convex ID
export const byId = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.gameId);
  },
});

// Get games by status
export const byStatus = query({
  args: {
    status: v.union(
      v.literal("NotStarted"),
      v.literal("Started"),
      v.literal("Ended")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("games")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

// List all games
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("games").collect();
  },
});

// Get complete game state with player hands (for realtime subscriptions)
export const getGameState = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_roomId", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!game) return null;

    // Get all player hands
    const hands = await ctx.db
      .query("hands")
      .withIndex("by_game_player", (q) => q.eq("gameId", game._id))
      .collect();

    // Build player decks object
    const playerDecks: any = {
      player1Deck: [],
      player2Deck: [],
      player3Deck: [],
      player4Deck: [],
      player5Deck: [],
      player6Deck: [],
    };

    game.players.forEach((playerAddress, index) => {
      const hand = hands.find((h) => h.playerAddress === playerAddress);
      const deckKey = `player${index + 1}Deck`;
      playerDecks[deckKey] = hand ? hand.cardHashes : [];
    });

    return {
      ...game,
      ...playerDecks,
      turn: `Player ${(game.currentPlayerIndex || 0) + 1}`,
    };
  },
});


// Add player to game
export const addPlayer = mutation({
  args: { gameId: v.id("games"), playerAddress: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.players.includes(args.playerAddress)) return args.gameId;

    await ctx.db.patch(args.gameId, {
      players: [...game.players, args.playerAddress],
    });
    return args.gameId;
  },
});

// Start game
export const startGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "NotStarted") return false;

    await ctx.db.patch(args.gameId, {
      status: "Started",
      startedAt: Date.now(),
    });
    return true;
  },
});

// End game
export const endGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status === "Ended") return false;

    await ctx.db.patch(args.gameId, {
      status: "Ended",
      endedAt: Date.now(),
    });
    return true;
  },
});

// Update game state after move
export const updateState = mutation({
  args: {
    gameId: v.id("games"),
    currentPlayerIndex: v.optional(v.number()),
    turnCount: v.optional(v.number()),
    playDirection: v.union(
      v.literal("clockwise"),
      v.literal("counterclockwise")
    ),
    currentColor: v.optional(v.string()),
    currentNumber: v.optional(v.string()),
    lastPlayedCardHash: v.optional(v.string()),
    deckHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { gameId, ...updates } = args;
    const game = await ctx.db.get(gameId);
    if (!game) return false;

    await ctx.db.patch(gameId, {
      ...updates,
      lastActionTimestamp: Date.now(),
    });
    return true;
  },
});
