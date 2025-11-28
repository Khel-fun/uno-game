/**
 * =============================================================================
 * UNO GAME TYPE DEFINITIONS
 * =============================================================================
 *
 * This file defines all TypeScript types used in the UNO game backend.
 * The game uses cryptographic hashing to hide card information from clients,
 * preventing cheating while maintaining game functionality.
 *
 * Key Concepts:
 * - Cards are hashed on the server to prevent clients from seeing hidden cards
 * - Player addresses are Ethereum-style wallet addresses (0x...)
 * - Game state is persisted to JSON files for crash recovery
 * - All timestamps are Unix timestamps in milliseconds
 */

// =============================================================================
// CARD TYPES
// =============================================================================

/**
 * Represents a single UNO card with its visible properties.
 *
 * @property color - The card's color: "red", "blue", "green", "yellow", or "wild"
 * @property value - The card's value: numbers (0-9) or special cards (skip, reverse, draw2, wild, draw4)
 *
 * @example
 * { color: "red", value: "5" }        // Red 5
 * { color: "blue", value: "skip" }    // Blue Skip
 * { color: "wild", value: "draw4" }   // Wild Draw Four
 */
export interface Card {
  color: string;
  value: string;
}

/**
 * A lookup table mapping cryptographic hashes to actual card objects.
 *
 * This is the "secret decoder ring" that translates hashed card references
 * into actual card information. Only the server knows these mappings.
 *
 * @property [hash: string] - Cryptographic hash as key, Card object as value
 *
 * @example
 * {
 *   "hash1": { color: "red", value: "5" },
 *   "hash2": { color: "blue", value: "7" },
 *   "hash3": { color: "green", value: "skip" }
 * }
 *
 * Why hashes?
 * - Prevents clients from seeing cards in the deck or other players' hands
 * - Clients receive "hash1" but don't know it's a Red 5 until they draw it
 * - Server-side validation ensures no cheating
 */
export interface CardHashMap {
  [hash: string]: Card;
}

// =============================================================================
// PLAYER HAND TYPES
// =============================================================================

/**
 * Maps each player to their hand of cards (represented as hashes).
 *
 * @property [playerAddress: string] - Ethereum wallet address (0x...) as key,
 *                                     array of card hashes as value
 *
 * @example
 * {
 *   "0x1234567890abcdef1234567890abcdef12345678": ["hash1", "hash2", "hash3"],
 *   "0xabcdef1234567890abcdef1234567890abcdef12": ["hash4", "hash5"]
 * }
 *
 * Player 1 has 3 cards, Player 2 has 2 cards.
 * The actual cards are looked up in CardHashMap.
 */
export interface PlayerHands {
  [playerAddress: string]: string[];
}

/**
 * Maps each player to a hash representing their entire hand.
 *
 * This allows cryptographic verification that a player's hand hasn't been
 * tampered with, without revealing what cards they have.
 *
 * @property [playerAddress: string] - Ethereum wallet address as key,
 *                                     cryptographic hash of entire hand as value
 *
 * Note: Currently appears to be unused in the implementation (empty object {})
 */
export interface PlayerHandsHash {
  [playerAddress: string]: string;
}

// =============================================================================
// GAME STATE TYPE - THE CORE GAME OBJECT
// =============================================================================

/**
 * The complete state of an active UNO game.
 *
 * This is the main data structure that represents everything about a game
 * at any given moment. It's saved to persistent storage and can be used to
 * recover games after server restarts.
 *
 * @property id - Unique identifier for this game (matches gameId)
 * @property players - Array of player Ethereum addresses participating in the game
 * @property isActive - Whether the game is currently in progress
 * @property isStarted - Whether the game has been started (vs waiting in lobby)
 * @property currentPlayerIndex - Index into players array indicating whose turn it is (0-based)
 * @property turnCount - String representation of how many turns have been played
 * @property directionClockwise - Game direction: true = clockwise, false = counter-clockwise
 *                                (affected by Reverse cards)
 * @property playerHandsHash - Hash of each player's hand for verification (currently unused)
 * @property playerHands - The actual cards in each player's hand (as hashes)
 * @property deckHash - Cryptographic hash representing the remaining draw pile
 * @property discardPileHash - Cryptographic hash representing the discard pile
 * @property currentColor - The active color (important when Wild cards are played)
 * @property currentValue - The active value (what cards can be played on top of)
 * @property lastPlayedCardHash - Hash of the most recently played card
 * @property stateHash - Hash of the entire game state for verification/integrity
 * @property lastActionTimestamp - Unix timestamp (ms) of the last game action
 *
 * @example
 * {
 *   id: "123",
 *   players: ["0x1234...", "0xabcd..."],
 *   isActive: true,
 *   isStarted: true,
 *   currentPlayerIndex: 0,        // First player's turn
 *   turnCount: "5",                // 5 turns have been played
 *   directionClockwise: true,      // Going clockwise
 *   playerHands: {
 *     "0x1234...": ["hash1", "hash2"],
 *     "0xabcd...": ["hash3", "hash4", "hash5"]
 *   },
 *   currentColor: "red",           // Current color is red
 *   currentValue: "5",             // Last played was a 5
 *   ...
 * }
 */
export interface GameState {
  id: string;
  players: string[];
  isActive: boolean;
  currentPlayerIndex: number;
  lastActionTimestamp: number;
  turnCount: string;
  directionClockwise: boolean;
  playerHandsHash: PlayerHandsHash;
  playerHands: PlayerHands;
  deckHash: string;
  discardPileHash: string;
  currentColor: string;
  currentValue: string;
  lastPlayedCardHash: string;
  stateHash: string;
  isStarted: boolean;
}

// =============================================================================
// GAME METADATA TYPE
// =============================================================================

/**
 * Lightweight summary information about a game.
 *
 * This is a subset of GameState containing only the essential information
 * needed for listing games, checking activity, etc. without loading the
 * full game state.
 *
 * @property players - Array of player addresses in this game
 * @property startTime - Unix timestamp (ms) when the game started
 * @property lastActivity - Unix timestamp (ms) of last action (used for cleanup)
 * @property roomId - Socket.IO room identifier for this game
 * @property isStarted - Whether the game has begun (vs lobby/waiting)
 * @property turnCount - String representation of turns played
 *
 * @example
 * {
 *   players: ["0x1234...", "0xabcd..."],
 *   startTime: 1700550000000,
 *   lastActivity: 1700550420000,
 *   roomId: "game-123",
 *   isStarted: true,
 *   turnCount: "5"
 * }
 */
export interface GameMetadata {
  players: string[];
  startTime: number;
  lastActivity: number;
  roomId: string;
  isStarted: boolean;
  turnCount: string;
}

// =============================================================================
// COMPLETE GAME TYPE
// =============================================================================

/**
 * A complete game record including state, card mappings, and metadata.
 *
 * This is the structure that gets saved to game-states.json for persistence.
 * It contains everything needed to fully restore a game after server restart.
 *
 * @property roomId - Socket.IO room identifier (matches metadata.roomId)
 * @property gameId - Unique game identifier (matches state.id)
 * @property state - The complete game state (see GameState)
 * @property cardHashMap - The hash-to-card lookup table for this game
 * @property lastUpdated - Unix timestamp (ms) when this game was last modified
 * @property metadata - Summary information about the game
 *
 * @example
 * {
 *   roomId: "game-123",
 *   gameId: "123",
 *   state: { ... },              // Full GameState object
 *   cardHashMap: { ... },        // All card hash mappings
 *   lastUpdated: 1700550420000,
 *   metadata: { ... }            // Game summary info
 * }
 */
export interface Game {
  roomId: string;
  gameId: string;
  state: GameState;
  cardHashMap: CardHashMap;
  lastUpdated: number;
  metadata: GameMetadata;
}

// =============================================================================
// PERSISTENT STORAGE FILE TYPE
// =============================================================================

/**
 * The structure of the game-states.json file.
 *
 * This file provides crash recovery by periodically saving game states to disk.
 * Only the 10 most recent games are kept to prevent unlimited file growth.
 *
 * @property lastSaved - ISO 8601 timestamp of when this file was last written
 * @property totalGames - Number of games currently stored in the file
 * @property games - Array of complete Game objects (max 10)
 *
 * @example
 * {
 *   lastSaved: "2025-11-23T15:44:37.933Z",
 *   totalGames: 2,
 *   games: [
 *     { roomId: "game-123", gameId: "123", ... },
 *     { roomId: "game-456", gameId: "456", ... }
 *   ]
 * }
 *
 * File Operations:
 * - Loaded on server startup to restore games
 * - Saved every 30 seconds automatically
 * - Saved on server shutdown (SIGINT/SIGTERM)
 * - Old games (>1 hour inactive) are automatically removed
 */
export interface GameStatesFile {
  lastSaved: string;
  totalGames: number;
  games: Game[];
}

// =============================================================================
// LOGGING TYPES
// =============================================================================

/**
 * Represents a single game action in the log.
 *
 * Used for debugging, analytics, and game replay functionality.
 *
 * @property timestamp - ISO 8601 timestamp of when the action occurred
 * @property gameId - Which game this action belongs to
 * @property turnNumber - The turn number when this action occurred
 * @property player - Ethereum address of the player who performed the action
 * @property action - Type of action performed (see PlayerAction type)
 * @property cardHash - (Optional) Hash of the card involved in the action
 * @property cardDetails - (Optional) Human-readable card description for logs
 * @property currentColor - (Optional) The game's current color after this action
 * @property currentValue - (Optional) The game's current value after this action
 * @property nextPlayer - (Optional) Ethereum address of the next player
 *
 * @example
 * {
 *   timestamp: "2025-11-23T15:44:37.933Z",
 *   gameId: "123",
 *   turnNumber: 5,
 *   player: "0x1234...",
 *   action: "playCard",
 *   cardHash: "hash1",
 *   cardDetails: "Red 5",
 *   currentColor: "red",
 *   currentValue: "5",
 *   nextPlayer: "0xabcd..."
 * }
 */
export interface LogEntry {
  timestamp: string;
  gameId: string;
  turnNumber: number;
  player: string;
  action: string;
  cardHash?: string;
  cardDetails?: string;
  currentColor?: string;
  currentValue?: string;
  nextPlayer?: string;
}

// =============================================================================
// PLAYER ACTION TYPES
// =============================================================================

/**
 * All possible player actions in the game.
 *
 * Used for logging, validation, and event handling.
 */
export type PlayerAction =
  | "playCard" // Player plays a card from their hand
  | "drawCard" // Player draws a card from the deck
  | "startGame" // Player initiates game start
  | "joinGame" // Player joins a game lobby
  | "leaveGame"; // Player leaves the game

// =============================================================================
// CARD ENUMERATION TYPES
// =============================================================================

/**
 * Valid UNO card colors.
 *
 * Note: "wild" is used for Wild and Wild Draw Four cards which have no color
 * until played, at which point the player chooses a color.
 */
export type CardColor = "red" | "blue" | "green" | "yellow" | "wild";

/**
 * Valid UNO card values.
 *
 * Standard UNO deck includes:
 * - Number cards: 0-9 in each color
 * - Action cards: skip, reverse, draw2 in each color
 * - Wild cards: wild, draw4 (no color)
 */
export type CardValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip" // Skip next player's turn
  | "reverse" // Reverse play direction
  | "draw2" // Next player draws 2 cards and loses turn
  | "wild" // Wild card - player chooses color
  | "draw4"; // Wild Draw Four - next player draws 4 and loses turn

/**
 * Compact notation used to represent cards in the deck definition.
 *
 * This notation is used in packOfCards.ts to define the initial deck composition.
 * Each card is represented by a short string combining value and color.
 *
 * Format: {value}{color}
 * - Numbers: "5R" = Red 5, "7B" = Blue 7
 * - Skip: "skipG" = Green Skip
 * - Reverse: "_R" = Red Reverse (underscore represents reverse arrow)
 * - Draw Two: "D2B" = Blue Draw Two
 * - Wild: "W" = Wild (no color)
 * - Wild Draw Four: "D4W" = Wild Draw Four
 *
 * Color Codes:
 * - R = Red
 * - G = Green
 * - B = Blue
 * - Y = Yellow
 * - W = Wild (no specific color)
 *
 * @example
 * const deck: PackOfCards = ["0R", "1R", "2R", "skipB", "W", "D4W"];
 */
export type CardNotation =
  // Red cards (R)
  | "0R" // Red 0
  | "1R" // Red 1
  | "2R" // Red 2
  | "3R" // Red 3
  | "4R" // Red 4
  | "5R" // Red 5
  | "6R" // Red 6
  | "7R" // Red 7
  | "8R" // Red 8
  | "9R" // Red 9
  | "skipR" // Red Skip
  | "_R" // Red Reverse
  | "D2R" // Red Draw Two
  // Green cards (G)
  | "0G" // Green 0
  | "1G" // Green 1
  | "2G" // Green 2
  | "3G" // Green 3
  | "4G" // Green 4
  | "5G" // Green 5
  | "6G" // Green 6
  | "7G" // Green 7
  | "8G" // Green 8
  | "9G" // Green 9
  | "skipG" // Green Skip
  | "_G" // Green Reverse
  | "D2G" // Green Draw Two
  // Blue cards (B)
  | "0B" // Blue 0
  | "1B" // Blue 1
  | "2B" // Blue 2
  | "3B" // Blue 3
  | "4B" // Blue 4
  | "5B" // Blue 5
  | "6B" // Blue 6
  | "7B" // Blue 7
  | "8B" // Blue 8
  | "9B" // Blue 9
  | "skipB" // Blue Skip
  | "_B" // Blue Reverse
  | "D2B" // Blue Draw Two
  // Yellow cards (Y)
  | "0Y" // Yellow 0
  | "1Y" // Yellow 1
  | "2Y" // Yellow 2
  | "3Y" // Yellow 3
  | "4Y" // Yellow 4
  | "5Y" // Yellow 5
  | "6Y" // Yellow 6
  | "7Y" // Yellow 7
  | "8Y" // Yellow 8
  | "9Y" // Yellow 9
  | "skipY" // Yellow Skip
  | "_Y" // Yellow Reverse
  | "D2Y" // Yellow Draw Two
  // Wild cards (W)
  | "W" // Wild (player chooses color)
  | "D4W"; // Wild Draw Four

/**
 * Represents the complete UNO deck as an array of card notations.
 *
 * A standard UNO deck contains 108 cards:
 * - 76 Number cards (0-9 in each color, with 0 appearing once and 1-9 appearing twice)
 * - 24 Action cards (Skip, Reverse, Draw Two in each color, each appearing twice)
 * - 4 Wild cards
 * - 4 Wild Draw Four cards
 */
export type PackOfCards = CardNotation[];
