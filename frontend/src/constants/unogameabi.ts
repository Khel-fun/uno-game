export const unoGameABI = [
    {
        "type": "function",
        "name": "commitMove",
        "inputs": [
            {
                "name": "gameId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "moveHash",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "createGame",
        "inputs": [
            {
                "name": "_creator",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "endGame",
        "inputs": [
            {
                "name": "gameId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "gameHash",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getActiveGames",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256[]",
                "internalType": "uint256[]"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getGame",
        "inputs": [
            {
                "name": "gameId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "id",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "players",
                "type": "address[]",
                "internalType": "address[]"
            },
            {
                "name": "status",
                "type": "uint8",
                "internalType": "enum UnoGame.GameStatus"
            },
            {
                "name": "startTime",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "endTime",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "gameHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "moves",
                "type": "bytes32[]",
                "internalType": "bytes32[]"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getNotStartedGames",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256[]",
                "internalType": "uint256[]"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "joinGame",
        "inputs": [
            {
                "name": "gameId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "_joinee",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "startGame",
        "inputs": [
            {
                "name": "gameId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "GameCreated",
        "inputs": [
            {
                "name": "gameId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "creator",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "GameEnded",
        "inputs": [
            {
                "name": "gameId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "GameStarted",
        "inputs": [
            {
                "name": "gameId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "MoveCommitted",
        "inputs": [
            {
                "name": "gameId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "moveHash",
                "type": "bytes32",
                "indexed": false,
                "internalType": "bytes32"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "PlayerJoined",
        "inputs": [
            {
                "name": "gameId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "player",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "ReentrancyGuardReentrantCall",
        "inputs": []
    }
] as const;
  