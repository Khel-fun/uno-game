/**
 * =============================================================================
 * CONVEX SCHEMA FOR UNO GAME
 * =============================================================================
 *
 * This schema implements a clean, event-sourced architecture with immutable
 * game history and mutable live state.
 *
 * Architecture Overview:
 * ----------------------
 * 1. games       → Immutable game header (metadata + current state)
 * 2. moves       → Immutable event ledger (audit trail)
 * 3. gameStates  → Immutable state snapshots (replay cache)
 * 4. hands       → Mutable live player hands (deleted after game)
 * 5. cardMappings → Hash-to-card decoder (security)
 * 6. players     → Player profiles + connection state
 *
 * Key Design Decisions:
 * ---------------------
 * ✅ Flat relational structure (no nesting)
 * ✅ Fetch on demand (only load what you need)
 * ✅ Seat position = array index in games.players
 * ✅ Sessions merged into players table
 * ✅ Player hands stored separately for security
 * ✅ Immutable event log for replay/audit
 *
 * Data Flow Example:
 * ------------------
 * When Alice plays a Red 5:
 * 1. Log move to `moves` table (immutable)
 * 2. Update Alice's hand in `hands` table (remove card)
 * 3. Save snapshot to `gameStates` table (immutable)
 * 4. Update game header in `games` table (current state)
 * 5. Convex auto-syncs to all subscribed clients!
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    walletAddress: v.string(), // Ethereum address (0x...)
    displayName: v.optional(v.string()), // Player's chosen name
    currentGameId: v.optional(v.id("games")), // Currently playing game
    socketId: v.optional(v.string()), // Current Socket.IO connection
    connected: v.boolean(), // Is player online?
    lastSeen: v.number(), // Unix timestamp of last activity
    gamesPlayed: v.optional(v.number()), // Total games played
    gamesWon: v.optional(v.number()), // Total games won
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_socketId", ["socketId"])
    .index("by_currentGame", ["currentGameId"]),

  games: defineTable({
    // Immutable metadata
    roomId: v.string(), // Socket.IO room identifier
    gameNumericId: v.string(), // Human-readable game ID
    players: v.array(v.string()), // Player addresses (index = seat)
    createdAt: v.number(), // Unix timestamp of creation
    startedAt: v.optional(v.number()), // When game started
    endedAt: v.optional(v.number()), // When game ended

    // Game status
    status: v.union(
      v.literal("NotStarted"), // Waiting for players
      v.literal("Started"), // Game in progress
      v.literal("Ended") // Game finished
    ),

    // Current game state (updated after each move)
    currentPlayerIndex: v.number(), // Whose turn (index into players)
    turnCount: v.number(), // Number of turns played
    directionClockwise: v.boolean(), // Game direction
    currentColor: v.optional(v.string()), // Active color
    currentValue: v.optional(v.string()), // Active value
    lastPlayedCardHash: v.optional(v.string()), // Last card played
    deckHash: v.optional(v.string()), // Remaining deck hash
    lastActionTimestamp: v.number(), // Last move timestamp
  })
    .index("by_roomId", ["roomId"])
    .index("by_numericId", ["gameNumericId"])
    .index("by_status", ["status"]),

  moves: defineTable({
    gameId: v.id("games"), // Which game
    turnNumber: v.number(), // Turn when action occurred
    playerAddress: v.string(), // Who performed the action
    actionType: v.string(), // "playCard" | "drawCard" | "skip"
    cardHash: v.optional(v.string()), // Card involved (if any)
    timestamp: v.number(), // Unix timestamp
  }).index("by_game_turn", ["gameId", "turnNumber"]),

  gameStates: defineTable({
    gameId: v.id("games"), // Which game
    turnNumber: v.number(), // Turn number
    stateHash: v.string(), // Hash of entire state
    currentPlayerIndex: v.number(), // Whose turn
    directionClockwise: v.boolean(), // Game direction
    currentColor: v.optional(v.string()), // Active color
    currentValue: v.optional(v.string()), // Active value
    lastPlayedCardHash: v.optional(v.string()), // Last card
    deckHash: v.optional(v.string()), // Deck state
    createdAt: v.number(), // Unix timestamp
  })
    .index("by_game_turn", ["gameId", "turnNumber"])
    .index("by_stateHash", ["stateHash"]),

  hands: defineTable({
    gameId: v.id("games"), // Which game
    playerAddress: v.string(), // Which player
    cardHashes: v.array(v.string()), // Array of card hashes
    updatedAt: v.number(), // Last modification timestamp
  }).index("by_game_player", ["gameId", "playerAddress"]),

  cardMappings: defineTable({
    gameId: v.id("games"), // Which game
    cardHash: v.string(), // Cryptographic hash
    color: v.string(), // "red" | "blue" | "green" | "yellow" | "wild"
    value: v.string(), // "0"-"9" | "skip" | "reverse" | "draw2" | "wild" | "draw4"
  })
    .index("by_game", ["gameId"])
    .index("by_game_hash", ["gameId", "cardHash"]),
});
// ===========================================================================
// 1. PLAYERS - User Profiles + Connection State
// ===========================================================================
/**
 * Stores player profiles and connection status.
 *
 * Features:
 * - Persistent player identity (by wallet address)
 * - Current game tracking
 * - Connection state (for reconnection)
 * - Game statistics
 *
 * Indexes:
 * - by_wallet: Look up player by Ethereum address
 * - by_socketId: Find player by current socket connection
 * - by_currentGame: Get all players in a game
 */
// ===========================================================================
// 2. GAMES - Immutable Game Header + Current State
// ===========================================================================
/**
 * The "birth certificate" of each game.
 *
 * What's immutable:
 * - roomId, gameNumericId, players array, createdAt
 *
 * What changes:
 * - status (NotStarted → Started → Ended)
 * - Current game state fields (updated after each move)
 * - endedAt (when game finishes)
 *
 * Indexes:
 * - by_roomId: Look up game by Socket.IO room
 * - by_numericId: Look up by human-readable ID
 * - by_status: List all active/waiting/ended games
 */
// ===========================================================================
// 3. MOVES - Immutable Event Ledger
// ===========================================================================
/**
 * The "blockchain" of game events.
 *
 * Purpose:
 * - Audit trail (can prove what happened)
 * - Replay capability (reconstruct any turn)
 * - Analytics (track player behavior)
 *
 * Characteristics:
 * - Append-only (never modified)
 * - Ordered by turnNumber
 * - One entry per player action
 *
 * Indexes:
 * - by_game_turn: Get moves chronologically
 */
// ===========================================================================
// 4. GAME STATES - Immutable State Snapshots
// ===========================================================================
/**
 * The "save file" at each turn.
 *
 * Purpose:
 * - Fast access to any historical state
 * - Replay without recomputing from moves
 * - Debug/verification
 *
 * Characteristics:
 * - Immutable (one snapshot per turn)
 * - Created AFTER each move
 * - Can be reconstructed from moves if deleted
 *
 * Security Note:
 * - Does NOT include player hands (would leak info)
 * - Hands stored separately in `hands` table
 *
 * Indexes:
 * - by_game_turn: Get state at specific turn
 * - by_stateHash: Verify state integrity
 */

// ===========================================================================
// 5. HANDS - Mutable Live Player Hands
// ===========================================================================
/**
 * The "current reality" of player hands.
 *
 * Purpose:
 * - Track what cards each player currently has
 * - Validate card plays
 * - Enable reconnection (restore hand after refresh)
 *
 * Characteristics:
 * - MUTABLE (updated every turn)
 * - Private (only player can see their own hand)
 * - Deleted when game ends (not historical)
 *
 * Security:
 * - Cards stored as hashes (not visible to other players)
 * - Server validates plays using cardMappings
 *
 * Indexes:
 * - by_game_player: Get specific player's hand
 */

// ===========================================================================
// 6. CARD MAPPINGS - Hash-to-Card Decoder
// ===========================================================================
/**
 * The "secret decoder ring" for card hashes.
 *
 * Purpose:
 * - Translate hashes to actual cards
 * - Server-side validation of card plays
 * - Prevent cheating (client never sees other players' cards)
 *
 * Security Model:
 * - Client receives: "hash_abc123" (meaningless)
 * - Server knows: hash_abc123 = Red 5
 * - Client only learns card when they draw it
 *
 * Lifecycle:
 * - Created when game starts (shuffle deck)
 * - Never modified
 * - Can be deleted when game ends (optional cleanup)
 *
 * Indexes:
 * - by_game: Get all mappings for a game
 * - by_game_hash: Decode specific card
 */
