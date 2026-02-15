// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/UnoGame.sol";
import "../src/interfaces/IUltraVerifier.sol";

/**
 * @title MockVerifier
 * @notice Mock verifier for testing - always returns true or configurable response
 */
contract MockVerifier is IUltraVerifier {
    bool public shouldPass = true;

    function setVerificationResult(bool _shouldPass) external {
        shouldPass = _shouldPass;
    }

    function verify(bytes calldata, bytes32[] calldata) external view returns (bool) {
        return shouldPass;
    }
}

/**
 * @title UnoGameTest
 * @notice Comprehensive test suite for UnoGame contract with private/public lobbies
 */
contract UnoGameTest is Test {
    UnoGame public unoGame;
    MockVerifier public mockShuffleVerifier;
    MockVerifier public mockDealVerifier;
    MockVerifier public mockDrawVerifier;
    MockVerifier public mockPlayVerifier;

    address public deployer;
    address public player1;
    address public player2;
    address public player3;
    address public player4;
    address public player5;

    string constant GAME_CODE = "A3K9F2B7";
    bytes32 constant GAME_CODE_HASH = keccak256(abi.encodePacked(GAME_CODE));

    event GameCreated(uint256 indexed gameId, address indexed creator, bool isPrivate);
    event PlayerJoined(uint256 indexed gameId, address indexed player);
    event GameStarted(uint256 indexed gameId, bytes32 deckCommitment);
    event MoveCommitted(uint256 indexed gameId, address indexed player, bytes32 moveHash);
    event ProofVerified(uint256 indexed gameId, address indexed player, UnoGame.CircuitType circuitType);
    event GameEnded(uint256 indexed gameId, address indexed winner);
    event GameDeleted(uint256 indexed gameId, address indexed creator);

    function setUp() public {
        deployer = makeAddr("deployer");

        // Deploy mock verifiers
        mockShuffleVerifier = new MockVerifier();
        mockDealVerifier = new MockVerifier();
        mockDrawVerifier = new MockVerifier();
        mockPlayVerifier = new MockVerifier();

        // Deploy UnoGame as deployer (owner)
        vm.prank(deployer);
        unoGame = new UnoGame(
            address(mockShuffleVerifier),
            address(mockDealVerifier),
            address(mockDrawVerifier),
            address(mockPlayVerifier)
        );

        // Setup test players
        player1 = makeAddr("player1");
        player2 = makeAddr("player2");
        player3 = makeAddr("player3");
        player4 = makeAddr("player4");
        player5 = makeAddr("player5");

        // Fund players
        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
        vm.deal(player3, 10 ether);
        vm.deal(player4, 10 ether);
        vm.deal(player5, 10 ether);
    }

    // ========================================
    // CONSTRUCTOR TESTS
    // ========================================

    function test_ConstructorSetsVerifiers() public view {
        assertEq(address(unoGame.shuffleVerifier()), address(mockShuffleVerifier));
        assertEq(address(unoGame.dealVerifier()), address(mockDealVerifier));
        assertEq(address(unoGame.drawVerifier()), address(mockDrawVerifier));
        assertEq(address(unoGame.playVerifier()), address(mockPlayVerifier));
    }

    function test_ConstructorSetsOwner() public view {
        assertEq(unoGame.owner(), deployer);
    }

    function test_RevertWhenZeroAddressVerifier() public {
        vm.expectRevert(UnoGame.InvalidVerifierAddress.selector);
        new UnoGame(address(0), address(mockDealVerifier), address(mockDrawVerifier), address(mockPlayVerifier));
    }

    function test_MaxPlayersConstant() public view {
        assertEq(unoGame.MAX_PLAYERS(), 4);
    }

    // ========================================
    // CREATE GAME TESTS - PUBLIC
    // ========================================

    function test_CreatePublicGame() public {
        vm.prank(player1);

        vm.expectEmit(true, true, false, true);
        emit GameCreated(1, player1, false);

        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        assertEq(gameId, 1, "First game should have ID 1");

        UnoGame.GameView memory game = unoGame.getGame(gameId);

        assertEq(game.id, gameId);
        assertEq(game.creator, player1);
        assertEq(game.players.length, 1);
        assertEq(game.players[0], player1);
        assertEq(uint256(game.status), uint256(UnoGame.GameStatus.NotStarted));
        assertFalse(game.isPrivate);
        assertEq(game.gameCodeHash, bytes32(0));
        assertEq(game.maxPlayers, 4);
        assertGt(game.startTime, 0);
    }

    function test_CreatePublicGame_BackwardCompat() public {
        vm.prank(player1);

        uint256 gameId = unoGame.createGame(player1, false);

        UnoGame.GameView memory game = unoGame.getGame(gameId);

        assertEq(game.creator, player1);
        assertFalse(game.isPrivate);
        assertEq(game.gameCodeHash, bytes32(0));
        assertEq(game.maxPlayers, 4); // defaults to MAX_PLAYERS
    }

    function test_CreateGameWith2Players() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 2);

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(game.maxPlayers, 2);
    }

    function test_CreateGameWith3Players() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 3);

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(game.maxPlayers, 3);
    }

    function test_RevertCreateGameInvalidMaxPlayers_TooLow() public {
        vm.prank(player1);
        vm.expectRevert(UnoGame.InvalidMaxPlayers.selector);
        unoGame.createGame(player1, false, false, bytes32(0), 1);
    }

    function test_RevertCreateGameInvalidMaxPlayers_TooHigh() public {
        vm.prank(player1);
        vm.expectRevert(UnoGame.InvalidMaxPlayers.selector);
        unoGame.createGame(player1, false, false, bytes32(0), 5);
    }

    function test_CreateBotGame() public {
        vm.prank(player1);

        uint256 gameId = unoGame.createGame(player1, true, false, bytes32(0), 2);

        UnoGame.GameView memory game = unoGame.getGame(gameId);

        assertEq(game.players.length, 2);
        assertEq(game.players[0], player1);
        assertEq(game.players[1], address(0xB07));
        assertEq(uint256(game.status), uint256(UnoGame.GameStatus.Started));
    }

    function test_CreateMultipleGames() public {
        vm.startPrank(player1);
        uint256 gameId1 = unoGame.createGame(player1, false, false, bytes32(0), 4);
        uint256 gameId2 = unoGame.createGame(player1, false, false, bytes32(0), 3);
        vm.stopPrank();

        assertEq(gameId1, 1);
        assertEq(gameId2, 2);
    }

    // ========================================
    // CREATE GAME TESTS - PRIVATE
    // ========================================

    function test_CreatePrivateGame() public {
        vm.prank(player1);

        vm.expectEmit(true, true, false, true);
        emit GameCreated(1, player1, true);

        uint256 gameId = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);

        UnoGame.GameView memory game = unoGame.getGame(gameId);

        assertEq(game.creator, player1);
        assertTrue(game.isPrivate);
        assertEq(game.gameCodeHash, GAME_CODE_HASH);
        assertEq(game.maxPlayers, 3);
    }

    function test_IsGamePrivate() public {
        vm.startPrank(player1);
        uint256 publicId = unoGame.createGame(player1, false, false, bytes32(0), 4);
        uint256 privateId = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);
        vm.stopPrank();

        assertFalse(unoGame.isGamePrivate(publicId));
        assertTrue(unoGame.isGamePrivate(privateId));
    }

    function test_RevertIsGamePrivateInvalidId() public {
        vm.expectRevert(UnoGame.InvalidGameId.selector);
        unoGame.isGamePrivate(999);
    }

    // ========================================
    // JOIN GAME TESTS - PUBLIC
    // ========================================

    function test_JoinPublicGame() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        vm.prank(player2);
        vm.expectEmit(true, true, false, true);
        emit PlayerJoined(gameId, player2);
        unoGame.joinGame(gameId, player2);

        UnoGame.GameView memory game = unoGame.getGame(gameId);

        assertEq(game.players.length, 2);
        assertEq(game.players[1], player2);
    }

    function test_JoinPublicGame_4Players() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        unoGame.joinGame(gameId, player2);
        unoGame.joinGame(gameId, player3);
        unoGame.joinGame(gameId, player4);

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(game.players.length, 4);
    }

    function test_RevertJoinAlreadyJoined() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        vm.prank(player1);
        vm.expectRevert(UnoGame.AlreadyJoined.selector);
        unoGame.joinGame(gameId, player1);
    }

    function test_RevertJoinGameFull_2Players() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 2);

        unoGame.joinGame(gameId, player2);

        vm.expectRevert(UnoGame.GameFull.selector);
        unoGame.joinGame(gameId, player3);
    }

    function test_RevertJoinGameFull_3Players() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 3);

        unoGame.joinGame(gameId, player2);
        unoGame.joinGame(gameId, player3);

        vm.expectRevert(UnoGame.GameFull.selector);
        unoGame.joinGame(gameId, player4);
    }

    function test_RevertJoinGameFull_4Players() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        unoGame.joinGame(gameId, player2);
        unoGame.joinGame(gameId, player3);
        unoGame.joinGame(gameId, player4);

        vm.expectRevert(UnoGame.GameFull.selector);
        unoGame.joinGame(gameId, player5);
    }

    function test_RevertJoinInvalidGame() public {
        vm.expectRevert(UnoGame.InvalidGameId.selector);
        unoGame.joinGame(999, player1);
    }

    function test_RevertJoinStartedGame() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        vm.expectRevert(UnoGame.InvalidGameStatus.selector);
        unoGame.joinGame(gameId, player3);
    }

    function test_RevertJoinPrivateGameWithoutCode() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);

        vm.expectRevert(UnoGame.InvalidGameCode.selector);
        unoGame.joinGame(gameId, player2);
    }

    // ========================================
    // JOIN GAME TESTS - PRIVATE (WITH CODE)
    // ========================================

    function test_JoinPrivateGameWithCorrectCode() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);

        vm.prank(player2);
        vm.expectEmit(true, true, false, true);
        emit PlayerJoined(gameId, player2);
        unoGame.joinGameWithCode(gameId, player2, GAME_CODE);

        UnoGame.GameView memory game = unoGame.getGame(gameId);

        assertEq(game.players.length, 2);
        assertEq(game.players[1], player2);
    }

    function test_RevertJoinPrivateGameWithWrongCode() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);

        vm.expectRevert(UnoGame.InvalidGameCode.selector);
        unoGame.joinGameWithCode(gameId, player2, "WRONGCODE");
    }

    function test_JoinPublicGameWithCode() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        unoGame.joinGameWithCode(gameId, player2, "anything");

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(game.players.length, 2);
    }

    function test_RevertJoinPrivateGameAlreadyJoined() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);

        unoGame.joinGameWithCode(gameId, player2, GAME_CODE);

        vm.expectRevert(UnoGame.AlreadyJoined.selector);
        unoGame.joinGameWithCode(gameId, player2, GAME_CODE);
    }

    function test_RevertJoinPrivateGameFull() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);

        unoGame.joinGameWithCode(gameId, player2, GAME_CODE);
        unoGame.joinGameWithCode(gameId, player3, GAME_CODE);

        vm.expectRevert(UnoGame.GameFull.selector);
        unoGame.joinGameWithCode(gameId, player4, GAME_CODE);
    }

    // ========================================
    // DELETE GAME TESTS
    // ========================================

    function test_DeleteGame() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit GameDeleted(gameId, player1);
        unoGame.deleteGame(gameId);

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(uint256(game.status), uint256(UnoGame.GameStatus.Ended));
        assertGt(game.endTime, 0);
    }

    function test_DeleteRemovesFromActiveGames() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        uint256[] memory activeBefore = unoGame.getActiveGames();
        assertEq(activeBefore.length, 1);

        vm.prank(player1);
        unoGame.deleteGame(gameId);

        uint256[] memory activeAfter = unoGame.getActiveGames();
        assertEq(activeAfter.length, 0);
    }

    function test_RevertDeleteNotCreator() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        vm.prank(player2);
        vm.expectRevert(UnoGame.NotGameCreator.selector);
        unoGame.deleteGame(gameId);
    }

    function test_RevertDeleteStartedGame() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        vm.prank(player1);
        vm.expectRevert(UnoGame.InvalidGameStatus.selector);
        unoGame.deleteGame(gameId);
    }

    function test_RevertDeleteInvalidGame() public {
        vm.prank(player1);
        vm.expectRevert(UnoGame.InvalidGameId.selector);
        unoGame.deleteGame(999);
    }

    function test_DeletePrivateGame() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);

        vm.prank(player1);
        unoGame.deleteGame(gameId);

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(uint256(game.status), uint256(UnoGame.GameStatus.Ended));
    }

    function test_CannotJoinDeletedGame() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        vm.prank(player1);
        unoGame.deleteGame(gameId);

        vm.expectRevert(UnoGame.InvalidGameStatus.selector);
        unoGame.joinGame(gameId, player2);
    }

    // ========================================
    // START GAME TESTS
    // ========================================

    function test_StartGameSimple() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        unoGame.joinGame(gameId, player2);

        vm.expectEmit(true, false, false, true);
        emit GameStarted(gameId, bytes32(0));
        unoGame.startGame(gameId);

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(uint256(game.status), uint256(UnoGame.GameStatus.Started));
    }

    function test_StartGameWithShuffleProof() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        unoGame.joinGame(gameId, player2);

        bytes32 deckCommitment = keccak256("deck_merkle_root");
        bytes memory shuffleProof = hex"1234";
        bytes32[] memory publicInputs = new bytes32[](0);

        vm.expectEmit(true, false, false, true);
        emit GameStarted(gameId, deckCommitment);

        unoGame.startGame(gameId, deckCommitment, shuffleProof, publicInputs);

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(uint256(game.status), uint256(UnoGame.GameStatus.Started));
        assertEq(game.deckCommitment, deckCommitment);
    }

    function test_StartPrivateGame() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);

        unoGame.joinGameWithCode(gameId, player2, GAME_CODE);
        unoGame.startGame(gameId);

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(uint256(game.status), uint256(UnoGame.GameStatus.Started));
    }

    function test_RevertStartGameNotEnoughPlayers() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        vm.expectRevert(UnoGame.NotEnoughPlayers.selector);
        unoGame.startGame(gameId);
    }

    function test_RevertStartGameInvalidProof() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        unoGame.joinGame(gameId, player2);

        mockShuffleVerifier.setVerificationResult(false);

        bytes32 deckCommitment = keccak256("deck_merkle_root");
        bytes memory shuffleProof = hex"1234";
        bytes32[] memory publicInputs = new bytes32[](0);

        vm.expectRevert(UnoGame.InvalidProof.selector);
        unoGame.startGame(gameId, deckCommitment, shuffleProof, publicInputs);
    }

    // ========================================
    // COMMIT MOVE TESTS
    // ========================================

    function test_CommitMoveSimple() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        bytes32 moveHash = keccak256("move1");

        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit MoveCommitted(gameId, player1, moveHash);
        unoGame.commitMove(gameId, moveHash);

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(game.moveCommitments.length, 1);
        assertEq(game.moveCommitments[0], moveHash);
    }

    function test_CommitMoveWithZKProof() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        bytes32 moveHash = keccak256("move1");
        bytes memory proof = hex"abcd";
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = bytes32(uint256(1));

        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit ProofVerified(gameId, player1, UnoGame.CircuitType.Play);

        unoGame.commitMove(gameId, moveHash, proof, publicInputs, UnoGame.CircuitType.Play);

        UnoGame.MoveProof[] memory proofs = unoGame.getGameProofs(gameId);
        assertEq(proofs.length, 1);
        assertEq(proofs[0].commitment, moveHash);
        assertEq(proofs[0].player, player1);
        assertTrue(proofs[0].verified);
    }

    function test_CommitMoveWithDealProof() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        bytes32 moveHash = keccak256("deal");
        bytes memory proof = hex"abcd";
        bytes32[] memory publicInputs = new bytes32[](0);

        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit ProofVerified(gameId, player1, UnoGame.CircuitType.Deal);

        unoGame.commitMove(gameId, moveHash, proof, publicInputs, UnoGame.CircuitType.Deal);
    }

    function test_CommitMoveWithDrawProof() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        bytes32 moveHash = keccak256("draw");
        bytes memory proof = hex"abcd";
        bytes32[] memory publicInputs = new bytes32[](0);

        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit ProofVerified(gameId, player1, UnoGame.CircuitType.Draw);

        unoGame.commitMove(gameId, moveHash, proof, publicInputs, UnoGame.CircuitType.Draw);
    }

    function test_RevertCommitMoveNotPlayer() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        bytes32 moveHash = keccak256("move");
        bytes memory proof = hex"abcd";
        bytes32[] memory publicInputs = new bytes32[](0);

        vm.prank(player3);
        vm.expectRevert(UnoGame.PlayerNotInGame.selector);
        unoGame.commitMove(gameId, moveHash, proof, publicInputs, UnoGame.CircuitType.Play);
    }

    function test_RevertCommitMoveInvalidProof() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        mockPlayVerifier.setVerificationResult(false);

        bytes32 moveHash = keccak256("move");
        bytes memory proof = hex"abcd";
        bytes32[] memory publicInputs = new bytes32[](0);

        vm.prank(player1);
        vm.expectRevert(UnoGame.InvalidProof.selector);
        unoGame.commitMove(gameId, moveHash, proof, publicInputs, UnoGame.CircuitType.Play);
    }

    // ========================================
    // END GAME TESTS
    // ========================================

    function test_EndGame() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        bytes32 gameHash = keccak256("final_state");

        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit GameEnded(gameId, player1);
        unoGame.endGame(gameId, gameHash);

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(uint256(game.status), uint256(UnoGame.GameStatus.Ended));
        assertGt(game.endTime, 0);
    }

    function test_EndGameRemovesFromActiveGames() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        uint256[] memory activeBefore = unoGame.getActiveGames();
        assertEq(activeBefore.length, 1);

        unoGame.endGame(gameId, keccak256("final"));

        uint256[] memory activeAfter = unoGame.getActiveGames();
        assertEq(activeAfter.length, 0);
    }

    // ========================================
    // VIEW FUNCTION TESTS
    // ========================================

    function test_GetActiveGames() public {
        vm.startPrank(player1);
        uint256 gameId1 = unoGame.createGame(player1, false, false, bytes32(0), 4);
        uint256 gameId2 = unoGame.createGame(player1, false, false, bytes32(0), 3);
        vm.stopPrank();

        uint256[] memory activeGames = unoGame.getActiveGames();
        assertEq(activeGames.length, 2);
        assertEq(activeGames[0], gameId1);
        assertEq(activeGames[1], gameId2);
    }

    function test_GetNotStartedGames() public {
        vm.prank(player1);
        uint256 gameId1 = unoGame.createGame(player1, false, false, bytes32(0), 4);

        vm.prank(player1);
        unoGame.createGame(player1, false, false, bytes32(0), 4);
        unoGame.joinGame(2, player2);
        unoGame.startGame(2);

        uint256[] memory notStarted = unoGame.getNotStartedGames();
        assertEq(notStarted.length, 1);
        assertEq(notStarted[0], gameId1);
    }

    function test_GetPublicNotStartedGames() public {
        vm.startPrank(player1);
        uint256 publicId = unoGame.createGame(player1, false, false, bytes32(0), 4);
        unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);
        vm.stopPrank();

        uint256[] memory publicGames = unoGame.getPublicNotStartedGames();
        assertEq(publicGames.length, 1);
        assertEq(publicGames[0], publicId);
    }

    function test_GetPublicNotStartedGames_ExcludesStarted() public {
        vm.prank(player1);
        uint256 gameId1 = unoGame.createGame(player1, false, false, bytes32(0), 4);

        vm.prank(player1);
        unoGame.createGame(player1, false, false, bytes32(0), 4);
        unoGame.joinGame(2, player2);
        unoGame.startGame(2);

        uint256[] memory publicGames = unoGame.getPublicNotStartedGames();
        assertEq(publicGames.length, 1);
        assertEq(publicGames[0], gameId1);
    }

    function test_GetGamesByCreator() public {
        vm.prank(player1);
        uint256 gameId1 = unoGame.createGame(player1, false, false, bytes32(0), 4);

        vm.prank(player2);
        unoGame.createGame(player2, false, false, bytes32(0), 4);

        vm.prank(player1);
        uint256 gameId3 = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);

        uint256[] memory player1Games = unoGame.getGamesByCreator(player1);
        assertEq(player1Games.length, 2);
        assertEq(player1Games[0], gameId1);
        assertEq(player1Games[1], gameId3);

        uint256[] memory player2Games = unoGame.getGamesByCreator(player2);
        assertEq(player2Games.length, 1);
    }

    function test_GetGameCount() public {
        assertEq(unoGame.getGameCount(), 0);

        vm.prank(player1);
        unoGame.createGame(player1, false, false, bytes32(0), 4);
        assertEq(unoGame.getGameCount(), 1);

        vm.prank(player2);
        unoGame.createGame(player2, false, false, bytes32(0), 3);
        assertEq(unoGame.getGameCount(), 2);
    }

    function test_GetGameReturnsGameView() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);

        unoGame.joinGameWithCode(gameId, player2, GAME_CODE);

        UnoGame.GameView memory game = unoGame.getGame(gameId);

        assertEq(game.id, gameId);
        assertEq(game.creator, player1);
        assertEq(game.players.length, 2);
        assertTrue(game.isPrivate);
        assertEq(game.gameCodeHash, GAME_CODE_HASH);
        assertEq(game.maxPlayers, 3);
    }

    // ========================================
    // UPDATE VERIFIERS TESTS (OWNER ONLY)
    // ========================================

    function test_UpdateVerifiers() public {
        MockVerifier newShuffleVerifier = new MockVerifier();
        MockVerifier newDealVerifier = new MockVerifier();
        MockVerifier newDrawVerifier = new MockVerifier();
        MockVerifier newPlayVerifier = new MockVerifier();

        vm.prank(deployer);
        unoGame.updateVerifiers(
            address(newShuffleVerifier),
            address(newDealVerifier),
            address(newDrawVerifier),
            address(newPlayVerifier)
        );

        assertEq(address(unoGame.shuffleVerifier()), address(newShuffleVerifier));
        assertEq(address(unoGame.dealVerifier()), address(newDealVerifier));
        assertEq(address(unoGame.drawVerifier()), address(newDrawVerifier));
        assertEq(address(unoGame.playVerifier()), address(newPlayVerifier));
    }

    function test_RevertUpdateVerifiersNotOwner() public {
        vm.prank(player1);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", player1));
        unoGame.updateVerifiers(
            address(mockShuffleVerifier),
            address(mockDealVerifier),
            address(mockDrawVerifier),
            address(mockPlayVerifier)
        );
    }

    function test_RevertUpdateVerifiersZeroAddress() public {
        vm.prank(deployer);
        vm.expectRevert(UnoGame.InvalidVerifierAddress.selector);
        unoGame.updateVerifiers(
            address(0),
            address(mockDealVerifier),
            address(mockDrawVerifier),
            address(mockPlayVerifier)
        );
    }

    // ========================================
    // INTEGRATION TESTS
    // ========================================

    function test_FullPublicGameFlow_4Players() public {
        // Create public game with 4 max players
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 4);

        // Players join
        unoGame.joinGame(gameId, player2);
        unoGame.joinGame(gameId, player3);
        unoGame.joinGame(gameId, player4);

        // Start with shuffle proof
        bytes32 deckCommitment = keccak256("shuffled_deck");
        unoGame.startGame(gameId, deckCommitment, hex"", new bytes32[](0));

        // Deal cards
        vm.prank(player1);
        unoGame.commitMove(gameId, keccak256("deal_p1"), hex"", new bytes32[](0), UnoGame.CircuitType.Deal);

        vm.prank(player2);
        unoGame.commitMove(gameId, keccak256("deal_p2"), hex"", new bytes32[](0), UnoGame.CircuitType.Deal);

        vm.prank(player3);
        unoGame.commitMove(gameId, keccak256("deal_p3"), hex"", new bytes32[](0), UnoGame.CircuitType.Deal);

        vm.prank(player4);
        unoGame.commitMove(gameId, keccak256("deal_p4"), hex"", new bytes32[](0), UnoGame.CircuitType.Deal);

        // Play moves
        vm.prank(player1);
        unoGame.commitMove(gameId, keccak256("play_1"), hex"", new bytes32[](0), UnoGame.CircuitType.Play);

        vm.prank(player2);
        unoGame.commitMove(gameId, keccak256("draw_1"), hex"", new bytes32[](0), UnoGame.CircuitType.Draw);

        // End game
        vm.prank(player3);
        unoGame.endGame(gameId, keccak256("final_state"));

        // Verify
        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(uint256(game.status), uint256(UnoGame.GameStatus.Ended));

        UnoGame.MoveProof[] memory proofs = unoGame.getGameProofs(gameId);
        assertEq(proofs.length, 6);
    }

    function test_FullPrivateGameFlow() public {
        // Create private game with 3 max players
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, true, GAME_CODE_HASH, 3);

        // Players join with code
        unoGame.joinGameWithCode(gameId, player2, GAME_CODE);
        unoGame.joinGameWithCode(gameId, player3, GAME_CODE);

        // Start game
        unoGame.startGame(gameId);

        // Play
        vm.prank(player1);
        unoGame.commitMove(gameId, keccak256("move1"));

        vm.prank(player2);
        unoGame.commitMove(gameId, keccak256("move2"));

        // End
        vm.prank(player1);
        unoGame.endGame(gameId, keccak256("final"));

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(uint256(game.status), uint256(UnoGame.GameStatus.Ended));
    }

    function test_MultipleConcurrentGames() public {
        // Create public + private games with different maxPlayers
        vm.prank(player1);
        uint256 gameId1 = unoGame.createGame(player1, false, false, bytes32(0), 2);

        vm.prank(player2);
        uint256 gameId2 = unoGame.createGame(player2, false, true, GAME_CODE_HASH, 3);

        // Join and start both
        unoGame.joinGame(gameId1, player2);
        unoGame.joinGameWithCode(gameId2, player1, GAME_CODE);

        unoGame.startGame(gameId1);
        unoGame.startGame(gameId2);

        // Play in both
        vm.prank(player1);
        unoGame.commitMove(gameId1, keccak256("game1_move1"));

        vm.prank(player2);
        unoGame.commitMove(gameId2, keccak256("game2_move1"));

        // End one
        unoGame.endGame(gameId1, keccak256("game1_final"));

        uint256[] memory active = unoGame.getActiveGames();
        assertEq(active.length, 1);
        assertEq(active[0], gameId2);
    }

    function test_DeleteAndRecreateFlow() public {
        // Create and delete a game
        vm.prank(player1);
        uint256 gameId1 = unoGame.createGame(player1, false, false, bytes32(0), 4);

        vm.prank(player1);
        unoGame.deleteGame(gameId1);

        // Create a new game
        vm.prank(player1);
        uint256 gameId2 = unoGame.createGame(player1, false, false, bytes32(0), 3);

        assertEq(gameId2, 2); // Counter incremented
        uint256[] memory active = unoGame.getActiveGames();
        assertEq(active.length, 1);
        assertEq(active[0], gameId2);
    }

    function test_2PlayerGameFlow() public {
        // Create a 2-player game
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false, false, bytes32(0), 2);

        unoGame.joinGame(gameId, player2);

        // Can't add more
        vm.expectRevert(UnoGame.GameFull.selector);
        unoGame.joinGame(gameId, player3);

        // But can start with 2
        unoGame.startGame(gameId);

        UnoGame.GameView memory game = unoGame.getGame(gameId);
        assertEq(uint256(game.status), uint256(UnoGame.GameStatus.Started));
        assertEq(game.players.length, 2);
    }
}
