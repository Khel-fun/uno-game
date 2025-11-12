const express = require("express");
const app = express();
const cors = require("cors");
const server = require("http").createServer(app);
const ws = require("ws");
const path = require('path');
const {addUser, removeUser, getUser, getUsersInRoom} = require("./users");
const { createClaimableBalance } = require("./diamnetService");
const logger = require('./logger');
const gameLogger = require('./gameLogger');

// Set server timeout to prevent hanging connections
server.timeout = 30000; // 30 seconds

const io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
    wsEngine: ws.Server,
    pingTimeout: 20000, // 20 seconds before a client is considered disconnected
    pingInterval: 10000, // Send ping every 10 seconds
    connectTimeout: 15000, // Connection timeout
    maxHttpBufferSize: 1e6, // 1MB max payload size
    transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling
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
    res.status(200).json({
        status: 'ok',
        connections: activeConnections,
        uptime: process.uptime()
    });
});

io.on("connection", (socket) => {
    activeConnections++;
    logger.info(`User ${socket.id} connected. Active connections: ${activeConnections}`);
    io.to(socket.id).emit("server_id", socket.id);
    
    // Note: Socket timeout is already configured in the io initialization options
    // (pingTimeout, pingInterval, and connectTimeout)

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
        let numberOfUsersInRoom = getUsersInRoom(payload.room).length;

        // Assign player name based on current number of users (Player 1-6)
        const playerName = `Player ${numberOfUsersInRoom + 1}`;

        const { error, newUser } = addUser({
            id: socket.id,
            name: playerName,
            room: payload.room,
        });

        if (error) return callback(error);

        socket.join(newUser.room);

        io.to(newUser.room).emit("roomData", { room: newUser.room, users: getUsersInRoom(newUser.room) });
        socket.emit("currentUserData", { name: newUser.name });
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
            // Broadcast the game state to all players in the room
            io.to(user.room).emit("initGameState", gameState);
            logger.info(`Game initialized in room ${user.room} with ${Object.keys(gameState).filter(k => k.includes('Deck')).length} players`);
        }
    });

    socket.on("updateGameState", (gameState) => {
        try {
            const user = getUser(socket.id);
            if (user) {
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

    // Handle disconnection
    socket.on("disconnect", () => {
        activeConnections--;
        logger.info(`User ${socket.id} disconnected. Active connections: ${activeConnections}`);
        
        // Clean up user data on disconnect to prevent memory leaks
        const user = removeUser(socket.id);
        if (user) {
            io.to(user.room).emit("roomData", { 
                room: user.room, 
                users: getUsersInRoom(user.room) 
            });
            io.to(user.room).emit("userLeft", socket.id);
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