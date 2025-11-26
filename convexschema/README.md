# Uno ConvexDB Schema

This project implements a ConvexDB schema for managing the game state and player-session mappings for the Uno game. It provides a structured way to handle game data, player information, and session management.

## Project Structure

- **convex/schema.ts**: Defines the ConvexDB schema for the Uno game.
- **convex/functions/**: Contains various functions for managing different aspects of the game:
  - **games.ts**: Functions related to game management.
  - **states.ts**: Functions for managing game states.
  - **moves.ts**: Functions for handling player moves.
  - **players.ts**: Functions for managing player data.
  - **sessions.ts**: Functions for managing player sessions.
- **convex/indexes.ts**: Defines indexes for the ConvexDB schema.
- **src/app.ts**: Entry point for the application, initializing the ConvexDB connection.
- **src/types/index.ts**: Exports TypeScript types and interfaces used throughout the application.
- **convex.json**: Configuration file for ConvexDB.
- **package.json**: Configuration file for npm dependencies and scripts.
- **tsconfig.json**: Configuration file for TypeScript compiler options.

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd uno-convex-schema
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Configure ConvexDB settings in `convex.json` as needed.

5. Run the application:
   ```
   npm start
   ```

## Usage

This project allows you to create and manage Uno games, track player sessions, and handle game states efficiently using ConvexDB. Refer to the individual function files for specific usage instructions and examples.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.