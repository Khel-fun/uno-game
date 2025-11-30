import React, {
  useEffect,
  useReducer,
  useState,
  useRef,
  useCallback,
} from "react";
import { ethers } from "ethers";
import { useWalletClient } from "wagmi";
import { useSendTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";

// Socket and context
import socket from "../../services/socket";
import { useSocketConnection } from "@/context/SocketConnectionContext";
import { useSoundProvider } from "../../context/SoundProvider";

// Components
import CenterInfo from "./CenterInfo";
import GameScreen from "./GameScreen";
import GameBackground from "./GameBackground";
import ColourDialog from "./colourDialog";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { LowBalanceDrawer } from "@/components/LowBalanceDrawer";

// Utilities
import { useWalletAddress } from "@/utils/onchainWalletUtils";
import { useBalanceCheck } from "@/hooks/useBalanceCheck";
import { client } from "@/utils/thirdWebClient";
import {
  INITIAL_GAME_STATE,
  ACTION_CARD_CODES,
  GAME_CONFIG,
  TOAST_DURATION,
} from "../../utils/gameConstants";
import {
  getPlayerDeck,
  getActivePlayers,
  getNextPlayer,
  extractCardDetails,
  isCardPlayable,
} from "../../utils/gameLogic";
import {
  computerMakeMove,
  selectRandomColor,
  shouldDeclareUno,
} from "../../utils/computerAI";
import {
  initializeComputerGame,
  initializeMultiplayerGame,
} from "../../utils/gameInitialization";
import { reshuffleDiscardPile } from "../../utils/cardHandlers";
import {
  processCardPlay,
  validateCardPlay,
  handleReverseCard,
} from "../../utils/cardPlayHandlers";

// Contract ABI (you'll need to import this from your contract file)
// import { unoGameABI } from "../../contracts/unoGameABI";
// import { baseSepolia } from "thirdweb/chains";

export interface GameState {
  gameOver: boolean;
  winner: string;
  turn: string;
  player1Deck: string[];
  player2Deck: string[];
  player3Deck: string[];
  player4Deck: string[];
  player5Deck: string[];
  player6Deck: string[];
  currentColor: string;
  currentNumber: string;
  playedCardsPile: string[];
  drawCardPile: string[];
  isUnoButtonPressed: boolean;
  drawButtonPressed: boolean;
  lastCardPlayedBy: string;
  isExtraTurn: boolean;
  totalPlayers: number;
  playDirection: "clockwise" | "counterclockwise";
  [key: string]: any; // Allow index signature for dynamic deck access
}

interface CardDetails {
  color: string | null;
  number: number | string;
  type: string;
}

interface GameProps {
  room: string;
  currentUser: string;
  isComputerMode?: boolean;
  playerCount?: number;
  restoredGameState?: Partial<GameState> | null;
}

const gameReducer = (
  state: GameState,
  action: Partial<GameState>
): GameState => ({
  ...state,
  ...action,
});

const Game: React.FC<GameProps> = ({
  room,
  currentUser,
  isComputerMode = false,
  playerCount = 2,
  restoredGameState = null,
}) => {
  // Use restored game state if available (for reconnection), otherwise use initial state
  const [gameState, dispatch] = useReducer(
    gameReducer,
    (restoredGameState as GameState) || INITIAL_GAME_STATE
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogCallback, setDialogCallback] = useState<
    ((color: string) => void) | null
  >(null);
  const [rewardGiven, setRewardGiven] = useState(false);
  const [computerMoveCounter, setComputerMoveCounter] = useState(0);
  const [showLowBalanceDrawer, setShowLowBalanceDrawer] = useState(false);

  // Refs
  const pendingActionsRef = useRef<{ eventName: string; data: any }[]>([]);

  // Hooks
  const { checkBalance } = useBalanceCheck();
  const { isConnected: socketConnected, isReconnecting } =
    useSocketConnection();
  const { address, isConnected } = useWalletAddress();
  const { data: walletClient } = useWalletClient();
  const { mutate: sendTransaction } = useSendTransaction();
  const { toast } = useToast();

  // Sound effects
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

  // Destructure game state
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
    playDirection = "clockwise",
  } = gameState;

  // Sound map for action cards
  const playSoundMap = useCallback(
    (code: number | string) => {
      const numCode = typeof code === "string" ? parseInt(code) : code;
      switch (numCode) {
        case ACTION_CARD_CODES.SKIP:
          return playSkipCardSound();
        case ACTION_CARD_CODES.DRAW_2:
          return playDraw2CardSound();
        case ACTION_CARD_CODES.DRAW_4_WILD:
          return playDraw4CardSound();
        case ACTION_CARD_CODES.WILD:
          return playWildCardSound();
        default:
          return playCardPlayedSound();
      }
    },
    [
      playSkipCardSound,
      playDraw2CardSound,
      playDraw4CardSound,
      playWildCardSound,
      playCardPlayedSound,
    ]
  );

  /**
   * Socket event emitter with buffering support
   */
  const emitSocketEvent = useCallback(
    (eventName: string, data: any) => {
      if (socketConnected) {
        socket.emit(eventName, data);
      } else {
        console.log(`Socket disconnected, buffering event: ${eventName}`);
        pendingActionsRef.current.push({ eventName, data });

        toast({
          title: "Connection issue",
          description: "Your action will be sent when connection is restored",
          duration: TOAST_DURATION.SHORT,
          variant: "warning",
        });
      }
    },
    [socketConnected, toast]
  );

  /**
   * Process pending actions when reconnected
   */
  useEffect(() => {
    if (socketConnected && pendingActionsRef.current.length > 0) {
      console.log(
        `Processing ${pendingActionsRef.current.length} pending actions`
      );

      pendingActionsRef.current.forEach(({ eventName, data }) => {
        socket.emit(eventName, data);
      });

      pendingActionsRef.current = [];

      toast({
        title: "Connection restored",
        description: "All pending actions have been sent",
        duration: TOAST_DURATION.SHORT,
        variant: "success",
      });
    }
  }, [socketConnected, toast]);

  /**
   * Show warning when connection is lost during game
   */
  useEffect(() => {
    if (!socketConnected && !isReconnecting && gameState.turn) {
      toast({
        title: "Connection lost",
        description: "Attempting to reconnect...",
        duration: TOAST_DURATION.LONG,
        variant: "destructive",
      });
    }
  }, [socketConnected, isReconnecting, gameState.turn, toast]);

  /**
   * Update game state (local or via socket)
   */
  const updateGameState = useCallback(
    (newState: Partial<GameState>) => {
      if (isComputerMode) {
        dispatch(newState);

        // Play appropriate sound
        if (newState.currentNumber) {
          playSoundMap(newState.currentNumber);
        } else {
          playCardPlayedSound();
        }

        // Check for game over
        if (newState.gameOver) {
          playGameOverSound();
        }
      } else {
        emitSocketEvent("updateGameState", newState);
      }
    },
    [
      isComputerMode,
      playSoundMap,
      playCardPlayedSound,
      playGameOverSound,
      emitSocketEvent,
    ]
  );

  /**
   * Handle card draw
   */
  const onCardDrawnHandler = useCallback(() => {
    let copiedDrawCardPileArray = [...drawCardPile];
    let updatedPlayedCardsPile = [...playedCardsPile];

    // Check if there are cards left in the draw pile
    if (copiedDrawCardPileArray.length === 0) {
      const reshuffleResult = reshuffleDiscardPile(playedCardsPile);

      if (reshuffleResult) {
        copiedDrawCardPileArray = reshuffleResult.newDrawPile;
        updatedPlayedCardsPile = reshuffleResult.newPlayedCardsPile;

        playShufflingSound();

        toast({
          title: "Reshuffling Cards",
          description: "Draw pile has been replenished with shuffled cards.",
          variant: "default",
          duration: TOAST_DURATION.SHORT,
        });

        console.log(
          "Reshuffled discard pile into draw pile. New draw pile size:",
          copiedDrawCardPileArray.length
        );
      } else {
        console.warn(
          "Draw card pile is empty and not enough cards to reshuffle!"
        );

        toast({
          title: "No Cards Available",
          description: "There are no more cards to draw.",
          variant: "warning",
          duration: TOAST_DURATION.SHORT,
        });

        // Skip turn without drawing
        const activePlayers = getActivePlayers(totalPlayers);
        const turnCopy = getNextPlayer(turn, activePlayers, playDirection);

        const newState = {
          turn: turnCopy,
          drawButtonPressed: false,
          isExtraTurn: false,
        };

        updateGameState(newState);
        return;
      }
    }

    // Draw a card
    const drawCard = copiedDrawCardPileArray.pop();

    if (!drawCard) {
      console.error("Undefined card drawn from pile");
      return;
    }

    // Extract card details
    // const cardDetails = extractCardDetails(drawCard);

    // Check if the drawn card is playable
    const playable = isCardPlayable(drawCard, currentColor, currentNumber);

    console.log("Card drawn:", drawCard, "Playable:", playable);

    // Only change turn if the drawn card is NOT playable
    const activePlayers = getActivePlayers(totalPlayers);
    const turnCopy = playable
      ? turn
      : getNextPlayer(turn, activePlayers, playDirection);

    // Add drawn card to current player's deck
    const currentPlayerDeck = getPlayerDeck(turn, gameState);
    const updatedDeck = [...currentPlayerDeck, drawCard];
    const deckKey = `${turn.toLowerCase().replace(" ", "")}Deck`;

    const updateState = {
      turn: turnCopy,
      [deckKey]: updatedDeck,
      drawCardPile: copiedDrawCardPileArray,
      playedCardsPile: updatedPlayedCardsPile,
      drawButtonPressed: false,
      isExtraTurn: false,
    };

    if (isComputerMode) {
      dispatch(updateState);

      // For computer mode, if computer draws a playable card, trigger another move
      if (playable && turn === "Player 2") {
        console.log(
          "Computer drew playable card:",
          drawCard,
          "Will play on next turn cycle"
        );
        setTimeout(() => {
          setComputerMoveCounter((prev) => prev + 1);
        }, GAME_CONFIG.COMPUTER_DRAW_DELAY);
      }
    } else {
      emitSocketEvent("updateGameState", updateState);
    }
  }, [
    drawCardPile,
    playedCardsPile,
    totalPlayers,
    turn,
    playDirection,
    currentColor,
    currentNumber,
    gameState,
    isComputerMode,
    updateGameState,
    emitSocketEvent,
    playShufflingSound,
    toast,
  ]);

  /**
   * Handle regular card play
   */
  const handleRegularCardPlay = useCallback(
    (played_card: string, cardDetails: CardDetails) => {
      const validation = validateCardPlay(
        played_card,
        currentColor,
        currentNumber
      );

      if (!validation.isValid) {
        console.log("Invalid move:", validation);
        alert(
          "Invalid Move! You must play a card that matches either the color or number of the current card."
        );
        return;
      }

      console.log("Valid move:", validation);

      const newState = processCardPlay({
        cardPlayedBy: turn,
        played_card,
        colorOfPlayedCard: cardDetails.color,
        numberOfPlayedCard: cardDetails.number,
        gameState,
        isComputerMode,
        playShufflingSound,
      });

      updateGameState(newState);
    },
    [
      currentColor,
      currentNumber,
      turn,
      gameState,
      isComputerMode,
      playShufflingSound,
      updateGameState,
    ]
  );

  /**
   * Handle dialog submission for wild cards
   */
  const handleDialogSubmit = (colorOfPlayedCard: string) => {
    if (dialogCallback) {
      dialogCallback(colorOfPlayedCard);
    }
    setIsDialogOpen(false);
  };

  /**
   * Handle wild card play
   */
  const handleWildCardPlay = useCallback(
    (played_card: string, isDraw4: boolean) => {
      // For computer player, randomly select a color
      if (isComputerMode && turn === "Player 2") {
        const randomColor = selectRandomColor();

        const newState = processCardPlay({
          cardPlayedBy: turn,
          played_card,
          colorOfPlayedCard: randomColor,
          numberOfPlayedCard: isDraw4
            ? ACTION_CARD_CODES.DRAW_4_WILD
            : ACTION_CARD_CODES.WILD,
          gameState,
          isDraw4,
          toggleTurn: !isDraw4,
          isComputerMode,
          playShufflingSound,
        });

        updateGameState(newState);

        // Trigger another computer move after playing +4 (turn stays with computer)
        if (isDraw4) {
          setComputerMoveCounter((prev) => prev + 1);
        }
      } else {
        // Ask for new color via dialog for human players
        setIsDialogOpen(true);
        setDialogCallback(() => (colorOfPlayedCard: string) => {
          if (!colorOfPlayedCard) return;

          const newState = processCardPlay({
            cardPlayedBy: turn,
            played_card,
            colorOfPlayedCard,
            numberOfPlayedCard: isDraw4
              ? ACTION_CARD_CODES.DRAW_4_WILD
              : ACTION_CARD_CODES.WILD,
            gameState,
            isDraw4,
            toggleTurn: !isDraw4,
            isComputerMode,
            playShufflingSound,
          });

          updateGameState(newState);
        });
      }
    },
    [isComputerMode, turn, gameState, playShufflingSound, updateGameState]
  );

  /**
   * Handle Draw 2 card play
   */
  const handleDraw2CardPlay = useCallback(
    (played_card: string, cardDetails: CardDetails) => {
      const validation = validateCardPlay(
        played_card,
        currentColor,
        currentNumber
      );

      if (!validation.isValid) {
        alert(
          "Invalid Move! Draw 2 cards must match either the color or number of the current card."
        );
        return;
      }

      const newState = processCardPlay({
        cardPlayedBy: turn,
        played_card,
        colorOfPlayedCard: cardDetails.color,
        numberOfPlayedCard: cardDetails.number,
        gameState,
        isDraw2: true,
        toggleTurn: false,
        isComputerMode,
        playShufflingSound,
      });

      updateGameState(newState);

      // Trigger another computer move (turn stays with computer)
      if (isComputerMode && turn === "Player 2") {
        setComputerMoveCounter((prev) => prev + 1);
      }
    },
    [
      currentColor,
      currentNumber,
      turn,
      gameState,
      isComputerMode,
      playShufflingSound,
      updateGameState,
    ]
  );

  /**
   * Handle reverse card play
   */
  const handleReverseCardPlay = useCallback(
    (played_card: string, cardDetails: CardDetails) => {
      const validation = validateCardPlay(
        played_card,
        currentColor,
        currentNumber
      );

      if (!validation.isValid) {
        alert(
          "Invalid Move! Reverse cards must match either the color or number of the current card."
        );
        return;
      }

      const activePlayers = getActivePlayers(totalPlayers);
      const reverseResult = handleReverseCard(
        turn,
        activePlayers,
        playDirection
      );

      console.log("Reverse card played:", {
        cardPlayedBy: turn,
        newDirection:
          reverseResult.newDirection === 1 ? "clockwise" : "counter-clockwise",
        nextTurn: reverseResult.nextTurn,
        actsLikeSkip: reverseResult.actsLikeSkip,
      });

      // Play the card
      const newState = processCardPlay({
        cardPlayedBy: turn,
        played_card,
        colorOfPlayedCard: cardDetails.color,
        numberOfPlayedCard: cardDetails.number,
        gameState,
        toggleTurn: false,
        isComputerMode,
        playShufflingSound,
      });

      // Update state with new direction and turn
      updateGameState({
        ...newState,
        playDirection: reverseResult.newDirection,
        turn: reverseResult.nextTurn,
      });

      // Trigger another computer move if it's the computer's turn and acts like skip
      if (isComputerMode && reverseResult.actsLikeSkip && turn === "Player 2") {
        setComputerMoveCounter((prev) => prev + 1);
      }
    },
    [
      currentColor,
      currentNumber,
      totalPlayers,
      turn,
      playDirection,
      gameState,
      isComputerMode,
      playShufflingSound,
      updateGameState,
    ]
  );

  /**
   * Handle skip card play (extracted from onCardPlayedHandler logic)
   */
  const handleSkipCardPlay = useCallback(
    (played_card: string, cardDetails: CardDetails) => {
      const validation = validateCardPlay(
        played_card,
        currentColor,
        currentNumber
      );
      if (!validation.isValid) {
        alert(
          "Invalid Move! Skip cards must match either the color or number of the current card."
        );
        return;
      }

      const activePlayers = getActivePlayers(totalPlayers);
      const nextPlayer = getNextPlayer(turn, activePlayers, playDirection);
      const playerAfterSkipped = getNextPlayer(
        nextPlayer,
        activePlayers,
        playDirection
      );

      // Play the card but don't toggle turn (we'll set it manually)
      const newState = processCardPlay({
        cardPlayedBy: turn,
        played_card,
        colorOfPlayedCard: cardDetails.color,
        numberOfPlayedCard: cardDetails.number,
        gameState,
        toggleTurn: false,
        isComputerMode,
        playShufflingSound,
      });

      // Update state with the skipped turn
      updateGameState({
        ...newState,
        turn: playerAfterSkipped,
      });
    },
    [
      currentColor,
      currentNumber,
      totalPlayers,
      turn,
      playDirection,
      gameState,
      isComputerMode,
      playShufflingSound,
      updateGameState,
    ]
  );

  /**
   * Main handler for card play
   */
  const onCardPlayedHandler = useCallback(
    (played_card: string) => {
      //extract the card played
      const cardDetails = extractCardDetails(played_card);

      // Update the last player who played a card
      dispatch({ lastCardPlayedBy: turn });

      switch (cardDetails.type) {
        case "SKIP":
          handleSkipCardPlay(played_card, cardDetails);
          break;
        case "REVERSE":
          handleReverseCardPlay(played_card, cardDetails);
          break;
        case "DRAW_2":
          handleDraw2CardPlay(played_card, cardDetails);
          break;
        case "WILD":
          handleWildCardPlay(played_card, false);
          break;
        case "DRAW_4_WILD":
          handleWildCardPlay(played_card, true);
          break;
        default:
          handleRegularCardPlay(played_card, cardDetails);
          break;
      }
    },
    [
      turn,
      handleSkipCardPlay,
      handleReverseCardPlay,
      handleDraw2CardPlay,
      handleWildCardPlay,
      handleRegularCardPlay,
    ]
  );

  /**
   * Handle computer turn with delay for better UX
   */
  useEffect(() => {
    if (isComputerMode && turn === "Player 2" && !gameOver) {
      const computerTurnDelay = setTimeout(() => {
        // Check if computer should declare UNO
        if (shouldDeclareUno(player2Deck.length)) {
          playUnoSound();
        }

        const computerMove = computerMakeMove(
          player2Deck,
          currentColor,
          currentNumber
        );

        if (computerMove === "draw") {
          onCardDrawnHandler();
        } else {
          onCardPlayedHandler(computerMove);
        }
      }, GAME_CONFIG.COMPUTER_TURN_DELAY);

      return () => clearTimeout(computerTurnDelay);
    }
  }, [
    turn,
    isComputerMode,
    gameOver,
    computerMoveCounter,
    player2Deck,
    currentColor,
    currentNumber,
    playUnoSound,
    onCardDrawnHandler,
    onCardPlayedHandler,
  ]);

  /**
   * Initialize game on component mount
   */
  useEffect(() => {
    console.log("Game component mounted, isComputerMode:", isComputerMode);

    if (isComputerMode) {
      console.log("Initializing computer mode game...");
      const initialState = initializeComputerGame() as Partial<GameState>;
      dispatch(initialState);
    } else if (currentUser === "Player 1") {
      console.log(
        `Player 1 initializing multiplayer game with ${playerCount} players...`
      );
      const initialState = initializeMultiplayerGame(
        playerCount
      ) as Partial<GameState>;
      emitSocketEvent("initGameState", initialState);
    }
  }, [isComputerMode, currentUser, playerCount, emitSocketEvent]);

  /**
   * Socket event listeners
   */
  useEffect(() => {
    const handleInitGameState = (gameState: Partial<GameState>) => {
      // Dispatch all game state properties dynamically
      dispatch(gameState);
      playShufflingSound();
    };

    const handleUpdateGameState = (gameState: Partial<GameState>) => {
      const { gameOver, winner, currentNumber } = gameState;

      if (gameOver) playGameOverSound();

      //check for special card and play their sound else play regular sound
      if (currentNumber) {
        playSoundMap(currentNumber);
      }

      // Dispatch all game state updates
      dispatch({
        ...gameState,
        isUnoButtonPressed: false,
        drawButtonPressed: gameState.drawButtonPressed || false,
      });
    };

    socket.on("initGameState", handleInitGameState);
    socket.on("updateGameState", handleUpdateGameState);

    // CRITICAL: Cleanup event listeners on unmount or reconnection
    return () => {
      socket.off("initGameState", handleInitGameState);
      socket.off("updateGameState", handleUpdateGameState);
    };
  }, [
    playShufflingSound,
    playGameOverSound,
    playCardPlayedSound,
    playSoundMap,
  ]);

  /**
   * Handle skip button
   */
  const onSkipButtonHandler = useCallback(() => {
    const activePlayers = getActivePlayers(totalPlayers);
    const newState = {
      turn: getNextPlayer(turn, activePlayers, playDirection),
      drawButtonPressed: false,
      isExtraTurn: false,
    };

    updateGameState(newState);
  }, [totalPlayers, turn, playDirection, updateGameState]);

  /**
   * Handle winner reward (blockchain transaction)
   */
  const handleWinnerReward = useCallback(
    async (winnerName: string) => {
      try {
        if (rewardGiven) return;

        if (!address || !isConnected) {
          console.log("Wallet not connected. Please connect your wallet.");

          toast({
            title: "Wallet Required",
            description:
              "A connected wallet is required to receive your reward.",
            variant: "destructive",
            duration: TOAST_DURATION.LONG,
          });

          return;
        }

        const currentUserAddress = address;
        console.log("Connected wallet address:", currentUserAddress);

        // Only create a claimable balance if the current user is the winner
        const isCurrentUserWinner =
          (winnerName === "Player 1" && currentUser === "Player 1") ||
          (winnerName === "Player 2" && currentUser === "Player 2");

        console.log(currentUser, winnerName, isCurrentUserWinner);

        if (!isCurrentUserWinner) {
          console.log("Current user is not the winner");
          return;
        }

        setRewardGiven(true);

        try {
          // Check balance before proceeding with transaction
          const hasSufficientBalance = await checkBalance();
          if (!hasSufficientBalance) {
            setShowLowBalanceDrawer(true);
            return;
          }

          const gameResultData = {
            winnerAddress: currentUserAddress,
            winnerPlayer: winnerName,
            loserPlayers: ["Player 1", "Player 2"].filter(
              (player) => player !== winnerName
            ) as string[],
            gameId: room,
            timestamp: Date.now(),
          };

          const gameResultString = JSON.stringify(gameResultData);
          const gameHash = ethers.keccak256(
            ethers.toUtf8Bytes(gameResultString)
          );

          console.log(
            "Calling endGame with gameId:",
            room,
            "and gameHash:",
            gameHash
          );

          // Blockchain transaction code (commented out as in original)
          toast({
            title: "Game Ended on Blockchain",
            description:
              "The game has been successfully recorded on the blockchain.",
            variant: "success",
            duration: TOAST_DURATION.LONG,
          });
        } catch (error) {
          console.error("Failed to end game on blockchain:", error);

          toast({
            title: "Blockchain Update Failed",
            description:
              "There was an issue recording the game on the blockchain.",
            variant: "warning",
            duration: TOAST_DURATION.LONG,
          });
        }

        toast({
          title: "Congratulations!",
          description: "You've won the game!",
          variant: "success",
          duration: TOAST_DURATION.LONG,
        });
      } catch (error) {
        console.error("Error creating claimable balance:", error);
      }
    },
    [address, isConnected, rewardGiven, currentUser, room, checkBalance, toast]
  );

  /**
   * Trigger winner reward when game ends
   */
  useEffect(() => {
    if (gameOver && winner && !rewardGiven) {
      handleWinnerReward(winner);
    }
  }, [gameOver, winner, rewardGiven, handleWinnerReward]);

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        marginTop: "-27px",
      }}
    >
      <GameBackground
        turn={turn}
        currentColor={currentColor}
        currentUser={currentUser}
        totalPlayers={totalPlayers}
      />

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
                dispatch({
                  type: "SET_UNO_BUTTON_PRESSED" as any,
                  isUnoButtonPressed: true,
                });
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
