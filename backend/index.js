/* Main server entry for Zunno backend */
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { socketConfig } = require('./config/socket');
const registerSocketHandlers = require('./socket');
const apiRouter = require('./routes/api');
const logger = require('./logger');
const gameStateManager = require('./gameStateManager');
const userManager = require('./users');
const { setupCleanup } = require('./utils/cleanup');

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);

const server = http.createServer(app);

const io = new Server(server, socketConfig);
registerSocketHandlers(io, { gameStateManager, userManager });

// Apply server-level timeouts
server.timeout = 120000; // 120 seconds

setupCleanup({ gameStateManager, userManager });

server.listen(PORT, () => {
  logger.info(`Zunno backend listening on port ${PORT}`);
});

module.exports = server;
