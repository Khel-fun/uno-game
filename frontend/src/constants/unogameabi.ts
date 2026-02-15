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
  { type: "error", name: "GameAlreadyStarted", inputs: [] },
  { type: "error", name: "GameFull", inputs: [] },
  { type: "error", name: "InvalidGameCode", inputs: [] },
  { type: "error", name: "InvalidGameId", inputs: [] },
  { type: "error", name: "InvalidGameStatus", inputs: [] },
  { type: "error", name: "InvalidMaxPlayers", inputs: [] },
  { type: "error", name: "InvalidProof", inputs: [] },
  { type: "error", name: "InvalidVerifierAddress", inputs: [] },
  { type: "error", name: "NotEnoughPlayers", inputs: [] },
  { type: "error", name: "NotGameCreator", inputs: [] },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
  },
  { type: "error", name: "PlayerNotInGame", inputs: [] },
  { type: "error", name: "ReentrancyGuardReentrantCall", inputs: [] },
  // Events
  {
    type: "event",
    name: "GameCreated",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "creator", type: "address", indexed: true, internalType: "address" },
      { name: "isPrivate", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "GameDeleted",
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
    name: "OwnershipTransferred",
    inputs: [
      { name: "previousOwner", type: "address", indexed: true, internalType: "address" },
      { name: "newOwner", type: "address", indexed: true, internalType: "address" },
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
    name: "MAX_PLAYERS",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
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
    name: "createGame",
    inputs: [
      { name: "_creator", type: "address", internalType: "address" },
      { name: "_isBot", type: "bool", internalType: "bool" },
      { name: "_isPrivate", type: "bool", internalType: "bool" },
      { name: "_gameCodeHash", type: "bytes32", internalType: "bytes32" },
      { name: "_maxPlayers", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "dealVerifier",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IUltraVerifier" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deleteGame",
    inputs: [{ name: "gameId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "drawVerifier",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IUltraVerifier" }],
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
      {
        name: "view_",
        type: "tuple",
        internalType: "struct UnoGame.GameView",
        components: [
          { name: "id", type: "uint256", internalType: "uint256" },
          { name: "creator", type: "address", internalType: "address" },
          { name: "players", type: "address[]", internalType: "address[]" },
          { name: "status", type: "uint8", internalType: "enum UnoGame.GameStatus" },
          { name: "isPrivate", type: "bool", internalType: "bool" },
          { name: "gameCodeHash", type: "bytes32", internalType: "bytes32" },
          { name: "maxPlayers", type: "uint256", internalType: "uint256" },
          { name: "startTime", type: "uint256", internalType: "uint256" },
          { name: "endTime", type: "uint256", internalType: "uint256" },
          { name: "deckCommitment", type: "bytes32", internalType: "bytes32" },
          { name: "moveCommitments", type: "bytes32[]", internalType: "bytes32[]" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getGameCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
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
    name: "getGamesByCreator",
    inputs: [{ name: "_creator", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
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
    name: "getPublicNotStartedGames",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isGamePrivate",
    inputs: [{ name: "gameId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
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
    name: "joinGameWithCode",
    inputs: [
      { name: "gameId", type: "uint256", internalType: "uint256" },
      { name: "_joinee", type: "address", internalType: "address" },
      { name: "_gameCode", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "playVerifier",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IUltraVerifier" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "shuffleVerifier",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IUltraVerifier" }],
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
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address", internalType: "address" }],
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
  baseSepolia: "0xdFE172aD77a0742B77869482aC05F6CBf2Df1DAa",
} as const;

// Verifier addresses
export const VERIFIER_ADDRESSES = {
  baseSepolia: {
    shuffle: "0x9D2fE939001325fF9fb58C2a22dB60549D4Ba1dA",
    deal: "0x4AeaB7206A19EE01FbAEC8aee3654e4E93B59BE6",
    draw: "0x4d9CA273817BfEf07a9D73E23072DEabeb825060",
    play: "0xB99a5Cb916bd38353C435d52dDfCb9F7b51bfF0a",
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

// GameView struct type matching the contract return
export interface GameView {
  id: bigint;
  creator: string;
  players: string[];
  status: number;
  isPrivate: boolean;
  gameCodeHash: string;
  maxPlayers: bigint;
  startTime: bigint;
  endTime: bigint;
  deckCommitment: string;
  moveCommitments: string[];
}
