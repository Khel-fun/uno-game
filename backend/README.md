# Game of Uno Backend

This is the backend server for the Game of Uno application. It handles game state management, real-time communication, and blockchain interactions.

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file based on the `.env.example` template:
   ```bash
   cp .env.example .env
   ```

3. Update the `.env` file with your configuration values.

4. Start the server:
   ```bash
   npm start
   ```

## Logging

The application uses Winston for logging. Logs are stored in the `logs` directory:
- `error.log`: Contains all error-level logs
- `combined.log`: Contains all logs of all levels

You can configure the log level in the `.env` file:
```
LOG_LEVEL=info
```

Available log levels (from most to least severe):
- error
- warn
- info
- http
- verbose
- debug
- silly

In development mode, logs are also output to the console with color formatting.

## API Endpoints

- `POST /api/create-claimable-balance`: Creates a claimable balance on the Diamnet blockchain
- `GET /health`: Health check endpoint that returns server status

## Socket.IO Events

The server uses Socket.IO for real-time communication. Key events include:
- `connection`: Triggered when a client connects
- `joinRoom`: Joins a specific game room
- `createGameRoom`: Creates a new game room
- `gameStarted`: Signals the start of a game
- `playCard`: Handles card play actions
- `updateGameState`: Updates the game state
- `disconnect`: Handles client disconnection

## Graceful Shutdown

The server implements graceful shutdown handling for SIGTERM and SIGINT signals.
