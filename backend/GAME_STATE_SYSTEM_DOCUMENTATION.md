# UNO Game State System Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Type Definitions](#type-definitions)
5. [Storage System](#storage-system)
6. [Security & Hashing](#security--hashing)
7. [Examples](#examples)
8. [Common Operations](#common-operations)

---

## Overview

The UNO game backend uses a **persistent game state management system** that stores game data both in memory (for performance) and on disk (for crash recovery). The system employs **cryptographic hashing** to prevent cheating by hiding card information from clients.

### Key Features

- **In-memory storage** for fast access during gameplay
- **Persistent file storage** for crash recovery
- **Automatic cleanup** of old/inactive games
- **Cryptographic hashing** to prevent client-side cheating
- **Blockchain integration** using Ethereum wallet addresses

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Client Layer                        │
│  (Players see only hashed card references, not actual   │
│   card values - prevents cheating)                      │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ Socket.IO Events
                            │
┌─────────────────────────────────────────────────────────┐
│                    Server Layer (index.js)               │
│  - Validates moves                                       │
│  - Manages Socket.IO connections                         │
│  - Calls gameStateManager to save/load state            │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│              Game State Manager (gameStateManager.ts)    │
│  - Manages in-memory game states (Map)                  │
│  - Manages card hash mappings (Map)                     │
│  - Handles persistence to/from JSON file                │
│  - Automatic cleanup of old games                       │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│              Persistent Storage (game-states.json)       │
│  - Contains up to 10 most recent games                  │
│  - Saved every 30 seconds automatically                 │
│  - Saved on server shutdown (SIGINT/SIGTERM)            │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Game Start Flow

```
1. Players join room via Socket.IO
   ↓
2. Game starts → Server creates GameState
   ↓
3. Server generates card hashes
   ↓
4. Server saves state → gameStateManager.saveGameState()
   ↓
5. State saved to memory (Map) + queued for file save
   ↓
6. Clients receive game state with hashed cards
```

### Player Move Flow

```
1. Client emits "playCard" with card hash
   ↓
2. Server validates move using CardHashMap
   ↓
3. Server updates GameState
   ↓
4. Server saves updated state → gameStateManager.saveGameState()
   ↓
5. Server broadcasts new state to all players
```

### Crash Recovery Flow

```
1. Server starts up
   ↓
2. gameStateManager.loadGameStatesFromFile()
   ↓
3. Reads game-states.json
   ↓
4. Restores games to in-memory Maps
   ↓
5. Players can reconnect and continue playing
```

---

## Type Definitions

### Core Types Hierarchy

```
GameStatesFile (the JSON file)
│
├── lastSaved: string
├── totalGames: number
└── games: Game[]
    │
    ├── Game (individual game record)
    │   ├── roomId: string
    │   ├── gameId: string
    │   ├── state: GameState ◄─── THE MAIN GAME OBJECT
    │   │   ├── id: string
    │   │   ├── players: string[]
    │   │   ├── isActive: boolean
    │   │   ├── isStarted: boolean
    │   │   ├── currentPlayerIndex: number
    │   │   ├── turnCount: string
    │   │   ├── directionClockwise: boolean
    │   │   ├── playerHands: PlayerHands
    │   │   │   └── [playerAddress]: string[] (card hashes)
    │   │   ├── playerHandsHash: PlayerHandsHash
    │   │   ├── deckHash: string
    │   │   ├── discardPileHash: string
    │   │   ├── currentColor: string
    │   │   ├── currentValue: string
    │   │   ├── lastPlayedCardHash: string
    │   │   ├── stateHash: string
    │   │   └── lastActionTimestamp: number
    │   │
    │   ├── cardHashMap: CardHashMap ◄─── THE DECODER RING
    │   │   └── [hash]: Card
    │   │       ├── color: string
    │   │       └── value: string
    │   │
    │   ├── lastUpdated: number
    │   └── metadata: GameMetadata
    │       ├── players: string[]
    │       ├── startTime: number
    │       ├── lastActivity: number
    │       ├── roomId: string
    │       ├── isStarted: boolean
    │       └── turnCount: string
```

## Storage System

### In-Memory Storage (Maps)

```typescript
// In gameStateManager.ts
const gameStates = new Map<string, { state: GameState; lastUpdated: number }>();
const cardHashMaps = new Map<string, CardHashMap>();
const gameMetadata = new Map<string, GameMetadata>();
```

### File Storage (game-states.json)

**Location**: `/home/viscanum853/uno-game/backend/game-states.json`

**Save Triggers**:

1. Every 30 seconds (automatic)
2. After each game state update (async)
3. On server shutdown (SIGINT/SIGTERM)

**Cleanup Rules**:

- Only keeps 10 most recent games
- Removes games inactive for >1 hour
- Runs cleanup every 5 minutes

**Current State**:

```json
{
  "lastSaved": "2025-11-23T15:44:37.933Z",
  "totalGames": 0,
  "games": []
}
```

---

## Security & Hashing

### Why Hashing?

**Problem**: In a web game, clients can inspect network traffic and see card data.

**Solution**: Hash everything!

```
Server has:
{
  "hash1": { "color": "red", "value": "5" },
  "hash2": { "color": "blue", "value": "7" }
}

Client receives:
{
  "myHand": ["hash1", "hash2"],
  "opponentHand": ["hash3", "hash4"]  // Client doesn't know what these are!
}
```

### What Gets Hashed

1. **Individual Cards**: Each card → unique hash
2. **Player Hands**: Entire hand → single hash (verification)
3. **Deck**: Remaining deck → hash
4. **Discard Pile**: All discarded cards → hash
5. **Game State**: Entire state → hash (integrity check)

### Hash Flow

```
Card Created
    ↓
Server generates hash using crypto library
    ↓
Server stores in CardHashMap: hash → card
    ↓
Server sends hash to client
    ↓
Client stores hash (doesn't know actual card)
    ↓
When card is played/drawn, server reveals actual card
```

---

## Examples

### Example 1: Game State After 2 Players Start

```json
{
  "id": "123",
  "players": [
    "0x1234567890abcdef1234567890abcdef12345678",
    "0xabcdef1234567890abcdef1234567890abcdef12"
  ],
  "isActive": true,
  "isStarted": true,
  "currentPlayerIndex": 0,
  "turnCount": "0",
  "directionClockwise": true,
  "playerHands": {
    "0x1234567890abcdef1234567890abcdef12345678": [
      "hash1",
      "hash2",
      "hash3",
      "hash4",
      "hash5",
      "hash6",
      "hash7"
    ],
    "0xabcdef1234567890abcdef1234567890abcdef12": [
      "hash8",
      "hash9",
      "hash10",
      "hash11",
      "hash12",
      "hash13",
      "hash14"
    ]
  },
  "currentColor": "red",
  "currentValue": "5",
  "lastPlayedCardHash": "hash15",
  "lastActionTimestamp": 1700550000000
}
```

**Interpretation**:

- Game #123
- 2 players, each with 7 cards (standard UNO start)
- Player 1's turn (currentPlayerIndex: 0)
- Last card played was a Red 5
- No turns played yet (just started)

---

### Example 2: CardHashMap for Above Game

```json
{
  "hash1": { "color": "red", "value": "3" },
  "hash2": { "color": "blue", "value": "7" },
  "hash3": { "color": "green", "value": "skip" },
  "hash4": { "color": "yellow", "value": "2" },
  "hash5": { "color": "red", "value": "reverse" },
  "hash6": { "color": "blue", "value": "draw2" },
  "hash7": { "color": "wild", "value": "wild" },
  "hash8": { "color": "green", "value": "5" },
  ...
}
```

---

### Example 3: Complete game-states.json

```json
{
  "lastSaved": "2025-11-23T16:30:00.000Z",
  "totalGames": 2,
  "games": [
    {
      "roomId": "game-123",
      "gameId": "123",
      "state": {
        "id": "123",
        "players": ["0x1234...", "0xabcd..."],
        "isActive": true,
        "currentPlayerIndex": 0,
        "turnCount": "5",
        "directionClockwise": true,
        "playerHands": {
          "0x1234...": ["hash1", "hash2", "hash3"],
          "0xabcd...": ["hash4", "hash5"]
        },
        "currentColor": "red",
        "currentValue": "5",
        "isStarted": true,
        "lastActionTimestamp": 1700550420000
      },
      "cardHashMap": {
        "hash1": { "color": "red", "value": "5" },
        "hash2": { "color": "blue", "value": "7" }
      },
      "lastUpdated": 1700550420000,
      "metadata": {
        "players": ["0x1234...", "0xabcd..."],
        "startTime": 1700550000000,
        "lastActivity": 1700550420000,
        "roomId": "game-123",
        "isStarted": true,
        "turnCount": "5"
      }
    }
  ]
}
```

---

## Common Operations

### Save a Game State

```typescript
import { saveGameState } from "./gameStateManager";

// After a player makes a move
saveGameState(roomId, updatedGameState, cardHashMap);
```

### Load a Game State

```typescript
import { getGameState } from "./gameStateManager";

const state = getGameState(roomId);
if (state) {
  // Game exists, can be restored
}
```

### Get Card from Hash

```typescript
import { getCardHashMap } from "./gameStateManager";

const cardHashMap = getCardHashMap(roomId);
const actualCard = cardHashMap["hash1"];
// actualCard = { color: "red", value: "5" }
```

### Check Active Games

```typescript
import { getStats } from "./gameStateManager";

const stats = getStats();
console.log(stats.totalGames); // Number of active games
console.log(stats.activeRooms); // Array of room IDs
console.log(stats.persistedGames); // Number saved to file
```

### Manual Cleanup

```typescript
import { cleanupOldGameStates } from "./gameStateManager";

// Remove games inactive for more than 1 hour
const removed = cleanupOldGameStates(3600000);
console.log(`Removed ${removed} old games`);
```

---

## Card Notation Reference

### Quick Reference Table

| Notation | Card           | Color  | Value   |
| -------- | -------------- | ------ | ------- |
| `0R`     | Red 0          | red    | 0       |
| `5B`     | Blue 5         | blue   | 5       |
| `skipG`  | Green Skip     | green  | skip    |
| `_Y`     | Yellow Reverse | yellow | reverse |
| `D2R`    | Red Draw Two   | red    | draw2   |
| `W`      | Wild           | wild   | wild    |
| `D4W`    | Wild Draw Four | wild   | draw4   |

### Color Codes

- **R** = Red
- **G** = Green
- **B** = Blue
- **Y** = Yellow
- **W** = Wild (no color until played)

---

## Configuration

### Timeouts & Intervals

```typescript
// In gameStateManager.ts
const MAX_STORED_GAMES = 10; // Max games in file
const CLEANUP_INTERVAL = 300000; // 5 minutes
const SAVE_INTERVAL = 30000; // 30 seconds
const MAX_GAME_AGE = 3600000; // 1 hour
```

### File Paths

```typescript
const STORAGE_FILE = path.join(__dirname, "game-states.json");
```

---

## Troubleshooting

### Problem: Games not persisting after restart

**Check**:

1. Is `game-states.json` being created?
2. Are there errors in logs about file write permissions?
3. Is the server shutting down gracefully (SIGINT/SIGTERM)?

### Problem: Memory growing indefinitely

**Check**:

1. Is cleanup running? (Check logs every 5 minutes)
2. Are old games being removed?
3. Check stats: `getStats().totalGames`

### Problem: Players seeing cards they shouldn't

**Check**:

1. Are cards being sent as hashes, not full Card objects?
2. Is CardHashMap being kept server-side only?
3. Review Socket.IO event payloads

---

## Production Recommendations

### For Large Scale Deployment

1. **Replace in-memory storage with Redis**

   ```typescript
   // Instead of Map
   const redis = require("redis");
   const client = redis.createClient();
   ```

2. **Use database instead of JSON file**

   - MongoDB, PostgreSQL, etc.
   - Better concurrency
   - Proper indexing

3. **Add monitoring**

   - Track active games
   - Monitor memory usage
   - Alert on high disconnection rates

4. **Implement rate limiting**

   - Prevent spam/abuse
   - Limit reconnection attempts

5. **Enable horizontal scaling**
   - Redis for shared state
   - Socket.IO Redis adapter
   - Load balancer

---

## Summary

This game state system provides:
✅ **Security** via cryptographic hashing
✅ **Persistence** via file storage
✅ **Performance** via in-memory caching
✅ **Reliability** via automatic cleanup
✅ **Recovery** via crash recovery on startup

The system is designed for a small-to-medium scale deployment. For production with many concurrent games, migrate to Redis/database as recommended in the documentation.
