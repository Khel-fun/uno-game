/* Main server entry for Zunno backend */
import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

import { socketConfig } from "./config/socket";
import registerSocketHandlers from "./socket";
import apiRouter from "./routes/api";
import log from "./log";
import gameStorage from "./services/storage/gameStorage";
import userStorage from "./services/storage/userStorage";
import { setupCleanup } from "./utils/cleanup";

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", apiRouter);

const server = http.createServer(app);

const io = new Server(server, socketConfig);
log.info("Socket.IO server initialized");
registerSocketHandlers(io, { gameStorage, userStorage });

// Apply server-level timeouts
server.timeout = 120000; // 120 seconds

setupCleanup({ gameStorage, userStorage });

server.listen(PORT, () => {
  log.info(`Zunno backend listening on port ${PORT}`);
});

export default server;
