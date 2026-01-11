import { Server, Socket } from "socket.io";
import { clearRemoval } from "./timers";
import log from "../log";
import type { UserStorage } from "../services/storage/userStorage";

interface LobbyDependencies {
  userStorage: UserStorage;
}

interface JoinPayload {
  room: string;
  walletAddress?: string;
}

interface SendMessagePayload {
  message: string;
}

interface RegisterOrLoginUserPayload {
  walletAddress: string;
  username?: string;
}

export default function lobbyHandler(
  io: Server,
  socket: Socket,
  { userStorage }: LobbyDependencies
): void {
  log.info(`[LOBBY] Lobby handler initialized for socket: ${socket.id}`);

  // Register or login user when they connect wallet (creates account if new, or logs in existing user)
  socket.on(
    "registerOrLoginUser",
    async (
      { walletAddress, username }: RegisterOrLoginUserPayload,
      callback?: (error: string | null, data?: any) => void
    ) => {
      try {
        if (!walletAddress) {
          callback?.("Wallet address is required");
          return;
        }

        log.info(
          `User registration/login - socketId: ${
            socket.id
          }, wallet: ${walletAddress}, username: ${username || "none"}`
        );

        // Register or login user with UUID (creates new account or returns existing user)
        const user = await userStorage.registerOrLoginUser(walletAddress);

        // Set the current socket connection
        user.socketId = socket.id;
        user.status = "active";
        user.lastSeenAt = Date.now();

        // Update name if provided
        if (username) {
          user.name = username;
        }

        await userStorage.updateUser(user);

        log.info(
          `✓ User registered/logged in - userId: ${user.id}, wallet: ${user.walletAddress}, socketId: ${socket.id}, stored in Redis`
        );

        callback?.(null, {
          userId: user.id,
          name: user.name,
          walletAddress: user.walletAddress,
        });
      } catch (err: any) {
        log.error(`Error registering user: ${err.message}`);
        callback?.("Failed to register user");
      }
    }
  );

  socket.on(
    "join",
    async (
      { room, walletAddress }: JoinPayload,
      callback?: (error: string | null, data?: any) => void
    ) => {
      try {
        log.info(
          `Join room request - socketId: ${socket.id}, room: ${room}, wallet: ${
            walletAddress || "none"
          }`
        );

        // Use new method that updates existing user instead of creating new one
        const result = await userStorage.joinRoomWithUser(
          walletAddress || "",
          room,
          socket.id
        );

        if (result.error) {
          log.warn(`Join room failed - ${result.error}`);
          callback?.(result.error);
          return;
        }

        const { user, reused } = result;
        if (!user) return;

        clearRemoval(user.id);
        socket.join(room);
        log.info(
          `✓ User ${user.name} (${user.id}) joined room ${room}, reused: ${reused}`
        );

        socket.emit("currentUserData", { name: user.name });

        const users = await userStorage.getUsersInRoom(room);
        io.to(room).emit("roomData", { room, users });

        callback?.(null, { reused });
      } catch (err: any) {
        log.error(`Error handling join: ${err.message}`);
        callback?.("Internal error");
      }
    }
  );

  socket.on("quitRoom", async () => {
    const user = await userStorage.getUserBySocketId(socket.id);
    if (user && user.room) {
      await userStorage.removeUser(user.id);
      socket.leave(user.room);
      const users = await userStorage.getUsersInRoom(user.room);
      io.to(user.room).emit("roomData", { room: user.room, users });
    }
  });

  socket.on(
    "sendMessage",
    async ({ message }: SendMessagePayload, callback?: () => void) => {
      const user = await userStorage.getUserBySocketId(socket.id);
      if (!user || !user.room) return;
      io.to(user.room).emit("message", { user: user.name, text: message });
      callback?.();
    }
  );
}
