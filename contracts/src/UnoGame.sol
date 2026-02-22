// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IUltraVerifier.sol";

/**
 * @title UnoGame
 * @notice Zero-knowledge proof enabled UNO game contract with private/public lobbies
 * @dev Integrates Noir ZK circuits for verifiable game moves.
 *      Supports private games with keccak256 game code verification
 *      and public games with open access.
 */


interface IVerifyProofAggregation {
    function verifyProofAggregation(
        uint256 _domainId,
        uint256 _aggregationId,
        bytes32 _leaf,
        bytes32[] calldata _merklePath,
        uint256 _leafCount,
        uint256 _index
    ) external view returns (bool);
}

contract UnoGame is ReentrancyGuard, Ownable {
    uint256 private _gameIdCounter;
    uint256[] private _activeGames;
    address public zkVerify;
    /// @notice Maximum number of players per game (hard cap)
    uint256 public constant MAX_PLAYERS = 4;

    // ZK Verifier contracts for different circuit types
    IUltraVerifier public shuffleVerifier;
    IUltraVerifier public dealVerifier;
    IUltraVerifier public drawVerifier;
    IUltraVerifier public playVerifier;

    enum GameStatus { NotStarted, Started, Ended }

    enum CircuitType { Shuffle, Deal, Draw, Play }

    struct Game {
        uint256 id;
        address creator;
        address[] players;
        GameStatus status;
        bool isPrivate;
        bytes32 gameCodeHash; // keccak256(gameCode) for private games, bytes32(0) for public
        uint256 maxPlayers; // creator-chosen max (2-4)
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

    /// @notice Return type for getGame() since mappings cannot be returned
    struct GameView {
        uint256 id;
        address creator;
        address[] players;
        GameStatus status;
        bool isPrivate;
        bytes32 gameCodeHash;
        uint256 maxPlayers;
        uint256 startTime;
        uint256 endTime;
        bytes32 deckCommitment;
        bytes32[] moveCommitments;
    }

    mapping(uint256 => Game) private games;
    mapping(uint256 => MoveProof[]) private gameProofs;

    event GameCreated(uint256 indexed gameId, address indexed creator, bool isPrivate);
    event PlayerJoined(uint256 indexed gameId, address indexed player);
    event GameStarted(uint256 indexed gameId, bytes32 deckCommitment);
    event MoveCommitted(uint256 indexed gameId, address indexed player, bytes32 moveHash);
    event ProofVerified(uint256 indexed gameId, address indexed player, CircuitType circuitType);
    event GameEnded(uint256 indexed gameId, address indexed winner);
    event GameDeleted(uint256 indexed gameId, address indexed creator);
    event ZkVerifyUpdated(address indexed zkVerify);
    error InvalidGameId();
    error InvalidGameStatus();
    error NotEnoughPlayers();
    error GameFull();
    error AlreadyJoined();
    error InvalidProof();
    error PlayerNotInGame();
    error InvalidVerifierAddress();
    error InvalidGameCode();
    error NotGameCreator();
    error GameAlreadyStarted();
    error InvalidMaxPlayers();

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
        address _playVerifier,
        address _zkVerify
    ) Ownable(msg.sender) {
        if (_shuffleVerifier == address(0) || _dealVerifier == address(0) ||
            _drawVerifier == address(0) || _playVerifier == address(0)) {
            revert InvalidVerifierAddress();
        }
    require(_zkVerify != address(0), "Invalid zkVerify address");
        shuffleVerifier = IUltraVerifier(_shuffleVerifier);
        dealVerifier = IUltraVerifier(_dealVerifier);
        drawVerifier = IUltraVerifier(_drawVerifier);
        playVerifier = IUltraVerifier(_playVerifier);
        zkVerify = _zkVerify;
    }

    /**
     * @notice Create a new game (public or private)
     * @param _creator Address of the game creator
     * @param _isBot Whether this is a bot game
     * @param _isPrivate Whether this is a private game requiring a code to join
     * @param _gameCodeHash keccak256 hash of the game code for private games, bytes32(0) for public
     * @param _maxPlayers Maximum players for this game (2-4)
     * @return gameId The ID of the created game
     */
    function createGame(
        address _creator,
        bool _isBot,
        bool _isPrivate,
        bytes32 _gameCodeHash,
        uint256 _maxPlayers
    ) external nonReentrant returns (uint256) {
        if (_maxPlayers < 2 || _maxPlayers > MAX_PLAYERS) revert InvalidMaxPlayers();
        _gameIdCounter++;
        uint256 newGameId = _gameIdCounter;

        Game storage game = games[newGameId];
        game.id = newGameId;
        game.creator = _creator;
        game.isPrivate = _isPrivate;
        game.gameCodeHash = _gameCodeHash;
        game.maxPlayers = _maxPlayers;
        game.startTime = block.timestamp;

        if (_isBot) {
            // For bot games, add creator and mark as started
            game.players.push(_creator);
            game.players.push(address(0xB07));
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
        emit GameCreated(newGameId, _creator, _isPrivate);
        return newGameId;
    }

    /**
     * @notice Backward-compatible createGame without private lobby params
     * @param _creator Address of the game creator
     * @param _isBot Whether this is a bot game
     * @return gameId The ID of the created game
     */
    function createGame(address _creator, bool _isBot) external nonReentrant returns (uint256) {
        _gameIdCounter++;
        uint256 newGameId = _gameIdCounter;

        Game storage game = games[newGameId];
        game.id = newGameId;
        game.creator = _creator;
        game.isPrivate = false;
        game.gameCodeHash = bytes32(0);
        game.maxPlayers = MAX_PLAYERS; // default to max
        game.startTime = block.timestamp;

        if (_isBot) {
            game.players.push(_creator);
            game.players.push(address(0xB07));
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
        emit GameCreated(newGameId, _creator, false);
        return newGameId;
    }

    /**
     * @notice Join a public game
     * @param gameId The ID of the game to join
     * @param _joinee Address of the player joining
     */
    function joinGame(uint256 gameId, address _joinee)
        external
        nonReentrant
        validateGame(gameId, GameStatus.NotStarted)
    {
        Game storage game = games[gameId];

        // Public games only - private games must use joinGameWithCode
        if (game.isPrivate) revert InvalidGameCode();
        if (game.players.length >= game.maxPlayers) revert GameFull();
        if (game.hasJoined[_joinee]) revert AlreadyJoined();

        game.players.push(_joinee);
        game.hasJoined[_joinee] = true;

        emit PlayerJoined(gameId, _joinee);
    }

    /**
     * @notice Join a private game with a game code
     * @param gameId The ID of the game to join
     * @param _joinee Address of the player joining
     * @param _gameCode The plaintext game code (pre-image of the stored hash)
     */
    function joinGameWithCode(
        uint256 gameId,
        address _joinee,
        string calldata _gameCode
    )
        external
        nonReentrant
        validateGame(gameId, GameStatus.NotStarted)
    {
        Game storage game = games[gameId];

        if (game.players.length >= game.maxPlayers) revert GameFull();
        if (game.hasJoined[_joinee]) revert AlreadyJoined();

        // Verify game code for private games
        if (game.isPrivate) {
            if (keccak256(abi.encodePacked(_gameCode)) != game.gameCodeHash) {
                revert InvalidGameCode();
            }
        }

        game.players.push(_joinee);
        game.hasJoined[_joinee] = true;

        emit PlayerJoined(gameId, _joinee);
    }

    /**
     * @notice Delete a game (only creator, only before game starts)
     * @param gameId The ID of the game to delete
     */
    function deleteGame(uint256 gameId)
        external
        nonReentrant
        validateGame(gameId, GameStatus.NotStarted)
    {
        Game storage game = games[gameId];

        if (msg.sender != game.creator) revert NotGameCreator();

        // Mark as ended so it cannot be interacted with
        game.status = GameStatus.Ended;
        game.endTime = block.timestamp;

        removeFromActiveGames(gameId);
        emit GameDeleted(gameId, msg.sender);
    }

    /**
     * @notice Start a game with deck commitment and shuffle proof
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
        game.deckCommitment = gameHash;

        removeFromActiveGames(gameId);
        emit GameEnded(gameId, msg.sender);
    }

    // ========================================
    // VIEW FUNCTIONS
    // ========================================

    /**
     * @notice Get all active games
     * @return Array of active game IDs
     */
    function getActiveGames() external view returns (uint256[] memory) {
        return _activeGames;
    }

    /**
     * @notice Get all public games that haven't started yet (for lobby browsing)
     * @return Array of public not-started game IDs
     */
    function getPublicNotStartedGames() external view returns (uint256[] memory) {
        uint256[] memory temp = new uint256[](_activeGames.length);
        uint256 count = 0;

        for (uint256 i = 0; i < _activeGames.length; i++) {
            uint256 gameId = _activeGames[i];
            Game storage game = games[gameId];
            if (game.status == GameStatus.NotStarted && !game.isPrivate) {
                temp[count] = gameId;
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 j = 0; j < count; j++) {
            result[j] = temp[j];
        }

        return result;
    }

    /**
     * @notice Get all not-started games (both public and private)
     * @return Array of not-started game IDs
     */
    function getNotStartedGames() external view returns (uint256[] memory) {
        uint256[] memory temp = new uint256[](_activeGames.length);
        uint256 count = 0;

        for (uint256 i = 0; i < _activeGames.length; i++) {
            uint256 gameId = _activeGames[i];
            if (games[gameId].status == GameStatus.NotStarted) {
                temp[count] = gameId;
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 j = 0; j < count; j++) {
            result[j] = temp[j];
        }

        return result;
    }

    /**
     * @notice Get games created by a specific address
     * @param _creator The creator address to filter by
     * @return Array of game IDs created by the address
     */
    function getGamesByCreator(address _creator) external view returns (uint256[] memory) {
        uint256[] memory temp = new uint256[](_activeGames.length);
        uint256 count = 0;

        for (uint256 i = 0; i < _activeGames.length; i++) {
            uint256 gameId = _activeGames[i];
            if (games[gameId].creator == _creator) {
                temp[count] = gameId;
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 j = 0; j < count; j++) {
            result[j] = temp[j];
        }

        return result;
    }

    /**
     * @notice Check if a game is private
     * @param gameId The game ID to check
     * @return Whether the game is private
     */
    function isGamePrivate(uint256 gameId) external view returns (bool) {
        if (gameId == 0 || gameId > _gameIdCounter) revert InvalidGameId();
        return games[gameId].isPrivate;
    }

    /**
     * @notice Get game details
     * @param gameId The game ID
     * @return view_ GameView struct with all game details
     */
    function getGame(uint256 gameId) external view returns (GameView memory view_) {
        Game storage game = games[gameId];
        view_ = GameView({
            id: game.id,
            creator: game.creator,
            players: game.players,
            status: game.status,
            isPrivate: game.isPrivate,
            gameCodeHash: game.gameCodeHash,
            maxPlayers: game.maxPlayers,
            startTime: game.startTime,
            endTime: game.endTime,
            deckCommitment: game.deckCommitment,
            moveCommitments: game.moveCommitments
        });
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
     * @notice Get the total number of games created
     * @return The current game ID counter
     */
    function getGameCount() external view returns (uint256) {
        return _gameIdCounter;
    }

    // ========================================
    // ADMIN FUNCTIONS
    // ========================================

    /**
     * @notice Update verifier contracts (owner only)
     * @param _shuffleVerifier New shuffle verifier address
     * @param _dealVerifier New deal verifier address
     * @param _drawVerifier New draw verifier address
     * @param _playVerifier New play verifier address
     */
    function updateVerifiers(
        address _shuffleVerifier,
        address _dealVerifier,
        address _drawVerifier,
        address _playVerifier
    ) external onlyOwner {
        if (_shuffleVerifier == address(0) || _dealVerifier == address(0) ||
            _drawVerifier == address(0) || _playVerifier == address(0)) {
            revert InvalidVerifierAddress();
        }

        shuffleVerifier = IUltraVerifier(_shuffleVerifier);
        dealVerifier = IUltraVerifier(_dealVerifier);
        drawVerifier = IUltraVerifier(_drawVerifier);
        playVerifier = IUltraVerifier(_playVerifier);
    }

    // ========================================
    // INTERNAL FUNCTIONS
    // ========================================

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
    function verifyProofAggregation(
        uint256 _domainId,
        uint256 _aggregationId,
        bytes32 _leaf,
        bytes32[] calldata _merklePath,
        uint256 _leafCount,
        uint256 _index
    ) external view returns (bool) {
        return IVerifyProofAggregation(zkVerify).verifyProofAggregation(
            _domainId,
            _aggregationId,
            _leaf,
            _merklePath,
            _leafCount,
            _index
        );
    }
        function updateZkVerify(address _zkVerify) external onlyOwner {
        require(_zkVerify != address(0), "Invalid zkVerify address");
        zkVerify = _zkVerify;
        emit ZkVerifyUpdated(_zkVerify);
    }
}
