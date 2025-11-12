# Game Logging System

This document explains the game logging system implemented in the Zunno game.

## Overview

The game logging system tracks all game actions including:
- Game starts
- Card plays
- Card draws
- Turn progression

**Important:** All logging is handled on the **backend server** to ensure file system access and centralized logging.

## Log Location

Logs are stored in the backend `/game-logs` directory (automatically created):
- `backend/game-logs/game-history.log` - Main log file with all game actions
- `backend/game-logs/game-{gameId}.log` - Individual game-specific log files (optional)

**Note:** The `/game-logs` directory is gitignored to prevent committing log files.

## Log Format

Each log entry contains:
```
[timestamp] | Game: {gameId} | Turn: {turnNumber} | Player: {address} | Action: {action} | [additional details]
```

### Example Log Entries

**Game Start:**
```
[2024-11-12T06:15:30.123Z] | Game: 1 | Turn: 0 | Player: SYSTEM | Action: startGame | Details: First card: red 5 | Color: red | Value: 5 | Next: 0x1234...
```

**Card Play:**
```
[2024-11-12T06:15:45.456Z] | Game: 1 | Turn: 1 | Player: 0x1234... | Action: playCard | Card: 0xabcd... | Details: blue 7 | Color: blue | Value: 7 | Next: 0x5678...
```

**Card Draw:**
```
[2024-11-12T06:16:00.789Z] | Game: 1 | Turn: 2 | Player: 0x5678... | Action: drawCard | Card: 0xef01... | Details: green skip (played immediately) | Next: 0x9abc...
```

## Implementation

### Backend Logger Module
Location: `backend/gameLogger.js`

The `GameLogger` class provides methods:
- `logGameStart(gameId, players)` - Log game initialization
- `logCardPlay(gameId, turn, player, cardHash, cardDetails, color, value, nextPlayer)` - Log card plays
- `logCardDraw(gameId, turn, player, cardHash, cardDetails, wasPlayed, nextPlayer)` - Log card draws
- `log(entry)` - Generic log method

### Integration Points

The logger is integrated in the backend `index.js` via Socket.IO events:

1. **Game Start** (socket event: `gameStarted`)
   - Logs when game starts
   - Records first card and starting player
   - Triggered when frontend emits `gameStarted` event

2. **Play Card** (socket event: `playCard`)
   - Logs each card played
   - Records card details, color, value, and next player
   - Triggered when frontend emits `playCard` event

3. **Draw Card** (socket event: `playCard` with action type `drawCard`)
   - Logs each card drawn
   - Records whether card was played immediately or added to hand
   - Triggered when frontend emits card draw actions

## Usage

The logging happens automatically during gameplay. No manual intervention required.

### Viewing Logs

**Backend Server:**
```bash
# Navigate to backend directory
cd backend

# View all game logs
cat game-logs/game-history.log

# View specific game
cat game-logs/game-{gameId}.log

# Follow logs in real-time
tail -f game-logs/game-history.log

# View backend winston logs (includes game logs)
cat logs/combined.log
```

**Console:**
All logs are also output to the backend console with `[GAME]` prefix via winston logger for easy debugging.

## Benefits

1. **Debugging** - Track game flow and identify issues
2. **Audit Trail** - Complete history of all game actions
3. **Analytics** - Analyze game patterns and player behavior
4. **Dispute Resolution** - Verify game fairness and resolve disputes

## Environment

- **Backend Server**: Logs written to files in `backend/game-logs/` and winston logs in `backend/logs/`
- **Frontend**: No logging (all logging handled by backend via Socket.IO events)

## Privacy

Player addresses are truncated in logs (first 8 characters + "...") for readability while maintaining uniqueness.
