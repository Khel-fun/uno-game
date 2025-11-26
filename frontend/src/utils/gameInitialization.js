import { PACK_OF_CARDS, ACTION_CARDS } from './packOfCards';
import shuffleArray from './shuffleArray';
import { GAME_CONFIG, PLAY_DIRECTION } from './gameConstants';

/**
 * Game initialization utilities
 */

/**
 * Initialize game state for computer mode
 */
export const initializeComputerGame = () => {
  const shuffledCards = shuffleArray(PACK_OF_CARDS);
  
  // Deal cards to players
  const player1Deck = shuffledCards.splice(0, GAME_CONFIG.INITIAL_HAND_SIZE);
  const player2Deck = shuffledCards.splice(0, GAME_CONFIG.INITIAL_HAND_SIZE);
  
  // Get a non-action starting card
  let startingCardIndex = Math.floor(Math.random() * (shuffledCards.length - ACTION_CARDS.length));
  
  while (ACTION_CARDS.includes(shuffledCards[startingCardIndex])) {
    startingCardIndex = Math.floor(Math.random() * (shuffledCards.length - ACTION_CARDS.length));
  }
  
  // Extract the starting card
  const playedCardsPile = shuffledCards.splice(startingCardIndex, 1);
  
  // Remaining cards go to draw pile
  const drawCardPile = [...shuffledCards];
  
  return {
    gameOver: false,
    turn: "Player 1",
    player1Deck,
    player2Deck,
    currentColor: playedCardsPile[0].charAt(1),
    currentNumber: playedCardsPile[0].charAt(0),
    playedCardsPile,
    drawCardPile,
    totalPlayers: 2,
    playDirection: PLAY_DIRECTION.CLOCKWISE,
  };
};

/**
 * Initialize game state for multiplayer mode
 */
export const initializeMultiplayerGame = (playerCount) => {
  const shuffledCards = shuffleArray(PACK_OF_CARDS);
  
  const gameState = {
    gameOver: false,
    turn: "Player 1",
    currentColor: "",
    currentNumber: "",
    playedCardsPile: [],
    drawCardPile: [],
  };
  
  // Deal cards to each player
  for (let i = 1; i <= playerCount && i <= GAME_CONFIG.MAX_PLAYERS; i++) {
    gameState[`player${i}Deck`] = shuffledCards.splice(0, GAME_CONFIG.INITIAL_HAND_SIZE);
  }
  
  // Initialize empty decks for unused player slots
  for (let i = playerCount + 1; i <= GAME_CONFIG.MAX_PLAYERS; i++) {
    gameState[`player${i}Deck`] = [];
  }
  
  // Get a non-action starting card
  let startingCardIndex = Math.floor(Math.random() * shuffledCards.length);
  
  while (ACTION_CARDS.includes(shuffledCards[startingCardIndex]) && shuffledCards.length > 0) {
    startingCardIndex = Math.floor(Math.random() * shuffledCards.length);
  }
  
  // Extract the starting card
  const playedCardsPile = shuffledCards.splice(startingCardIndex, 1);
  
  // Remaining cards go to draw pile
  const drawCardPile = [...shuffledCards];
  
  gameState.playedCardsPile = playedCardsPile;
  gameState.currentColor = playedCardsPile[0].charAt(1);
  gameState.currentNumber = playedCardsPile[0].charAt(0);
  gameState.drawCardPile = drawCardPile;
  gameState.totalPlayers = playerCount;
  gameState.playDirection = PLAY_DIRECTION.CLOCKWISE;
  
  return gameState;
};
