/**
 * Convex Schema for UNO Game
 * ---------------------------------
 * This schema supports:
 *  - Persistent game metadata (games table)
 *  - Off-chain authoritative game state snapshots (gameStates table)
 *  - Player seat and profile info (players table)
 *  - Current hands per player (hands table)
 *  - Ordered immutable move log (moves table)
 *  - Connection/reconnection session tracking (sessions table)
 *
 * Reconnection Flow Backed by Schema:
 *  1. Client refreshes -> looks up prior session by walletAddress in `sessions`.
 *  2. Restore seat (players.seatIndex) and latest game state snapshot (gameStates latest where gameId).
 *  3. Restore hand from `hands` table.
 *  4. If needed recompute derived data (e.g., playable cards) client-side.
 *
 * Index Strategy (to be added in indexes.ts):
 *  - games: by gameNumericId (string), status
 *  - gameStates: by gameId, createdAt (for latest retrieval)
 *  - hands: by gameId+playerAddress
 *  - moves: by gameId+createdAt (chronological replay)
 *  - players: by walletAddress, currentGameId
 *  - sessions: by walletAddress, gameId, sessionId
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    currentGameId: v.optional(v.id("games")),
    seatIndex: v.optional(v.number()),
    connected: v.boolean(),
    lastSeen: v.number(),
    gamesPlayed: v.optional(v.number()),
    gamesWon: v.optional(v.number()),
  })
    .index("by_wallet", ["walletAddress"]) 
    .index("by_currentGame", ["currentGameId"]) ,

  games: defineTable({
    roomId: v.string(),
    gameNumericId: v.string(),
    status: v.string(),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    players: v.array(v.string()),
    currentPlayerIndex: v.number(),
    turnCount: v.number(),
    directionClockwise: v.boolean(),
    lastActionTimestamp: v.number(),
    currentColor: v.optional(v.string()),
    currentValue: v.optional(v.string()),
    lastPlayedCardHash: v.optional(v.string()),
    onChainGameHash: v.optional(v.string()),
    isStarted: v.boolean(),
  })
    .index("by_numericId", ["gameNumericId"]) 
    .index("by_status", ["status"]) ,

  moves: defineTable({
    gameId: v.id("games"),
    playerAddress: v.string(),
    actionType: v.string(),
    cardHash: v.optional(v.string()),
    resultingStateHash: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_game_createdAt", ["gameId", "createdAt"]) ,

  gameStates: defineTable({
    gameId: v.id("games"),
    stateHash: v.string(),
    currentPlayerIndex: v.number(),
    turnCount: v.number(),
    directionClockwise: v.boolean(),
    deckHash: v.optional(v.string()),
    discardPileHash: v.optional(v.string()),
    currentColor: v.optional(v.string()),
    currentValue: v.optional(v.string()),
    lastPlayedCardHash: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_game_createdAt", ["gameId", "createdAt"]) 
    .index("by_stateHash", ["stateHash"]) ,

  hands: defineTable({
    gameId: v.id("games"),
    playerAddress: v.string(),
    cardHashes: v.array(v.string()),
    updatedAt: v.number(),
  })
    .index("by_game_player", ["gameId", "playerAddress"]) ,

  sessions: defineTable({
    playerAddress: v.string(),
    sessionId: v.string(),
    gameId: v.optional(v.id("games")),
    socketId: v.optional(v.string()),
    lastSeen: v.number(),
    active: v.boolean(),
  })
    .index("by_player", ["playerAddress"]) 
    .index("by_game", ["gameId"]) 
    .index("by_sessionId", ["sessionId"]) ,
});