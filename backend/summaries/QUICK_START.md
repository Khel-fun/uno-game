# Quick Start Guide - Backend Reconnection

## 🚀 Getting Started

### 1. Install Dependencies (if needed)
```bash
cd /Users/ayush/gameofuno/unogameui/backend
npm install
```

### 2. Start the Server
```bash
node index.js
```

You should see:
```
Server started on Port 4000 at 2024-11-18T...
Game state manager initialized with periodic cleanup
```

### 3. Verify It's Working
```bash
# Check health endpoint
curl http://localhost:4000/health
```

Expected response:
```json
{
    "status": "ok",
    "connections": 0,
    "uptime": 5.123,
    "gameStates": 0,
    "activeRooms": 0
}
```

## ✅ What's New

### Reconnection Features
- ✅ **Ping-Pong Heartbeat** - Detects dead connections
- ✅ **Auto Rejoin** - Players automatically rejoin rooms
- ✅ **State Sync** - Game state synchronized on reconnection
- ✅ **60s Grace Period** - Players have 60 seconds to reconnect
- ✅ **Auto Cleanup** - Old states and users cleaned automatically

## 🧪 Quick Test

### Test 1: Basic Reconnection
1. Start the backend server
2. Open two browser tabs with your frontend
3. Start a game between the two tabs
4. In one tab, open DevTools → Network → Go Offline
5. Wait 5 seconds
6. Go back Online
7. ✅ Player should automatically reconnect and sync

### Test 2: Grace Period
1. Start a game
2. Disconnect one player
3. Wait 30 seconds
4. Check server logs - player should still be marked as disconnected
5. Wait another 35 seconds (total 65 seconds)
6. ✅ Player should be permanently removed

### Test 3: State Persistence
1. Start a game and play a few moves
2. Disconnect a player
3. Reconnect within 60 seconds
4. ✅ Game state should be synchronized correctly

## 📊 Monitor Your Server

### Real-time Logs
```bash
# Watch all logs
tail -f logs/combined.log

# Watch only errors
tail -f logs/error.log

# Watch game logs
tail -f logs/game.log
```

### Key Log Messages
```
✅ User {id} connected
✅ User {id} attempting to rejoin room {room}
✅ User {id} successfully rejoined room {room}
✅ Game state synced for user {id}
✅ User {id} marked as disconnected
✅ Periodic cleanup removed {count} disconnected users
```

### Health Check
```bash
# Basic check
curl http://localhost:4000/health

# Pretty print
curl http://localhost:4000/health | json_pp

# Watch continuously
watch -n 5 'curl -s http://localhost:4000/health | json_pp'
```

## 🔧 Configuration

### Adjust Grace Period
Edit `index.js` line ~458:
```javascript
setTimeout(() => {
    // ...
}, 60000); // Change to desired milliseconds
```

### Adjust Cleanup Intervals
Edit `index.js` line ~111:
```javascript
setInterval(() => {
    cleanupDisconnectedUsers(60000); // Max disconnect time
}, 30000); // Cleanup interval
```

### Adjust Game State Retention
Edit `gameStateManager.js` line ~100:
```javascript
const CLEANUP_INTERVAL = 300000; // How often to clean
const maxAge = 3600000; // Max age before cleanup
```

## 🐛 Troubleshooting

### Server won't start
```bash
# Check if port is in use
lsof -i :4000

# Kill existing process
kill -9 <PID>

# Try different port
PORT=5000 node index.js
```

### High memory usage
```bash
# Check Node.js memory
node --max-old-space-size=4096 index.js

# Monitor memory
watch -n 1 'curl -s http://localhost:4000/health | grep -E "gameStates|activeRooms"'
```

### Reconnection not working
1. Check frontend is emitting 'rejoinRoom' event
2. Verify room still exists: `curl http://localhost:4000/health`
3. Check server logs for errors
4. Ensure grace period hasn't expired

## 📝 Important Notes

### Grace Period Behavior
- Users have **60 seconds** to reconnect
- After 60 seconds, they're permanently removed
- Other players are notified of disconnection status

### State Persistence
- Game states stored for **1 hour** after last update
- Automatic cleanup every **5 minutes**
- Includes full game state and card hash maps

### Memory Management
- Disconnected users cleaned every **30 seconds**
- Old game states cleaned every **5 minutes**
- Health endpoint shows current memory usage

## 🎯 Next Steps

### 1. Test with Frontend
```bash
# Terminal 1: Backend
cd /Users/ayush/gameofuno/unogameui/backend
node index.js

# Terminal 2: Frontend
cd /Users/ayush/gameofuno/unogameui/frontend
npm run dev
```

### 2. Test Reconnection Flow
1. Open two browser tabs
2. Start a game
3. Disconnect one player (DevTools → Network → Offline)
4. Wait 5-10 seconds
5. Reconnect (DevTools → Network → Online)
6. Verify automatic rejoin and state sync

### 3. Monitor Logs
```bash
tail -f logs/combined.log | grep -E "reconnect|disconnect|sync"
```

### 4. Check Health Regularly
```bash
watch -n 5 'curl -s http://localhost:4000/health'
```

## 🚀 Production Deployment

### Using PM2
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start index.js --name zunno-backend

# Monitor
pm2 monit

# View logs
pm2 logs zunno-backend

# Restart
pm2 restart zunno-backend

# Stop
pm2 stop zunno-backend
```

### Environment Variables
```bash
# Set port
PORT=4000 node index.js

# Production mode
NODE_ENV=production node index.js
```

## 📚 Documentation

- **Full Implementation Details**: `RECONNECTION_IMPLEMENTATION.md`
- **Summary**: `IMPLEMENTATION_SUMMARY.md`
- **Frontend Guide**: `../frontend/SOCKET_RECONNECTION_GUIDE.md`

## ✨ Success Indicators

Your reconnection system is working if you see:
- ✅ Players automatically rejoin after brief disconnections
- ✅ Game state syncs correctly on reconnection
- ✅ Server logs show reconnection events
- ✅ Health endpoint shows active game states
- ✅ No memory leaks (stable memory usage)
- ✅ Disconnected users cleaned up after 60 seconds

## 🎉 You're All Set!

The backend is ready to handle reconnections. Test it thoroughly and monitor the logs to ensure everything works as expected.

**Happy Gaming! 🎮**
