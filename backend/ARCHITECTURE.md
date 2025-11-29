# Backend Architecture

This document describes the modular architecture of the Zunno game backend server.

## Directory Structure

```
backend/
├── config/
│   └── socket.js              # Socket.IO configuration
├── routes/
│   └── api.js                 # REST API endpoints
├── services/
│   ├── convexClient.js        # Convex HTTP client
│   └── convexStorage.js       # Convex storage service (write-only)
├── socket/
│   ├── index.js               # Socket handler orchestrator
│   ├── connection.js          # Connection/disconnection handlers
│   ├── reconnection.js        # Reconnection logic
│   ├── game.js                # Game-related socket events
│   └── lobby.js               # Lobby/room management
├── utils/
│   └── cleanup.js             # Cleanup tasks and shutdown handlers
├── convex/
│   ├── schema.ts              # Convex database schema
│   ├── games.ts               # Game mutations
│   ├── moves.ts               # Move mutations
│   └── ...                    # Other Convex functions
├── index.js                   # Main server entry point
├── users.js                   # User management
├── gameStateManager.js        # Game state persistence
├── gameLogger.js              # Game event logging
├── logger.js                  # General logging
├── diamnetService.js          # Blockchain service
└── packOfCards.js             # Card deck definitions
```

## Module Descriptions

### Main Entry Point

**`index.js`**
- Initializes Express app and HTTP server
- Configures middleware (CORS, JSON parsing)
- Mounts API routes
- Initializes Socket.IO with configuration
- Sets up cleanup tasks and error handlers
- Starts the server

### Configuration

**`config/socket.js`**
- Socket.IO server configuration
- Connection timeouts and intervals
- Transport settings
- CORS configuration

### API Routes

**`routes/api.js`**
- `/api/create-claimable-balance` - Create blockchain rewards
- `/api/game-state/:gameId` - Retrieve game state by ID
- `/api/recent-games` - Get list of recent games
- `/api/health` - Health check endpoint

### Services

**`services/convexClient.js`**
- Convex HTTP client wrapper
- Handles connection to Convex deployment
- Provides mutation execution interface

**`services/convexStorage.js`**
- Write-only operations to Convex
- Stores game data for analytics and replay
- Non-blocking, fail-safe operations

### Socket Event Handlers

**`socket/index.js`**
- Orchestrates all socket event handlers
- Registers handlers on new connections

**`socket/connection.js`**
- Handles new connections
- Manages disconnections with grace period
- Tracks active connection count

**`socket/reconnection.js`**
- `rejoinRoom` - Rejoin room after disconnection
- `requestGameStateSync` - Sync game state after reconnection

**`socket/game.js`**
- `joinRoom` - Join a game room
- `createGameRoom` - Create new game room
- `gameStarted` - Broadcast game start
- `playCard` - Handle card plays
- `initGameState` - Initialize game state
- `updateGameState` - Update game state
- `requestGameInit` - Server-side game initialization

**`socket/lobby.js`**
- `join` - Join lobby/room
- `quitRoom` - Leave room
- `sendMessage` - Chat messages

### Utilities

**`utils/cleanup.js`**
- `startPeriodicCleanup()` - Clean up disconnected users
- `setupGracefulShutdown()` - Handle SIGTERM/SIGINT
- `setupGlobalErrorHandlers()` - Handle uncaught errors

## Benefits of Modular Architecture

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Maintainability**: Easier to locate and fix bugs
3. **Testability**: Individual modules can be tested in isolation
4. **Scalability**: Easy to add new features without cluttering main file
5. **Readability**: Clear organization makes codebase easier to understand
6. **Reusability**: Modules can be reused across different parts of the application

## Event Flow

### New Connection
1. Client connects → `socket/connection.js` handles connection
2. All handlers registered via `socket/index.js`
3. Connection count incremented

### Game Start
1. Client emits `gameStarted` → `socket/game.js` handles
2. Game state saved via `gameStateManager`
3. Event logged via `gameLogger`
4. Broadcast to all players in room

### Disconnection & Reconnection
1. Client disconnects → `socket/connection.js` marks as disconnected
2. 60-second grace period begins
3. If reconnects → `socket/reconnection.js` handles rejoin
4. Game state synced via `requestGameStateSync`
5. If timeout → User removed, room updated

## Configuration

Environment variables:
- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment mode (production/development)

## Running the Server

```bash
# Install dependencies
npm install

# Start server
npm start

# Development mode with auto-reload
npm run dev
```

## API Documentation

### Health Check
```
GET /api/health
Response: { status, uptime, gameStates, activeRooms }
```

### Get Game State
```
GET /api/game-state/:gameId
Response: { success, gameId, roomId, state, cardHashMap, metadata }
```

### Recent Games
```
GET /api/recent-games
Response: { success, games, count }
```

### Create Claimable Balance
```
POST /api/create-claimable-balance
Body: { winnerAddress, gameId }
Response: { success, ... }
```
