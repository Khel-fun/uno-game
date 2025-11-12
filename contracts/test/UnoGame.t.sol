// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/uno.sol";

contract UnoGameTest is Test {
    UnoGame unoGame;
    bytes32[10] players;

    function setUp() public {
        unoGame = new UnoGame();
        for (uint i = 0; i < 10; i++) {
            players[i] = bytes32(uint256(i + 1));
        }
    }

    function testCreateGame() public {
        bytes32 creator = players[0];
        vm.prank(address(uint160(uint256(creator))));
        uint256 gameId = unoGame.createGame(creator);
        assertEq(gameId, 1, "First game should have ID 1");

        (
            uint256 id,
            bytes32[] memory gamePlayers,
            UnoGame.GameStatus status,
            ,
            ,
            ,

        ) = unoGame.getGame(gameId);

        assertEq(id, gameId, "Game ID should match");
        assertEq(gamePlayers.length, 0, "Game should start with no players");
        assertEq(
            uint(status),
            uint(UnoGame.GameStatus.NotStarted),
            "Game should be in NotStarted status"
        );
    }

    function testJoinGame() public {
        bytes32 creator = players[0];
        vm.prank(address(uint160(uint256(creator))));
        uint256 gameId = unoGame.createGame(creator);

        vm.prank(address(uint160(uint256(players[0]))));
        unoGame.joinGame(gameId, players[0]);

        vm.prank(address(uint160(uint256(players[1]))));
        unoGame.joinGame(gameId, players[1]);

        (, bytes32[] memory gamePlayers, , , , , ) = unoGame.getGame(gameId);

        assertEq(gamePlayers.length, 2, "Game should have 2 players");
        assertEq(
            gamePlayers[0],
            players[0],
            "First player should be players[0]"
        );
        assertEq(
            gamePlayers[1],
            players[1],
            "Second player should be players[1]"
        );
    }

    function testCannotJoinFullGame() public {
        bytes32 creator = players[0];
        vm.prank(address(uint160(uint256(creator))));
        uint256 gameId = unoGame.createGame(creator);

        for (uint i = 0; i < 10; i++) {
            vm.prank(address(uint160(uint256(players[i]))));
            unoGame.joinGame(gameId, players[i]);
        }

        vm.expectRevert("Game is full");
        vm.prank(address(0x100));
        unoGame.joinGame(gameId, bytes32(uint256(0x100)));
    }

    function testStartGame() public {
        bytes32 creator = players[0];
        vm.prank(address(uint160(uint256(creator))));
        uint256 gameId = unoGame.createGame(creator);

        vm.prank(address(uint160(uint256(players[0]))));
        unoGame.joinGame(gameId, players[0]);

        vm.prank(address(uint160(uint256(players[1]))));
        unoGame.joinGame(gameId, players[1]);

        vm.prank(address(uint160(uint256(creator))));
        unoGame.startGame(gameId);

        (, , UnoGame.GameStatus status, , , , ) = unoGame.getGame(gameId);

        assertEq(
            uint(status),
            uint(UnoGame.GameStatus.Started),
            "Game should be in Started status"
        );
    }

    function testCannotStartGameWithLessThanTwoPlayers() public {
        bytes32 creator = players[0];
        vm.prank(address(uint160(uint256(creator))));
        uint256 gameId = unoGame.createGame(creator);

        vm.prank(address(uint160(uint256(players[0]))));
        unoGame.joinGame(gameId, players[0]);

        vm.expectRevert("Not enough players");
        vm.prank(address(uint160(uint256(creator))));
        unoGame.startGame(gameId);
    }

    function testCommitMove() public {
        bytes32 creator = players[0];
        vm.prank(address(uint160(uint256(creator))));
        uint256 gameId = unoGame.createGame(creator);

        vm.prank(address(uint160(uint256(players[0]))));
        unoGame.joinGame(gameId, players[0]);

        vm.prank(address(uint160(uint256(players[1]))));
        unoGame.joinGame(gameId, players[1]);

        vm.prank(address(uint160(uint256(creator))));
        unoGame.startGame(gameId);

        bytes32 moveHash = keccak256("move1");
        vm.prank(address(uint160(uint256(players[0]))));
        unoGame.commitMove(gameId, moveHash);

        (, , , , , , bytes32[] memory moves) = unoGame.getGame(gameId);

        assertEq(moves.length, 1, "Should have 1 move");
        assertEq(moves[0], moveHash, "Move hash should match");
    }

    function testCannotCommitMoveWhenGameNotStarted() public {
        bytes32 creator = players[0];
        vm.prank(address(uint160(uint256(creator))));
        uint256 gameId = unoGame.createGame(creator);

        vm.prank(address(uint160(uint256(players[0]))));
        unoGame.joinGame(gameId, players[0]);

        vm.prank(address(uint160(uint256(players[1]))));
        unoGame.joinGame(gameId, players[1]);

        bytes32 moveHash = keccak256("move1");
        vm.expectRevert("Game is not in the required status");
        vm.prank(address(uint160(uint256(players[0]))));
        unoGame.commitMove(gameId, moveHash);
    }

    function testEndGame() public {
        bytes32 creator = players[0];
        vm.prank(address(uint160(uint256(creator))));
        uint256 gameId = unoGame.createGame(creator);

        vm.prank(address(uint160(uint256(players[0]))));
        unoGame.joinGame(gameId, players[0]);

        vm.prank(address(uint160(uint256(players[1]))));
        unoGame.joinGame(gameId, players[1]);

        vm.prank(address(uint160(uint256(creator))));
        unoGame.startGame(gameId);

        bytes32 gameHash = keccak256("gameHash");
        vm.prank(address(uint160(uint256(creator))));
        unoGame.endGame(gameId, gameHash);

        (, , UnoGame.GameStatus status, , , , ) = unoGame.getGame(gameId);

        assertEq(
            uint(status),
            uint(UnoGame.GameStatus.Ended),
            "Game should be in Ended status"
        );
    }

    function testCannotEndGameWhenNotStarted() public {
        bytes32 creator = players[0];
        vm.prank(address(uint160(uint256(creator))));
        uint256 gameId = unoGame.createGame(creator);

        vm.prank(address(uint160(uint256(players[0]))));
        unoGame.joinGame(gameId, players[0]);

        vm.prank(address(uint160(uint256(players[1]))));
        unoGame.joinGame(gameId, players[1]);

        bytes32 gameHash = keccak256("gameHash");
        vm.expectRevert("Game is not in the required status");
        vm.prank(address(uint160(uint256(creator))));
        unoGame.endGame(gameId, gameHash);
    }

    function testGetActiveGames() public {
        bytes32 creator = players[0];
        vm.prank(address(uint160(uint256(creator))));
        uint256 gameId1 = unoGame.createGame(creator);

        vm.prank(address(uint160(uint256(players[0]))));
        unoGame.joinGame(gameId1, players[0]);

        vm.prank(address(uint160(uint256(players[1]))));
        unoGame.joinGame(gameId1, players[1]);

        vm.prank(address(uint160(uint256(creator))));
        unoGame.startGame(gameId1);

        uint256[] memory activeGames = unoGame.getActiveGames();
        assertEq(activeGames.length, 1, "Should have 1 active game");
        assertEq(activeGames[0], gameId1, "Active game ID should match");
    }
}