// Load environment variables from .env.local first, then .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const express = require("express");
const app = express();
const cors = require("cors");
const server = require("http").createServer(app);
const path = require('path');
const logger = require('./logger');
const socketConfig = require('./config/socket');
const apiRoutes = require('./routes/api');
const { initializeSocketHandlers } = require('./socket');
const { 
    startPeriodicCleanup, 
    setupGracefulShutdown, 
    setupGlobalErrorHandlers 
} = require('./utils/cleanup');
const convexClient = require('./services/convexClient');

// Set server timeout to prevent hanging connections
// Increased to 120 seconds to support long-lived WebSocket connections
server.timeout = 120000; // 120 seconds

// Initialize Socket.IO with configuration
const io = require("socket.io")(server, socketConfig);

const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Track active connections
const connectionTracker = { count: 0 };

// API Routes
app.use('/api', apiRoutes);

if (process.env.NODE_ENV === "production") {
    app.use(express.static("frontend/build"));
    app.get("*", (req, res) => {
        res.sendFile(path.resolve(__dirname, "build", "index.html"));
    });
}

// Initialize Convex client (optional - for data storage only)
convexClient.initialize();

// Setup utilities
setupGracefulShutdown(server);
setupGlobalErrorHandlers();
startPeriodicCleanup(30000, 60000); // Cleanup every 30s, remove users disconnected > 60s

// Initialize all socket event handlers
initializeSocketHandlers(io, connectionTracker);

// Start server
server.listen(PORT, () => {
    logger.info(`Server started on Port ${PORT} at ${new Date().toISOString()}`);
    logger.info(`Convex integration: ${convexClient.isEnabled() ? 'ENABLED' : 'DISABLED'}`);
});