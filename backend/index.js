const express = require("express");
const app = express();
const cors = require("cors");
const server = require("http").createServer(app);
const ws = require("ws");
const path = require('path');
const {
    addUser, 
    removeUser, 
    getUser, 
    getUsersInRoom, 
    markUserDisconnected, 
    cleanupDisconnectedUsers,
    findUserByNameAndRoom
} = require("./users");
const { createClaimableBalance } = require("./diamnetService");
const logger = require('./logger');
const gameLogger = require('./gameLogger');
const gameStateManager = require('./gameStateManager');

// Set server timeout to prevent hanging connections
// Increased to 120 seconds to support long-lived WebSocket connections
server.timeout = 120000; // 120 seconds

const io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
    wsEngine: ws.Server,
    pingTimeout: 30000, // Increased to 30 seconds before a client is considered disconnected
    pingInterval: 10000, // Send ping every 10 seconds
    connectTimeout: 20000, // Increased connection timeout to 20 seconds
    maxHttpBufferSize: 1e6, // 1MB max payload size
    transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling
    allowEIO3: true, // Allow Engine.IO v3 clients
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// API endpoint for creating claimable balances
app.post("/api/create-claimable-balance", async (req, res) => {
  try {
    const { winnerAddress, gameId } = req.body;
    
    // Validate the request
    if (!winnerAddress) {
      return res.status(400).json({ error: "Winner address is required" });
    }
    
    // Create the claimable balance
    const result = await createClaimableBalance(winnerAddress);
    
    // Return success response
    res.status(200).json(result);
  } catch (error) {
    logger.error("Error creating claimable balance:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to create claimable balance" 
    });
  }
});

// API endpoint to get game state by game ID
app.get("/api/game-state/:gameId", (req, res) => {
  try {
    const { gameId } = req.params;
    
    if (!gameId) {
      return res.status(400).json({ error: "Game ID is required" });
    }
    
    const gameData = gameStateManager.getGameStateByGameId(gameId);
    
    if (gameData) {
      logger.info(`Game state retrieved for game ID ${gameId}`);
      res.status(200).json({
        success: true,
        gameId,
        roomId: gameData.roomId,
        state: gameData.state,
        cardHashMap: gameData.cardHashMap,
        metadata: gameData.metadata
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Game state not found"
      });
    }
  } catch (error) {
    logger.error(`Error retrieving game state for game ID ${req.params.gameId}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve game state"
    });
  }
});

// API endpoint to get list of recent games
app.get("/api/recent-games", (req, res) => {
  try {
    const recentGames = gameStateManager.getRecentGames();
    res.status(200).json({
      success: true,
      games: recentGames,
      count: recentGames.length
    });
  } catch (error) {
    logger.error("Error retrieving recent games:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve recent games"
    });
  }
});

if (process.env.NODE_ENV === "production") {
    app.use(express.static("frontend/build"));
    app.get("*", (req, res) => {
        res.sendFile(path.resolve(__dirname, "build", "index.html"));
    });
}

// Set up graceful shutdown
function gracefulShutdown() {
    logger.info('Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(PORT, () => {
    logger.info(`Server started on Port ${PORT} at ${new Date().toISOString()}`);
});

// Track active connections for monitoring
let activeConnections = 0;

// Health check endpoint for Cloud Run
app.get('/health', (req, res) => {
    const gameStats = gameStateManager.getStats();
    res.status(200).json({
        status: 'ok',
        connections: activeConnections,
        uptime: process.uptime(),
        gameStates: gameStats.totalGames,
        activeRooms: gameStats.activeRooms.length
    });
});

// Periodic cleanup of disconnected users (every 30 seconds)
setInterval(() => {
    const removed = cleanupDisconnectedUsers(60000); // Remove users disconnected for > 60 seconds
    if (removed.length > 0) {
        logger.info(`Periodic cleanup removed ${removed.length} disconnected users`);
    }
}, 30000);

io.on("connection", (socket) => {
    activeConnections++;
    logger.info(`User ${socket.id} connected. Active connections: ${activeConnections}`);
    io.to(socket.id).emit("server_id", socket.id);
    
    // Note: Socket timeout is already configured in the io initialization options
    // (pingTimeout, pingInterval, and connectTimeout)

    // ============================================
    // RECONNECTION HANDLERS
    // ============================================
    
    // 1. Heartbeat/Ping-Pong Handler
    // COMMENTED OUT: Using Socket.IO's built-in ping/pong mechanism instead
    // Custom implementation was causing more issues than it solved
    /*
    socket.on('ping', () => {
        const timestamp = new Date().toISOString();
        logger.debug(`[Heartbeat] ✅ Received ping from ${socket.id} at ${timestamp}, sending pong`);
        try {
            socket.emit('pong');
            logger.debug(`[Heartbeat] 📤 Pong sent successfully to ${socket.id}`);
        } catch (error) {
            logger.error(`[Heartbeat] ❌ Error sending pong to ${socket.id}:`, error);
        }
    });
    */
    
    // 2. Room Rejoin Handler
    socket.on('rejoinRoom', ({ room, gameId, playerAddress }, callback) => {
        try {
            logger.info(`User ${socket.id} attempting to rejoin room ${room} with address ${playerAddress}`);

            // Check if room has active users or game state
            const roomUsers = getUsersInRoom(room);
            const gameRoomId = gameId ? `game-${gameId}` : room;
            const roomExists = roomUsers.length > 0 || gameStateManager.hasGameState(gameRoomId);

            if (roomExists) {
                // Try to find the user's previous session by matching disconnected users
                let reconnectedUser = null;
                const disconnectedUsers = roomUsers.filter(u => u.connected === false);

                if (disconnectedUsers.length > 0) {
                    // If there's only one disconnected user, reconnect to that
                    if (disconnectedUsers.length === 1) {
                        reconnectedUser = disconnectedUsers[0];
                    }
                    // If multiple, try to match by playerAddress or take the most recent
                    else if (playerAddress) {
                        reconnectedUser = disconnectedUsers.find(u => u.address === playerAddress);
                    }

                    // Fallback: take the most recently disconnected user
                    if (!reconnectedUser && disconnectedUsers.length > 0) {
                        reconnectedUser = disconnectedUsers.sort((a, b) =>
                            (b.disconnectedAt || 0) - (a.disconnectedAt || 0)
                        )[0];
                    }
                }

                // If we found a user to reconnect, update their info
                if (reconnectedUser) {
                    reconnectedUser.id = socket.id;
                    reconnectedUser.connected = true;
                    reconnectedUser.disconnectedAt = null;
                    if (playerAddress && !reconnectedUser.address) {
                        reconnectedUser.address = playerAddress;
                    }
                    logger.info(`Reconnected user ${socket.id} as ${reconnectedUser.name} in room ${room}`);
                }

                // Add socket back to room channels
                socket.join(room);
                if (gameId) {
                    socket.join(`game-${gameId}`);
                }

                logger.info(`User ${socket.id} successfully rejoined room ${room}`);

                // Send success response with user info
                if (callback && typeof callback === 'function') {
                    callback({
                        success: true,
                        room,
                        gameId,
                        userName: reconnectedUser?.name,
                        reconnected: !!reconnectedUser
                    });
                }

                // Notify other players in the room
                socket.to(room).emit('playerReconnected', {
                    userId: socket.id,
                    userName: reconnectedUser?.name,
                    room,
                    timestamp: Date.now()
                });

                // Emit reconnected event to the socket itself
                socket.emit('reconnected', {
                    room,
                    gameId,
                    userName: reconnectedUser?.name
                });

                // Send updated room data to all users in the room (including the reconnected user)
                const updatedRoomUsers = getUsersInRoom(room).filter(u => u.connected !== false);
                io.to(room).emit('roomData', { room, users: updatedRoomUsers });
                logger.info(`Sent updated room data to room ${room} with ${updatedRoomUsers.length} users`);
            } else {
                logger.warn(`Room ${room} not found for rejoin (no users and no game state)`);
                if (callback && typeof callback === 'function') {
                    callback({ success: false, error: 'Room not found or expired' });
                }
            }
        } catch (error) {
            logger.error(`Error rejoining room ${room}:`, error);
            if (callback && typeof callback === 'function') {
                callback({ success: false, error: error.message });
            }
        }
    });
    
    // 3. Game State Sync Handler
    socket.on('requestGameStateSync', ({ roomId, gameId }) => {
        try {
            logger.info(`User ${socket.id} requesting game state sync for room ${roomId}, game ${gameId}`);
            
            // Try to fetch by roomId first
            let gameState = gameStateManager.getGameState(roomId);
            let cardHashMap = gameStateManager.getCardHashMap(roomId);
            
            // If not found by roomId, try by gameId
            if (!gameState && gameId) {
                logger.info(`Attempting to restore game state by game ID ${gameId}`);
                const gameData = gameStateManager.getGameStateByGameId(gameId);
                if (gameData) {
                    gameState = gameData.state;
                    cardHashMap = gameData.cardHashMap;
                    logger.info(`Game state restored from persistent storage for game ${gameId}`);
                }
            }
            
            if (gameState) {
                // Send state back to the requesting client
                socket.emit(`gameStateSync-${roomId}`, {
                    newState: gameState,
                    cardHashMap: cardHashMap || {},
                    restored: true
                });
                logger.info(`Game state synced for user ${socket.id} in room ${roomId}`);
            } else {
                logger.warn(`No game state found for room ${roomId} or game ${gameId}`);
                socket.emit(`gameStateSync-${roomId}`, {
                    error: 'Game state not found'
                });
            }
        } catch (error) {
            logger.error(`Error syncing game state for room ${roomId}:`, error);
            socket.emit(`gameStateSync-${roomId}`, {
                error: error.message
            });
        }
    });

    // Add room functionality
    socket.on("joinRoom", (roomId) => {
        socket.join(roomId);
        logger.info(`User ${socket.id} joined room ${roomId}`);
        io.to(roomId).emit("userJoined", socket.id);
    });

    // Add game room creation handler
    socket.on("createGameRoom", () => {
        logger.info(`Game room created by user`);
        io.emit("gameRoomCreated");
    });

    socket.on('gameStarted', (data) => {
        const { newState, cardHashMap, roomId } = data;
        logger.info(`Game started in room ${roomId}`);
        
        // Save game state for reconnection support
        gameStateManager.saveGameState(roomId, newState, cardHashMap);
        
        // Log game start with all details
        if (newState) {
            gameLogger.logGameStart(newState.id, newState.players);
            
            // Log the first card
            if (newState.currentColor && newState.currentValue) {
                gameLogger.log({
                    timestamp: new Date().toISOString(),
                    gameId: newState.id.toString(),
                    turnNumber: 0,
                    player: 'SYSTEM',
                    action: 'startGame',
                    cardDetails: `First card: ${newState.currentColor} ${newState.currentValue}`,
                    currentColor: newState.currentColor,
                    currentValue: newState.currentValue,
                    nextPlayer: newState.players[newState.currentPlayerIndex]
                });
            }
        }

        // Emit the gameStarted event to all clients in the room with a room-specific event name
        io.to(roomId).emit(`gameStarted-${roomId}`, { newState, cardHashMap });
    });

    // Add playCard event handler
    socket.on('playCard', (data) => {
        const { roomId, action, newState } = data;
        logger.info(`Card played in room ${roomId}`);
        
        // Save updated game state for reconnection support
        if (newState) {
            gameStateManager.saveGameState(roomId, newState);
        }
        
        // Log card play action
        if (action && newState) {
            const nextPlayerIndex = (newState.currentPlayerIndex) % newState.players.length;
            
            if (action.type === 'playCard' && action.cardHash) {
                gameLogger.logCardPlay(
                    newState.id.toString(),
                    Number(newState.turnCount),
                    action.player,
                    action.cardHash,
                    `${newState.currentColor} ${newState.currentValue}`,
                    newState.currentColor,
                    newState.currentValue,
                    newState.players[nextPlayerIndex]
                );
            } else if (action.type === 'drawCard') {
                // Log draw action (details would need to be passed from frontend)
                gameLogger.log({
                    timestamp: new Date().toISOString(),
                    gameId: newState.id.toString(),
                    turnNumber: Number(newState.turnCount),
                    player: action.player,
                    action: 'drawCard',
                    nextPlayer: newState.players[nextPlayerIndex]
                });
            }
        }

        // Broadcast the cardPlayed event to all clients in the room
        io.to(roomId).emit(`cardPlayed-${roomId}`, { action, newState });
    });

    // Add leave room functionality
    socket.on("leaveRoom", (roomId) => {
        socket.leave(roomId);
        logger.info(`User ${socket.id} left room ${roomId}`);
        io.to(roomId).emit("userLeft", socket.id);
    });

    socket.on("join", (payload, callback) => {
        // Filter to only count connected users for room capacity
        const connectedUsersInRoom = getUsersInRoom(payload.room).filter(u => u.connected !== false);
        let numberOfUsersInRoom = connectedUsersInRoom.length;

        // Assign player name based on current number of connected users (Player 1-6)
        const playerName = `Player ${numberOfUsersInRoom + 1}`;

        const { error, newUser, reconnected } = addUser({
            id: socket.id,
            name: playerName,
            room: payload.room,
            address: payload.address || null,
        });

        if (error) return callback(error);

        socket.join(newUser.room);

        // Send updated room data to all users (only show connected users)
        const activeUsers = getUsersInRoom(newUser.room).filter(u => u.connected !== false);
        io.to(newUser.room).emit("roomData", { room: newUser.room, users: activeUsers });
        socket.emit("currentUserData", { name: newUser.name });

        if (reconnected) {
            logger.info(`User ${socket.id} reconnected as ${newUser.name} in room ${newUser.room}`);
        } else {
            logger.info(`New user ${socket.id} joined as ${newUser.name} in room ${newUser.room}`);
        }

        logger.debug(newUser)
        callback();
    });

    // Handle game initialization request
    socket.on("requestGameInit", (payload) => {
        const user = getUser(socket.id);
        if (user) {
            const roomUsers = getUsersInRoom(user.room);
            const numPlayers = roomUsers.length;
            
            logger.info(`Initializing game in room ${user.room} with ${numPlayers} players`);
            
            // Import required utilities (these would need to be added to backend)
            const PACK_OF_CARDS = require('./packOfCards'); // You'll need to create this
            const shuffleArray = (array) => {
                const shuffled = [...array];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
            };
            
            const shuffledCards = shuffleArray(PACK_OF_CARDS);
            const gameState = {
                gameOver: false,
                turn: "Player 1",
                currentColor: "",
                currentNumber: "",
                playedCardsPile: [],
                drawCardPile: [],
            };
            
            // Deal 5 cards to each player
            for (let i = 1; i <= numPlayers && i <= 6; i++) {
                gameState[`player${i}Deck`] = shuffledCards.splice(0, 5);
            }
            
            // Initialize empty decks for unused player slots
            for (let i = numPlayers + 1; i <= 6; i++) {
                gameState[`player${i}Deck`] = [];
            }
            
            // Find a non-action starting card
            const ACTION_CARDS = ['skipR', 'skipG', 'skipB', 'skipY', 'D2R', 'D2G', 'D2B', 'D2Y', 'W', 'D4W'];
            let startingCardIndex = Math.floor(Math.random() * shuffledCards.length);
            while (ACTION_CARDS.includes(shuffledCards[startingCardIndex])) {
                startingCardIndex = Math.floor(Math.random() * shuffledCards.length);
            }
            
            const startingCard = shuffledCards.splice(startingCardIndex, 1)[0];
            gameState.playedCardsPile = [startingCard];
            gameState.currentColor = startingCard.charAt(1);
            gameState.currentNumber = startingCard.charAt(0);
            gameState.drawCardPile = shuffledCards;
            
            // Broadcast to all players in the room
            io.to(user.room).emit("initGameState", gameState);
        }
    });

    socket.on("initGameState", (gameState) => {
        const user = getUser(socket.id);
        if (user) {
            // Save game state for reconnection support
            gameStateManager.saveGameState(user.room, gameState);
            
            // Broadcast the game state to all players in the room
            io.to(user.room).emit("initGameState", gameState);
            logger.info(`Game initialized in room ${user.room} with ${Object.keys(gameState).filter(k => k.includes('Deck')).length} players`);
        }
    });

    socket.on("updateGameState", (gameState) => {
        try {
            const user = getUser(socket.id);
            if (user) {
                // Save updated game state for reconnection support
                gameStateManager.saveGameState(user.room, gameState);
                
                // Add a timestamp to track latency
                const enhancedGameState = {
                    ...gameState,
                    _serverTimestamp: Date.now()
                };
                io.to(user.room).emit("updateGameState", enhancedGameState);
            }
        } catch (error) {
            logger.error(`Error updating game state for socket ${socket.id}:`, error);
            socket.emit("error", { message: "Failed to update game state" });
        }
    });

    socket.on("sendMessage", (payload, callback) => {
        const user = getUser(socket.id);
        io.to(user.room).emit("message", { user: user.name, text: payload.message });
        callback();
    });

    socket.on("quitRoom", () => {
        const user = removeUser(socket.id);
        if (user) io.to(user.room).emit("roomData", { room: user.room, users: getUsersInRoom(user.room) });
    });

    // Handle disconnection with grace period for reconnection
    socket.on("disconnect", (reason) => {
        activeConnections--;
        logger.info(`User ${socket.id} disconnected: ${reason}. Active connections: ${activeConnections}`);
        
        // Mark user as temporarily disconnected instead of removing immediately
        const user = markUserDisconnected(socket.id);
        
        if (user) {
            // Notify other players that user is temporarily disconnected
            io.to(user.room).emit('playerDisconnected', {
                userId: socket.id,
                userName: user.name,
                temporary: true,
                reason: reason
            });
            
            // Set timeout to remove user if they don't reconnect (60 second grace period)
            setTimeout(() => {
                const currentUser = getUser(socket.id);
                
                // Only remove if user is still disconnected
                if (currentUser && currentUser.connected === false) {
                    const removedUser = removeUser(socket.id);
                    
                    if (removedUser) {
                        logger.info(`User ${socket.id} did not reconnect, removing from room ${removedUser.room}`);
                        
                        // Update room data
                        io.to(removedUser.room).emit("roomData", { 
                            room: removedUser.room, 
                            users: getUsersInRoom(removedUser.room) 
                        });
                        
                        // Notify that player permanently left
                        io.to(removedUser.room).emit('playerLeft', {
                            userId: socket.id,
                            userName: removedUser.name,
                            permanent: true
                        });
                    }
                } else if (currentUser && currentUser.connected === true) {
                    logger.info(`User ${socket.id} reconnected before timeout`);
                }
            }, 60000); // 60 second grace period
        }
    });
    
    // Handle socket errors
    socket.on("error", (error) => {
        logger.error(`Socket ${socket.id} error:`, error);
    });
});

// Global error handlers
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Keep the process running despite the error
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    // Keep the process running despite the rejection
});