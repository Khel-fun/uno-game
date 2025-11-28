import express, { Request, Response } from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import ws from "ws";
import path from "path";
import { ConvexHttpClient } from "convex/browser";
// @ts-ignore - Types will be generated after running 'npx convex dev'
import { api } from "./convex/_generated/api";
// @ts-ignore - Types will be generated after running 'npx convex dev'
import { Id } from "./convex/_generated/dataModel";
import logger from "./logger";

const app = express();
const server = http.createServer(app);

// Initialize Convex client
const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  throw new Error("CONVEX_URL environment variable is required");
}
const convex = new ConvexHttpClient(convexUrl);

// Socket.IO server setup
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  wsEngine: ws.Server,
  pingTimeout: 30000,
  pingInterval: 10000,
  connectTimeout: 20000,
  maxHttpBufferSize: 1e6,
  transports: ["websocket", "polling"],
  allowEIO3: true,
});

const PORT = process.env.PORT || 4000;
server.timeout = 120000;

app.use(cors());
app.use(express.json());

// Track active connections
let activeConnections = 0;

// ============================================
// API ENDPOINTS
// ============================================

// Health check endpoint
app.get("/health", async (req: Request, res: Response) => {
  try {
    // Query Convex for game stats
    const games = await convex.query(api.games.listAll);
    const activeGames = games.filter((g) => g.status === "Started");

    res.status(200).json({
      status: "ok",
      connections: activeConnections,
      uptime: process.uptime(),
      totalGames: games.length,
      activeGames: activeGames.length,
    });
  } catch (error) {
    logger.error("Health check failed:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch game stats",
    });
  }
});

// Get game state by numeric game ID
app.get("/api/game-state/:gameId", async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    if (!gameId) {
      return res.status(400).json({ error: "Game ID is required" });
    }

    const numericGameId = parseInt(gameId, 10);
    const game = await convex.query(api.games.byNumericId, {
      numericId: numericGameId,
    });

    if (game) {
      // Get hands for all players
      const hands = await Promise.all(
        game.players.map((playerAddress) =>
          convex.query(api.hands.byPlayer, {
            gameId: game._id,
            playerAddress,
          })
        )
      );

      // Get card mappings
      // @ts-ignore - cardMappings will be available after Convex type generation
      const cardMappings = await convex.query(api.cardMappings.getAllForGame, {
        gameId: game._id,
      });

      logger.info(`Game state retrieved for game ID ${gameId}`);
      return res.status(200).json({
        success: true,
        gameId,
        game,
        hands,
        cardMappings,
      });
    } else {
      return res.status(404).json({
        success: false,
        error: "Game state not found",
      });
    }
  } catch (error) {
    logger.error(`Error retrieving game state for game ID ${req.params.gameId}:`, error);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve game state",
    });
  }
});

// Get recent games
app.get("/api/recent-games", async (req: Request, res: Response) => {
  try {
    const games = await convex.query(api.games.listAll);
    const recentGames = games
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 20);

    res.status(200).json({
      success: true,
      games: recentGames,
      count: recentGames.length,
    });
  } catch (error) {
    logger.error("Error retrieving recent games:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve recent games",
    });
  }
});

// Create claimable balance endpoint (preserved from original)
app.post("/api/create-claimable-balance", async (req: Request, res: Response) => {
  try {
    const { winnerAddress, gameId } = req.body;

    if (!winnerAddress) {
      return res.status(400).json({ error: "Winner address is required" });
    }

    // Import dynamically to avoid build issues
    const { createClaimableBalance } = await import("./diamnetService");
    const result = await createClaimableBalance(winnerAddress);

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error creating claimable balance:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create claimable balance",
    });
  }
});

// Production static file serving
if (process.env.NODE_ENV === "production") {
  app.use(express.static("frontend/build"));
  app.get("*", (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, "build", "index.html"));
  });
}

// ============================================
// SOCKET.IO EVENT HANDLERS
// ============================================

io.on("connection", (socket: Socket) => {
  activeConnections++;
  logger.info(`User ${socket.id} connected. Active connections: ${activeConnections}`);
  socket.emit("server_id", socket.id);

  // ============================================
  // RECONNECTION HANDLERS
  // ============================================

  socket.on(
    "rejoinRoom",
    async (
      {
        room,
        gameId,
        playerAddress,
      }: { room: string; gameId?: number; playerAddress?: string },
      callback: (response: any) => void
    ) => {
      try {
        logger.info(`User ${socket.id} attempting to rejoin room ${room} with address ${playerAddress}`);

        // Query Convex for game and player data
        let game = null;
        if (gameId) {
          game = await convex.query(api.games.byNumericId, { numericId: gameId });
        } else {
          game = await convex.query(api.games.byRoomId, { roomId: room });
        }

        if (game) {
          // Update player connection status in Convex
          if (playerAddress) {
            await convex.mutation(api.players.setConnected, {
              walletAddress: playerAddress,
              socketId: socket.id,
              connected: true,
            });
          }

          // Join socket rooms
          socket.join(room);
          if (gameId) {
            socket.join(`game-${gameId}`);
          }

          logger.info(`User ${socket.id} successfully rejoined room ${room}`);

          // Get updated player list
          const players = await convex.query(api.players.inGame, {
            gameId: game._id,
          });

          if (callback && typeof callback === "function") {
            callback({
              success: true,
              room,
              gameId,
              userName: playerAddress,
              reconnected: true,
            });
          }

          // Notify other players
          socket.to(room).emit("playerReconnected", {
            userId: socket.id,
            userName: playerAddress,
            room,
            timestamp: Date.now(),
          });

          socket.emit("reconnected", {
            room,
            gameId,
            userName: playerAddress,
          });

          // Send updated room data
          io.to(room).emit("roomData", { room, users: players });
          logger.info(`Sent updated room data to room ${room} with ${players.length} players`);
        } else {
          logger.warn(`Room ${room} not found for rejoin`);
          if (callback && typeof callback === "function") {
            callback({ success: false, error: "Room not found or expired" });
          }
        }
      } catch (error) {
        logger.error(`Error rejoining room ${room}:`, error);
        if (callback && typeof callback === "function") {
          callback({ success: false, error: (error as Error).message });
        }
      }
    }
  );

  // Game state sync handler
  socket.on(
    "requestGameStateSync",
    async ({ roomId, gameId }: { roomId: string; gameId?: number }) => {
      try {
        logger.info(`User ${socket.id} requesting game state sync for room ${roomId}, game ${gameId}`);

        // Query game from Convex
        let game: any = null;
        if (gameId) {
          game = await convex.query(api.games.byNumericId, { numericId: gameId });
        } else {
          game = await convex.query(api.games.byRoomId, { roomId });
        }

        if (game) {
          // Get hands for all players
          const hands = await Promise.all(
            game.players.map((playerAddress: string) =>
              convex.query(api.hands.byPlayer, {
                gameId: game._id,
                playerAddress,
              })
            )
          );

          // Get card mappings
          // @ts-ignore - cardMappings will be available after Convex type generation
          const cardMappings = await convex.query(api.cardMappings.getAllForGame, {
            gameId: game._id,
          });

          socket.emit(`gameStateSync-${roomId}`, {
            newState: game,
            hands,
            cardMappings,
            restored: true,
          });
          logger.info(`Game state synced for user ${socket.id} in room ${roomId}`);
        } else {
          logger.warn(`No game state found for room ${roomId} or game ${gameId}`);
          socket.emit(`gameStateSync-${roomId}`, {
            error: "Game state not found",
          });
        }
      } catch (error) {
        logger.error(`Error syncing game state for room ${roomId}:`, error);
        socket.emit(`gameStateSync-${roomId}`, {
          error: (error as Error).message,
        });
      }
    }
  );

  // Join room handler
  socket.on("joinRoom", (roomId: string) => {
    socket.join(roomId);
    logger.info(`User ${socket.id} joined room ${roomId}`);
    io.to(roomId).emit("userJoined", socket.id);
  });

  // Create game room handler
  socket.on("createGameRoom", () => {
    logger.info(`Game room created by user`);
    io.emit("gameRoomCreated");
  });

  // Join game lobby
  socket.on(
    "join",
    async (
      payload: { room: string; address?: string },
      callback: (error?: string) => void
    ) => {
      try {
        // Get or create game
        let game = await convex.query(api.games.byRoomId, { roomId: payload.room });

        if (!game) {
          // Create new game
          const newGameId = await convex.mutation(api.games.create, {
            roomId: payload.room,
            players: [],
          });
          game = await convex.query(api.games.byRoomId, { roomId: payload.room });
        }

        if (!game) {
          return callback("Failed to create or find game");
        }

        // Upsert player in Convex
        if (payload.address) {
          await convex.mutation(api.players.upsert, {
            walletAddress: payload.address,
            socketId: socket.id,
            connected: true,
          });

          // Add player to game if not already in it
          if (!game.players.includes(payload.address)) {
            await convex.mutation(api.games.addPlayer, {
              gameId: game._id,
              playerAddress: payload.address,
            });
          }
        }

        socket.join(payload.room);

        // Get updated player list
        const players = await convex.query(api.players.inGame, {
          gameId: game._id,
        });

        const playerName = `Player ${players.length}`;

        // Send room data to all users
        io.to(payload.room).emit("roomData", { room: payload.room, users: players });
        socket.emit("currentUserData", { name: playerName });

        logger.info(`New user ${socket.id} joined as ${playerName} in room ${payload.room}`);
        callback();
      } catch (error) {
        logger.error("Error joining room:", error);
        callback((error as Error).message);
      }
    }
  );

  // Game started handler
  socket.on(
    "gameStarted",
    async (data: {
      roomId: string;
      gameId: number;
      playerAddresses: string[];
    }) => {
      try {
        const { roomId, gameId, playerAddresses } = data;
        logger.info(`Game started in room ${roomId}`);

        // Get game by numeric ID
        const game = await convex.query(api.games.byNumericId, {
          numericId: gameId,
        });

        if (!game) {
          logger.error(`Game ${gameId} not found`);
          return;
        }

        // Initialize game in Convex
        // @ts-ignore - gameActions will be available after Convex type generation
        const result = await convex.mutation(api.gameActions.initializeGame, {
          gameId: game._id,
          playerAddresses,
        });

        if (result.success) {
          logger.info(`Game ${gameId} initialized successfully`);

          // Get updated game state
          const updatedGame = await convex.query(api.games.byNumericId, {
            numericId: gameId,
          });

          // Get hands for all players
          const hands = await Promise.all(
            playerAddresses.map((playerAddress) =>
              convex.query(api.hands.byPlayer, {
                gameId: game._id,
                playerAddress,
              })
            )
          );

          // Get card mappings
          // @ts-ignore - cardMappings will be available after Convex type generation
          const cardMappings = await convex.query(api.cardMappings.getAllForGame, {
            gameId: game._id,
          });

          // Emit to all clients in the room
          io.to(roomId).emit(`gameStarted-${roomId}`, {
            newState: updatedGame,
            hands,
            cardMappings,
          });
        } else {
          logger.error(`Failed to initialize game ${gameId}:`, result.error);
        }
      } catch (error) {
        logger.error("Error starting game:", error);
      }
    }
  );

  // Play card handler
  socket.on(
    "playCard",
    async (data: {
      roomId: string;
      gameId: number;
      playerAddress: string;
      cardHash: string;
      chosenColor?: string;
    }) => {
      try {
        const { roomId, gameId, playerAddress, cardHash, chosenColor } = data;
        logger.info(`Card played in room ${roomId} by ${playerAddress}`);

        // Get game
        const game = await convex.query(api.games.byNumericId, {
          numericId: gameId,
        });

        if (!game) {
          logger.error(`Game ${gameId} not found`);
          return;
        }

        // Play card using Convex mutation
        // @ts-ignore - gameActions will be available after Convex type generation
        const result = await convex.mutation(api.gameActions.playCard, {
          gameId: game._id,
          playerAddress,
          cardHash,
          chosenColor,
        });

        if (result.success) {
          // Get updated game state
          const updatedGame = await convex.query(api.games.byNumericId, {
            numericId: gameId,
          });

          // Broadcast to all clients in the room
          io.to(roomId).emit(`cardPlayed-${roomId}`, {
            action: {
              type: "playCard",
              player: playerAddress,
              cardHash,
            },
            newState: updatedGame,
            winner: result.winner,
          });

          logger.info(`Card played successfully in game ${gameId}`);
        } else {
          logger.error(`Failed to play card in game ${gameId}:`, result.error);
          socket.emit("error", { message: result.error });
        }
      } catch (error) {
        logger.error("Error playing card:", error);
        socket.emit("error", { message: "Failed to play card" });
      }
    }
  );

  // Draw card handler
  socket.on(
    "drawCard",
    async (data: { roomId: string; gameId: number; playerAddress: string }) => {
      try {
        const { roomId, gameId, playerAddress } = data;
        logger.info(`Card drawn in room ${roomId} by ${playerAddress}`);

        // Get game
        const game = await convex.query(api.games.byNumericId, {
          numericId: gameId,
        });

        if (!game) {
          logger.error(`Game ${gameId} not found`);
          return;
        }

        // Draw card using Convex mutation
        // @ts-ignore - gameActions will be available after Convex type generation
        const result = await convex.mutation(api.gameActions.drawCard, {
          gameId: game._id,
          playerAddress,
        });

        if (result.success) {
          // Get updated game state
          const updatedGame = await convex.query(api.games.byNumericId, {
            numericId: gameId,
          });

          // Broadcast to all clients in the room
          io.to(roomId).emit(`cardDrawn-${roomId}`, {
            action: {
              type: "drawCard",
              player: playerAddress,
            },
            newState: updatedGame,
          });

          logger.info(`Card drawn successfully in game ${gameId}`);
        } else {
          logger.error(`Failed to draw card in game ${gameId}:`, result.error);
          socket.emit("error", { message: result.error });
        }
      } catch (error) {
        logger.error("Error drawing card:", error);
        socket.emit("error", { message: "Failed to draw card" });
      }
    }
  );

  // Leave room handler
  socket.on("leaveRoom", async (roomId: string) => {
    socket.leave(roomId);
    logger.info(`User ${socket.id} left room ${roomId}`);
    io.to(roomId).emit("userLeft", socket.id);
  });

  // Quit room handler
  socket.on("quitRoom", async () => {
    try {
      // Mark player as disconnected in Convex
      const player = await convex.query(api.players.bySocketId, {
        socketId: socket.id,
      });

      if (player) {
        await convex.mutation(api.players.setConnected, {
          walletAddress: player.walletAddress,
          socketId: socket.id,
          connected: false,
        });

        // Get game
        if (player.currentGameId) {
          const game = await convex.query(api.games.byRoomId, {
            roomId: player.currentGameId,
          });

          if (game) {
            const players = await convex.query(api.players.inGame, {
              gameId: game._id,
            });
            io.to(player.currentGameId).emit("roomData", {
              room: player.currentGameId,
              users: players,
            });
          }
        }
      }
    } catch (error) {
      logger.error("Error quitting room:", error);
    }
  });

  // Send message handler
  socket.on(
    "sendMessage",
    async (
      payload: { message: string },
      callback: () => void
    ) => {
      try {
        const player = await convex.query(api.players.bySocketId, {
          socketId: socket.id,
        });

        if (player && player.currentGameId) {
          const game = await convex.query(api.games.byRoomId, {
            roomId: player.currentGameId,
          });

          if (game) {
            io.to(player.currentGameId).emit("message", {
              user: player.walletAddress,
              text: payload.message,
            });
          }
        }
        callback();
      } catch (error) {
        logger.error("Error sending message:", error);
      }
    }
  );

  // Disconnect handler
  socket.on("disconnect", async (reason: string) => {
    activeConnections--;
    logger.info(`User ${socket.id} disconnected: ${reason}. Active connections: ${activeConnections}`);

    try {
      // Mark player as temporarily disconnected in Convex
      const player = await convex.query(api.players.bySocketId, {
        socketId: socket.id,
      });

      if (player) {
        await convex.mutation(api.players.setConnected, {
          walletAddress: player.walletAddress,
          socketId: socket.id,
          connected: false,
        });

        // Notify other players
        if (player.currentGameId) {
          io.to(player.currentGameId).emit("playerDisconnected", {
            userId: socket.id,
            userName: player.walletAddress,
            temporary: true,
            reason: reason,
          });

          // Set timeout to permanently remove if no reconnect (60 seconds)
          setTimeout(async () => {
            try {
              const currentPlayer = await convex.query(api.players.bySocketId, {
                socketId: socket.id,
              });

              if (currentPlayer && !currentPlayer.connected) {
                await convex.mutation(api.players.leaveGame, {
                  walletAddress: currentPlayer.walletAddress,
                });

                logger.info(`User ${socket.id} did not reconnect, removed from game`);

                if (currentPlayer.currentGameId) {
                  const game = await convex.query(api.games.byRoomId, {
                    roomId: currentPlayer.currentGameId,
                  });

                  if (game) {
                    const players = await convex.query(api.players.inGame, {
                      gameId: game._id,
                    });

                    io.to(currentPlayer.currentGameId).emit("roomData", {
                      room: currentPlayer.currentGameId,
                      users: players,
                    });

                    io.to(currentPlayer.currentGameId).emit("playerLeft", {
                      userId: socket.id,
                      userName: currentPlayer.walletAddress,
                      permanent: true,
                    });
                  }
                }
              } else if (currentPlayer && currentPlayer.connected) {
                logger.info(`User ${socket.id} reconnected before timeout`);
              }
            } catch (error) {
              logger.error("Error in disconnect timeout:", error);
            }
          }, 60000); // 60 second grace period
        }
      }
    } catch (error) {
      logger.error("Error handling disconnect:", error);
    }
  });

  // Socket error handler
  socket.on("error", (error: Error) => {
    logger.error(`Socket ${socket.id} error:`, error);
  });
});

// ============================================
// SERVER LIFECYCLE
// ============================================

// Graceful shutdown
function gracefulShutdown() {
  logger.info("Shutting down gracefully...");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Global error handlers
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
});

// Start server
server.listen(PORT, () => {
  logger.info(`Server started on Port ${PORT} at ${new Date().toISOString()}`);
  logger.info(`Convex URL: ${convexUrl}`);
});
