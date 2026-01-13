import { Server, Socket } from "socket.io";
import connectionHandler from "./connection";
import lobbyHandler from "./lobby";
import gameHandler from "./game";
import reconnectionHandler from "./reconnection";
import type { GameStorage } from "../services/storage/gameStorage";
import type { UserStorage } from "../services/storage/userStorage";

interface SocketDependencies {
  gameStorage: GameStorage;
  userStorage: UserStorage;
}

function registerSocketHandlers(
  io: Server,
  { gameStorage, userStorage }: SocketDependencies
): void {
  io.on("connection", (socket: Socket) => {
    connectionHandler(io, socket, { userStorage });
    lobbyHandler(io, socket, { userStorage });
    gameHandler(io, socket, { gameStorage, userStorage });
    reconnectionHandler(io, socket, { gameStorage, userStorage });
  });
}

export default registerSocketHandlers;
