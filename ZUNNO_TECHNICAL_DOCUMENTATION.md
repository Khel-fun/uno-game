# Zunno (UNO) Game - Complete Technical Documentation

**Version:** 1.0.0  
**Last Updated:** March 8, 2026  
**Project:** Blockchain-based UNO card game with Zero-Knowledge proofs

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Smart Contract Layer](#smart-contract-layer)
4. [Backend Services](#backend-services)
5. [Frontend Application](#frontend-application)
6. [Zero-Knowledge Proof System](#zero-knowledge-proof-system)
7. [Game Flow](#game-flow)
8. [Deployment & Configuration](#deployment--configuration)
9. [API Reference](#api-reference)
10. [Security Considerations](#security-considerations)

---

## System Overview

### What is Zunno?

Zunno is a decentralized, blockchain-based implementation of the classic UNO card game featuring:

- **Blockchain Integration**: Smart contracts on Base Sepolia (testnet) for game state management
- **Zero-Knowledge Proofs**: Privacy-preserving card validation using Noir circuits
- **Real-time Multiplayer**: WebSocket-based gameplay via Socket.IO
- **Wallet Authentication**: OnchainKit and Privy integration for seamless Web3 login
- **Computer AI Mode**: Single-player mode with intelligent AI opponent
- **Private & Public Lobbies**: Create private games with shareable codes or join public matches

### Technology Stack

**Frontend:**
- Next.js 14.2.35 (React 19)
- TypeScript
- Wagmi 2.16.1 + Viem 2.33.2 (Ethereum interactions)
- OnchainKit 0.38.17 (Coinbase wallet integration)
- Privy 3.13.1 (Authentication)
- Socket.IO Client 4.7.5
- TailwindCSS + Radix UI
- Noir.js 1.0.0-beta.18 (ZK proof generation)

**Backend:**
- Node.js + Express 4.17.1
- Socket.IO 4.1.3
- Redis (optional) via IORedis 5.8.2
- Prisma 6.16.2 (Database ORM)
- Winston 3.17.0 (Logging)
- Poseidon-lite 0.3.0 (Cryptographic hashing)

**Smart Contracts:**
- Solidity 0.8.20
- OpenZeppelin Contracts (ReentrancyGuard, Ownable)
- Noir ZK Verifiers (UltraVerifier interface)
- Deployed on Base Sepolia (Chain ID: 84532)

**ZK Circuits:**
- Noir Language (Aztec)
- BB.js 3.0.0 (Proof generation)
- Circuits: Shuffle, Deal, Draw, Play
- Poseidon hash function for commitments

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Play Page   │  │  Game Room   │  │  Game Logic  │          │
│  │  (Lobby)     │  │  Component   │  │  Component   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
│         └──────────────────┴──────────────────┘                   │
│                            │                                      │
│         ┌──────────────────┴──────────────────┐                  │
│         │                                     │                   │
│    ┌────▼─────┐                        ┌─────▼──────┐           │
│    │  Wagmi   │                        │  Socket.IO │           │
│    │  Hooks   │                        │   Client   │           │
│    └────┬─────┘                        └─────┬──────┘           │
└─────────┼────────────────────────────────────┼──────────────────┘
          │                                     │
          │ RPC Calls                           │ WebSocket
          │                                     │
┌─────────▼─────────────────────────────────────▼──────────────────┐
│                    BLOCKCHAIN & BACKEND                           │
│  ┌────────────────────────────┐  ┌──────────────────────────┐   │
│  │   Smart Contract           │  │   Backend Server         │   │
│  │   (UnoGame.sol)            │  │   (Express + Socket.IO)  │   │
│  │                            │  │                          │   │
│  │  - Game Creation           │  │  - Game State Manager    │   │
│  │  - Player Management       │  │  - ZK State Manager      │   │
│  │  - ZK Proof Verification   │  │  - User Manager          │   │
│  │  - Move Commitments        │  │  - Socket Handlers       │   │
│  │  - Game Lifecycle          │  │  - Redis (optional)      │   │
│  └────────────────────────────┘  └──────────┬───────────────┘   │
│                                              │                    │
│                                   ┌──────────▼───────────┐       │
│                                   │   PostgreSQL DB      │       │
│                                   │   (Prisma)           │       │
│                                   └──────────────────────┘       │
└───────────────────────────────────────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  ZK Circuits   │
                    │  (Noir)        │
                    │                │
                    │  - Shuffle     │
                    │  - Deal        │
                    │  - Draw        │
                    │  - Play        │
                    └────────────────┘
```

### Component Interaction Flow

1. **User connects wallet** → Privy/OnchainKit authentication
2. **Create/Join game** → Smart contract transaction → Event emitted
3. **Backend listens** → Registers game room → Initializes ZK state
4. **Players join** → Socket.IO room → Real-time sync
5. **Game starts** → Deck shuffled → Cards dealt → ZK Merkle tree built
6. **Gameplay** → Card plays → ZK proofs generated → Validated → State updated
7. **Game ends** → Winner determined → Rewards distributed (if applicable)

---

## Smart Contract Layer

### Contract: `UnoGame.sol`

**Location:** `/unogameui/contracts/src/UnoGame.sol`  
**Network:** Base Sepolia (Chain ID: 84532)  
**Compiler:** Solidity ^0.8.20

### Key Features

1. **Game Lifecycle Management**
2. **ZK Proof Verification**
3. **Private & Public Lobbies**
4. **Multi-player Support (2-4 players)**
5. **Move Commitment System**

### Contract Structure

#### State Variables

```solidity
uint256 private _gameIdCounter;           // Auto-incrementing game ID
uint256[] private _activeGames;           // List of active game IDs
address public zkVerify;                  // zkVerify aggregation contract
uint256 public constant MAX_PLAYERS = 4;  // Maximum players per game

// ZK Verifier contracts
IUltraVerifier public shuffleVerifier;
IUltraVerifier public dealVerifier;
IUltraVerifier public drawVerifier;
IUltraVerifier public playVerifier;
```

#### Data Structures

**Game Struct:**
```solidity
struct Game {
    uint256 id;
    address creator;
    address[] players;
    GameStatus status;           // NotStarted, Started, Ended
    bool isPrivate;
    bytes32 gameCodeHash;        // keccak256(gameCode) for private games
    uint256 maxPlayers;          // 2-4
    uint256 startTime;
    uint256 endTime;
    bytes32 deckCommitment;      // Merkle root of shuffled deck
    bytes32[] moveCommitments;   // ZK move commitments
    mapping(address => bool) hasJoined;
}
```

**MoveProof Struct:**
```solidity
struct MoveProof {
    bytes32 commitment;
    bytes proof;
    bytes32[] publicInputs;
    address player;
    uint256 timestamp;
    bool verified;
}
```

#### Core Functions

**1. Game Creation**

```solidity
function createGame(
    address _creator,
    bool _isBot,
    bool _isPrivate,
    bytes32 _gameCodeHash,
    uint256 _maxPlayers
) external nonReentrant returns (uint256)
```

- Creates a new game with specified parameters
- Generates unique game ID
- Emits `GameCreated(gameId, creator, isPrivate)` event
- For bot games, auto-starts with address(0xB07) as second player

**2. Joining Games**

```solidity
// Public games
function joinGame(uint256 gameId, address _joinee) external

// Private games (requires code)
function joinGameWithCode(
    uint256 gameId,
    address _joinee,
    string calldata _gameCode
) external
```

- Validates game status (NotStarted)
- Checks player capacity
- Verifies game code for private games using keccak256
- Emits `PlayerJoined(gameId, player)` event

**3. Starting Games**

```solidity
// With ZK shuffle proof
function startGame(
    uint256 gameId,
    bytes32 deckCommitment,
    bytes calldata shuffleProof,
    bytes32[] calldata publicInputs
) external

// Without proof (backward compatibility)
function startGame(uint256 gameId) external
```

- Requires at least 2 players
- Verifies shuffle proof if provided
- Sets game status to Started
- Stores deck commitment (Merkle root)

**4. Move Commitment**

```solidity
function commitMove(
    uint256 gameId,
    bytes32 moveHash,
    bytes calldata proof,
    bytes32[] calldata publicInputs,
    CircuitType circuitType  // Deal, Draw, or Play
) external
```

- Verifies player is in game
- Validates ZK proof based on circuit type
- Stores move commitment and proof details
- Emits `MoveCommitted` and `ProofVerified` events

**5. Game Termination**

```solidity
function endGame(uint256 gameId, bytes32 gameHash) external

function deleteGame(uint256 gameId) external  // Only creator, before start
```

#### View Functions

- `getActiveGames()` - Returns all active game IDs
- `getPublicNotStartedGames()` - Returns public games in lobby
- `getNotStartedGames()` - Returns all not-started games
- `getGamesByCreator(address)` - Returns games created by address
- `getGame(uint256)` - Returns full game details
- `getGameProofs(uint256)` - Returns all move proofs for a game
- `isGamePrivate(uint256)` - Checks if game is private

#### Events

```solidity
event GameCreated(uint256 indexed gameId, address indexed creator, bool isPrivate);
event PlayerJoined(uint256 indexed gameId, address indexed player);
event GameStarted(uint256 indexed gameId, bytes32 deckCommitment);
event MoveCommitted(uint256 indexed gameId, address indexed player, bytes32 moveHash);
event ProofVerified(uint256 indexed gameId, address indexed player, CircuitType circuitType);
event GameEnded(uint256 indexed gameId, address indexed winner);
event GameDeleted(uint256 indexed gameId, address indexed creator);
event ZkVerifyUpdated(address indexed zkVerify);
```

#### Security Features

1. **ReentrancyGuard** - Prevents reentrancy attacks on state-changing functions
2. **Access Control** - Ownable pattern for admin functions
3. **Input Validation** - Custom errors for invalid states
4. **Game Code Hashing** - Private game codes stored as keccak256 hashes
5. **ZK Proof Verification** - All moves can be cryptographically verified

---

## Backend Services

### Architecture Overview

**Location:** `/unogameui/backend/`  
**Entry Point:** `index.js`  
**Port:** 4000 (configurable via `process.env.PORT`)

### Core Modules

#### 1. Server Setup (`index.js`)

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, socketConfig);

// Register socket handlers
registerSocketHandlers(io, { 
    gameStateManager, 
    userManager, 
    trackingService 
});

server.listen(PORT);
```

**Key Dependencies:**
- Express for REST API
- Socket.IO for WebSocket communication
- CORS enabled for cross-origin requests
- Graceful shutdown handling

#### 2. Game State Manager (`gameStateManager.js`)

**Purpose:** Manages game state persistence and game code generation

**Features:**
- In-memory game state storage (Map-based)
- Optional Redis integration for distributed systems
- File-based persistence (`game-states.json`)
- Game code generation and validation
- Automatic cleanup of old states

**Key Methods:**

```javascript
class GameStateManager {
    // Game code management
    generateGameCode()                    // 8-char alphanumeric code
    registerGameCode(gameId, roomId, isPrivate, providedCode)
    getGameByCode(code)
    getCodeByGameId(gameId)
    deleteGameCode(gameId)
    
    // State management
    async saveGameState(roomId, state)
    async getGameState(roomId)
    async saveCardHashMap(roomId, cardHashMap)
    async getCardHashMap(roomId)
    async deleteGameState(roomId)
    async getByGameId(gameId)
    
    // Persistence
    persistToDisk()                       // Saves to JSON file
    loadFromDisk()                        // Loads from JSON file
    cleanupOldStates()                    // Removes expired states
}
```

**Configuration Constants:**
```javascript
GAME_STATE_TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours
FILE_PERSIST_INTERVAL_MS = 30000;          // 30 seconds
MAX_STORED_GAMES = 10;
GAME_CODE_LENGTH = 8;
GAME_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
```

#### 3. ZK State Manager (`zk/index.js`)

**Purpose:** Manages cryptographic state for zero-knowledge proofs

**Features:**
- Pre-computed card UIDs (Poseidon hashes)
- Merkle tree construction for card commitments
- Card consumption tracking (bitset)
- Proof data generation for play/draw actions

**Key Components:**

**Card UID System:**
```javascript
// 108 pre-computed Poseidon hashes matching Noir circuits
const CANONICAL_DECK_UIDS = [
    0x2a6cdcd8bc3579aa55dabad85ac4befebd94577e5cd744b0000c7f991aac8d35n,  // Wild #1
    0x15399bce9bc49ae4d02c35bed3d49c9a037b8e58ab6b051ef899431edd11b830n,  // Wild #2
    // ... 106 more cards
];

function getCardUID(color, cardType, copyIndex) {
    // Returns pre-computed UID from lookup table
    // Matches circuits/lib/src/card_uids.nr
}
```

**Cryptographic Functions:**
```javascript
// Domain separation constants (match Noir circuits)
const DOMAIN_CARD_UID = 1n;
const DOMAIN_CARD_COMMITMENT = 2n;
const DOMAIN_MERKLE_NODE = 3n;
const DOMAIN_BITSET_COMPRESS = 4n;

function generateCardCommitment(cardUID, nonce) {
    return poseidon3([DOMAIN_CARD_COMMITMENT, cardUID, nonce]);
}

function hashMerkleNode(left, right) {
    return poseidon2([left, right]);
}

function buildMerkleTree(leaves) {
    // Pads to 2^7 = 128 leaves
    // Returns { root, layers }
}

function generateMerkleProof(layers, leafIndex) {
    // Returns { path, indices } for circuit verification
}
```

**ZKGameState Class:**
```javascript
class ZKGameState {
    constructor(gameId) {
        this.gameId = gameId;
        this.cards = new Map();           // cardStr -> { uid, nonce, commitment, index }
        this.deck = [];                   // Array of card strings
        this.merkleTree = null;           // { root, layers }
        this.consumedBits = Array(108);   // Bitset for consumed cards
        this.consumedCount = 0;
    }
    
    initializeDeck(shuffledDeck)          // Build Merkle tree from deck
    getCardZKData(cardStr, deckPosition)  // Get proof data for a card
    consumeCard(cardStr, deckPosition)    // Mark card as used
    compressBitset(bits)                  // Hash bitset for proofs
    getMerkleRoot()                       // Get current Merkle root
    toJSON() / fromJSON()                 // Serialization
}
```

**Proof Data Generation:**
```javascript
function getPlayProofData(gameId, playedCard, topCard, playerHand, playerId) {
    const zkState = zkGameStates.get(gameId);
    
    // Find card data in ZK state
    const playedCardData = zkState.getCardZKData(playedCard);
    const topCardData = zkState.getCardZKData(topCard);
    
    // Compute move commitment
    const moveCommitment = poseidon4([
        gameId, playerId, playedCardUID, nonce
    ]);
    
    return {
        gameId,
        playerId,
        playedCard: { ...playedCardData, commitment: moveCommitment },
        topCard: topCardData,
        merkleRoot: zkState.getMerkleRoot(),
        consumedState: zkState.getConsumedState()
    };
}
```

#### 4. Socket Handlers

**Connection Handler (`socket/connection.js`):**
```javascript
socket.on('join', ({ room, walletAddress }, callback) => {
    const user = userManager.addUser(socket.id, room, walletAddress);
    socket.join(room);
    io.to(room).emit('roomData', { users: userManager.getUsersInRoom(room) });
    callback();
});

socket.on('disconnect', () => {
    const user = userManager.removeUser(socket.id);
    if (user) {
        io.to(user.room).emit('playerDisconnected', user.id);
    }
});
```

**Game Handler (`socket/game.js`):**

Key events handled:
- `createGameRoom` - Register game with backend
- `validateGameCode` - Verify private game code
- `getGameCode` - Retrieve code for a game
- `gameStarted` - Initialize ZK state, save game state
- `playCard` - Update and broadcast game state
- `requestGameStateSync` - Reconnection support
- `requestPlayProofData` - Provide ZK proof data
- `requestDrawProofData` - Provide draw proof data

**Lobby Handler (`socket/lobby.js`):**
- `joinRoom` - Join a specific game room
- `leaveRoom` - Leave a game room

**Reconnection Handler (`socket/reconnection.js`):**
- `rejoinRoom` - Rejoin after disconnect
- Automatic state restoration

#### 5. User Manager (`users.js`)

```javascript
class UserManager {
    constructor() {
        this.users = [];
    }
    
    addUser(id, room, walletAddress)
    removeUser(id)
    getUser(id)
    getUsersInRoom(room)
}
```

#### 6. API Routes (`routes/api.js`)

```javascript
// Health check
GET /api/health
// Response: { status: 'ok', timestamp, counts }

// Get game state by ID
GET /api/game-state/:gameId
// Response: { gameState, cardHashMap }

// Get recent games
GET /api/recent-games
// Response: { games: [...] }
```

#### 7. Tracking Service (`tracking/service.js`)

**Purpose:** Track game events in PostgreSQL database via Prisma

**Features:**
- Queue-based event processing
- Batch updates for performance
- Circuit setup tracking
- Game session management

**Database Schema (Prisma):**
```prisma
model GameSession {
  id          String   @id @default(uuid())
  chainId     Int
  gameId      String
  roomId      String?
  ownerAddress String
  isPrivate   Boolean  @default(false)
  gameCodeHash String?
  status      String   // not_started, started, ended
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model CircuitSetup {
  id          String   @id @default(uuid())
  chainId     Int
  circuitType String   // shuffle, deal, draw, play
  verifierAddress String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}
```

### Backend Configuration

**Environment Variables (`.env`):**
```bash
PORT=4000
NODE_ENV=development

# Redis (optional)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=false

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/zunno

# Tracking
DEFAULT_CHAIN_ID=84532
```

---

## Frontend Application

### Architecture Overview

**Framework:** Next.js 14 (App Router)  
**Location:** `/unogameui/frontend/`  
**Entry Point:** `src/app/layout.tsx`

### Key Pages & Components

#### 1. Play Page (`src/app/play/page.tsx`)

**Purpose:** Main lobby for creating/joining games

**Features:**
- Wallet connection (Privy + OnchainKit)
- Game creation modal (public/private)
- Browse public games
- View "My Games"
- Join with game code
- Infinite scroll pagination

**Key Functions:**

```typescript
// Create public/private game
async function createGame() {
    const gameCode = isPrivateGame ? generateGameCode() : '';
    const gameCodeHash = isPrivateGame ? keccak256(toBytes(gameCode)) : '0x0';
    
    // Encode contract call
    const data = encodeFunctionData({
        abi: unoGameABI,
        functionName: 'createGame',
        args: [address, false, isPrivateGame, gameCodeHash, maxPlayersSelection]
    });
    
    // Send transaction
    const txHash = await sendWagmiTransaction({
        to: contractAddress,
        data,
        chainId
    });
    
    // Wait for confirmation and extract gameId from logs
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const gameId = extractGameIdFromLogs(receipt.logs, contractAddress);
    
    // Register with backend
    socketManager.emit('createGameRoom', {
        gameId, isPrivate, gameCode, chainId, creatorAddress: address
    });
    
    // Navigate to game room
    router.push(`/game/${gameId}`);
}
```

**Contract Interactions:**
- `getPublicNotStartedGames()` - Fetch lobby games
- `getGamesByCreator(address)` - Fetch user's games
- `createGame()` - Create new game
- `joinGame()` / `joinGameWithCode()` - Join games

#### 2. Game Room (`src/components/gameroom/Room.tsx`)

**Purpose:** Pre-game lobby and game initialization

**Features:**
- Player waiting room
- Network validation
- Game state restoration (reconnection)
- Computer mode detection
- Game start orchestration

**Key Hooks:**

```typescript
const { address, chainId } = useAccount();
const { contract } = await getContractNew(chainId);
const { isConnected, isReconnecting } = useSocketConnection();

// Fetch game state from contract
const gameState = await fetchGameState(contract, gameId, address);

// Join socket room
socket.emit('join', { room, walletAddress: address });

// Start game
async function handleStartGame() {
    await ensureCorrectChain(gameChainId);
    
    const data = encodeFunctionData({
        abi: unoGameABI,
        functionName: 'startGame',
        args: [gameId]
    });
    
    await sendTransaction({ to: contractAddress, data, chainId });
}
```

**State Management:**
- `offChainGameState` - Local game state
- `users` - Players in room
- `gameStarted` - Game status flag
- `gameChainId` - Network validation

#### 3. Game Component (`src/components/gameroom/Game.js`)

**Purpose:** Core gameplay logic and rendering

**Features:**
- Turn-based gameplay
- Card validation
- Computer AI opponent
- Sound effects
- Real-time state synchronization
- ZK proof integration

**Game State:**
```javascript
const gameState = {
    gameOver: false,
    winner: "",
    turn: "Player 1",
    player1Deck: [],
    player2Deck: [],
    player3Deck: [],
    player4Deck: [],
    currentColor: "",
    currentNumber: "",
    playedCardsPile: [],
    drawCardPile: [],
    isUnoButtonPressed: false,
    drawButtonPressed: false,
    lastCardPlayedBy: "",
    isExtraTurn: false,
    totalPlayers: 2,
    playDirection: 1  // 1 = clockwise, -1 = counter-clockwise
};
```

**Card Validation:**
```javascript
function isValidPlay(card, currentColor, currentNumber) {
    // Wild cards always valid
    if (isWildCard(card)) return true;
    
    const { color, number } = parseCard(card);
    
    // Color match or number match
    return color === currentColor || String(number) === String(currentNumber);
}
```

**Computer AI:**
```javascript
function computerMakeMove() {
    const validMoves = player2Deck.filter(card => 
        isValidPlay(card, currentColor, currentNumber)
    );
    
    if (validMoves.length === 0) return "draw";
    
    // Prioritize special cards
    const special = validMoves.find(c => 
        isSkipCard(c) || isDraw2Card(c) || isWildCard(c)
    );
    
    return special || validMoves[0];
}
```

**Socket Events:**
```javascript
// Emit card play
socket.emit('playCard', {
    roomId: `game-${room}`,
    action: { type: 'cardPlayed', card, player },
    newState: gameState
});

// Listen for opponent moves
socket.on(`cardPlayed-${roomId}`, ({ action, newState }) => {
    dispatch(newState);
    playCardSound(action.card);
});

// Listen for game start
socket.on(`gameStarted-${roomId}`, ({ newState, cardHashMap, zkData }) => {
    dispatch(newState);
    setOffChainGameState(newState);
});
```

#### 4. ZK Integration (`src/hooks/useZKGameIntegration.ts`)

**Purpose:** Generate and verify zero-knowledge proofs for gameplay

**Features:**
- Real/simulated proof modes
- Backend proof data requests
- Local verification
- zkVerify submission
- Proof persistence

**Key Functions:**

```typescript
async function generatePlayProof(
    playedCard: string,
    playerHand: string[],
    topCard: string,
    playerId: string,
    gameId: string
) {
    // Request proof data from backend
    const proofData = await new Promise<BackendPlayProofData>((resolve) => {
        socket.emit('requestPlayProofData', {
            gameId, playedCard, topCard, playerHand, playerId
        });
        
        socket.once('playProofData', (data) => resolve(data));
    });
    
    // Build circuit input
    const input = {
        game_id: proofData.gameId,
        player_id: proofData.playerId,
        move_commitment: proofData.playedCard.commitment,
        hand_merkle_root: proofData.playedCard.merkleRoot,
        top_card_commitment: proofData.topCard.commitment,
        played_card_color: proofData.playedCard.color,
        played_card_type: proofData.playedCard.cardType,
        played_card_copy: proofData.playedCard.copyIndex,
        played_card_nonce: proofData.playedCard.nonce,
        played_card_merkle_path: proofData.playedCard.merkleProof,
        // ... more fields
    };
    
    // Generate proof using Noir
    const proof = await proofService.generatePlayProof(input);
    
    // Verify locally
    const verifyResult = await verificationService.verifyLocally('play', proof);
    
    // Submit to zkVerify (non-blocking)
    verificationService.submitToZkVerify('play', proof);
    
    return proof;
}
```

**Proof Statistics:**
```typescript
const [stats, setStats] = useState({
    proofsGenerated: 0,
    proofsVerified: 0,
    proofsSimulated: 0,
    totalGenerationTime: 0,
    lastProofType: null,
    lastProofTime: 0,
    errors: 0
});
```

#### 5. Wallet Integration

**Privy Configuration:**
```typescript
<PrivyProvider
    appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
    config={{
        loginMethods: ['wallet', 'email'],
        appearance: { theme: 'dark' },
        embeddedWallets: {
            createOnLogin: 'users-without-wallets'
        }
    }}
>
```

**Wagmi Configuration:**
```typescript
const config = createConfig({
    chains: [baseSepolia],
    connectors: [
        coinbaseWallet({ appName: 'Zunno' }),
        injected()
    ],
    transports: {
        [baseSepolia.id]: http()
    }
});
```

**OnchainKit Integration:**
```typescript
<OnchainKitProvider
    apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
    chain={baseSepolia}
>
    <WalletProvider>
        <App />
    </WalletProvider>
</OnchainKitProvider>
```

### Frontend File Structure

```
frontend/src/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Landing page
│   ├── play/page.tsx           # Game lobby
│   └── game/[id]/page.tsx      # Game room
├── components/
│   ├── gameroom/
│   │   ├── Room.tsx            # Pre-game lobby
│   │   ├── Game.js             # Main game logic
│   │   ├── GameScreen.js       # Game UI
│   │   ├── CenterInfo.js       # Center card display
│   │   └── colourDialog.tsx    # Wild card color picker
│   ├── WalletConnection.tsx    # Wallet UI
│   ├── ProfileDropdown.tsx     # User menu
│   └── ui/                     # Radix UI components
├── hooks/
│   ├── useZKGameIntegration.ts # ZK proof generation
│   ├── useChainSwitcher.ts     # Network switching
│   └── useBalanceCheck.ts      # ETH balance validation
├── lib/
│   ├── web3.ts                 # Contract utilities
│   ├── zk/
│   │   ├── proofService.ts     # Noir proof generation
│   │   ├── verificationService.ts # Proof verification
│   │   ├── zkVerifyService.ts  # zkVerify integration
│   │   └── cardUids.ts         # Card UID lookup
├── services/
│   ├── socket.ts               # Socket.IO client
│   └── socketManager.ts        # Connection management
├── constants/
│   ├── unogameabi.ts           # Contract ABI
│   ├── gameConstants.ts        # Game rules
│   └── networks.ts             # Chain configs
└── utils/
    ├── packOfCards.js          # Card definitions
    └── shuffleArray.js         # Deck shuffling
```

---

## Zero-Knowledge Proof System

### Overview

Zunno uses **Noir** (Aztec's ZK language) to generate zero-knowledge proofs for:
1. **Shuffle** - Prove deck was shuffled correctly
2. **Deal** - Prove cards were dealt fairly
3. **Draw** - Prove card drawn from deck is valid
4. **Play** - Prove played card matches game rules

### Circuit Architecture

**Location:** `/unogameui/circuits/`

```
circuits/
├── lib/                    # Shared library
│   └── src/
│       ├── card_uids.nr    # Pre-computed card UIDs
│       ├── constants.nr    # Domain separators
│       ├── types.nr        # Structs (Card, MerkleProof)
│       └── utils/
│           ├── hash.nr     # Poseidon hashing
│           └── merkle.nr   # Merkle tree verification
├── shuffle/
│   └── src/main.nr         # Shuffle circuit
├── deal/
│   └── src/main.nr         # Deal circuit
├── draw/
│   └── src/main.nr         # Draw circuit
└── play/
    └── src/main.nr         # Play circuit
```

### Play Circuit (Example)

**File:** `circuits/play/src/main.nr`

```noir
use dep::lib::types::{Card, MerkleProof};
use dep::lib::utils::hash::{hash_card_commitment, hash_4};
use dep::lib::utils::merkle::verify_merkle_proof;
use dep::lib::card_uids::get_card_uid;

fn main(
    game_id: Field,
    player_id: Field,
    move_commitment: pub Field,
    hand_merkle_root: pub Field,
    top_card_commitment: pub Field,
    
    // Played card (private)
    played_card_color: u8,
    played_card_type: u8,
    played_card_copy: u8,
    played_card_nonce: Field,
    played_card_merkle_path: MerkleProof,
    
    // Top card (private)
    top_card_color: u8,
    top_card_type: u8,
    top_card_copy: u8,
    top_card_nonce: Field
) {
    // 1. Compute played card UID
    let played_uid = get_card_uid(
        played_card_color, 
        played_card_type, 
        played_card_copy
    );
    
    // 2. Verify move commitment
    let computed_commitment = hash_4([
        game_id, 
        player_id, 
        played_uid, 
        played_card_nonce
    ]);
    assert(computed_commitment == move_commitment);
    
    // 3. Verify card is in player's hand (Merkle proof)
    let card_commitment = hash_card_commitment(played_uid, played_card_nonce);
    assert(verify_merkle_proof(
        card_commitment,
        hand_merkle_root,
        played_card_merkle_path
    ));
    
    // 4. Verify play is valid (color or number match)
    let is_wild = played_card_color == 0;
    let color_match = played_card_color == top_card_color;
    let number_match = played_card_type == top_card_type;
    
    assert(is_wild | color_match | number_match);
}
```

### Cryptographic Primitives

**Poseidon Hash Function:**
- Used for all commitments and Merkle trees
- BN254 curve (21888242871839275222246405745257275088548364400416034343698204186575808495617)
- Domain separation for different hash types

**Domain Separators:**
```noir
global DOMAIN_CARD_UID: Field = 1;
global DOMAIN_CARD_COMMITMENT: Field = 2;
global DOMAIN_MERKLE_NODE: Field = 3;
global DOMAIN_BITSET_COMPRESS: Field = 4;
```

**Card UID Computation:**
```noir
fn get_card_uid(color: u8, card_type: u8, copy_index: u8) -> Field {
    // Pre-computed lookup table (108 cards)
    // Poseidon4(DOMAIN_CARD_UID, color, card_type, copy_index)
    CANONICAL_DECK_UIDS[index]
}
```

**Card Commitment:**
```noir
fn hash_card_commitment(card_uid: Field, nonce: Field) -> Field {
    poseidon3([DOMAIN_CARD_COMMITMENT, card_uid, nonce])
}
```

**Merkle Tree:**
- Depth: 7 (supports 128 leaves for 108 cards)
- Hash function: Poseidon2 (no domain separation)
- Padding: Zero-filled to 128 leaves

### Proof Generation Flow

1. **Backend prepares proof data:**
   - Card UIDs from lookup table
   - Nonces (random 128-bit values)
   - Commitments (Poseidon hashes)
   - Merkle proofs (path + indices)

2. **Frontend requests proof data:**
   ```typescript
   socket.emit('requestPlayProofData', { gameId, playedCard, topCard });
   socket.on('playProofData', (data) => { /* ... */ });
   ```

3. **Frontend generates proof:**
   ```typescript
   const proof = await noir.generateProof(input);
   ```

4. **Local verification:**
   ```typescript
   const isValid = await noir.verifyProof(proof);
   ```

5. **Submit to zkVerify (optional):**
   ```typescript
   await zkVerifyService.submitProof(proof);
   ```

6. **On-chain verification (optional):**
   ```solidity
   playVerifier.verify(proof, publicInputs);
   ```

### Proof Optimization

**Simulation Mode:**
- Enabled by default (`ENABLE_REAL_PROOFS = false`)
- Skips actual proof generation
- Instant validation for testing
- Toggle via environment variable

**Caching:**
- Proof data cached in backend ZK state
- Merkle tree computed once per game
- Card commitments pre-computed

**Batching:**
- Multiple moves can be batched
- Aggregate proofs via zkVerify
- Reduces on-chain verification costs

---

## Game Flow

### Complete Game Lifecycle

#### Phase 1: Game Creation

```
User → Connect Wallet → Create Game
  ↓
Frontend → Smart Contract: createGame(creator, isBot, isPrivate, codeHash, maxPlayers)
  ↓
Contract → Emit: GameCreated(gameId, creator, isPrivate)
  ↓
Frontend → Extract gameId from logs
  ↓
Frontend → Backend: createGameRoom({ gameId, isPrivate, gameCode })
  ↓
Backend → Register game code → Store in gameStateManager
  ↓
Frontend → Navigate to /game/{gameId}
```

#### Phase 2: Players Join

```
Player 2 → Browse Public Games / Enter Game Code
  ↓
Frontend → Smart Contract: joinGame(gameId, player) OR joinGameWithCode(gameId, player, code)
  ↓
Contract → Verify capacity & code → Add player
  ↓
Contract → Emit: PlayerJoined(gameId, player)
  ↓
Frontend → Socket: join({ room: `game-${gameId}`, walletAddress })
  ↓
Backend → userManager.addUser(socketId, room, wallet)
  ↓
Backend → Emit: roomData({ users })
  ↓
All clients → Update player list
```

#### Phase 3: Game Start

```
Creator → Click "Start Game"
  ↓
Frontend → Smart Contract: startGame(gameId)
  ↓
Contract → Verify ≥2 players → Set status = Started
  ↓
Contract → Emit: GameStarted(gameId, deckCommitment)
  ↓
Frontend → Initialize game state:
  - Shuffle deck (PACK_OF_CARDS)
  - Deal 5 cards to each player
  - Select starting card (non-action)
  - Create cardHashMap (hash → {color, value})
  ↓
Frontend → Socket: gameStarted({ roomId, newState, cardHashMap })
  ↓
Backend → Initialize ZK state:
  - Convert cardHashMap to card strings
  - Generate card UIDs, nonces, commitments
  - Build Merkle tree (depth 7, 128 leaves)
  - Store in zkGameStates Map
  ↓
Backend → Save game state & cardHashMap
  ↓
Backend → Emit: gameStarted-{roomId}({ newState, cardHashMap, zkData })
  ↓
All clients → Receive state → Render game board
```

#### Phase 4: Gameplay

**Player Turn:**
```
Player → Select card to play
  ↓
Frontend → Validate: isValidPlay(card, currentColor, currentNumber)
  ↓
If valid:
  Frontend → Update local state
  Frontend → Socket: playCard({ roomId, action, newState })
  Backend → Save state
  Backend → Emit: cardPlayed-{roomId}({ action, newState })
  All clients → Update UI
  
If wild card:
  Frontend → Show color picker dialog
  Player → Select color
  Frontend → Update currentColor
  
If special card (Skip/Reverse/Draw2/Draw4):
  Frontend → Apply effect:
    - Skip: Next player loses turn
    - Reverse: Reverse play direction
    - Draw2: Next player draws 2
    - Draw4: Next player draws 4
```

**Computer Turn (if enabled):**
```
Turn = "Player 2" (Computer)
  ↓
Frontend → Wait 1.5s (UX delay)
  ↓
Frontend → computerMakeMove():
  - Get valid moves
  - Prioritize special cards
  - Return card or "draw"
  ↓
Frontend → Execute move
```

**ZK Proof Generation (optional):**
```
Player plays card
  ↓
Frontend → Socket: requestPlayProofData({ gameId, playedCard, topCard })
  ↓
Backend → zkState.getPlayProofData()
  - Find card in Merkle tree
  - Generate Merkle proof
  - Compute move commitment
  ↓
Backend → Socket: playProofData({ playedCard, topCard, merkleRoot, ... })
  ↓
Frontend → Build circuit input
  ↓
Frontend → Noir: generatePlayProof(input)
  ↓
Frontend → Verify locally
  ↓
Frontend → Submit to zkVerify (background)
```

#### Phase 5: Game End

```
Player plays last card
  ↓
Frontend → checkGameOver(deck) → true
  ↓
Frontend → checkWinner(deck, player) → winner
  ↓
Frontend → Update state: { gameOver: true, winner }
  ↓
Frontend → Smart Contract: endGame(gameId, gameHash)
  ↓
Contract → Set status = Ended → Remove from activeGames
  ↓
Contract → Emit: GameEnded(gameId, winner)
  ↓
Frontend → Show winner modal
  ↓
Backend → Delete game state (optional)
```

### Reconnection Flow

```
Player refreshes page / loses connection
  ↓
Frontend → Detect gameId from URL
  ↓
Frontend → Socket: requestGameStateSync({ roomId, gameId })
  ↓
Backend → gameStateManager.getGameState(roomId)
  ↓
Backend → gameStateManager.getCardHashMap(roomId)
  ↓
Backend → Socket: gameStateSync-{roomId}({ newState, cardHashMap, restored: true })
  ↓
Frontend → Restore state:
  - dispatch(newState)
  - Rebuild UI
  - Show toast: "Game state restored"
```

---

## Deployment & Configuration

### Smart Contract Deployment

**Network:** Base Sepolia (Chain ID: 84532)  
**Deployment Tool:** Foundry

**Steps:**
1. Compile contracts:
   ```bash
   cd unogameui/contracts
   forge build
   ```

2. Deploy verifiers (Noir circuits):
   ```bash
   cd ../circuits
   ./generate_verifiers.sh
   ```

3. Deploy UnoGame contract:
   ```bash
   forge create src/UnoGame.sol:UnoGame \
     --constructor-args <shuffleVerifier> <dealVerifier> <drawVerifier> <playVerifier> <zkVerify> \
     --private-key $PRIVATE_KEY \
     --rpc-url https://sepolia.base.org
   ```

4. Update frontend config:
   ```typescript
   // frontend/src/config/networks.ts
   export const CONTRACT_ADDRESSES = {
     84532: '0x...' // Deployed address
   };
   ```

### Backend Deployment

**Requirements:**
- Node.js 18+
- PostgreSQL 14+ (for tracking)
- Redis (optional, for distributed systems)

**Steps:**

1. Install dependencies:
   ```bash
   cd unogameui/backend
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. Setup database:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   npm run tracking:seed:circuits
   ```

4. Start server:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

**Production Considerations:**
- Use PM2 or systemd for process management
- Enable Redis for multi-instance deployments
- Configure CORS for your frontend domain
- Set up logging aggregation (Winston → CloudWatch/Datadog)
- Monitor WebSocket connections
- Implement rate limiting

### Frontend Deployment

**Platform:** Vercel (recommended for Next.js)

**Steps:**

1. Install dependencies:
   ```bash
   cd unogameui/frontend
   npm install
   ```

2. Configure environment:
   ```bash
   # .env.local
   NEXT_PUBLIC_BACKEND_URL=https://api.zunno.game
   NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
   NEXT_PUBLIC_PRIVY_APP_ID=...
   NEXT_PUBLIC_ONCHAINKIT_API_KEY=...
   ```

3. Build:
   ```bash
   npm run build
   ```

4. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

**Environment Variables:**
```bash
# Wallet & Auth
NEXT_PUBLIC_PRIVY_APP_ID=clxxx...
NEXT_PUBLIC_ONCHAINKIT_API_KEY=...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# Backend
NEXT_PUBLIC_BACKEND_URL=https://api.zunno.game

# Contract
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=84532

# ZK Proofs
NEXT_PUBLIC_ENABLE_REAL_PROOFS=false

# Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=...
```

### Network Configuration

**Supported Chains:**
```typescript
// frontend/src/config/networks.ts
export const SUPPORTED_CHAINS = {
  84532: {
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    contractAddress: '0x...'
  }
};

export const DEFAULT_CHAIN_ID = 84532;
```

---

## API Reference

### Smart Contract ABI

**Key Functions:**

```typescript
// Game Management
createGame(address _creator, bool _isBot, bool _isPrivate, bytes32 _gameCodeHash, uint256 _maxPlayers) returns (uint256)
joinGame(uint256 gameId, address _joinee)
joinGameWithCode(uint256 gameId, address _joinee, string _gameCode)
startGame(uint256 gameId)
deleteGame(uint256 gameId)
endGame(uint256 gameId, bytes32 gameHash)

// ZK Proofs
commitMove(uint256 gameId, bytes32 moveHash, bytes proof, bytes32[] publicInputs, CircuitType circuitType)

// View Functions
getActiveGames() returns (uint256[])
getPublicNotStartedGames() returns (uint256[])
getGamesByCreator(address) returns (uint256[])
getGame(uint256) returns (GameView)
isGamePrivate(uint256) returns (bool)
```

### Backend Socket Events

**Client → Server:**

```typescript
// Connection
'join' → { room: string, walletAddress: string }
'disconnect' → void

// Lobby
'joinRoom' → roomId: string
'leaveRoom' → roomId: string

// Game Management
'createGameRoom' → { gameId, isPrivate, gameCode, chainId, creatorAddress }
'validateGameCode' → { gameCode }
'getGameCode' → { gameId }
'deleteGameCode' → { gameId, chainId }

// Gameplay
'gameStarted' → { roomId, newState, cardHashMap }
'playCard' → { roomId, action, newState }
'updateGameState' → gameState
'requestGameStateSync' → { roomId, gameId }

// ZK Proofs
'requestPlayProofData' → { gameId, playedCard, topCard, playerHand, playerId }
'requestDrawProofData' → { gameId, drawnCard, deckPosition }
'requestZKState' → { gameId }
```

**Server → Client:**

```typescript
// Connection
'roomData' → { users: User[] }
'currentUserData' → { user: User }
'playerDisconnected' → userId: string
'playerLeft' → userId: string

// Game Management
'gameRoomCreated' → { gameId, isPrivate }
'userJoined' → socketId: string
'userLeft' → socketId: string

// Gameplay
'gameStarted-{roomId}' → { newState, cardHashMap, zkData }
'cardPlayed-{roomId}' → { action, newState }
'gameStateSync-{roomId}' → { newState, cardHashMap, restored }
'updateGameState' → gameState

// ZK Proofs
'playProofData' → { gameId, playerId, playedCard, topCard, merkleRoot }
'drawProofData' → { gameId, drawnCard, merkleRoot }
'zkState' → { gameId, merkleRoot, consumedState }
```

### REST API Endpoints

```
GET /api/health
Response: {
  status: 'ok',
  timestamp: number,
  counts: {
    gameStates: number,
    activeRooms: number,
    gameCodes: number
  },
  redis: boolean
}

GET /api/game-state/:gameId
Response: {
  gameState: object,
  cardHashMap: object
}

GET /api/recent-games
Response: {
  games: Array<{
    gameId: string,
    roomId: string,
    state: object,
    updatedAt: number
  }>
}
```

---

## Security Considerations

### Smart Contract Security

1. **Reentrancy Protection**
   - All state-changing functions use `nonReentrant` modifier
   - OpenZeppelin's ReentrancyGuard implementation

2. **Access Control**
   - Ownable pattern for admin functions
   - Player validation for game actions
   - Creator-only game deletion

3. **Input Validation**
   - Custom errors for invalid states
   - Range checks on player counts (2-4)
   - Game status validation via modifiers

4. **Private Game Security**
   - Game codes stored as keccak256 hashes
   - Pre-image resistance prevents code guessing
   - Codes generated client-side, never transmitted in plain text on-chain

5. **ZK Proof Verification**
   - All proofs verified by UltraVerifier contracts
   - Public inputs validated against commitments
   - Prevents cheating via cryptographic guarantees

### Backend Security

1. **WebSocket Security**
   - CORS configuration for allowed origins
   - Socket.IO authentication via wallet addresses
   - Room isolation (players can't access other games)

2. **Data Validation**
   - Input sanitization on all socket events
   - Game state validation before persistence
   - Rate limiting on API endpoints (recommended)

3. **State Management**
   - Automatic cleanup of old game states
   - TTL-based expiration (24 hours)
   - Redis encryption in transit (if enabled)

4. **Logging**
   - Winston logger with configurable levels
   - No sensitive data in logs
   - Structured logging for monitoring

### Frontend Security

1. **Wallet Security**
   - Privy embedded wallets with MPC
   - Never expose private keys
   - Transaction signing via user approval

2. **Network Validation**
   - Chain ID verification before transactions
   - Automatic network switching prompts
   - Contract address validation

3. **XSS Prevention**
   - React's built-in XSS protection
   - No dangerouslySetInnerHTML usage
   - Input sanitization for user-generated content

4. **CSRF Protection**
   - SameSite cookies
   - Origin validation on WebSocket connections

### ZK Security

1. **Proof Soundness**
   - Noir circuits formally verified
   - Poseidon hash function cryptographically secure
   - BN254 curve (128-bit security level)

2. **Privacy Guarantees**
   - Card values never revealed on-chain
   - Only commitments and proofs stored
   - Merkle proofs prevent hand reconstruction

3. **Replay Protection**
   - Nonces prevent proof reuse
   - Game ID and player ID in commitments
   - Timestamp validation (optional)

### Recommendations

1. **Smart Contract Audits**
   - Professional audit before mainnet deployment
   - Formal verification of critical functions
   - Bug bounty program

2. **Backend Hardening**
   - Implement rate limiting (express-rate-limit)
   - Add DDoS protection (Cloudflare)
   - Enable Redis authentication
   - Use HTTPS/WSS in production

3. **Frontend Best Practices**
   - Content Security Policy headers
   - Subresource Integrity for CDN scripts
   - Regular dependency updates
   - Security headers (Helmet.js)

4. **Monitoring**
   - Real-time error tracking (Sentry)
   - Performance monitoring (New Relic)
   - Blockchain event monitoring
   - WebSocket connection health checks

---

## Appendix

### Card Encoding

**Card String Format:**
- Number cards: `{number}{color}` (e.g., `5R`, `9B`)
- Skip: `skip{color}` (e.g., `skipG`)
- Reverse: `_{color}` (e.g., `_Y`)
- Draw Two: `D2{color}` (e.g., `D2R`)
- Wild: `W`
- Wild Draw Four: `D4W`

**Colors:**
- R = Red (1)
- G = Green (2)
- B = Blue (3)
- Y = Yellow (4)

**Card Types:**
- 0-9 = Number cards
- 10 = Skip
- 11 = Reverse
- 12 = Draw Two
- 13 = Wild
- 14 = Wild Draw Four

### Deck Composition

- **108 total cards**
- Wild cards: 4 Wild + 4 Wild Draw Four = 8
- Per color (Red/Green/Blue/Yellow):
  - 1× Zero
  - 2× each number (1-9) = 18
  - 2× Skip = 2
  - 2× Reverse = 2
  - 2× Draw Two = 2
  - Total per color: 25
- Total colored cards: 25 × 4 = 100

### Game Rules

1. **Setup:** Each player gets 5 cards
2. **Turn order:** Clockwise (can reverse)
3. **Valid play:** Match color OR number (wild always valid)
4. **Special cards:**
   - Skip: Next player loses turn
   - Reverse: Reverse play direction
   - Draw Two: Next player draws 2 and loses turn
   - Wild: Choose new color
   - Wild Draw Four: Choose new color, next player draws 4
5. **Drawing:** If no valid play, draw 1 card
6. **UNO:** Say "UNO" when down to 1 card (optional)
7. **Winning:** First player to empty hand wins

### Troubleshooting

**Common Issues:**

1. **"Network mismatch" error**
   - Solution: Switch to Base Sepolia in wallet

2. **"Game state not found" on reconnect**
   - Solution: Backend may have restarted, create new game

3. **ZK proof generation fails**
   - Solution: Enable simulation mode (`ENABLE_REAL_PROOFS=false`)

4. **Transaction fails with "InvalidGameId"**
   - Solution: Game may have been deleted, refresh lobby

5. **Socket disconnects frequently**
   - Solution: Check backend logs, verify CORS settings

### Performance Metrics

**Expected Performance:**
- Game creation: ~5-10 seconds (blockchain confirmation)
- Join game: ~3-5 seconds
- Card play: <100ms (off-chain)
- ZK proof generation: 2-5 seconds (real mode)
- ZK proof verification: <1 second
- Reconnection: <2 seconds

### Future Enhancements

1. **Tournaments & Leaderboards**
2. **NFT Card Skins**
3. **Mainnet Deployment**
4. **Mobile App (React Native)**
5. **Voice Chat Integration**
6. **Spectator Mode**
7. **Replay System**
8. **Advanced AI Difficulty Levels**
9. **Cross-chain Support**
10. **Gasless Transactions (Account Abstraction)**

---

**Document Version:** 1.0.0  
**Last Updated:** March 8, 2026  
**Maintainer:** Zunno Development Team

For questions or contributions, please refer to the project repository.
