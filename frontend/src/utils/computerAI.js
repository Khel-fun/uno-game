import { CARD_COLORS } from './gameConstants';

/**
 * Computer AI logic for UNO game
 */

/**
 * Get all valid moves for the computer player
 */
export const getValidMoves = (computerDeck, currentColor, currentNumber) => {
  return computerDeck.filter(card => {
    // Wild cards can always be played
    if (card.includes("W") || card.includes("D4W")) return true;
    
    // Match color or number
    const cardColor = card.charAt(1);
    const cardNumber = card.charAt(0);
    
    return cardColor === currentColor || cardNumber === currentNumber;
  });
};

/**
 * Determine the best move for the computer
 * @returns {string} - Card to play or "draw" if no valid moves
 */
export const computerMakeMove = (computerDeck, currentColor, currentNumber) => {
  const validMoves = getValidMoves(computerDeck, currentColor, currentNumber);
  
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
  }
  
  // Draw a card if no valid moves
  return "draw";
};

/**
 * Select a random color for wild cards
 */
export const selectRandomColor = () => {
  return CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
};

/**
 * Check if computer should declare UNO
 */
export const shouldDeclareUno = (computerDeckSize) => {
  return computerDeckSize === 2;
};
