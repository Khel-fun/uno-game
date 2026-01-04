import React, { useEffect, useReducer, useState, useRef } from "react";
import socket from "../../services/socket";
import CenterInfo from "./CenterInfo";
import GameScreen from "./GameScreen";
import GameBackground from "./GameBackground";
import { PACK_OF_CARDS, ACTION_CARDS } from "../../utils/packOfCards";
import shuffleArray from "../../utils/shuffleArray";
import { useSoundProvider } from "../../context/SoundProvider";
import ColourDialog from "./colourDialog";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useWalletAddress } from "@/utils/onchainWalletUtils";
import { useBalanceCheck } from "@/hooks/useBalanceCheck";
import { LowBalanceDrawer } from "@/components/LowBalanceDrawer";
import { ethers } from "ethers";
import { useSendTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { getSelectedNetwork } from "@/utils/networkUtils";
import { client } from "@/utils/thirdWebClient";
import { useSocketConnection } from "@/context/SocketConnectionContext";
import { MAX_PLAYERS } from "@/constants/gameConstants";
import { unoGameABI } from "@/constants/unogameabi";

// Card codes: SKIP=100, DRAW2=200, DRAW4=400, WILD=500
const checkGameOver = (deck) => deck.length === 1;
const checkWinner = (deck, player) => (deck.length === 1 ? player : "");

const initialGameState = {
  gameOver: false,
  winner: "",
  turn: "",
  player1Deck: [],
  player2Deck: [],
  player3Deck: [],
  player4Deck: [],
  player5Deck: [],
  player6Deck: [],
  currentColor: "",
  currentNumber: "",
  playedCardsPile: [],
  drawCardPile: [],
  isUnoButtonPressed: false,
  drawButtonPressed: false,
  lastCardPlayedBy: "",
  isExtraTurn: false, // Track if current turn is an extra turn from special card
  totalPlayers: 2, // Track the number of players in the game
  playDirection: 1, // 1 for clockwise, -1 for counter-clockwise
};

const gameReducer = (state, action) => ({ ...state, ...action });

// Card parsing helpers
const parseCard = (card) => {
  if (card.startsWith('skip')) return { color: card.charAt(4), number: 100 };
  if (card.startsWith('D2')) return { color: card.charAt(2), number: 200 };
  if (card.startsWith('_')) return { color: card.charAt(1), number: 100 };
  if (card === 'W') return { color: null, number: 500 };
  if (card === 'D4W') return { color: null, number: 400 };
  return { color: card.charAt(1), number: card.charAt(0) };
};

const isWildCard = (card) => card === 'W' || card === 'D4W';
const isSkipCard = (card) => card.startsWith('skip');
const isReverseCard = (card) => card.startsWith('_');
const isDraw2Card = (card) => card.startsWith('D2');
const isValidPlay = (card, currentColor, currentNumber) => {
  if (isWildCard(card)) return true;
  const { color, number } = parseCard(card);
  return color === currentColor || String(number) === String(currentNumber);
};

const Game = ({ room, currentUser, isComputerMode = false, playerCount = 2 }) => {
  const [gameState, dispatch] = useReducer(gameReducer, initialGameState);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogCallback, setDialogCallback] = useState(null);
  const [rewardGiven, setRewardGiven] = useState(false);
  const [computerMoveCounter, setComputerMoveCounter] = useState(0);
  const [showLowBalanceDrawer, setShowLowBalanceDrawer] = useState(false);
  const { checkBalance } = useBalanceCheck();
  
  // Connection status tracking
  const { isConnected: socketConnected, isReconnecting } = useSocketConnection();
  const pendingActionsRef = useRef([]);

  const { address, isConnected } = useWalletAddress();

  const { mutate: sendTransaction } = useSendTransaction();

  const {
    gameOver,
    winner,
    turn,
    player1Deck,
    player2Deck,
    player3Deck,
    player4Deck,
    player5Deck,
    player6Deck,
    currentColor,
    currentNumber,
    playedCardsPile,
    drawCardPile,
    isUnoButtonPressed,
    drawButtonPressed,
    lastCardPlayedBy,
    isExtraTurn,
    totalPlayers = playerCount,
    playDirection = 1,
  } = gameState;

  const { toast } = useToast();

  // Socket.io room format (must match Room.tsx)
  const socketRoomId = `game-${room}`;

  // Helper function to emit socket events with buffering support
  const emitSocketEvent = (eventName, data) => {
    // Automatically add roomId for game state events
    const payload = (eventName === "updateGameState" || eventName === "initGameState") 
      ? { ...data, roomId: socketRoomId } 
      : data;
    
    if (socketConnected) {
      socket.emit(eventName, payload);
    } else {
      pendingActionsRef.current.push({ eventName, data: payload });
      toast({
        title: "Connection issue",
        description: "Your action will be sent when connection is restored",
        duration: 3000,
        variant: "warning",
      });
    }
  };

  // Process pending actions when reconnected
  useEffect(() => {
    if (socketConnected && pendingActionsRef.current.length > 0) {
      // console.log(`Processing ${pendingActionsRef.current.length} pending actions`);
      
      pendingActionsRef.current.forEach(({ eventName, data }) => {
        socket.emit(eventName, data);
      });
      
      pendingActionsRef.current = [];
      
      toast({
        title: "Connection restored",
        description: "All pending actions have been sent",
        duration: 3000,
        variant: "success",
      });
    }
  }, [socketConnected]);

  // Show warning when connection is lost during game
  useEffect(() => {
    if (!socketConnected && !isReconnecting && gameState.turn) {
      toast({
        title: "Connection lost",
        description: "Attempting to reconnect...",
        duration: 5000,
        variant: "destructive",
      });
    }
  }, [socketConnected, isReconnecting]);

  // Sound hooks
  const {
    playUnoSound,
    playCardPlayedSound,
    playShufflingSound,
    playSkipCardSound,
    playDraw2CardSound,
    playWildCardSound,
    playDraw4CardSound,
    playGameOverSound,
  } = useSoundProvider();

  const playSoundMap = {
    100: playSkipCardSound,
    200: playDraw2CardSound,
    400: playDraw4CardSound,
    500: playWildCardSound,
  };

  // Computer AI: find valid moves and pick best one
  const getValidMoves = (deck) => deck.filter(card => isValidPlay(card, currentColor, currentNumber));

  const computerMakeMove = () => {
    const validMoves = getValidMoves(player2Deck);
    if (validMoves.length === 0) return "draw";
    const special = validMoves.find(c => isSkipCard(c) || isDraw2Card(c) || isWildCard(c));
    return special || validMoves[0];
  };

  // Computer turn with delay
  useEffect(() => {
    if (!isComputerMode || turn !== "Player 2" || gameOver) return;
    
    const timer = setTimeout(() => {
      if (player2Deck.length === 2) playUnoSound();
      const move = computerMakeMove();
      move === "draw" ? onCardDrawnHandler() : onCardPlayedHandler(move);
    }, 3000);

    return () => clearTimeout(timer);
  }, [turn, isComputerMode, gameOver, computerMoveCounter]);

  // Find a valid starting card (not an action card)
  const findStartingCard = (cards) => {
    let idx = Math.floor(Math.random() * cards.length);
    while (ACTION_CARDS.includes(cards[idx]) && cards.length > 0) {
      idx = Math.floor(Math.random() * cards.length);
    }
    return idx;
  };

  // Initialize game on mount
  useEffect(() => {
    if (isComputerMode) {
      const shuffled = shuffleArray(PACK_OF_CARDS);
      const p1Deck = shuffled.splice(0, 5);
      const p2Deck = shuffled.splice(0, 5);
      const startIdx = findStartingCard(shuffled);
      const startCard = shuffled.splice(startIdx, 1);

      dispatch({
        gameOver: false,
        turn: "Player 1",
        player1Deck: p1Deck,
        player2Deck: p2Deck,
        currentColor: startCard[0].charAt(1),
        currentNumber: startCard[0].charAt(0),
        playedCardsPile: startCard,
        drawCardPile: shuffled,
        totalPlayers: 2,
        playDirection: 1,
      });
    } else{
      // Multiplayer: Player 1 initializes
      const shuffled = shuffleArray(PACK_OF_CARDS);
      const state = {
        gameOver: false,
        turn: "Player 1",
        totalPlayers: playerCount,
        playDirection: 1,
      };

      // Deal 5 cards to each player
      for (let i = 1; i <= playerCount && i <= MAX_PLAYERS; i++) {
        state[`player${i}Deck`] = shuffled.splice(0, 5);
      }
      for (let i = playerCount + 1; i <= MAX_PLAYERS; i++) {
        state[`player${i}Deck`] = [];
      }

      const startIdx = findStartingCard(shuffled);
      const startCard = shuffled.splice(startIdx, 1);
      state.playedCardsPile = startCard;
      state.currentColor = startCard[0].charAt(1);
      state.currentNumber = startCard[0].charAt(0);
      state.drawCardPile = shuffled;

      emitSocketEvent("initGameState", state);
    }
  }, [isComputerMode]);

  // Socket event listeners
  useEffect(() => {
    socket.on("initGameState", (state) => {
      dispatch(state);
      playShufflingSound();
    });

    socket.on("updateGameState", (state) => {
      if (state.gameOver) playGameOverSound();
      if (state.currentNumber in playSoundMap) {
        playSoundMap[state.currentNumber]();
      } else if (state.currentNumber) {
        playCardPlayedSound();
      }
      dispatch({ ...state, isUnoButtonPressed: false, drawButtonPressed: state.drawButtonPressed || false });
    });

    return () => {
      socket.off("initGameState");
      socket.off("updateGameState");
    };
  }, []);

  // Player deck lookup
  const decks = { player1Deck, player2Deck, player3Deck, player4Deck, player5Deck, player6Deck };
  const getPlayerDeck = (name) => decks[name.toLowerCase().replace(' ', '') + 'Deck'] || [];

  // Turn rotation helpers
  const getNextPlayer = (current, players, dir = playDirection) => {
    const idx = players.indexOf(current);
    return players[(idx + dir + players.length) % players.length];
  };

  const getActivePlayers = () => {
    const n = totalPlayers || playerCount;
    return Array.from({ length: n }, (_, i) => `Player ${i + 1}`);
  };

  // Core card play logic
  const cardPlayedByPlayer = ({
    cardPlayedBy,
    played_card,
    colorOfPlayedCard,
    numberOfPlayedCard,
    isDraw2 = false,
    isDraw4 = false,
    toggleTurn = true,
  }) => {
    const playerDeck = getPlayerDeck(cardPlayedBy);
    const activePlayers = getActivePlayers();
    const nextPlayerName = getNextPlayer(cardPlayedBy, activePlayers);
    const nextPlayerDeck = getPlayerDeck(nextPlayerName);

    // Remove played card from player's deck
    const removeIndex = playerDeck.indexOf(played_card);
    let updatedPlayerDeck = [...playerDeck.slice(0, removeIndex), ...playerDeck.slice(removeIndex + 1)];

    let copiedDrawCardPileArray = [...drawCardPile];
    let updatedPlayedCardsPile = [...playedCardsPile, played_card];
    let nextPlayerDeckCopy = [...nextPlayerDeck];

    // Draw with auto-reshuffle when pile empty
    const drawCardWithReshuffle = () => {
      if (copiedDrawCardPileArray.length === 0 && updatedPlayedCardsPile.length > 1) {
        const topCard = updatedPlayedCardsPile[updatedPlayedCardsPile.length - 1];
        const cardsToReshuffle = updatedPlayedCardsPile.slice(0, -1);
        copiedDrawCardPileArray = shuffleArray([...cardsToReshuffle]);
        updatedPlayedCardsPile = [topCard];
        playShufflingSound();
      }
      return copiedDrawCardPileArray.length > 0 ? copiedDrawCardPileArray.pop() : null;
    };

    // Handle Draw 2/4 penalty to next player
    if (isDraw2 || isDraw4) {
      for (let i = 0; i < (isDraw4 ? 4 : 2); i++) {
        const card = drawCardWithReshuffle();
        if (card) nextPlayerDeckCopy.push(card);
      }
    }

    const turnCopy = toggleTurn ? nextPlayerName : cardPlayedBy;

    // UNO penalty check (skip for computer)
    const isComputerPlayer = isComputerMode && cardPlayedBy === "Player 2";
    if (playerDeck.length === 2 && !isUnoButtonPressed && !isComputerPlayer) {
      alert("Oops! You forgot to press UNO. You drew 2 cards as penalty.");
      for (let i = 0; i < 2; i++) {
        const card = drawCardWithReshuffle();
        if (card) updatedPlayerDeck.push(card);
      }
    }

    dispatch({ isUnoButtonPressed: false });

    const newGameState = {
      gameOver: checkGameOver(playerDeck),
      winner: checkWinner(playerDeck, cardPlayedBy),
      turn: turnCopy,
      playedCardsPile: updatedPlayedCardsPile,
      currentColor: colorOfPlayedCard,
      currentNumber: numberOfPlayedCard,
      drawCardPile: copiedDrawCardPileArray,
      isExtraTurn: !toggleTurn,
    };

    // Update decks
    const toDeckKey = (name) => name.toLowerCase().replace(' ', '') + 'Deck';
    newGameState[toDeckKey(cardPlayedBy)] = updatedPlayerDeck;
    if (isDraw2 || isDraw4) {
      newGameState[toDeckKey(nextPlayerName)] = nextPlayerDeckCopy;
    }
    activePlayers.forEach(player => {
      const key = toDeckKey(player);
      if (!newGameState[key]) newGameState[key] = getPlayerDeck(player);
    });

    if (isComputerMode) {
      dispatch(newGameState);
      numberOfPlayedCard in playSoundMap ? playSoundMap[numberOfPlayedCard]() : playCardPlayedSound();
      if (newGameState.gameOver) playGameOverSound();
    } else {
      emitSocketEvent("updateGameState", newGameState);
    }
  };

  // Handle card play
  const onCardPlayedHandler = (played_card) => {
    const cardPlayedBy = turn;
    dispatch({ lastCardPlayedBy: cardPlayedBy });
    switch (played_card) {
      case "skipR":
      case "skipG":
      case "skipB":
      case "skipY": {
        const colorOfPlayedCard = played_card.charAt(4);
        const numberOfPlayedCard = 100;
        
        if (!isValidPlay(played_card, currentColor, currentNumber)) {
          alert("Invalid Move! Skip cards must match either the color or number of the current card.");
          break;
        }

        const activePlayers = getActivePlayers();
        const nextPlayer = getNextPlayer(cardPlayedBy, activePlayers, playDirection);
        const playerAfterSkipped = getNextPlayer(nextPlayer, activePlayers, playDirection);

        cardPlayedByPlayer({ cardPlayedBy, played_card, colorOfPlayedCard, numberOfPlayedCard, toggleTurn: false });

        setTimeout(() => {
          const update = { turn: playerAfterSkipped };
          isComputerMode ? dispatch(update) : emitSocketEvent("updateGameState", update);
        }, 0);
        break;
      }
      case "_R":
      case "_G":
      case "_B":
      case "_Y": {
        const colorOfPlayedCard = played_card.charAt(1);
        const numberOfPlayedCard = 100;

        if (!isValidPlay(played_card, currentColor, currentNumber)) {
          alert("Invalid Move! Reverse cards must match either the color or number of the current card.");
          break;
        }

        const activePlayers = getActivePlayers();

        if (activePlayers.length === 2) {
          // 2-player: Reverse acts like Skip
          cardPlayedByPlayer({ cardPlayedBy, played_card, colorOfPlayedCard, numberOfPlayedCard, toggleTurn: false });
          if (isComputerMode && cardPlayedBy === "Player 2") setComputerMoveCounter(prev => prev + 1);
        } else {
          // 3+ players: flip direction
          const newDirection = playDirection * -1;
          const nextPlayer = getNextPlayer(cardPlayedBy, activePlayers, newDirection);
          cardPlayedByPlayer({ cardPlayedBy, played_card, colorOfPlayedCard, numberOfPlayedCard, toggleTurn: false });
          setTimeout(() => {
            const update = { playDirection: newDirection, turn: nextPlayer };
            isComputerMode ? dispatch(update) : emitSocketEvent("updateGameState", update);
          }, 0);
        }
        break;
      }
      case "D2R":
      case "D2G":
      case "D2B":
      case "D2Y": {
        const colorOfPlayedCard = played_card.charAt(2);
        const numberOfPlayedCard = 200;

        if (!isValidPlay(played_card, currentColor, currentNumber)) {
          alert("Invalid Move! Draw 2 cards must match either the color or number of the current card.");
          break;
        }

        cardPlayedByPlayer({ cardPlayedBy, played_card, colorOfPlayedCard, numberOfPlayedCard, isDraw2: true, toggleTurn: false });
        if (isComputerMode && cardPlayedBy === "Player 2") setComputerMoveCounter(prev => prev + 1);
        break;
      }
      case "W":
      case "D4W": {
        const isDraw4 = played_card === 'D4W';
        const numberOfPlayedCard = isDraw4 ? 400 : 500;

        const playWild = (color) => {
          cardPlayedByPlayer({ cardPlayedBy, played_card, colorOfPlayedCard: color, numberOfPlayedCard, isDraw4, toggleTurn: !isDraw4 });
          if (isDraw4 && isComputerMode && cardPlayedBy === "Player 2") setComputerMoveCounter(prev => prev + 1);
        };

        if (isComputerMode && cardPlayedBy === "Player 2") {
          const colors = ['R', 'G', 'B', 'Y'];
          playWild(colors[Math.floor(Math.random() * colors.length)]);
        } else {
          setIsDialogOpen(true);
          setDialogCallback(() => (color) => color && playWild(color));
        }
        break;
      }
      default: {
        const { color, number } = parseCard(played_card);
        if (isValidPlay(played_card, currentColor, currentNumber)) {
          cardPlayedByPlayer({ cardPlayedBy, played_card, colorOfPlayedCard: color, numberOfPlayedCard: number });
        } else {
          alert("Invalid Move! You must play a card that matches either the color or number of the current card.");
        }
        break;
      }
    }
  };

  const handleDialogSubmit = (colorOfPlayedCard) => {
    if (dialogCallback) {
      dialogCallback(colorOfPlayedCard);
    }
    setIsDialogOpen(false);
  };

  // Reshuffle discard pile when draw pile empty
  const reshuffleDiscardPile = () => {
    if (playedCardsPile.length < 2) return null;

    const topCard = playedCardsPile[playedCardsPile.length - 1];
    const newDrawPile = shuffleArray([...playedCardsPile.slice(0, -1)]);
    playShufflingSound();
    toast({ title: "Reshuffling Cards", description: "Draw pile replenished.", variant: "default", duration: 3000 });

    return { newDrawPile, newPlayedCardsPile: [topCard] };
  };

  // Draw a card
  const onCardDrawnHandler = () => {
    let drawPile = [...drawCardPile];
    let discardPile = [...playedCardsPile];

    // Reshuffle if empty
    if (drawPile.length === 0) {
      const result = reshuffleDiscardPile();
      if (result) {
        drawPile = result.newDrawPile;
        discardPile = result.newPlayedCardsPile;
      } else {
        toast({ title: "No Cards Available", description: "There are no more cards to draw.", variant: "warning", duration: 3000 });
        const update = { turn: getNextPlayer(turn, getActivePlayers()), drawButtonPressed: false, isExtraTurn: false };
        isComputerMode ? dispatch(update) : emitSocketEvent("updateGameState", update);
        return;
      }
    }

    const drawCard = drawPile.pop();
    if (!drawCard) return;

    const { color, number } = parseCard(drawCard);
    const isPlayable = isValidPlay(drawCard, currentColor, currentNumber);
    const activePlayers = getActivePlayers();
    const turnCopy = isPlayable ? turn : getNextPlayer(turn, activePlayers);

    const deckKey = turn.toLowerCase().replace(' ', '') + 'Deck';
    const updateState = {
      turn: turnCopy,
      [deckKey]: [...getPlayerDeck(turn), drawCard],
      drawCardPile: drawPile,
      playedCardsPile: discardPile,
      drawButtonPressed: false,
      isExtraTurn: false,
    };

    if (isComputerMode) {
      dispatch(updateState);
      if (isPlayable && turn === "Player 2") {
        setTimeout(() => setComputerMoveCounter(prev => prev + 1), 1000);
      }
    } else {
      emitSocketEvent("updateGameState", updateState);
    }
  };

  // Skip turn button
  const onSkipButtonHandler = () => {
    const update = { turn: getNextPlayer(turn, getActivePlayers()), drawButtonPressed: false, isExtraTurn: false };
    isComputerMode ? dispatch(update) : emitSocketEvent("updateGameState", update);
  };

  // Handle winner reward and blockchain transaction
  const handleWinnerReward = async (winnerName) => {
    if (rewardGiven) return;

    if (!address || !isConnected) {
      toast({ title: "Wallet Required", description: "A connected wallet is required to receive your reward.", variant: "destructive", duration: 5000 });
      return;
    }

    const isCurrentUserWinner = winnerName === currentUser;
    if (!isCurrentUserWinner) return;

    setRewardGiven(true);

    try {
      const hasSufficientBalance = await checkBalance();
      if (!hasSufficientBalance) {
        setShowLowBalanceDrawer(true);
        return;
      }

      const gameResultData = {
        winnerAddress: address,
        winnerPlayer: winnerName,
        loserPlayers: getActivePlayers().filter(p => p !== winnerName),
        gameId: room,
        timestamp: Date.now(),
      };

      const gameHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(gameResultData)));

      const transaction = prepareContractCall({
        contract: {
          address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
          abi: unoGameABI,
          chain: getSelectedNetwork(),
          client,
        },
        method: "endGame",
        params: [BigInt(room), gameHash],
      });

      sendTransaction(transaction, {
        onSuccess: () => toast({ title: "Game Ended on Blockchain", description: "Game recorded successfully.", variant: "success", duration: 5000 }),
        onError: (err) => {
          console.error("Transaction failed:", err);
          toast({ title: "Error", description: "Failed to end game on blockchain.", variant: "destructive", duration: 5000 });
        },
      });

      toast({ title: "Congratulations!", description: "You've won the game!", variant: "success", duration: 5000 });
    } catch (error) {
      console.error("Failed to end game on blockchain:", error);
      toast({ title: "Blockchain Update Failed", description: "Issue recording game on blockchain.", variant: "warning", duration: 5000 });
    }
  };

  useEffect(() => {
    if (gameOver && winner && !rewardGiven) handleWinnerReward(winner);
  }, [gameOver, winner, rewardGiven]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', marginTop: "-27px" }}>
      <GameBackground turn={turn} currentColor={currentColor} currentUser={currentUser} totalPlayers={totalPlayers} />
      {!gameOver ? (
        <>
          <GameScreen
            currentUser={currentUser}
            turn={turn}
            player1Deck={player1Deck}
            player2Deck={player2Deck}
            player3Deck={player3Deck}
            player4Deck={player4Deck}
            player5Deck={player5Deck}
            player6Deck={player6Deck}
            playerCount={playerCount}
            onCardDrawnHandler={onCardDrawnHandler}
            onCardPlayedHandler={onCardPlayedHandler}
            playedCardsPile={playedCardsPile}
            drawButtonPressed={drawButtonPressed}
            onSkipButtonHandler={onSkipButtonHandler}
            isComputerMode={isComputerMode}
            isExtraTurn={isExtraTurn}
            onUnoClicked={() => {
              if (!isUnoButtonPressed) {
                playUnoSound();
                dispatch({ isUnoButtonPressed: true });
              }
            }}
          />
          {isDialogOpen && (
            <ColourDialog
              onSubmit={handleDialogSubmit}
              onClose={() => setIsDialogOpen(false)}
              isDialogOpen={isDialogOpen}
            />
          )}
        </>
      ) : (
        <CenterInfo msg={`Game Over: ${winner} wins!!`} />
      )}
      <Toaster />
      <LowBalanceDrawer 
        open={showLowBalanceDrawer} 
        onClose={() => setShowLowBalanceDrawer(false)} 
      />
    </div>
  );
};

export default Game;
