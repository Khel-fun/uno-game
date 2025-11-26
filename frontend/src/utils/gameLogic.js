/**
 * Game logic utilities for UNO game
 */

/**
 * Check if the game is over (player has 1 card left)
 */
export const checkGameOver = (playerDeck) => {
  return playerDeck.length === 1;
};

/**
 * Check if a player is the winner
 */
export const checkWinner = (playerDeck, player) => {
  return playerDeck.length === 1 ? player : "";
};

/**
 * Get player deck by player name
 */
export const getPlayerDeck = (playerName, gameState) => {
  const deckMap = {
    "Player 1": gameState.player1Deck,
    "Player 2": gameState.player2Deck,
    "Player 3": gameState.player3Deck,
    "Player 4": gameState.player4Deck,
    "Player 5": gameState.player5Deck,
    "Player 6": gameState.player6Deck,
  };
  return deckMap[playerName] || [];
};

/**
 * Get all active players based on player count
 */
export const getActivePlayers = (totalPlayers) => {
  const players = [];
  for (let i = 1; i <= totalPlayers; i++) {
    players.push(`Player ${i}`);
  }
  return players;
};

/**
 * Get next player in turn rotation
 * @param {string} currentPlayer - Current player name
 * @param {string[]} allPlayers - Array of all active players
 * @param {number} direction - 1 for clockwise, -1 for counter-clockwise
 */
export const getNextPlayer = (currentPlayer, allPlayers, direction = 1) => {
  const currentIndex = allPlayers.indexOf(currentPlayer);
  const nextIndex = (currentIndex + direction + allPlayers.length) % allPlayers.length;
  return allPlayers[nextIndex];
};

/**
 * Extract card details (color and number)
 */
export const extractCardDetails = (card) => {
  // Handle special cards
  if (card.startsWith("skip")) {
    return {
      color: card.charAt(4),
      number: 100,
    };
  }
  
  if (card.startsWith("D2")) {
    return {
      color: card.charAt(2),
      number: 200,
    };
  }
  
  if (card.startsWith("_")) { // Reverse card
    return {
      color: card.charAt(1),
      number: 100,
    };
  }
  
  if (card === "W") {
    return {
      color: null,
      number: 500,
    };
  }
  
  if (card === "D4W") {
    return {
      color: null,
      number: 400,
    };
  }
  
  // Regular numbered cards
  return {
    color: card.charAt(1),
    number: card.charAt(0),
  };
};

/**
 * Check if a card can be played
 */
export const isCardPlayable = (card, currentColor, currentNumber) => {
  // Wild cards can always be played
  if (card === "W" || card === "D4W") {
    return true;
  }
  
  const { color, number } = extractCardDetails(card);
  const normalizedCurrentNumber = String(currentNumber);
  const normalizedCardNumber = String(number);
  
  return color === currentColor || normalizedCardNumber === normalizedCurrentNumber;
};

/**
 * Get the deck key for a player
 */
export const getPlayerDeckKey = (playerName) => {
  return `${playerName.toLowerCase().replace(' ', '')}Deck`;
};

/**
 * Normalize card number for comparison
 */
export const normalizeCardNumber = (number) => {
  return String(number);
};

/**
 * Check if two cards match (color or number)
 */
export const cardsMatch = (card1Details, currentColor, currentNumber) => {
  const normalizedCurrentNumber = normalizeCardNumber(currentNumber);
  const normalizedCardNumber = normalizeCardNumber(card1Details.number);
  
  const isColorMatch = card1Details.color === currentColor;
  const isNumberMatch = normalizedCardNumber === normalizedCurrentNumber;
  
  return { isColorMatch, isNumberMatch, isValid: isColorMatch || isNumberMatch };
};
