import React, { useEffect, useReducer, useState, useRef } from "react";
import socket, { socketManager } from "../../services/socket";
import MemoizedHeader from "./Header";
import CenterInfo from "./CenterInfo";
import GameScreen from "./GameScreen";
import GameBackground from "./GameBackground";
import { PACK_OF_CARDS, ACTION_CARDS } from "../../utils/packOfCards";
import shuffleArray from "../../utils/shuffleArray";
import { useSoundProvider } from "../../context/SoundProvider";
import ColourDialog from "./colourDialog";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useAccount, useWalletClient } from "wagmi";
// import { addClaimableBalance, claimableBalancesApi } from '@/utils/supabase';
import { useWalletAddress } from "@/utils/onchainWalletUtils";
import { useBalanceCheck } from "@/hooks/useBalanceCheck";
import { LowBalanceDrawer } from "@/components/LowBalanceDrawer";
import { ethers } from "ethers";
import { useReadContract, useActiveAccount, useSendTransaction } from "thirdweb/react";
import { waitForReceipt, getContract, prepareContractCall } from "thirdweb";
import { useSocketConnection } from "@/context/SocketConnectionContext";

//NUMBER CODES FOR ACTION CARDS
//SKIP - 100
//DRAW 2 - 200
//WILD - 500
//DRAW 4 WILD - 400

const checkGameOver = (playerDeck) => {
  return playerDeck.length === 1;
};

const checkWinner = (playerDeck, player) => {
  return playerDeck.length === 1 ? player : "";
};

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

  // Use Wagmi hooks for wallet functionality
  const { address, isConnected } = useWalletAddress();
  const { data: walletClient } = useWalletClient();

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

  // Helper function to emit socket events with buffering support
  const emitSocketEvent = (eventName, data) => {
    if (socketConnected) {
      socket.emit(eventName, data);
    } else {
      console.log(`Socket disconnected, buffering event: ${eventName}`);
      pendingActionsRef.current.push({ eventName, data });
      
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
      console.log(`Processing ${pendingActionsRef.current.length} pending actions`);
      
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

  // Computer AI logic
  const getValidMoves = (computerDeck, currentColor, currentNumber) => {
    return computerDeck.filter(card => {
      // Wild cards can always be played
      if (card.includes("W") || card.includes("D4W")) return true;
      
      // Match color or number
      const cardColor = card.charAt(1);
      const cardNumber = card.charAt(0);
      
      return cardColor === currentColor || cardNumber === currentNumber;
    });
  };

  const computerMakeMove = () => {
    const validMoves = getValidMoves(player2Deck, currentColor, currentNumber);
    
    if (validMoves.length > 0) {
      // Prioritize special cards if available
      const specialCards = validMoves.filter(card => 
        card.includes("skip") || card.includes("D2") || card === "W" || card === "D4W"
      );
      
      if (specialCards.length > 0) {
        return specialCards[0]; // Play the first special card found
      }
      
      // Otherwise play a regular card
      return validMoves[0];
    } else {
      // Check if draw pile is empty and needs reshuffling
      if (drawCardPile.length === 0 && playedCardsPile.length > 1) {
        // Don't need to actually reshuffle here, as that will happen in onCardDrawnHandler
        console.log('Computer notices draw pile is empty, will trigger reshuffle on draw');
      }
      
      // Draw a card if no valid moves
      // With new rule, if the drawn card is playable, the computer will play it automatically
      // This is handled in onCardDrawnHandler with the isPlayable check and setTimeout
      return "draw";
    }
  };

  // Handle computer turn with delay for better UX
  useEffect(() => {
    if (isComputerMode && turn === "Player 2" && !gameOver) {
      const computerTurnDelay = setTimeout(() => {
        // Check if computer should declare UNO (when it has 2 cards and will play one)
        if (player2Deck.length === 2) {
          playUnoSound();
        }
        
        const computerMove = computerMakeMove();
        
        if (computerMove === "draw") {
          // Computer draws a card
          // If the drawn card is playable, the computer will automatically play it
          // This is handled in onCardDrawnHandler with the isPlayable check and setTimeout
          onCardDrawnHandler();
          // Note: We don't need to do anything else here because onCardDrawnHandler
          // will handle playing the card if it's playable
        } else {
          // Computer plays a card from its existing hand
          onCardPlayedHandler(computerMove);
        }
      }, 3000); // 3 second delay for better UX

      return () => clearTimeout(computerTurnDelay);
    }
  }, [turn, isComputerMode, gameOver, computerMoveCounter]); // Added computerMoveCounter to re-trigger after special cards

  //handles the sounds with our custom sound provider
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

  //runs once on component mount
  useEffect(() => {
    console.log('Game component mounted, isComputerMode:', isComputerMode);
    
    if (isComputerMode) {
      console.log('Initializing computer mode game...');
      // For computer mode, initialize game state directly
      const shuffledCards = shuffleArray(PACK_OF_CARDS);
      console.log('Shuffled cards:', shuffledCards.length);

      //extract first 7 elements to player1Deck (standard Uno starting hand)
      const player1Deck = shuffledCards.splice(0, 5);

      //extract first 7 elements to player2Deck (computer)
      const player2Deck = shuffledCards.splice(0, 5);

      //extract random card from shuffledCards and check if its not an action card
      let startingCardIndex = Math.floor(Math.random() * (shuffledCards.length - ACTION_CARDS.length));

      while (ACTION_CARDS.includes(shuffledCards[startingCardIndex])) {
        startingCardIndex = Math.floor(Math.random() * (shuffledCards.length - ACTION_CARDS.length));
      }

      //extract the card from that startingCardIndex into the playedCardsPile
      const playedCardsPile = shuffledCards.splice(startingCardIndex, 1);

      //store all remaining cards into drawCardPile
      const drawCardPile = [...shuffledCards];

      console.log('Computer mode game state initialized:', {
        player1Deck: player1Deck.length,
        player2Deck: player2Deck.length,
        playedCard: playedCardsPile[0],
        drawPile: drawCardPile.length
      });

      // Initialize game state directly for computer mode
      dispatch({
        gameOver: false,
        turn: "Player 1",
        player1Deck: player1Deck,
        player2Deck: player2Deck,
        currentColor: playedCardsPile[0].charAt(1),
        currentNumber: playedCardsPile[0].charAt(0),
        playedCardsPile: playedCardsPile,
        drawCardPile: drawCardPile,
        totalPlayers: 2, // Computer mode is always 2 players
        playDirection: 1, // Start with clockwise direction
      });
    } else {
      // For multiplayer mode, Player 1 initializes the game
      if (currentUser === "Player 1") {
        console.log(`Player 1 initializing multiplayer game with ${playerCount} players...`);
        //shuffle PACK_OF_CARDS array
        const shuffledCards = shuffleArray(PACK_OF_CARDS);

        // Initialize game state object
        const gameState = {
          gameOver: false,
          turn: "Player 1",
          currentColor: "",
          currentNumber: "",
          playedCardsPile: [],
          drawCardPile: [],
        };

        // Deal 5 cards to each player
        for (let i = 1; i <= playerCount && i <= 4; i++) {
          gameState[`player${i}Deck`] = shuffledCards.splice(0, 5);
        }

        // Initialize empty decks for unused player slots
        for (let i = playerCount + 1; i <= 4; i++) {
          gameState[`player${i}Deck`] = [];
        }

        //extract random card from shuffledCards and check if its not an action card
        let startingCardIndex = Math.floor(Math.random() * shuffledCards.length);

        while (ACTION_CARDS.includes(shuffledCards[startingCardIndex]) && shuffledCards.length > 0) {
          startingCardIndex = Math.floor(Math.random() * shuffledCards.length);
        }

        //extract the card from that startingCardIndex into the playedCardsPile
        const playedCardsPile = shuffledCards.splice(startingCardIndex, 1);

        //store all remaining cards into drawCardPile
        const drawCardPile = [...shuffledCards];

        gameState.playedCardsPile = playedCardsPile;
        gameState.currentColor = playedCardsPile[0].charAt(1);
        gameState.currentNumber = playedCardsPile[0].charAt(0);
        gameState.drawCardPile = drawCardPile;
        gameState.totalPlayers = playerCount; // Store the initial player count
        gameState.playDirection = 1; // Start with clockwise direction

        console.log('Initialized game state:', {
          playerCount,
          totalPlayers: gameState.totalPlayers,
          decks: Object.keys(gameState).filter(k => k.includes('Deck')).map(k => `${k}: ${gameState[k].length} cards`)
        });

        //send initial state to server
        emitSocketEvent("initGameState", gameState);
      }
    }
  }, [isComputerMode]);

  useEffect(() => {
    socket.on(
      "initGameState",
      (gameState) => {
        // Dispatch all game state properties dynamically
        dispatch(gameState);
        playShufflingSound();
      }
    );

    socket.on(
      "updateGameState",
      (gameState) => {
        const { gameOver, winner, currentNumber } = gameState;
        
        gameOver && playGameOverSound();
        //check for special card and play their sound else play regular sound
        currentNumber && (currentNumber in playSoundMap ? playSoundMap[currentNumber]() : playCardPlayedSound());
        
        // Dispatch all game state updates
        dispatch({
          ...gameState,
          isUnoButtonPressed: false,
          drawButtonPressed: gameState.drawButtonPressed || false
        });
      }
    );
  }, []);

  // Helper function to get player deck by player name
  const getPlayerDeck = (playerName) => {
    switch(playerName) {
      case "Player 1": return player1Deck;
      case "Player 2": return player2Deck;
      case "Player 3": return player3Deck;
      case "Player 4": return player4Deck;
      case "Player 5": return player5Deck;
      case "Player 6": return player6Deck;
      default: return [];
    }
  };

  // Helper function to get next player in turn rotation
  // direction: 1 for clockwise (default), -1 for counter-clockwise
  const getNextPlayer = (currentPlayer, allPlayers, direction = playDirection) => {
    const currentIndex = allPlayers.indexOf(currentPlayer);
    const nextIndex = (currentIndex + direction + allPlayers.length) % allPlayers.length;
    return allPlayers[nextIndex];
  };

  // Helper function to get all active players based on initial player count
  const getActivePlayers = () => {
    const players = [];
    const numPlayers = totalPlayers || playerCount;
    for (let i = 1; i <= numPlayers; i++) {
      players.push(`Player ${i}`);
    }
    return players;
  };

  //remove the played card from player's deck and add it to playedCardsPile (immutably)
  //then update turn, currentColor and currentNumber
  //also checks for the card played and update opponentDeck accordingly
  //also checks for UNO pressed if not add 2 cards to playerDeck as penalty
  //play the relevant sound when particular card is played
  //This is generic helper method and can be used for any player
  const cardPlayedByPlayer = ({
    cardPlayedBy,
    played_card,
    colorOfPlayedCard,
    numberOfPlayedCard,
    isDraw2 = false,
    isDraw4 = false,
    toggleTurn = true,
  }) => {
    //check who is the current player
    const playerDeck = getPlayerDeck(cardPlayedBy);
    const activePlayers = getActivePlayers();
    const nextPlayerName = getNextPlayer(cardPlayedBy, activePlayers);
    const nextPlayerDeck = getPlayerDeck(nextPlayerName);
    
    console.log('Turn rotation:', {
      cardPlayedBy,
      activePlayers,
      nextPlayerName,
      totalPlayers,
      currentPlayerDeckSize: playerDeck.length,
      nextPlayerDeckSize: nextPlayerDeck.length
    });

    //remove the played card from player's deck and add it to playedCardsPile and update their deck(immutably)
    const removeIndex = playerDeck.indexOf(played_card);
    let updatedPlayerDeck = [...playerDeck.slice(0, removeIndex), ...playerDeck.slice(removeIndex + 1)];

    //make a drawcardpile copy for managing draw2,draw4 and UNO penalty
    let copiedDrawCardPileArray = [...drawCardPile];
    let updatedPlayedCardsPile = [...playedCardsPile, played_card];
    let nextPlayerDeckCopy = [...nextPlayerDeck];
    
    // Helper function to draw a card with reshuffle if needed
    const drawCardWithReshuffle = () => {
      // Check if draw pile is empty and needs reshuffling
      if (copiedDrawCardPileArray.length === 0) {
        // Keep the top card (the one just played)
        const topCard = updatedPlayedCardsPile[updatedPlayedCardsPile.length - 1];
        
        // Take all other cards from the discard pile
        const cardsToReshuffle = updatedPlayedCardsPile.slice(0, updatedPlayedCardsPile.length - 1);
        
        // If we have cards to reshuffle
        if (cardsToReshuffle.length > 0) {
          // Shuffle these cards
          copiedDrawCardPileArray = shuffleArray([...cardsToReshuffle]);
          updatedPlayedCardsPile = [topCard];
          
          // Play shuffling sound
          playShufflingSound();
          
          console.log('Reshuffled discard pile into draw pile during penalty. New draw pile size:', copiedDrawCardPileArray.length);
        }
      }
      
      // Draw a card if possible
      if (copiedDrawCardPileArray.length > 0) {
        return copiedDrawCardPileArray.pop();
      }
      
      return null; // No card available
    };
    
    // if it is a draw2 or draw4 move pop cards from drawCardPile
    // and add them to next player's deck (immutably)
    if (isDraw2 || isDraw4) {
      // Draw 2 cards for Draw 2
      const card1 = drawCardWithReshuffle();
      if (card1) nextPlayerDeckCopy.push(card1);
      
      const card2 = drawCardWithReshuffle();
      if (card2) nextPlayerDeckCopy.push(card2);
      
      // Draw 2 more cards for Draw 4
      if (isDraw4) {
        const card3 = drawCardWithReshuffle();
        if (card3) nextPlayerDeckCopy.push(card3);
        
        const card4 = drawCardWithReshuffle();
        if (card4) nextPlayerDeckCopy.push(card4);
      }
    }

    //if it is special card which persists turn like skip, draw4 card don't change the turn
    //else change turn after every play
    let turnCopy = cardPlayedBy;
    if (toggleTurn) {
      turnCopy = nextPlayerName;
    }

    //did player press UNO when 2 cards were remaining in their deck
    //if not then add 2 cards as penalty else continue
    // In computer mode, computer (Player 2) automatically calls UNO, so skip penalty for computer
    const isComputerPlayer = isComputerMode && cardPlayedBy === "Player 2";
    if (playerDeck.length === 2 && !isUnoButtonPressed && !isComputerPlayer) {
      alert("Oops! You forgot to press UNO. You drew 2 cards as penalty.");
      //pull out last two cards from draw card pile and add them to player's deck
      const penaltyCard1 = drawCardWithReshuffle();
      if (penaltyCard1) updatedPlayerDeck.push(penaltyCard1);
      
      const penaltyCard2 = drawCardWithReshuffle();
      if (penaltyCard2) updatedPlayerDeck.push(penaltyCard2);
    } 
    
    // Reset Uno button after checking for penalty
    // This ensures the penalty check sees the correct UNO button state
    dispatch({ type: "SET_UNO_BUTTON_PRESSED", isUnoButtonPressed: false }); 
    
    // Create a more explicit update of player decks to prevent card transfer issues
    const newGameState = {
      gameOver: checkGameOver(playerDeck),
      winner: checkWinner(playerDeck, cardPlayedBy),
      turn: turnCopy,
      playedCardsPile: updatedPlayedCardsPile,
      currentColor: colorOfPlayedCard,
      currentNumber: numberOfPlayedCard,
      drawCardPile: copiedDrawCardPileArray,
      isExtraTurn: !toggleTurn, // Set to true when player gets extra turn from special card
    };

    // Update the deck for the player who played the card
    newGameState[`${cardPlayedBy.toLowerCase().replace(' ', '')}Deck`] = updatedPlayerDeck;
    
    // Update the deck for the next player (if they received cards from Draw 2/4)
    if (isDraw2 || isDraw4) {
      newGameState[`${nextPlayerName.toLowerCase().replace(' ', '')}Deck`] = nextPlayerDeckCopy;
    }
    
    // Preserve all other player decks
    activePlayers.forEach(player => {
      const deckKey = `${player.toLowerCase().replace(' ', '')}Deck`;
      if (!newGameState[deckKey]) {
        newGameState[deckKey] = getPlayerDeck(player);
      }
    });
      
    console.log('Deck changes:', {
      cardPlayedBy,
      nextPlayer: nextPlayerName,
      activePlayers,
      updatedPlayerDeckLength: updatedPlayerDeck.length,
      nextPlayerDeckLength: nextPlayerDeckCopy.length
    });

    if (isComputerMode) {
      // Handle locally for computer mode
      dispatch(newGameState);
      
      // Play appropriate sound
      numberOfPlayedCard in playSoundMap ? playSoundMap[numberOfPlayedCard]() : playCardPlayedSound();
      
      // Check for game over
      if (newGameState.gameOver) {
        playGameOverSound();
      }
    } else {
      // Send new state to server for multiplayer mode
      emitSocketEvent("updateGameState", newGameState);
    }
  };

  //driver functions
  const onCardPlayedHandler = (played_card) => {
    // This function handles playing a card, either from the player's hand or a card that was just drawn
    // With the new rule, if a player draws a card that matches the current color, number, or is a wild card,
    // they can play it immediately and this function will be called
    
    //extract player who played the card
    const cardPlayedBy = turn;

    // Update the last player who played a card
    dispatch({
      lastCardPlayedBy: cardPlayedBy
    });

    //extract the card played
    const cardPlayed = played_card;
    switch (played_card) {
      //if card played was a skip card
      case "skipR":
      case "skipG":
      case "skipB":
      case "skipY": {
        //extract color of played skip card
        const colorOfPlayedCard = played_card.charAt(4);
        const numberOfPlayedCard = 100;
        // Normalize the values for comparison
        const normalizedCurrentNumber = String(currentNumber);
        const normalizedPlayedNumber = String(numberOfPlayedCard);
        
        // Check for color match or number match
        const isColorMatch = currentColor === colorOfPlayedCard;
        const isNumberMatch = normalizedCurrentNumber === normalizedPlayedNumber;
        
        if (isColorMatch || isNumberMatch) {
          console.log('Valid skip card move:', { isColorMatch, isNumberMatch });
          
          // Skip card: skip the next player and move to the player after them
          // Direction does NOT change
          const activePlayers = getActivePlayers();
          const nextPlayer = getNextPlayer(cardPlayedBy, activePlayers, playDirection);
          const playerAfterSkipped = getNextPlayer(nextPlayer, activePlayers, playDirection);
          
          console.log('Skip card played:', {
            cardPlayedBy,
            skippedPlayer: nextPlayer,
            nextTurn: playerAfterSkipped,
            direction: playDirection
          });
          
          // Manually set the turn to skip a player
          cardPlayedByPlayer({
            cardPlayedBy,
            played_card,
            colorOfPlayedCard,
            numberOfPlayedCard,
            toggleTurn: false, // We'll manually set the turn
          });
          
          // After the card is played, update the turn to the player after the skipped one
          setTimeout(() => {
            if (isComputerMode) {
              dispatch({ turn: playerAfterSkipped });
            } else {
              emitSocketEvent("updateGameState", { turn: playerAfterSkipped });
            }
          }, 0);
        }
        //if no color or number match, invalid move - do not update state
        else {
          console.log('Invalid skip card move:', { isColorMatch, isNumberMatch });
          alert("Invalid Move! Skip cards must match either the color or number of the current card.");
        }
        break;
      }
      case "_R":
      case "_G":
      case "_B":
      case "_Y": {
        //extract color of played reverse card
        const colorOfPlayedCard = played_card.charAt(1);
        const numberOfPlayedCard = 100;
        // Normalize the values for comparison
        const normalizedCurrentNumber = String(currentNumber);
        const normalizedPlayedNumber = String(numberOfPlayedCard);
        
        // Check for color match or number match
        const isColorMatch = currentColor === colorOfPlayedCard;
        const isNumberMatch = normalizedCurrentNumber === normalizedPlayedNumber;
        
        if (isColorMatch || isNumberMatch) {
          console.log('Valid reverse card move:', { isColorMatch, isNumberMatch });
          
          const activePlayers = getActivePlayers();
          
          // In a 2-player game, Reverse acts exactly like Skip
          // because reversing direction brings the turn back to the same player
          if (activePlayers.length === 2) {
            console.log('Reverse in 2-player game acts like Skip - turn stays with current player');
            
            // Play the card but keep the turn with the current player
            cardPlayedByPlayer({
              cardPlayedBy,
              played_card,
              colorOfPlayedCard,
              numberOfPlayedCard,
              toggleTurn: false, // Turn stays with current player
            });
            
            // Trigger another computer move if it's the computer's turn
            if (isComputerMode && cardPlayedBy === "Player 2") {
              setComputerMoveCounter(prev => prev + 1);
            }
          } else {
            // In 3+ player games, Reverse flips the direction
            const newDirection = playDirection * -1; // Flip direction: 1 -> -1 or -1 -> 1
            
            console.log('Reverse card flips direction:', {
              oldDirection: playDirection === 1 ? 'clockwise' : 'counter-clockwise',
              newDirection: newDirection === 1 ? 'clockwise' : 'counter-clockwise'
            });
            
            // Get the next player in the NEW direction
            const nextPlayer = getNextPlayer(cardPlayedBy, activePlayers, newDirection);
            
            console.log('Reverse card played:', {
              cardPlayedBy,
              newDirection: newDirection === 1 ? 'clockwise' : 'counter-clockwise',
              nextTurn: nextPlayer
            });
            
            // Play the card and update direction
            cardPlayedByPlayer({
              cardPlayedBy,
              played_card,
              colorOfPlayedCard,
              numberOfPlayedCard,
              toggleTurn: false, // We'll manually set the turn
            });
            
            // Update the direction and turn
            setTimeout(() => {
              if (isComputerMode) {
                dispatch({ 
                  playDirection: newDirection,
                  turn: nextPlayer 
                });
              } else {
                emitSocketEvent("updateGameState", { 
                  playDirection: newDirection,
                  turn: nextPlayer 
                });
              }
            }, 0);
          }
        }
        //if no color or number match, invalid move - do not update state
        else {
          console.log('Invalid reverse card move:', { isColorMatch, isNumberMatch });
          alert("Invalid Move! Reverse cards must match either the color or number of the current card.");
        }
        break;
      }
      //if card played was a draw 2 card
      case "D2R":
      case "D2G":
      case "D2B":
      case "D2Y": {
        //extract color of played skip card
        const colorOfPlayedCard = played_card.charAt(2);
        const numberOfPlayedCard = 200;
        // Normalize the values for comparison
        const normalizedCurrentNumber = String(currentNumber);
        const normalizedPlayedNumber = String(numberOfPlayedCard);
        
        // Check for color match or number match
        const isColorMatch = currentColor === colorOfPlayedCard;
        const isNumberMatch = normalizedCurrentNumber === normalizedPlayedNumber;
        
        if (isColorMatch || isNumberMatch) {
          console.log('Valid draw 2 card move:', { isColorMatch, isNumberMatch });
          cardPlayedByPlayer({
            cardPlayedBy,
            played_card,
            colorOfPlayedCard,
            numberOfPlayedCard,
            isDraw2: true,
            toggleTurn: false,
          });
          
          // Trigger another computer move after playing +2 (turn stays with computer)
          if (isComputerMode && cardPlayedBy === "Player 2") {
            setComputerMoveCounter(prev => prev + 1);
          }
        }
        //if no color or number match, invalid move - do not update state
        else {
          console.log('Invalid draw 2 card move:', { isColorMatch, isNumberMatch });
          alert("Invalid Move! Draw 2 cards must match either the color or number of the current card.");
        }
        break;
      }
      //if card played was a wild card
      case "W":
      case "D4W":
        {
          // For computer player, randomly select a color
          if (isComputerMode && cardPlayedBy === "Player 2") {
            // Available colors: R, G, B, Y
            const colors = ['R', 'G', 'B', 'Y'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            
            const cardDetails = {
              cardPlayedBy,
              played_card,
              colorOfPlayedCard: randomColor,
              numberOfPlayedCard: played_card === 'W' ? 500 : 400,
              isDraw4: played_card === 'D4W',
              toggleTurn: played_card !== 'D4W',
            };
            cardPlayedByPlayer(cardDetails);
            
            // Trigger another computer move after playing +4 (turn stays with computer)
            if (played_card === 'D4W') {
              setComputerMoveCounter(prev => prev + 1);
            }
          } else {
            //ask for new color via dialog for human players
            setIsDialogOpen(true);
            setDialogCallback(() => (colorOfPlayedCard) => {
              if (!colorOfPlayedCard) return;
              const cardDetails = {
                cardPlayedBy,
                played_card,
                colorOfPlayedCard,
                numberOfPlayedCard: played_card === 'W' ? 500 : 400,
                isDraw4: played_card === 'D4W',
                toggleTurn: played_card !== 'D4W',
              };
              cardPlayedByPlayer(cardDetails);
            });
          }
          break;
        }
      //if card played was a draw four wild card
      // case "D4W": {
      //   //ask for new color
      //   const colorOfPlayedCard = prompt("Enter first letter of new color (r/g/b/y)")?.toUpperCase();
      //   if (!colorOfPlayedCard) return;
      //   cardPlayedByPlayer({
      //     cardPlayedBy,
      //     played_card,
      //     colorOfPlayedCard,
      //     numberOfPlayedCard: 400,
      //     isDraw4: true,
      //     toggleTurn: false,
      //   });
      //   break;
      // }
      default: {
        //extract number and color of played card
        const numberOfPlayedCard = played_card.charAt(0);
        const colorOfPlayedCard = played_card.charAt(1);

        // Debug log to check the values being compared
        console.log('Card matching debug:', {
          played_card,
          numberOfPlayedCard,
          colorOfPlayedCard,
          currentNumber,
          currentColor,
          numberMatch: currentNumber === numberOfPlayedCard,
          colorMatch: currentColor === colorOfPlayedCard,
          numberType: typeof numberOfPlayedCard,
          currentNumberType: typeof currentNumber
        });

        // Normalize the values for comparison (ensure they're both strings)
        const normalizedCurrentNumber = String(currentNumber);
        const normalizedPlayedNumber = String(numberOfPlayedCard);
        
        // Check for color match or number match
        // A card can always be played if it has the same number and color as the current card
        const isSameCard = normalizedCurrentNumber === normalizedPlayedNumber && currentColor === colorOfPlayedCard;
        const isColorMatch = currentColor === colorOfPlayedCard;
        const isNumberMatch = normalizedCurrentNumber === normalizedPlayedNumber;
        
        if (isColorMatch || isNumberMatch || isSameCard) {
          console.log('Valid move:', { isColorMatch, isNumberMatch, isSameCard });
          cardPlayedByPlayer({ cardPlayedBy, played_card, colorOfPlayedCard, numberOfPlayedCard });
        }
        // If no color or number match, invalid move - do not update state
        else {
          console.log('Invalid move:', { isColorMatch, isNumberMatch, isSameCard });
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

  // Function to reshuffle the discard pile when draw pile is empty
  const reshuffleDiscardPile = () => {
    // Make sure we have played cards to reshuffle (at least 2, since we keep the top card)
    if (playedCardsPile.length < 2) {
      return null; // Not enough cards to reshuffle
    }
    
    // Keep the top card of the discard pile
    const topCard = playedCardsPile[playedCardsPile.length - 1];
    
    // Take all other cards from the discard pile
    const cardsToReshuffle = playedCardsPile.slice(0, playedCardsPile.length - 1);
    
    // Shuffle these cards
    const newDrawPile = shuffleArray([...cardsToReshuffle]);
    
    // Play shuffling sound
    playShufflingSound();
    
    // Show toast notification
    toast({
      title: "Reshuffling Cards",
      description: "Draw pile has been replenished with shuffled cards.",
      variant: "default",
      duration: 3000,
    });
    
    // Return an object with the new draw pile and the updated discard pile (just the top card)
    return {
      newDrawPile,
      newPlayedCardsPile: [topCard]
    };
  };

  const onCardDrawnHandler = () => {
    //extract player who drew the card
    let drawButtonPressed = false; // Always set to false to disable draw button after drawing
    //remove 1 new card from drawCardPile and send it to playerDrawn method
    let copiedDrawCardPileArray = [...drawCardPile];
    let updatedPlayedCardsPile = [...playedCardsPile];
    
    // Check if there are cards left in the draw pile
    if (copiedDrawCardPileArray.length === 0) {
      // Try to reshuffle the discard pile
      const reshuffleResult = reshuffleDiscardPile();
      
      if (reshuffleResult) {
        // Update the draw and discard piles
        copiedDrawCardPileArray = reshuffleResult.newDrawPile;
        updatedPlayedCardsPile = reshuffleResult.newPlayedCardsPile;
        
        console.log('Reshuffled discard pile into draw pile. New draw pile size:', copiedDrawCardPileArray.length);
      } else {
        // Handle case where there aren't enough cards to reshuffle
        console.warn('Draw card pile is empty and not enough cards to reshuffle!');
        toast({
          title: "No Cards Available",
          description: "There are no more cards to draw.",
          variant: "warning",
          duration: 3000,
        });
        
        // Skip turn without drawing
        const activePlayers = getActivePlayers();
        const turnCopy = getNextPlayer(turn, activePlayers);
        
        if (isComputerMode) {
          dispatch({
            turn: turnCopy,
            drawButtonPressed: false,
            isExtraTurn: false, // Reset when no cards available
          });
        } else {
          emitSocketEvent("updateGameState", {
            turn: turnCopy,
            drawButtonPressed: false,
            isExtraTurn: false, // Reset when no cards available
          });
        }
        return;
      }
    }
    
    //pull out last element from it
    const drawCard = copiedDrawCardPileArray.pop();
    
    // Safety check for undefined card
    if (!drawCard) {
      console.error('Undefined card drawn from pile');
      return;
    }
    
    //add the drawn card to player's deck
    let numberOfDrawnCard = drawCard.charAt(0);
    let colorOfDrawnCard = drawCard.charAt(1);

    //check if the card drawn is a skip card
    if (drawCard === "skipR" || drawCard === "skipG" || drawCard === "skipB" || drawCard === "skipY") {
      colorOfDrawnCard = drawCard.charAt(4);
      numberOfDrawnCard = 100;
    }
    //if it is draw 2 card
    if (drawCard === "D2R" || drawCard === "D2G" || drawCard === "D2B" || drawCard === "D2Y") {
      colorOfDrawnCard = drawCard.charAt(2);
      numberOfDrawnCard = 200;
    }

    // NEW RULE: Check if the drawn card is playable
    // A card is playable if it matches the current color, number, or is a wild card
    const isWildCard = drawCard === "W" || drawCard === "D4W";
    
    // Normalize the values for comparison (ensure they're both strings)
    const normalizedCurrentNumber = String(currentNumber);
    const normalizedDrawnNumber = String(numberOfDrawnCard);
    
    // Check if the drawn card matches the current card's color or number
    const isColorMatch = currentColor === colorOfDrawnCard;
    const isNumberMatch = normalizedCurrentNumber === normalizedDrawnNumber;
    const isPlayable = isWildCard || isColorMatch || isNumberMatch;
    
    console.log('Card drawn:', drawCard, 'Playable:', isPlayable, { isWildCard, isColorMatch, isNumberMatch });
    // Only change turn if the drawn card is NOT playable
    const activePlayers = getActivePlayers();
    const turnCopy = isPlayable ? turn : getNextPlayer(turn, activePlayers);
    
    // Show toast notification if the card is playable
    // if (isPlayable) {
    //   toast({
    //     title: "Playable Card",
    //     description: "You drew a playable card! You can play it now.",
    //     variant: "default",
    //     duration: 3000,
    //   });
    // }

    // Build the update object with the drawn card added to the current player's deck
    const currentPlayerDeck = getPlayerDeck(turn);
    const updatedDeck = [...currentPlayerDeck, drawCard];
    const deckKey = `${turn.toLowerCase().replace(' ', '')}Deck`;
    
    const updateState = {
      turn: turnCopy,
      [deckKey]: updatedDeck,
      drawCardPile: copiedDrawCardPileArray,
      playedCardsPile: updatedPlayedCardsPile, // Include updated played cards pile
      drawButtonPressed,
      isExtraTurn: false, // Reset extra turn when drawing a card
    };

    if (isComputerMode) {
      // Handle locally for computer mode
      dispatch(updateState);
      
      // For computer mode, if computer draws a playable card, trigger another move
      // Use computerMoveCounter to ensure fresh state instead of setTimeout with stale closure
      if (isPlayable && turn === "Player 2") {
        console.log('Computer drew playable card:', drawCard, 'Will play on next turn cycle');
        setTimeout(() => {
          setComputerMoveCounter(prev => prev + 1);
        }, 1000);
      }
    } else {
      //send new state to server for multiplayer mode
      emitSocketEvent("updateGameState", updateState);
    }
  };

  const onSkipButtonHandler = () => {
    //extract player who skipped
    const cardPlayedBy = turn;
    const activePlayers = getActivePlayers();
    const newState = {
      turn: getNextPlayer(cardPlayedBy, activePlayers),
      drawButtonPressed: false,
      isExtraTurn: false, // Reset extra turn when skipping
    };

    if (isComputerMode) {
      // Handle locally for computer mode
      dispatch(newState);
    } else {
      // Send new state to server for multiplayer mode
      emitSocketEvent("updateGameState", newState);
    }
  };

  const handleWinnerReward = async (winnerName) => {
    try {
      if (rewardGiven) return; // Prevent multiple rewards

      // In the UNO game, the winner is the player who played the last card
      // The lastCardPlayedBy state tracks this
      const winnerPlayer = winnerName;

      // Get the winner's wallet address using Wagmi
      if (!address || !isConnected) {
        console.log('Wallet not connected. Please connect your wallet.');
        
        toast({
          title: "Wallet Required",
          description: "A connected wallet is required to receive your reward.",
          variant: "destructive",
          duration: 5000,
        });
        
        return;
      }
      
      const currentUserAddress = address;
      console.log('Connected wallet address:', currentUserAddress);


      // Only create a claimable balance if the current user is the winner
      const isCurrentUserWinner =
        (winnerPlayer === "Player 1" && currentUser === "Player 1") ||
        (winnerPlayer === "Player 2" && currentUser === "Player 2");

      console.log(currentUser, winnerPlayer, isCurrentUserWinner)

      if (!isCurrentUserWinner) {
        console.log('Current user is not the winner');
        return;
      }

      // const response = await fetch(`${process.env.NEXT_PUBLIC_WEBSOCKET_URL}/api/create-claimable-balance`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     winnerAddress: currentUserAddress,
      //     gameId: room
      //   }),
      // });

      // const data = await response.json();
      // console.log('API response:', data);

      // Since we're not actually calling the API currently, just mark the reward as given
      if (true) {
        setRewardGiven(true);

        // If we were calling the API, we would use the balanceId from the response
        // const supabaseResponse = await claimableBalancesApi.addClaimableBalance(currentUserAddress, 'dummy-balance-id');
        // console.log('Supabase response:', supabaseResponse);

        try {
          // Check balance before proceeding with transaction
          const hasSufficientBalance = await checkBalance();
          if (!hasSufficientBalance) {
            setShowLowBalanceDrawer(true);
            return;
          }
          
          const gameResultData = {
            winnerAddress: currentUserAddress,
            winnerPlayer: winnerPlayer,
            // loserAddresses: [opponentAddress], 
            loserPlayers: ["Player 1", "Player 2"].filter(player => player !== winnerPlayer),
            gameId: room,
            timestamp: Date.now()
          };
          
          const gameResultString = JSON.stringify(gameResultData);
          const gameHash = ethers.keccak256(ethers.toUtf8Bytes(gameResultString));
          
          console.log('Calling endGame with gameId:', room, 'and gameHash:', gameHash);

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
                duration: 5000,
              });
            },
            onError: (error) => {
              console.error("Transaction failed:", error);
              toast({
                title: "Error",
                description: "Failed to end game on blockchain. Please try again.",
                variant: "destructive",
                duration: 5000,
              });
            }
          });
          

        } catch (error) {
          console.error('Failed to end game on blockchain:', error);
          
          toast({
            title: "Blockchain Update Failed",
            description: "There was an issue recording the game on the blockchain. The reward was still created.",
            variant: "warning",
            duration: 5000,
          });
        }

        toast({
          title: "Congratulations!",
          description: "You've won the game!",
          variant: "success",
          duration: 5000,
        });
      } else {
        console.error('Failed to create claimable balance');

        toast({
          title: "Reward Failed",
          description: "There was an issue creating your reward. Please try again later.",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error creating claimable balance:', error);

      // toast({
      //   title: "Error",
      //   description: "Something went wrong while creating your reward.",
      //   variant: "destructive",
      //   duration: 5000,
      // });
    }
  };

  useEffect(() => {
    if (gameOver && winner && !rewardGiven) {
      handleWinnerReward(winner);
    }
  }, [gameOver, winner, rewardGiven]);

  const cleanedTurn = turn == currentUser ? "current" : "opponent"

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', marginTop: "-27px" }}>
      <GameBackground turn={turn} currentColor={currentColor} currentUser={currentUser} totalPlayers={totalPlayers} />
      {/* <MemoizedHeader roomCode={room} /> */}
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
              // Only allow setting Uno to true if it's not already pressed
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
