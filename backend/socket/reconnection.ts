import { Server, Socket } from "socket.io";
import { clearRemoval } from "./timers";
import log from "../log";
import type { UserStorage } from "../services/storage/userStorage";
import type { GameStorage } from "../services/storage/gameStorage";

interface ReconnectionDependencies {
  userStorage: UserStorage;
  gameStorage: GameStorage;
}

interface RejoinPayload {
  room: string;
  gameId?: string | number;
  walletAddress?: string;
}

interface RejoinResponse {
  success: boolean;
  error?: string;
  room?: string;
  gameId?: string | number;
}

export default function reconnectionHandler(
  io: Server,
  socket: Socket,
  { userStorage }: ReconnectionDependencies
): void {
  socket.on(
    "rejoinRoom",
    async (
      { room, gameId, walletAddress }: RejoinPayload,
      callback?: (response: RejoinResponse) => void
    ) => {
      const match = await userStorage.reconnectUser({
        room,
        walletAddress,
        newId: socket.id,
      });

      if (!match) {
        callback?.({ success: false, error: "Room not found" });
        return;
      }

      clearRemoval(match.id);
      socket.join(room);
      log.info("User reconnected to room %s as %s", room, match.name);

      socket.emit("reconnected", { room, gameId });
      io.to(room).emit("playerReconnected", {
        userId: match.id,
        room,
        timestamp: Date.now(),
      });

      const users = await userStorage.getUsersInRoom(room);
      io.to(room).emit("roomData", { room, users });

      callback?.({ success: true, room, gameId });
    }
  );
}
