import { Server, Socket } from "socket.io";
import { scheduleRemoval } from "./timers";
import log from "../log";
import type { UserStorage } from "../services/storage/userStorage";

interface ConnectionDependencies {
  userStorage: UserStorage;
}

export default function connectionHandler(
  io: Server,
  socket: Socket,
  { userStorage }: ConnectionDependencies
): void {
  log.info(`[CONNECTION] New socket connection: ${socket.id}`);

  // Send server socket id
  socket.emit("server_id", socket.id);

  socket.on("disconnect", async (reason: string) => {
    const user = await userStorage.getUserBySocketId(socket.id);
    if (user && user.room) {
      // Mark user as disconnected but keep their data
      user.socketId = null;
      user.status = "disconnected";
      user.lastSeenAt = Date.now();
      await userStorage.updateUser(user);
      
      log.info(`User disconnected ${user.name} (${reason})`);
      // notify room
      io.to(user.room).emit("playerDisconnected", {
        userId: user.id,
        userName: user.name,
        temporary: true,
        reason,
      });

      scheduleRemoval(user.id, async () => {
        const removed = await userStorage.removeUser(user.id);
        if (removed && removed.room) {
          io.to(removed.room).emit("playerLeft", {
            userId: removed.id,
            userName: removed.name,
            permanent: true,
          });
          const updated = await userStorage.getUsersInRoom(removed.room);
          io.to(removed.room).emit("roomData", {
            room: removed.room,
            users: updated,
          });
        }
      });
    }
  });
}
