import { 
  getActivePlayers, 
  getNextPlayer, 
  extractCardDetails, 
  cardsMatch,
  getPlayerDeck,
  checkGameOver,
  checkWinner,
  getPlayerDeckKey,
} from './gameLogic';
import { drawMultipleCards, removeCardFromDeck } from './cardHandlers';
import { ACTION_CARD_CODES } from './gameConstants';

/**
 * Card play handler utilities
 */

/**
 * Validate if a card can be played based on current game state
 */
export const validateCardPlay = (card, currentColor, currentNumber) => {
  const cardDetails = extractCardDetails(card);
  const matchResult = cardsMatch(cardDetails, currentColor, currentNumber);
  
  return {
    isValid: matchResult.isValid,
    isColorMatch: matchResult.isColorMatch,
    isNumberMatch: matchResult.isNumberMatch,
    cardDetails,
  };
};

/**
 * Process a card play and return updated game state
 */
export const processCardPlay = ({
  cardPlayedBy,
  played_card,
  colorOfPlayedCard,
  numberOfPlayedCard,
  gameState,
  isDraw2 = false,
  isDraw4 = false,
  toggleTurn = true,
  isComputerMode = false,
  playShufflingSound = () => {},
}) => {
  const { 
    drawCardPile, 
    playedCardsPile, 
    isUnoButtonPressed, 
    totalPlayers,
    playDirection,
  } = gameState;
  
  const playerDeck = getPlayerDeck(cardPlayedBy, gameState);
  const activePlayers = getActivePlayers(totalPlayers);
  const nextPlayerName = getNextPlayer(cardPlayedBy, activePlayers, playDirection);
  const nextPlayerDeck = getPlayerDeck(nextPlayerName, gameState);
  
  // Remove the played card from player's deck
  let updatedPlayerDeck = removeCardFromDeck(playerDeck, played_card);
  
  // Update played cards pile
  let updatedPlayedCardsPile = [...playedCardsPile, played_card];
  
  // Handle Draw 2 or Draw 4 cards
  let nextPlayerDeckCopy = [...nextPlayerDeck];
  let copiedDrawCardPileArray = [...drawCardPile];
  
  if (isDraw2 || isDraw4) {
    const cardsToDraw = isDraw4 ? 4 : 2;
    const drawResult = drawMultipleCards(cardsToDraw, copiedDrawCardPileArray, updatedPlayedCardsPile);
    
    nextPlayerDeckCopy = [...nextPlayerDeck, ...drawResult.cards];
    copiedDrawCardPileArray = drawResult.newDrawPile;
    updatedPlayedCardsPile = drawResult.newPlayedCardsPile;
    
    if (drawResult.reshuffled) {
      playShufflingSound();
    }
  }
  
  // Determine next turn
  let turnCopy = toggleTurn ? nextPlayerName : cardPlayedBy;
  
  // Check for UNO penalty (only for human players)
  const isComputerPlayer = isComputerMode && cardPlayedBy === "Player 2";
  if (playerDeck.length === 2 && !isUnoButtonPressed && !isComputerPlayer) {
    // Add 2 penalty cards
    const penaltyResult = drawMultipleCards(2, copiedDrawCardPileArray, updatedPlayedCardsPile);
    updatedPlayerDeck = [...updatedPlayerDeck, ...penaltyResult.cards];
    copiedDrawCardPileArray = penaltyResult.newDrawPile;
    updatedPlayedCardsPile = penaltyResult.newPlayedCardsPile;
    
    if (penaltyResult.reshuffled) {
      playShufflingSound();
    }
  }
  
  // Build new game state
  const newGameState = {
    gameOver: checkGameOver(playerDeck),
    winner: checkWinner(playerDeck, cardPlayedBy),
    turn: turnCopy,
    playedCardsPile: updatedPlayedCardsPile,
    currentColor: colorOfPlayedCard,
    currentNumber: numberOfPlayedCard,
    drawCardPile: copiedDrawCardPileArray,
    isExtraTurn: !toggleTurn,
    isUnoButtonPressed: false,
  };
  
  // Update player decks
  newGameState[getPlayerDeckKey(cardPlayedBy)] = updatedPlayerDeck;
  
  if (isDraw2 || isDraw4) {
    newGameState[getPlayerDeckKey(nextPlayerName)] = nextPlayerDeckCopy;
  }
  
  // Preserve all other player decks
  activePlayers.forEach(player => {
    const deckKey = getPlayerDeckKey(player);
    if (!newGameState[deckKey]) {
      newGameState[deckKey] = getPlayerDeck(player, gameState);
    }
  });
  
  return newGameState;
};

/**
 * Handle skip card logic
 */
export const handleSkipCard = (cardPlayedBy, activePlayers, playDirection) => {
  const nextPlayer = getNextPlayer(cardPlayedBy, activePlayers, playDirection);
  const playerAfterSkipped = getNextPlayer(nextPlayer, activePlayers, playDirection);
  
  return {
    skippedPlayer: nextPlayer,
    nextTurn: playerAfterSkipped,
  };
};

/**
 * Handle reverse card logic
 */
export const handleReverseCard = (cardPlayedBy, activePlayers, playDirection) => {
  // In a 2-player game, Reverse acts exactly like Skip
  if (activePlayers.length === 2) {
    return {
      newDirection: playDirection,
      nextTurn: cardPlayedBy, // Turn stays with current player
      actsLikeSkip: true,
    };
  }
  
  // In 3+ player games, Reverse flips the direction
  const newDirection = playDirection * -1;
  const nextPlayer = getNextPlayer(cardPlayedBy, activePlayers, newDirection);
  
  return {
    newDirection,
    nextTurn: nextPlayer,
    actsLikeSkip: false,
  };
};

/**
 * Get card type information
 */
export const getCardType = (card) => {
  if (card.startsWith("skip")) return { type: 'skip', code: ACTION_CARD_CODES.SKIP };
  if (card.startsWith("_")) return { type: 'reverse', code: ACTION_CARD_CODES.SKIP };
  if (card.startsWith("D2")) return { type: 'draw2', code: ACTION_CARD_CODES.DRAW_2 };
  if (card === "W") return { type: 'wild', code: ACTION_CARD_CODES.WILD };
  if (card === "D4W") return { type: 'draw4wild', code: ACTION_CARD_CODES.DRAW_4_WILD };
  return { type: 'regular', code: null };
};
