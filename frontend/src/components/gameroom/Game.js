import React, { useEffect, useReducer, useState, useRef } from "react";
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
  TOAST_DURATION 
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
  shouldDeclareUno 
} from "../../utils/computerAI";
import { 
  initializeComputerGame, 
  initializeMultiplayerGame 
} from "../../utils/gameInitialization";
import { 
  drawCardWithReshuffle, 
  reshuffleDiscardPile 
} from "../../utils/cardHandlers";
import { 
  processCardPlay, 
  validateCardPlay, 
  handleSkipCard, 
  handleReverseCard,
  getCardType,
} from "../../utils/cardPlayHandlers";

// Contract ABI (you'll need to import this from your contract file)
// import { unoGameABI } from "../../contracts/unoGameABI";
// import { baseSepolia } from "thirdweb/chains";

const gameReducer = (state, action) => ({ ...state, ...action });

const Game = ({ room, currentUser, isComputerMode = false, playerCount = 2 }) => {
  // State management
  const [gameState, dispatch] = useReducer(gameReducer, INITIAL_GAME_STATE);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogCallback, setDialogCallback] = useState(null);
  const [rewardGiven, setRewardGiven] = useState(false);
  const [computerMoveCounter, setComputerMoveCounter] = useState(0);
  const [showLowBalanceDrawer, setShowLowBalanceDrawer] = useState(false);
  
  // Refs
  const pendingActionsRef = useRef([]);
  
  // Hooks
  const { checkBalance } = useBalanceCheck();
  const { isConnected: socketConnected, isReconnecting } = useSocketConnection();
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
    playDirection = 1,
  } = gameState;
  
  // Sound map for action cards
  const playSoundMap = {
    [ACTION_CARD_CODES.SKIP]: playSkipCardSound,
    [ACTION_CARD_CODES.DRAW_2]: playDraw2CardSound,
    [ACTION_CARD_CODES.DRAW_4_WILD]: playDraw4CardSound,
    [ACTION_CARD_CODES.WILD]: playWildCardSound,
  };
  
  /**
   * Socket event emitter with buffering support
   */
  const emitSocketEvent = (eventName, data) => {
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
  };
  
  /**
   * Process pending actions when reconnected
   */
  useEffect(() => {
    if (socketConnected && pendingActionsRef.current.length > 0) {
      console.log(`Processing ${pendingActionsRef.current.length} pending actions`);
      
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
  }, [socketConnected]);
  
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
  }, [socketConnected, isReconnecting]);
  
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
        
        const computerMove = computerMakeMove(player2Deck, currentColor, currentNumber);
        
        if (computerMove === "draw") {
          onCardDrawnHandler();
        } else {
          onCardPlayedHandler(computerMove);
        }
      }, GAME_CONFIG.COMPUTER_TURN_DELAY);
      
      return () => clearTimeout(computerTurnDelay);
    }
  }, [turn, isComputerMode, gameOver, computerMoveCounter]);
  
  /**
   * Initialize game on component mount
   */
  useEffect(() => {
    console.log('Game component mounted, isComputerMode:', isComputerMode);
    
    if (isComputerMode) {
      console.log('Initializing computer mode game...');
      const initialState = initializeComputerGame();
      dispatch(initialState);
    } else if (currentUser === "Player 1") {
      console.log(`Player 1 initializing multiplayer game with ${playerCount} players...`);
      const initialState = initializeMultiplayerGame(playerCount);
      emitSocketEvent("initGameState", initialState);
    }
  }, [isComputerMode]);
  
  /**
   * Socket event listeners
   */
  useEffect(() => {
    socket.on("initGameState", (gameState) => {
      dispatch(gameState);
      playShufflingSound();
    });
    
    socket.on("updateGameState", (gameState) => {
      const { gameOver, winner, currentNumber } = gameState;
      
      if (gameOver) playGameOverSound();
      
      // Play appropriate sound for card played
      if (currentNumber && currentNumber in playSoundMap) {
        playSoundMap[currentNumber]();
      } else if (currentNumber) {
        playCardPlayedSound();
      }
      
      dispatch({
        ...gameState,
        isUnoButtonPressed: false,
        drawButtonPressed: gameState.drawButtonPressed || false,
      });
    });
    
    return () => {
      socket.off("initGameState");
      socket.off("updateGameState");
    };
  }, []);
  
  /**
   * Main card play handler - routes to specific handlers based on card type
   */
  const onCardPlayedHandler = (played_card) => {
    const cardPlayedBy = turn;
    
    // Update the last player who played a card
    dispatch({ lastCardPlayedBy: cardPlayedBy });
    
    const cardType = getCardType(played_card);
    const cardDetails = extractCardDetails(played_card);
    
    // Route to specific handler based on card type
    switch (cardType.type) {
      case 'skip':
        handleSkipCardPlay(played_card, cardDetails);
        break;
        
      case 'reverse':
        handleReverseCardPlay(played_card, cardDetails);
        break;
        
      case 'draw2':
        handleDraw2CardPlay(played_card, cardDetails);
        break;
        
      case 'wild':
      case 'draw4wild':
        handleWildCardPlay(played_card, cardType.type === 'draw4wild');
        break;
        
      default:
        handleRegularCardPlay(played_card, cardDetails);
        break;
    }
  };
  
  /**
   * Handle skip card play
   */
  const handleSkipCardPlay = (played_card, cardDetails) => {
    const validation = validateCardPlay(played_card, currentColor, currentNumber);
    
    if (!validation.isValid) {
      alert("Invalid Move! Skip cards must match either the color or number of the current card.");
      return;
    }
    
    const activePlayers = getActivePlayers(totalPlayers);
    const skipResult = handleSkipCard(turn, activePlayers, playDirection);
    
    console.log('Skip card played:', {
      cardPlayedBy: turn,
      skippedPlayer: skipResult.skippedPlayer,
      nextTurn: skipResult.nextTurn,
      direction: playDirection,
    });
    
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
      turn: skipResult.nextTurn,
    });
  };
  
  /**
   * Handle reverse card play
   */
  const handleReverseCardPlay = (played_card, cardDetails) => {
    const validation = validateCardPlay(played_card, currentColor, currentNumber);
    
    if (!validation.isValid) {
      alert("Invalid Move! Reverse cards must match either the color or number of the current card.");
      return;
    }
    
    const activePlayers = getActivePlayers(totalPlayers);
    const reverseResult = handleReverseCard(turn, activePlayers, playDirection);
    
    console.log('Reverse card played:', {
      cardPlayedBy: turn,
      newDirection: reverseResult.newDirection === 1 ? 'clockwise' : 'counter-clockwise',
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
      setComputerMoveCounter(prev => prev + 1);
    }
  };
  
  /**
   * Handle Draw 2 card play
   */
  const handleDraw2CardPlay = (played_card, cardDetails) => {
    const validation = validateCardPlay(played_card, currentColor, currentNumber);
    
    if (!validation.isValid) {
      alert("Invalid Move! Draw 2 cards must match either the color or number of the current card.");
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
      setComputerMoveCounter(prev => prev + 1);
    }
  };
  
  /**
   * Handle wild card play
   */
  const handleWildCardPlay = (played_card, isDraw4) => {
    // For computer player, randomly select a color
    if (isComputerMode && turn === "Player 2") {
      const randomColor = selectRandomColor();
      
      const newState = processCardPlay({
        cardPlayedBy: turn,
        played_card,
        colorOfPlayedCard: randomColor,
        numberOfPlayedCard: isDraw4 ? ACTION_CARD_CODES.DRAW_4_WILD : ACTION_CARD_CODES.WILD,
        gameState,
        isDraw4,
        toggleTurn: !isDraw4,
        isComputerMode,
        playShufflingSound,
      });
      
      updateGameState(newState);
      
      // Trigger another computer move after playing +4 (turn stays with computer)
      if (isDraw4) {
        setComputerMoveCounter(prev => prev + 1);
      }
    } else {
      // Ask for new color via dialog for human players
      setIsDialogOpen(true);
      setDialogCallback(() => (colorOfPlayedCard) => {
        if (!colorOfPlayedCard) return;
        
        const newState = processCardPlay({
          cardPlayedBy: turn,
          played_card,
          colorOfPlayedCard,
          numberOfPlayedCard: isDraw4 ? ACTION_CARD_CODES.DRAW_4_WILD : ACTION_CARD_CODES.WILD,
          gameState,
          isDraw4,
          toggleTurn: !isDraw4,
          isComputerMode,
          playShufflingSound,
        });
        
        updateGameState(newState);
      });
    }
  };
  
  /**
   * Handle regular card play
   */
  const handleRegularCardPlay = (played_card, cardDetails) => {
    const validation = validateCardPlay(played_card, currentColor, currentNumber);
    
    if (!validation.isValid) {
      console.log('Invalid move:', validation);
      alert("Invalid Move! You must play a card that matches either the color or number of the current card.");
      return;
    }
    
    console.log('Valid move:', validation);
    
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
  };
  
  /**
   * Update game state (local or via socket)
   */
  const updateGameState = (newState) => {
    if (isComputerMode) {
      dispatch(newState);
      
      // Play appropriate sound
      if (newState.currentNumber in playSoundMap) {
        playSoundMap[newState.currentNumber]();
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
  };
  
  /**
   * Handle dialog submission for wild cards
   */
  const handleDialogSubmit = (colorOfPlayedCard) => {
    if (dialogCallback) {
      dialogCallback(colorOfPlayedCard);
    }
    setIsDialogOpen(false);
  };
  
  /**
   * Handle card draw
   */
  const onCardDrawnHandler = () => {
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
        
        console.log('Reshuffled discard pile into draw pile. New draw pile size:', copiedDrawCardPileArray.length);
      } else {
        console.warn('Draw card pile is empty and not enough cards to reshuffle!');
        
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
      console.error('Undefined card drawn from pile');
      return;
    }
    
    // Extract card details
    const cardDetails = extractCardDetails(drawCard);
    
    // Check if the drawn card is playable
    const playable = isCardPlayable(drawCard, currentColor, currentNumber);
    
    console.log('Card drawn:', drawCard, 'Playable:', playable);
    
    // Only change turn if the drawn card is NOT playable
    const activePlayers = getActivePlayers(totalPlayers);
    const turnCopy = playable ? turn : getNextPlayer(turn, activePlayers, playDirection);
    
    // Add drawn card to current player's deck
    const currentPlayerDeck = getPlayerDeck(turn, gameState);
    const updatedDeck = [...currentPlayerDeck, drawCard];
    const deckKey = `${turn.toLowerCase().replace(' ', '')}Deck`;
    
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
        console.log('Computer drew playable card:', drawCard, 'Will play on next turn cycle');
        setTimeout(() => {
          setComputerMoveCounter(prev => prev + 1);
        }, GAME_CONFIG.COMPUTER_DRAW_DELAY);
      }
    } else {
      emitSocketEvent("updateGameState", updateState);
    }
  };
  
  /**
   * Handle skip button
   */
  const onSkipButtonHandler = () => {
    const activePlayers = getActivePlayers(totalPlayers);
    const newState = {
      turn: getNextPlayer(turn, activePlayers, playDirection),
      drawButtonPressed: false,
      isExtraTurn: false,
    };
    
    updateGameState(newState);
  };
  
  /**
   * Handle winner reward (blockchain transaction)
   */
  const handleWinnerReward = async (winnerName) => {
    try {
      if (rewardGiven) return;
      
      if (!address || !isConnected) {
        console.log('Wallet not connected. Please connect your wallet.');
        
        toast({
          title: "Wallet Required",
          description: "A connected wallet is required to receive your reward.",
          variant: "destructive",
          duration: TOAST_DURATION.LONG,
        });
        
        return;
      }
      
      const currentUserAddress = address;
      console.log('Connected wallet address:', currentUserAddress);
      
      // Only create a claimable balance if the current user is the winner
      const isCurrentUserWinner =
        (winnerName === "Player 1" && currentUser === "Player 1") ||
        (winnerName === "Player 2" && currentUser === "Player 2");
      
      console.log(currentUser, winnerName, isCurrentUserWinner);
      
      if (!isCurrentUserWinner) {
        console.log('Current user is not the winner');
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
          loserPlayers: ["Player 1", "Player 2"].filter(player => player !== winnerName),
          gameId: room,
          timestamp: Date.now(),
        };
        
        const gameResultString = JSON.stringify(gameResultData);
        const gameHash = ethers.keccak256(ethers.toUtf8Bytes(gameResultString));
        
        console.log('Calling endGame with gameId:', room, 'and gameHash:', gameHash);
        
        // Note: You'll need to uncomment and configure this when you have the contract ABI
        /*
        const transaction = prepareContractCall({
          contract: {
            address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
            abi: unoGameABI,
            chain: baseSepolia,
            client,
          },
          method: "endGame",
          params: [BigInt(room), gameHash],
        });
        
        sendTransaction(transaction, {
          onSuccess: (result) => {
            console.log("Transaction successful:", result);
            toast({
              title: "Game Ended on Blockchain",
              description: "The game has been successfully recorded on the blockchain.",
              variant: "success",
              duration: TOAST_DURATION.LONG,
            });
          },
          onError: (error) => {
            console.error("Transaction failed:", error);
            toast({
              title: "Error",
              description: "Failed to end game on blockchain. Please try again.",
              variant: "destructive",
              duration: TOAST_DURATION.LONG,
            });
          },
        });
        */
      } catch (error) {
        console.error('Failed to end game on blockchain:', error);
        
        toast({
          title: "Blockchain Update Failed",
          description: "There was an issue recording the game on the blockchain.",
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
      console.error('Error creating claimable balance:', error);
    }
  };
  
  /**
   * Trigger winner reward when game ends
   */
  useEffect(() => {
    if (gameOver && winner && !rewardGiven) {
      handleWinnerReward(winner);
    }
  }, [gameOver, winner, rewardGiven]);
  
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', marginTop: "-27px" }}>
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
                dispatch({ type: "SET_UNO_BUTTON_PRESSED", isUnoButtonPressed: true });
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
