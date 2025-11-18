# Backend Socket Reconnection Implementation

## Overview
This document describes the server-side implementation of socket reconnection functionality for the Zunno game backend.

## Files Modified/Created

### New Files
1. **`gameStateManager.js`** - Manages game state persistence for reconnection
2. **`RECONNECTION_IMPLEMENTATION.md`** - This documentation file

### Modified Files
1. **`users.js`** - Enhanced user management with connection status tracking
2. **`index.js`** - Added reconnection handlers and improved disconnect logic

## Implementation Details

### 1. Enhanced User Management (`users.js`)

#### New Functions

**`markUserDisconnected(id)`**
- Marks a user as disconnected instead of removing them immediately
- Sets `connected: false` and `disconnectedAt: timestamp`
- Returns the user object

**`cleanupDisconnectedUsers(maxDisconnectTime)`**
- Removes users who have been disconnected longer than `maxDisconnectTime` (default: 60 seconds)
- Called periodically to prevent memory leaks
- Returns array of removed users

**`findUserByNameAndRoom(name, room)`**
- Finds a user by their name and room
- Used for reconnection matching

#### Modified Functions

**`addUser({id, name, room})`**
- Now checks for existing disconnected users with same name/room
- If found, updates socket ID and marks as reconnected
- Returns `{ newUser, reconnected: true }` for reconnections
- Adds connection status fields: `connected: true`, `disconnectedAt: null`

**`getUsersInRoom(room)`**
- Unchanged, but now returns users with connection status

### 2. Game State Manager (`gameStateManager.js`)

#### Purpose
Persists game states in memory to support reconnection and state synchronization.

#### Key Functions

**`saveGameState(roomId, gameState, cardHashMap)`**
- Stores game state with timestamp
- Optionally stores card hash map
- Returns success boolean

**`getGameState(roomId)`**
- Retrieves stored game state for a room
- Returns null if not found

**`getCardHashMap(roomId)`**
- Retrieves stored card hash map for a room
- Returns null if not found

**`hasGameState(roomId)`**
- Checks if a room has stored state
- Used for room existence validation

**`cleanupOldGameStates(maxAge)`**
- Removes game states older than `maxAge` (default: 1 hour)
- Runs automatically every 5 minutes
- Prevents memory leaks

**`getStats()`**
- Returns statistics about stored game states
- Used in health check endpoint

### 3. Socket Event Handlers (`index.js`)

#### New Handlers

**1. Ping-Pong (Heartbeat)**
```javascript
socket.on('ping', () => {
    socket.emit('pong');
});
```
- Responds to client heartbeat pings
- Allows client to detect dead connections

**2. Room Rejoin**
```javascript
socket.on('rejoinRoom', ({ room, gameId }, callback) => {
    // Validates room exists
    // Adds socket back to room
    // Notifies other players
    // Sends success/failure callback
});
```
- Handles automatic room rejoin on reconnection
- Validates room still exists
- Notifies other players of reconnection

**3. Game State Sync**
```javascript
socket.on('requestGameStateSync', ({ roomId, gameId }) => {
    // Fetches stored game state
    // Sends state to requesting client
    // Includes card hash map
});
```
- Synchronizes game state after reconnection
- Sends current game state to reconnected player

#### Modified Handlers

**`gameStarted`**
- Now saves game state: `gameStateManager.saveGameState(roomId, newState, cardHashMap)`
- Enables state recovery on reconnection

**`playCard`**
- Now saves updated state: `gameStateManager.saveGameState(roomId, newState)`
- Keeps state current for reconnections

**`initGameState`**
- Now saves initial state: `gameStateManager.saveGameState(user.room, gameState)`

**`updateGameState`**
- Now saves state updates: `gameStateManager.saveGameState(user.room, gameState)`

**`disconnect`**
- Completely rewritten with grace period logic
- Marks user as disconnected instead of removing
- Sets 60-second timeout before permanent removal
- Notifies room of temporary disconnection
- Notifies room of permanent leave if no reconnection

### 4. Periodic Cleanup

**Disconnected Users Cleanup**
```javascript
setInterval(() => {
    const removed = cleanupDisconnectedUsers(60000);
    if (removed.length > 0) {
        logger.info(`Periodic cleanup removed ${removed.length} disconnected users`);
    }
}, 30000);
```
- Runs every 30 seconds
- Removes users disconnected for more than 60 seconds

**Game State Cleanup**
- Runs automatically in `gameStateManager.js`
- Every 5 minutes
- Removes game states older than 1 hour

### 5. Enhanced Health Check

**Endpoint: `GET /health`**
```json
{
    "status": "ok",
    "connections": 5,
    "uptime": 3600,
    "gameStates": 3,
    "activeRooms": 3
}
```
- Added game state statistics
- Shows number of stored game states
- Shows number of active rooms

## Event Flow

### Normal Connection
```
1. Client connects
2. Server emits 'server_id'
3. Client joins room
4. Game starts
5. Game state saved
```

### Disconnection
```
1. Client disconnects
2. Server marks user as disconnected
3. Server emits 'playerDisconnected' (temporary: true)
4. 60-second timer starts
5a. If reconnects: User restored, timer cancelled
5b. If timeout: User removed, emit 'playerLeft' (permanent: true)
```

### Reconnection
```
1. Client reconnects (new socket ID)
2. Client emits 'rejoinRoom'
3. Server validates room exists
4. Server adds socket to room
5. Server emits 'playerReconnected' to others
6. Server emits 'reconnected' to client
7. Client emits 'requestGameStateSync'
8. Server sends current game state
9. Client updates local state
10. Game continues
```

## Configuration

### Timeouts
- **Grace Period**: 60 seconds (disconnect to permanent removal)
- **User Cleanup**: Every 30 seconds
- **Game State Cleanup**: Every 5 minutes
- **Game State Max Age**: 1 hour
- **Socket Ping Timeout**: 20 seconds (configured in socket.io options)
- **Socket Ping Interval**: 10 seconds (configured in socket.io options)

### Adjusting Timeouts

**Grace Period** (in `index.js`):
```javascript
setTimeout(() => {
    // ...
}, 60000); // Change this value (in milliseconds)
```

**User Cleanup Interval** (in `index.js`):
```javascript
setInterval(() => {
    cleanupDisconnectedUsers(60000); // Max disconnect time
}, 30000); // Cleanup interval
```

**Game State Cleanup** (in `gameStateManager.js`):
```javascript
const CLEANUP_INTERVAL = 300000; // 5 minutes
const maxAge = 3600000; // 1 hour
```

## Testing

### Test Reconnection
1. Start server: `node index.js`
2. Connect two clients to a game
3. Disconnect one client's network
4. Wait 5-10 seconds
5. Reconnect network
6. Verify client automatically rejoins and syncs state

### Test Grace Period
1. Connect client to game
2. Disconnect client
3. Wait 30 seconds
4. Check server logs - user should still be marked as disconnected
5. Wait another 35 seconds (total 65 seconds)
6. Check server logs - user should be permanently removed

### Test State Persistence
1. Start a game
2. Play a few moves
3. Disconnect a player
4. Reconnect player
5. Verify game state is synchronized correctly

### Monitor Health
```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
    "status": "ok",
    "connections": 2,
    "uptime": 123.45,
    "gameStates": 1,
    "activeRooms": 1
}
```

## Logging

### New Log Messages

**Connection Events**
- `User {id} reconnected to room {room} with new socket {id}`
- `User {id} marked as disconnected in room {room}`
- `User {id} did not reconnect, removing from room {room}`

**Reconnection Events**
- `User {id} attempting to rejoin room {room}`
- `User {id} successfully rejoined room {room}`
- `Room {room} not found for rejoin`

**State Sync Events**
- `User {id} requesting game state sync for room {roomId}`
- `Game state synced for user {id} in room {roomId}`
- `No game state found for room {roomId}`

**Cleanup Events**
- `Periodic cleanup removed {count} disconnected users`
- `Cleaned up old game state for room {roomId}`
- `Cleaned up {count} old game states`

## Memory Management

### In-Memory Storage
Game states are stored in JavaScript Maps:
- `gameStates` - Map of roomId → { state, lastUpdated }
- `cardHashMaps` - Map of roomId → cardHashMap

### Memory Limits
- No hard limit on number of game states
- Automatic cleanup after 1 hour of inactivity
- Consider using Redis for production with many concurrent games

### Monitoring Memory
```javascript
const stats = gameStateManager.getStats();
console.log(stats.memoryUsage);
```

## Production Considerations

### 1. Use Redis for State Storage
For production with many concurrent games, replace in-memory storage with Redis:

```javascript
const redis = require('redis');
const client = redis.createClient();

const saveGameState = async (roomId, gameState) => {
    await client.setex(
        `gameState:${roomId}`,
        3600, // 1 hour TTL
        JSON.stringify(gameState)
    );
};
```

### 2. Horizontal Scaling
If using multiple server instances:
- Use Redis for shared state storage
- Use Redis Pub/Sub for cross-server events
- Configure socket.io with Redis adapter

### 3. Monitoring
- Monitor memory usage
- Track reconnection success rate
- Alert on high disconnection rates
- Log game state storage size

### 4. Rate Limiting
Consider adding rate limiting for:
- Reconnection attempts
- State sync requests
- Ping-pong frequency

## Troubleshooting

### Issue: Users not reconnecting
**Check:**
- Client is emitting 'rejoinRoom' event
- Room still exists on server
- Grace period hasn't expired

### Issue: Game state not syncing
**Check:**
- Game state is being saved on updates
- `requestGameStateSync` event is being emitted
- Room ID matches between client and server

### Issue: Memory growing indefinitely
**Check:**
- Cleanup intervals are running
- Old game states are being removed
- Disconnected users are being cleaned up

### Issue: Players getting kicked too quickly
**Adjust:**
- Increase grace period from 60 seconds
- Increase socket ping timeout
- Check network stability

## API Reference

### Socket Events (Server → Client)

**`pong`**
- Response to ping heartbeat
- No data

**`reconnected`**
- Emitted when client successfully rejoins
- Data: `{ room, gameId }`

**`playerReconnected`**
- Broadcast to room when player reconnects
- Data: `{ userId, room, timestamp }`

**`playerDisconnected`**
- Broadcast when player disconnects
- Data: `{ userId, userName, temporary, reason }`

**`playerLeft`**
- Broadcast when player permanently leaves
- Data: `{ userId, userName, permanent }`

**`gameStateSync-{roomId}`**
- Sends synchronized game state
- Data: `{ newState, cardHashMap }`

### Socket Events (Client → Server)

**`ping`**
- Heartbeat check
- No data

**`rejoinRoom`**
- Request to rejoin a room
- Data: `{ room, gameId }`
- Callback: `(response) => { success, room, gameId, error }`

**`requestGameStateSync`**
- Request current game state
- Data: `{ roomId, gameId }`

## Changelog

### Version 1.0.0 (Current)
- ✅ Ping-pong heartbeat handler
- ✅ Room rejoin with validation
- ✅ Game state persistence
- ✅ Game state synchronization
- ✅ Grace period for disconnections (60s)
- ✅ Periodic cleanup of stale data
- ✅ Enhanced health check endpoint
- ✅ Comprehensive logging

### Future Enhancements
- [ ] Redis integration for production
- [ ] Cross-server event synchronization
- [ ] Reconnection analytics
- [ ] Configurable grace periods per room
- [ ] Player reconnection notifications in UI
- [ ] Automatic conflict resolution
