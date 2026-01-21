export const unoGameABI = [
  // Constructor
  {
    type: "constructor",
    inputs: [
      { name: "_shuffleVerifier", type: "address", internalType: "address" },
      { name: "_dealVerifier", type: "address", internalType: "address" },
      { name: "_drawVerifier", type: "address", internalType: "address" },
      { name: "_playVerifier", type: "address", internalType: "address" },
    ],
    stateMutability: "nonpayable",
  },
  // Errors
  { type: "error", name: "AlreadyJoined", inputs: [] },
  { type: "error", name: "GameFull", inputs: [] },
  { type: "error", name: "InvalidGameId", inputs: [] },
  { type: "error", name: "InvalidGameStatus", inputs: [] },
  { type: "error", name: "InvalidProof", inputs: [] },
  { type: "error", name: "InvalidVerifierAddress", inputs: [] },
  { type: "error", name: "NotEnoughPlayers", inputs: [] },
  { type: "error", name: "PlayerNotInGame", inputs: [] },
  { type: "error", name: "ReentrancyGuardReentrantCall", inputs: [] },
  // Events
  {
    type: "event",
    name: "GameCreated",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "creator", type: "address", indexed: true, internalType: "address" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "GameEnded",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "winner", type: "address", indexed: true, internalType: "address" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "GameStarted",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "deckCommitment", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MoveCommitted",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "player", type: "address", indexed: true, internalType: "address" },
      { name: "moveHash", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PlayerJoined",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "player", type: "address", indexed: true, internalType: "address" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ProofVerified",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "player", type: "address", indexed: true, internalType: "address" },
      { name: "circuitType", type: "uint8", indexed: false, internalType: "enum UnoGame.CircuitType" },
    ],
    anonymous: false,
  },
  // Functions
  {
    type: "function",
    name: "commitMove",
    inputs: [
      { name: "gameId", type: "uint256", internalType: "uint256" },
      { name: "moveHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "commitMove",
    inputs: [
      { name: "gameId", type: "uint256", internalType: "uint256" },
      { name: "moveHash", type: "bytes32", internalType: "bytes32" },
      { name: "proof", type: "bytes", internalType: "bytes" },
      { name: "publicInputs", type: "bytes32[]", internalType: "bytes32[]" },
      { name: "circuitType", type: "uint8", internalType: "enum UnoGame.CircuitType" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createGame",
    inputs: [
      { name: "_creator", type: "address", internalType: "address" },
      { name: "_isBot", type: "bool", internalType: "bool" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "dealVerifier",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IDealVerifier" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "drawVerifier",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IDrawVerifier" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "endGame",
    inputs: [
      { name: "gameId", type: "uint256", internalType: "uint256" },
      { name: "gameHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getActiveGames",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getGame",
    inputs: [{ name: "gameId", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "id", type: "uint256", internalType: "uint256" },
      { name: "players", type: "address[]", internalType: "address[]" },
      { name: "status", type: "uint8", internalType: "enum UnoGame.GameStatus" },
      { name: "startTime", type: "uint256", internalType: "uint256" },
      { name: "endTime", type: "uint256", internalType: "uint256" },
      { name: "deckCommitment", type: "bytes32", internalType: "bytes32" },
      { name: "moveCommitments", type: "bytes32[]", internalType: "bytes32[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getGameProofs",
    inputs: [{ name: "gameId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct UnoGame.MoveProof[]",
        components: [
          { name: "commitment", type: "bytes32", internalType: "bytes32" },
          { name: "proof", type: "bytes", internalType: "bytes" },
          { name: "publicInputs", type: "bytes32[]", internalType: "bytes32[]" },
          { name: "player", type: "address", internalType: "address" },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
          { name: "verified", type: "bool", internalType: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getNotStartedGames",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "joinGame",
    inputs: [
      { name: "gameId", type: "uint256", internalType: "uint256" },
      { name: "_joinee", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "playVerifier",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IPlayVerifier" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "shuffleVerifier",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IShuffleVerifier" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "startGame",
    inputs: [
      { name: "gameId", type: "uint256", internalType: "uint256" },
      { name: "deckCommitment", type: "bytes32", internalType: "bytes32" },
      { name: "shuffleProof", type: "bytes", internalType: "bytes" },
      { name: "publicInputs", type: "bytes32[]", internalType: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "startGame",
    inputs: [{ name: "gameId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateVerifiers",
    inputs: [
      { name: "_shuffleVerifier", type: "address", internalType: "address" },
      { name: "_dealVerifier", type: "address", internalType: "address" },
      { name: "_drawVerifier", type: "address", internalType: "address" },
      { name: "_playVerifier", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// Contract addresses for each network
export const CONTRACT_ADDRESSES = {
  baseSepolia: "0xbc2dB200412954577F9c84FD00b6c14E6c8bc18f",
} as const;

// Verifier addresses
export const VERIFIER_ADDRESSES = {
  baseSepolia: {
    shuffle: "0xaFDe698BFc358BE5D0a6e8F726b32a5fCb7f6DF9",
    deal: "0xeC2006F5E6C2A454296910cbf48CE9c0a272b596",
    draw: "0x9c1ABC478A33b99b680eaABe67D7C7c26217DeEa",
    play: "0x2F3B0d2B958661971fd92524aab6439134103C93",
  },
} as const;

// Circuit types enum matching the contract
export enum CircuitType {
  Shuffle = 0,
  Deal = 1,
  Draw = 2,
  Play = 3,
}

// Game status enum matching the contract
export enum GameStatus {
  NotStarted = 0,
  Active = 1,
  Ended = 2,
}
