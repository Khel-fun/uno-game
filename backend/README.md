# Game of Uno Backend

TypeScript + Convex backend for multiplayer UNO game with real-time synchronization.

## Quick Start

```bash
# 1. Deploy Convex schema and generate types
npx convex dev

# 2. Set environment variables
cp .env.example .env.local
# Add your CONVEX_URL to .env.local

# 3. Build and run
npm install
npm run build
npm start
```

## Architecture

**Stack:** TypeScript + Convex + Socket.IO

**Database (Convex):**
- `players` - User profiles and connection state
- `games` - Game metadata and current state
- `hands` - Mutable player hands
- `cardMappings` - Hash-to-card decoder for security
- `moves` - Immutable event log
- `gameStates` - State snapshots

**Key Features:**
- Event-sourced architecture with full audit trail
- Real-time sync via Convex (automatic)
- Card security via cryptographic hashing
- Reconnection support (60s grace period)
- ACID transactions

## API Endpoints

- `GET /health` - Health check with game stats
- `GET /api/game-state/:gameId` - Get game state
- `GET /api/recent-games` - List recent games
- `POST /api/create-claimable-balance` - Diamnet blockchain integration

## Socket.IO Events

**Client → Server:**
- `join` - Join game lobby
- `gameStarted` - Initialize game (calls `gameActions.initializeGame`)
- `playCard` - Play a card (calls `gameActions.playCard`)
- `drawCard` - Draw a card (calls `gameActions.drawCard`)
- `rejoinRoom` - Reconnect to game
- `requestGameStateSync` - Sync state after reconnect

**Server → Client:**
- `gameStarted-{roomId}` - Game initialized
- `cardPlayed-{roomId}` - Card played
- `gameStateSync-{roomId}` - State synced
- `playerReconnected` - Player rejoined
- `playerDisconnected` - Player left (temporary/permanent)

## Migration Notes

**Deprecated (moved to `deprecated/`):**
- `gameLogger.ts` → Convex `moves` table
- `gameStateManager.ts` → Convex `games` + `gameStates` tables
- `users.ts` → Convex `players` table

**Before (in-memory):** `gameStateManager.saveGameState(roomId, state)`
**After (Convex):** `convex.mutation(api.games.updateState, { gameId, ... })`
