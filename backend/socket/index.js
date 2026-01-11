const connectionHandler = require('./connection');
const lobbyHandler = require('./lobby');
const gameHandler = require('./game');
const reconnectionHandler = require('./reconnection');

function registerSocketHandlers(io, { gameStateManager, userManager }) {
  io.on('connection', (socket) => {
    connectionHandler(io, socket, { userManager });
    lobbyHandler(io, socket, { userManager });
    gameHandler(io, socket, { gameStateManager, userManager });
    reconnectionHandler(io, socket, { gameStateManager, userManager });
  });
}

module.exports = registerSocketHandlers;
