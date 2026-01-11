import { Server, Socket } from "socket.io";
import { clearRemoval } from "./timers";
import log from "../log";
import type { GameStorage } from "../services/storage/gameStorage";
import type { UserStorage } from "../services/storage/userStorage";

interface GameDependencies {
  gameStorage: GameStorage;
  userStorage: UserStorage;
}

interface GameStartedPayload {
  roomId: string;
  newState: any;
  cardHashMap?: any;
}

interface PlayCardPayload {
  roomId: string;
  action: any;
  newState: any;
}

interface RequestGameStateSyncPayload {
  roomId?: string;
  gameId?: string | number;
}

export default function gameHandler(
  io: Server,
  socket: Socket,
  { gameStorage, userStorage }: GameDependencies
): void {
  // Join a specific game room (socket.io room)
  socket.on("joinRoom", async (roomId: string) => {
    const user = await userStorage.getUserBySocketId(socket.id);
    if (user) {
      clearRemoval(user.id);
      // Update user's room field in database
      user.room = roomId;
      user.status = "active";
      await userStorage.updateUser(user);
    }
    socket.join(roomId);
    io.to(roomId).emit("userJoined", socket.id);
  });

  // Create a new game room (broadcast)
  socket.on("createGameRoom", () => {
    io.emit("gameRoomCreated");
  });

  // Game started: save state and broadcast
  socket.on(
    "gameStarted",
    async ({ roomId, newState, cardHashMap }: GameStartedPayload) => {
      try {
        await gameStorage.saveGameState(roomId, newState);
        if (cardHashMap) {
          await gameStorage.saveCardHashMap(roomId, cardHashMap);
        }
        io.to(roomId).emit(`gameStarted-${roomId}`, { newState, cardHashMap });
      } catch (err: any) {
        log.error(`Error handling gameStarted: ${err.message}`);
      }
    }
  );

  // Card play / draw update
  socket.on(
    "playCard",
    async ({ roomId, action, newState }: PlayCardPayload) => {
      try {
        await gameStorage.saveGameState(roomId, newState);
        io.to(roomId).emit(`cardPlayed-${roomId}`, { action, newState });
      } catch (err: any) {
        log.error(`Error handling playCard: ${err.message}`);
      }
    }
  );

  // Generic state update with timestamp
  socket.on("updateGameState", async (gameState: any) => {
    const roomId = gameState?.roomId;
    if (!roomId) return;
    const stateWithTs = { ...gameState, _serverTimestamp: Date.now() };
    await gameStorage.saveGameState(roomId, stateWithTs);
    io.to(roomId).emit("updateGameState", stateWithTs);
  });

  // Request server-side init (optional deck shuffle)
  socket.on("requestGameInit", (payload: any = {}) => {
    // For now just echo; deck generation could go here
    io.to(payload.roomId || socket.id).emit("initGameState", payload);
  });

  // Leave a game room
  socket.on("leaveRoom", (roomId: string) => {
    socket.leave(roomId);
    io.to(roomId).emit("userLeft", socket.id);
  });

  // Request game state sync (reconnection)
  socket.on(
    "requestGameStateSync",
    async ({ roomId, gameId }: RequestGameStateSyncPayload) => {
      let saved = null;
      let effectiveRoomId = roomId;
      if (effectiveRoomId) {
        saved = await gameStorage.getGameState(effectiveRoomId);
      }
      if (!saved && gameId) {
        saved = await gameStorage.getByGameId(gameId);
        if (saved?.roomId) {
          effectiveRoomId = saved.roomId;
        }
      }
      const cardHashMap = effectiveRoomId
        ? await gameStorage.getCardHashMap(effectiveRoomId)
        : null;
      if (!saved || !effectiveRoomId) {
        socket.emit(`gameStateSync-${effectiveRoomId || "unknown"}`, {
          error: "Game state not found",
        });
        return;
      }
      socket.emit(`gameStateSync-${effectiveRoomId}`, {
        newState: saved.state || saved,
        cardHashMap,
        restored: true,
      });
    }
  );

  // Init game state (bidirectional support)
  socket.on("initGameState", (gameState: any) => {
    const roomId = gameState?.roomId;
    if (!roomId) return;
    io.to(roomId).emit("initGameState", gameState);
  });
}
