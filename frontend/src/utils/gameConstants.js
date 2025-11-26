// Game action card number codes
export const ACTION_CARD_CODES = {
  SKIP: 100,
  DRAW_2: 200,
  WILD: 500,
  DRAW_4_WILD: 400,
};

// Game configuration
export const GAME_CONFIG = {
  INITIAL_HAND_SIZE: 5,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  COMPUTER_TURN_DELAY: 3000, // milliseconds
  COMPUTER_DRAW_DELAY: 1000, // milliseconds
  MIN_BALANCE_REQUIRED: 0.00001, // ETH
};

// Play direction
export const PLAY_DIRECTION = {
  CLOCKWISE: 1,
  COUNTER_CLOCKWISE: -1,
};

// Initial game state
export const INITIAL_GAME_STATE = {
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
  isExtraTurn: false,
  totalPlayers: 2,
  playDirection: PLAY_DIRECTION.CLOCKWISE,
};

// Card colors
export const CARD_COLORS = ['R', 'G', 'B', 'Y'];

// Toast durations
export const TOAST_DURATION = {
  SHORT: 3000,
  LONG: 5000,
};
