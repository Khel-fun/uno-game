# Socket Reconnection Implementation Guide

## Overview
This guide documents the socket reconnection implementation for the Zunno game frontend and provides instructions for the required server-side changes.

## Frontend Implementation

### 1. Enhanced Socket Manager (`/src/services/socketManager.ts`)
- **Automatic Reconnection**: Implements exponential backoff strategy (1s to 30s max delay)
- **Heartbeat Mechanism**: Sends ping every 5 seconds, disconnects after 3 missed pongs
- **Action Buffering**: Queues actions when disconnected and replays them on reconnection
- **Connection Status Tracking**: Emits status changes (connecting, connected, disconnected, reconnecting, error)
- **Room Persistence**: Stores room info for automatic rejoin on reconnection

### 2. Connection Status Context (`/src/context/SocketConnectionContext.tsx`)
- Global connection state management
- Provides `isConnected`, `isReconnecting`, `status` to all components
- Handles automatic socket initialization

### 3. UI Components
- **ConnectionStatusIndicator**: Shows banner when disconnected/reconnecting with retry button
- **ConnectionStatusBadge**: Small status indicator for headers

### 4. Game Component Updates
- **Action Buffering**: All socket emissions go through `emitSocketEvent()` wrapper
- **Pending Actions**: Automatically sent when connection restored
- **User Notifications**: Toast messages for connection status changes

### 5. Room Component Updates
- **Automatic Rejoin**: Rejoins room on reconnection
- **State Sync Request**: Requests game state sync after reconnection
- **Connection-Aware Join**: Only joins room when socket is connected

## Required Server-Side Changes

### 1. Heartbeat/Ping-Pong Handler

Add to your socket server:

```javascript
// Handle ping-pong for connection health monitoring
socket.on('ping', () => {
  socket.emit('pong');
});
```

### 2. Room Rejoin Handler

```javascript
socket.on('rejoinRoom', ({ room, gameId }, callback) => {
  try {
    // Check if room exists
    const roomExists = rooms.has(room);
    
    if (roomExists) {
      // Add socket back to room
      socket.join(room);
      
      // Restore user's session if needed
      const user = findUserBySocketId(socket.id);
      if (user) {
        user.connected = true;
      }
      
      callback({ success: true, room, gameId });
      
      // Notify other players
      socket.to(room).emit('playerReconnected', {
        userId: socket.id,
        room
      });
    } else {
      callback({ success: false, error: 'Room not found' });
    }
  } catch (error) {
    console.error('Error rejoining room:', error);
    callback({ success: false, error: error.message });
  }
});
```

### 3. Game State Sync Handler

```javascript
socket.on('requestGameStateSync', ({ roomId, gameId }) => {
  try {
    // Fetch current game state from your game state storage
    const gameState = getGameState(roomId, gameId);
    const cardHashMap = getCardHashMap(gameId);
    
    if (gameState) {
      // Send state back to the requesting client
      socket.emit(`gameStateSync-${roomId}`, {
        newState: gameState,
        cardHashMap: cardHashMap
      });
    }
  } catch (error) {
    console.error('Error syncing game state:', error);
  }
});
```

### 4. Disconnect Handling Improvements

```javascript
socket.on('disconnect', (reason) => {
  console.log(`Socket ${socket.id} disconnected: ${reason}`);
  
  // Mark user as temporarily disconnected instead of removing immediately
  const user = findUserBySocketId(socket.id);
  if (user) {
    user.connected = false;
    user.disconnectedAt = Date.now();
    
    // Notify other players
    socket.to(user.room).emit('playerDisconnected', {
      userId: socket.id,
      userName: user.name,
      temporary: true
    });
    
    // Set timeout to remove user if they don't reconnect (e.g., 60 seconds)
    setTimeout(() => {
      const stillDisconnected = !user.connected;
      if (stillDisconnected) {
        removeUser(socket.id);
        socket.to(user.room).emit('playerLeft', {
          userId: socket.id,
          userName: user.name
        });
      }
    }, 60000); // 60 second grace period
  }
});
```

### 5. Connection Event Handler

```javascript
socket.on('connect', () => {
  console.log(`Socket ${socket.id} connected`);
  
  // Check if this is a reconnection
  const existingUser = findUserBySocketId(socket.id);
  if (existingUser) {
    existingUser.connected = true;
    existingUser.disconnectedAt = null;
    
    // Notify room
    socket.to(existingUser.room).emit('playerReconnected', {
      userId: socket.id,
      userName: existingUser.name
    });
  }
});
```

### 6. Game State Persistence

Ensure your server maintains game state even when players disconnect temporarily:

```javascript
// Store game states in memory or database
const gameStates = new Map();

function saveGameState(roomId, gameState) {
  gameStates.set(roomId, {
    state: gameState,
    lastUpdated: Date.now()
  });
}

function getGameState(roomId) {
  const stored = gameStates.get(roomId);
  return stored ? stored.state : null;
}

// Clean up old game states periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 3600000; // 1 hour
  
  for (const [roomId, data] of gameStates.entries()) {
    if (now - data.lastUpdated > maxAge) {
      gameStates.delete(roomId);
    }
  }
}, 300000); // Check every 5 minutes
```

## Configuration

### Frontend Environment Variables
```env
NEXT_PUBLIC_WEBSOCKET_URL=https://your-websocket-server.com
```

### Socket Manager Configuration
You can adjust these values in `/src/services/socketManager.ts`:

```typescript
{
  reconnectAttempts: 10,        // Max reconnection attempts
  reconnectDelay: 1000,         // Initial delay (ms)
  reconnectDelayMax: 30000,     // Max delay (ms)
  heartbeatInterval: 5000,      // Ping interval (ms)
  timeout: 10000,               // Connection timeout (ms)
}
```

## Testing Reconnection

### Manual Testing
1. Start a game with two players
2. Disconnect one player's internet for 5-10 seconds
3. Reconnect - player should automatically rejoin
4. Verify game state is synchronized

### Network Throttling
Use browser DevTools:
1. Open DevTools → Network tab
2. Select "Offline" or "Slow 3G"
3. Observe connection status indicator
4. Restore connection
5. Verify pending actions are sent

### Simulated Disconnection
```javascript
// In browser console
socketManager.disconnect();
// Wait a few seconds
socketManager.connect();
```

## User Experience

### Connection States
- **Connected**: No indicator shown (normal gameplay)
- **Connecting**: Yellow banner "Connecting..."
- **Reconnecting**: Orange banner "Reconnecting..." with spinner
- **Disconnected**: Red banner "Disconnected" with Retry button
- **Error**: Red banner "Connection Error" with Retry button

### Action Buffering
- Actions taken while disconnected are queued
- Toast notification: "Your action will be sent when connection is restored"
- On reconnection: All pending actions sent automatically
- Toast notification: "Connection restored - All pending actions have been sent"

## Troubleshooting

### Issue: Reconnection fails repeatedly
- Check server logs for errors
- Verify `rejoinRoom` handler is implemented
- Check if room still exists on server

### Issue: Game state out of sync after reconnection
- Ensure `requestGameStateSync` handler is implemented
- Verify game state is persisted on server
- Check that cardHashMap is sent correctly

### Issue: Pending actions not sent
- Check browser console for errors
- Verify `emitSocketEvent` is used instead of direct `socket.emit`
- Check that socket is actually reconnected

### Issue: Heartbeat causing disconnections
- Adjust `heartbeatInterval` and `maxMissedHeartbeats`
- Check server is responding to ping events
- Monitor network latency

## Benefits

1. **Resilience**: Game continues even with brief network interruptions
2. **User Experience**: Clear feedback about connection status
3. **Data Integrity**: No lost actions due to buffering
4. **Automatic Recovery**: No manual intervention needed
5. **Graceful Degradation**: Game pauses but doesn't crash

## Future Enhancements

- [ ] Offline mode with local state
- [ ] Conflict resolution for simultaneous actions
- [ ] Connection quality indicator
- [ ] Adaptive heartbeat based on network conditions
- [ ] WebRTC fallback for peer-to-peer connections
