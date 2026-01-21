// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IShuffleVerifier.sol";
import "./interfaces/IDealVerifier.sol";
import "./interfaces/IDrawVerifier.sol";
import "./interfaces/IPlayVerifier.sol";

/**
 * @title UnoGame
 * @notice Zero-knowledge proof enabled UNO game contract
 * @dev Integrates Noir ZK circuits for verifiable game moves
 */
contract UnoGame is ReentrancyGuard {
    uint256 private _gameIdCounter;
    uint256[] private _activeGames;

    // ZK Verifier contracts for different circuit types
    IShuffleVerifier public shuffleVerifier;
    IDealVerifier public dealVerifier;
    IDrawVerifier public drawVerifier;
    IPlayVerifier public playVerifier;

    enum GameStatus { NotStarted, Started, Ended }
    
    enum CircuitType { Shuffle, Deal, Draw, Play }

    struct Game {
        uint256 id; 
        address[] players; 
        GameStatus status; 
        uint256 startTime; 
        uint256 endTime; 
        bytes32 deckCommitment; // Merkle root of shuffled deck
        bytes32[] moveCommitments; // Committed moves with ZK proofs
        mapping(address => bool) hasJoined;
    }

    struct MoveProof {
        bytes32 commitment;
        bytes proof;
        bytes32[] publicInputs;
        address player;
        uint256 timestamp;
        bool verified;
    }

    mapping(uint256 => Game) private games;
    mapping(uint256 => MoveProof[]) private gameProofs;

    event GameCreated(uint256 indexed gameId, address indexed creator);
    event PlayerJoined(uint256 indexed gameId, address indexed player);
    event GameStarted(uint256 indexed gameId, bytes32 deckCommitment);
    event MoveCommitted(uint256 indexed gameId, address indexed player, bytes32 moveHash);
    event ProofVerified(uint256 indexed gameId, address indexed player, CircuitType circuitType);
    event GameEnded(uint256 indexed gameId, address indexed winner);

    error InvalidGameId();
    error InvalidGameStatus();
    error NotEnoughPlayers();
    error GameFull();
    error AlreadyJoined();
    error InvalidProof();
    error PlayerNotInGame();
    error InvalidVerifierAddress();

    modifier validateGame(uint256 _gameId, GameStatus requiredStatus) {
        if (_gameId == 0 || _gameId > _gameIdCounter) revert InvalidGameId();
        if (games[_gameId].status != requiredStatus) revert InvalidGameStatus();
        _;
    }

    /**
     * @notice Initialize the contract with verifier addresses
     * @param _shuffleVerifier Address of shuffle circuit verifier
     * @param _dealVerifier Address of deal circuit verifier
     * @param _drawVerifier Address of draw circuit verifier
     * @param _playVerifier Address of play circuit verifier
     */
    constructor(
        address _shuffleVerifier,
        address _dealVerifier,
        address _drawVerifier,
        address _playVerifier
    ) {
        if (_shuffleVerifier == address(0) || _dealVerifier == address(0) || 
            _drawVerifier == address(0) || _playVerifier == address(0)) {
            revert InvalidVerifierAddress();
        }
        
        shuffleVerifier = IShuffleVerifier(_shuffleVerifier);
        dealVerifier = IDealVerifier(_dealVerifier);
        drawVerifier = IDrawVerifier(_drawVerifier);
        playVerifier = IPlayVerifier(_playVerifier);
    }

    /**
     * @notice Create a new game
     * @param _creator Address of the game creator
     * @param _isBot Whether this is a bot game
     * @return gameId The ID of the created game
     */
    function createGame(address _creator, bool _isBot) external nonReentrant returns (uint256) {
        _gameIdCounter++;
        uint256 newGameId = _gameIdCounter;

        Game storage game = games[newGameId];
        game.id = newGameId;
        game.startTime = block.timestamp;
        
        if (_isBot) {
            // For bot games, add creator and mark as started
            game.players.push(_creator);
            game.players.push(address(0xB07)); // Dummy bot address
            game.hasJoined[_creator] = true;
            game.hasJoined[address(0xB07)] = true;
            game.status = GameStatus.Started;
            emit GameStarted(newGameId, bytes32(0));
        } else {
            game.players.push(_creator);
            game.hasJoined[_creator] = true;
            game.status = GameStatus.NotStarted;
        }
        
        _activeGames.push(newGameId);
        emit GameCreated(newGameId, _creator);
        return newGameId;
    }

    /**
     * @notice Join an existing game
     * @param gameId The ID of the game to join
     */
    function joinGame(uint256 gameId, address _joinee) 
        external 
        nonReentrant 
        validateGame(gameId, GameStatus.NotStarted)
    {
        Game storage game = games[gameId];
        
        if (game.players.length >= 10) revert GameFull();
        if (game.hasJoined[_joinee]) revert AlreadyJoined();

        game.players.push(_joinee);
        game.hasJoined[_joinee] = true;
        
        emit PlayerJoined(gameId, _joinee);
    }

    /**
     * @notice Start a game with deck commitment
     * @param gameId The ID of the game to start
     * @param deckCommitment Merkle root of the shuffled deck
     * @param shuffleProof ZK proof of valid shuffle
     * @param publicInputs Public inputs for shuffle verification
     */
    function startGame(
        uint256 gameId,
        bytes32 deckCommitment,
        bytes calldata shuffleProof,
        bytes32[] calldata publicInputs
    ) 
        external 
        validateGame(gameId, GameStatus.NotStarted) 
    {
        Game storage game = games[gameId];
        if (game.players.length < 2) revert NotEnoughPlayers();
        
        // Verify shuffle proof
        bool isValid = shuffleVerifier.verify(shuffleProof, publicInputs);
        if (!isValid) revert InvalidProof();
        
        game.status = GameStatus.Started;
        game.deckCommitment = deckCommitment;
        
        emit GameStarted(gameId, deckCommitment);
        emit ProofVerified(gameId, msg.sender, CircuitType.Shuffle);
    }

    /**
     * @notice Start a game (simple version without ZK proof for backward compatibility)
     * @param gameId The ID of the game to start
     */
    function startGame(uint256 gameId) external validateGame(gameId, GameStatus.NotStarted) {
        Game storage game = games[gameId];
        if (game.players.length < 2) revert NotEnoughPlayers();
        
        game.status = GameStatus.Started;
        emit GameStarted(gameId, bytes32(0));
    }

    /**
     * @notice Commit a move with ZK proof
     * @param gameId The game ID
     * @param moveHash Hash of the move commitment
     * @param proof ZK proof of valid move
     * @param publicInputs Public inputs for verification
     * @param circuitType Type of circuit (Deal, Draw, or Play)
     */
    function commitMove(
        uint256 gameId,
        bytes32 moveHash,
        bytes calldata proof,
        bytes32[] calldata publicInputs,
        CircuitType circuitType
    ) 
        external 
        validateGame(gameId, GameStatus.Started) 
    {
        Game storage game = games[gameId];
        
        // Verify player is in game
        bool isPlayer = false;
        for (uint256 i = 0; i < game.players.length; i++) {
            if (game.players[i] == msg.sender) {
                isPlayer = true;
                break;
            }
        }
        if (!isPlayer) revert PlayerNotInGame();

        // Verify proof based on circuit type
        bool isValid = false;
        if (circuitType == CircuitType.Deal) {
            isValid = dealVerifier.verify(proof, publicInputs);
        } else if (circuitType == CircuitType.Draw) {
            isValid = drawVerifier.verify(proof, publicInputs);
        } else if (circuitType == CircuitType.Play) {
            isValid = playVerifier.verify(proof, publicInputs);
        }
        
        if (!isValid) revert InvalidProof();

        // Store move commitment
        game.moveCommitments.push(moveHash);
        
        // Store proof details
        gameProofs[gameId].push(MoveProof({
            commitment: moveHash,
            proof: proof,
            publicInputs: publicInputs,
            player: msg.sender,
            timestamp: block.timestamp,
            verified: true
        }));

        emit MoveCommitted(gameId, msg.sender, moveHash);
        emit ProofVerified(gameId, msg.sender, circuitType);
    }

    /**
     * @notice Commit a simple move without ZK proof (backward compatibility)
     * @param gameId The game ID
     * @param moveHash Hash of the move commitment
     */
    function commitMove(uint256 gameId, bytes32 moveHash) external validateGame(gameId, GameStatus.Started) {
        Game storage game = games[gameId];
        game.moveCommitments.push(moveHash);
        emit MoveCommitted(gameId, msg.sender, moveHash);
    }

    /**
     * @notice End a game
     * @param gameId The game ID
     * @param gameHash Final game state hash
     */
    function endGame(uint256 gameId, bytes32 gameHash) 
        external 
        validateGame(gameId, GameStatus.Started)
    {
        Game storage game = games[gameId];

        game.status = GameStatus.Ended;
        game.endTime = block.timestamp;
        game.deckCommitment = gameHash; // Reuse for final hash
        
        removeFromActiveGames(gameId);
        emit GameEnded(gameId, msg.sender);
    }

    /**
     * @notice Remove a game from active games list
     * @param gameId The game ID to remove
     */
    function removeFromActiveGames(uint256 gameId) internal {
        for (uint256 i = 0; i < _activeGames.length; i++) {
            if (_activeGames[i] == gameId) {
                _activeGames[i] = _activeGames[_activeGames.length - 1];
                _activeGames.pop();
                break;
            }
        }
    }

    /**
     * @notice Get all active games
     * @return Array of active game IDs
     */
    function getActiveGames() external view returns (uint256[] memory) {
        return _activeGames;
    }

    /**
     * @notice Get all games that haven't started
     * @return Array of not started game IDs
     */
    function getNotStartedGames() external view returns (uint256[] memory) {
        uint256[] memory notStartedGames = new uint256[](_activeGames.length);
        uint256 count = 0;

        for (uint256 i = 0; i < _activeGames.length; i++) {
            uint256 gameId = _activeGames[i];
            if (games[gameId].status == GameStatus.NotStarted) {
                notStartedGames[count] = gameId;
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 j = 0; j < count; j++) {
            result[j] = notStartedGames[j];
        }

        return result;
    }

    /**
     * @notice Get game details
     * @param gameId The game ID
     * @return id Game ID
     * @return players Array of player addresses
     * @return status Current game status
     * @return startTime Game start timestamp
     * @return endTime Game end timestamp
     * @return deckCommitment Deck Merkle root / final game hash
     * @return moveCommitments Array of move commitments
     */
    function getGame(uint256 gameId) external view returns (
        uint256 id,
        address[] memory players,
        GameStatus status,
        uint256 startTime,
        uint256 endTime,
        bytes32 deckCommitment,
        bytes32[] memory moveCommitments
    ) {
        Game storage game = games[gameId];
        return (
            game.id,
            game.players,
            game.status,
            game.startTime,
            game.endTime,
            game.deckCommitment,
            game.moveCommitments
        );
    }

    /**
     * @notice Get move proofs for a game
     * @param gameId The game ID
     * @return Array of move proofs
     */
    function getGameProofs(uint256 gameId) external view returns (MoveProof[] memory) {
        return gameProofs[gameId];
    }

    /**
     * @notice Update verifier contracts
     */
    function updateVerifiers(
        address _shuffleVerifier,
        address _dealVerifier,
        address _drawVerifier,
        address _playVerifier
    ) external {
        if (_shuffleVerifier == address(0) || _dealVerifier == address(0) || 
            _drawVerifier == address(0) || _playVerifier == address(0)) {
            revert InvalidVerifierAddress();
        }
        
        shuffleVerifier = IShuffleVerifier(_shuffleVerifier);
        dealVerifier = IDealVerifier(_dealVerifier);
        drawVerifier = IDrawVerifier(_drawVerifier);
        playVerifier = IPlayVerifier(_playVerifier);
    }
}
