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
 * @notice Comprehensive test suite for UnoGame contract with ZK proof support
 */
contract UnoGameTest is Test {
    UnoGame public unoGame;
    MockVerifier public mockShuffleVerifier;
    MockVerifier public mockDealVerifier;
    MockVerifier public mockDrawVerifier;
    MockVerifier public mockPlayVerifier;

    address public player1;
    address public player2;
    address public player3;
    address public player4;

    event GameCreated(uint256 indexed gameId, address indexed creator);
    event PlayerJoined(uint256 indexed gameId, address indexed player);
    event GameStarted(uint256 indexed gameId, bytes32 deckCommitment);
    event MoveCommitted(uint256 indexed gameId, address indexed player, bytes32 moveHash);
    event ProofVerified(uint256 indexed gameId, address indexed player, UnoGame.CircuitType circuitType);
    event GameEnded(uint256 indexed gameId, address indexed winner);

    function setUp() public {
        // Deploy mock verifiers
        mockShuffleVerifier = new MockVerifier();
        mockDealVerifier = new MockVerifier();
        mockDrawVerifier = new MockVerifier();
        mockPlayVerifier = new MockVerifier();

        // Deploy UnoGame with mock verifiers
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

        // Fund players
        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
        vm.deal(player3, 10 ether);
        vm.deal(player4, 10 ether);
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

    function test_RevertWhenZeroAddressVerifier() public {
        vm.expectRevert(UnoGame.InvalidVerifierAddress.selector);
        new UnoGame(address(0), address(mockDealVerifier), address(mockDrawVerifier), address(mockPlayVerifier));
    }

    // ========================================
    // CREATE GAME TESTS
    // ========================================

    function test_CreateGame() public {
        vm.prank(player1);
        
        vm.expectEmit(true, true, false, true);
        emit GameCreated(1, player1);
        
        uint256 gameId = unoGame.createGame(player1, false);
        
        assertEq(gameId, 1, "First game should have ID 1");

        (
            uint256 id,
            address[] memory players,
            UnoGame.GameStatus status,
            uint256 startTime,
            ,
            ,
        ) = unoGame.getGame(gameId);

        assertEq(id, gameId, "Game ID should match");
        assertEq(players.length, 1, "Game should have 1 player (creator)");
        assertEq(players[0], player1, "Creator should be first player");
        assertEq(uint256(status), uint256(UnoGame.GameStatus.NotStarted), "Game should be NotStarted");
        assertGt(startTime, 0, "Start time should be set");
    }

    function test_CreateBotGame() public {
        vm.prank(player1);
        
        uint256 gameId = unoGame.createGame(player1, true);

        (
            ,
            address[] memory players,
            UnoGame.GameStatus status,
            ,
            ,
            ,
        ) = unoGame.getGame(gameId);

        assertEq(players.length, 2, "Bot game should have 2 players");
        assertEq(players[0], player1, "Creator should be first player");
        assertEq(players[1], address(0xB07), "Bot should be second player");
        assertEq(uint256(status), uint256(UnoGame.GameStatus.Started), "Bot game should be Started");
    }

    function test_CreateMultipleGames() public {
        vm.startPrank(player1);
        uint256 gameId1 = unoGame.createGame(player1, false);
        uint256 gameId2 = unoGame.createGame(player1, false);
        vm.stopPrank();

        assertEq(gameId1, 1, "First game ID should be 1");
        assertEq(gameId2, 2, "Second game ID should be 2");
    }

    // ========================================
    // JOIN GAME TESTS
    // ========================================

    function test_JoinGame() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);

        vm.prank(player2);
        vm.expectEmit(true, true, false, true);
        emit PlayerJoined(gameId, player2);
        unoGame.joinGame(gameId, player2);

        (, address[] memory players, , , , ,) = unoGame.getGame(gameId);

        assertEq(players.length, 2, "Game should have 2 players");
        assertEq(players[1], player2, "Second player should be player2");
    }

    function test_RevertJoinAlreadyJoined() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);

        // Player1 already joined as creator
        vm.prank(player1);
        vm.expectRevert(UnoGame.AlreadyJoined.selector);
        unoGame.joinGame(gameId, player1);
    }

    function test_RevertJoinGameFull() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);

        // Join 9 more players (max is 10)
        for (uint256 i = 1; i <= 9; i++) {
            address joiner = makeAddr(string(abi.encodePacked("joiner", i)));
            unoGame.joinGame(gameId, joiner);
        }

        // 11th player should be rejected
        address eleventhPlayer = makeAddr("eleventh");
        vm.expectRevert(UnoGame.GameFull.selector);
        unoGame.joinGame(gameId, eleventhPlayer);
    }

    function test_RevertJoinInvalidGame() public {
        vm.expectRevert(UnoGame.InvalidGameId.selector);
        unoGame.joinGame(999, player1);
    }

    function test_RevertJoinStartedGame() public {
        // Create and start a game
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);
        
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        // Try to join started game
        vm.expectRevert(UnoGame.InvalidGameStatus.selector);
        unoGame.joinGame(gameId, player3);
    }

    // ========================================
    // START GAME TESTS
    // ========================================

    function test_StartGameSimple() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);
        
        unoGame.joinGame(gameId, player2);

        vm.expectEmit(true, false, false, true);
        emit GameStarted(gameId, bytes32(0));
        unoGame.startGame(gameId);

        (, , UnoGame.GameStatus status, , , ,) = unoGame.getGame(gameId);
        assertEq(uint256(status), uint256(UnoGame.GameStatus.Started), "Game should be Started");
    }

    function test_StartGameWithShuffleProof() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);
        
        unoGame.joinGame(gameId, player2);

        bytes32 deckCommitment = keccak256("deck_merkle_root");
        bytes memory shuffleProof = hex"1234";
        bytes32[] memory publicInputs = new bytes32[](0);

        vm.expectEmit(true, false, false, true);
        emit GameStarted(gameId, deckCommitment);
        
        unoGame.startGame(gameId, deckCommitment, shuffleProof, publicInputs);

        (, , UnoGame.GameStatus status, , , bytes32 storedCommitment,) = unoGame.getGame(gameId);
        assertEq(uint256(status), uint256(UnoGame.GameStatus.Started), "Game should be Started");
        assertEq(storedCommitment, deckCommitment, "Deck commitment should be stored");
    }

    function test_RevertStartGameNotEnoughPlayers() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);

        vm.expectRevert(UnoGame.NotEnoughPlayers.selector);
        unoGame.startGame(gameId);
    }

    function test_RevertStartGameInvalidProof() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);
        
        unoGame.joinGame(gameId, player2);

        // Make verifier return false
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
        // Setup game
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        bytes32 moveHash = keccak256("move1");

        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit MoveCommitted(gameId, player1, moveHash);
        unoGame.commitMove(gameId, moveHash);

        (, , , , , , bytes32[] memory moves) = unoGame.getGame(gameId);
        assertEq(moves.length, 1, "Should have 1 move");
        assertEq(moves[0], moveHash, "Move hash should match");
    }

    function test_CommitMoveWithZKProof() public {
        // Setup game
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);
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
        assertEq(proofs.length, 1, "Should have 1 proof");
        assertEq(proofs[0].commitment, moveHash, "Commitment should match");
        assertEq(proofs[0].player, player1, "Player should match");
        assertTrue(proofs[0].verified, "Proof should be verified");
    }

    function test_CommitMoveWithDealProof() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);
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
        uint256 gameId = unoGame.createGame(player1, false);
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
        uint256 gameId = unoGame.createGame(player1, false);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        bytes32 moveHash = keccak256("move");
        bytes memory proof = hex"abcd";
        bytes32[] memory publicInputs = new bytes32[](0);

        // Player3 is not in the game
        vm.prank(player3);
        vm.expectRevert(UnoGame.PlayerNotInGame.selector);
        unoGame.commitMove(gameId, moveHash, proof, publicInputs, UnoGame.CircuitType.Play);
    }

    function test_RevertCommitMoveInvalidProof() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);
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
        uint256 gameId = unoGame.createGame(player1, false);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        bytes32 gameHash = keccak256("final_state");

        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit GameEnded(gameId, player1);
        unoGame.endGame(gameId, gameHash);

        (, , UnoGame.GameStatus status, , uint256 endTime, ,) = unoGame.getGame(gameId);
        assertEq(uint256(status), uint256(UnoGame.GameStatus.Ended), "Game should be Ended");
        assertGt(endTime, 0, "End time should be set");
    }

    function test_EndGameRemovesFromActiveGames() public {
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);
        unoGame.joinGame(gameId, player2);
        unoGame.startGame(gameId);

        uint256[] memory activeBefore = unoGame.getActiveGames();
        assertEq(activeBefore.length, 1, "Should have 1 active game");

        unoGame.endGame(gameId, keccak256("final"));

        uint256[] memory activeAfter = unoGame.getActiveGames();
        assertEq(activeAfter.length, 0, "Should have 0 active games");
    }

    // ========================================
    // VIEW FUNCTION TESTS
    // ========================================

    function test_GetActiveGames() public {
        vm.startPrank(player1);
        uint256 gameId1 = unoGame.createGame(player1, false);
        uint256 gameId2 = unoGame.createGame(player1, false);
        vm.stopPrank();

        uint256[] memory activeGames = unoGame.getActiveGames();
        assertEq(activeGames.length, 2, "Should have 2 active games");
        assertEq(activeGames[0], gameId1, "First game ID should match");
        assertEq(activeGames[1], gameId2, "Second game ID should match");
    }

    function test_GetNotStartedGames() public {
        vm.prank(player1);
        uint256 gameId1 = unoGame.createGame(player1, false);
        
        vm.prank(player1);
        uint256 gameId2 = unoGame.createGame(player1, false);
        unoGame.joinGame(gameId2, player2);
        unoGame.startGame(gameId2);

        uint256[] memory notStarted = unoGame.getNotStartedGames();
        assertEq(notStarted.length, 1, "Should have 1 not started game");
        assertEq(notStarted[0], gameId1, "Not started game ID should match");
    }

    // ========================================
    // UPDATE VERIFIERS TESTS
    // ========================================

    function test_UpdateVerifiers() public {
        MockVerifier newShuffleVerifier = new MockVerifier();
        MockVerifier newDealVerifier = new MockVerifier();
        MockVerifier newDrawVerifier = new MockVerifier();
        MockVerifier newPlayVerifier = new MockVerifier();

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

    function test_RevertUpdateVerifiersZeroAddress() public {
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

    function test_FullGameFlow() public {
        // Create game
        vm.prank(player1);
        uint256 gameId = unoGame.createGame(player1, false);

        // Players join
        unoGame.joinGame(gameId, player2);
        unoGame.joinGame(gameId, player3);

        // Start with shuffle proof
        bytes32 deckCommitment = keccak256("shuffled_deck");
        unoGame.startGame(gameId, deckCommitment, hex"", new bytes32[](0));

        // Deal cards to all players
        vm.prank(player1);
        unoGame.commitMove(gameId, keccak256("deal_p1"), hex"", new bytes32[](0), UnoGame.CircuitType.Deal);

        vm.prank(player2);
        unoGame.commitMove(gameId, keccak256("deal_p2"), hex"", new bytes32[](0), UnoGame.CircuitType.Deal);

        vm.prank(player3);
        unoGame.commitMove(gameId, keccak256("deal_p3"), hex"", new bytes32[](0), UnoGame.CircuitType.Deal);

        // Play some moves
        vm.prank(player1);
        unoGame.commitMove(gameId, keccak256("play_1"), hex"", new bytes32[](0), UnoGame.CircuitType.Play);

        vm.prank(player2);
        unoGame.commitMove(gameId, keccak256("draw_1"), hex"", new bytes32[](0), UnoGame.CircuitType.Draw);

        vm.prank(player2);
        unoGame.commitMove(gameId, keccak256("play_2"), hex"", new bytes32[](0), UnoGame.CircuitType.Play);

        // End game
        vm.prank(player3);
        unoGame.endGame(gameId, keccak256("final_state"));

        // Verify final state
        (, , UnoGame.GameStatus status, , , ,) = unoGame.getGame(gameId);
        assertEq(uint256(status), uint256(UnoGame.GameStatus.Ended));

        // Verify all proofs recorded
        UnoGame.MoveProof[] memory proofs = unoGame.getGameProofs(gameId);
        assertEq(proofs.length, 6, "Should have 6 recorded proofs");
    }

    function test_MultipleConcurrentGames() public {
        // Create multiple games
        vm.prank(player1);
        uint256 gameId1 = unoGame.createGame(player1, false);
        
        vm.prank(player2);
        uint256 gameId2 = unoGame.createGame(player2, false);

        // Join and start both games
        unoGame.joinGame(gameId1, player2);
        unoGame.joinGame(gameId2, player1);
        
        unoGame.startGame(gameId1);
        unoGame.startGame(gameId2);

        // Play moves in both games
        vm.prank(player1);
        unoGame.commitMove(gameId1, keccak256("game1_move1"));
        
        vm.prank(player2);
        unoGame.commitMove(gameId2, keccak256("game2_move1"));

        // End one game
        unoGame.endGame(gameId1, keccak256("game1_final"));

        // Verify states
        uint256[] memory active = unoGame.getActiveGames();
        assertEq(active.length, 1, "Should have 1 active game");
        assertEq(active[0], gameId2, "Only game2 should be active");
    }
}
