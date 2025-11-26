// Placeholder types to avoid external dependencies during Convex setup.
export type Player = {
  id: string;
  name: string;
  address: string;
  sessionId?: string;
};

export type Game = {
  id: number;
  players: Player[];
  status: 'NotStarted' | 'Started' | 'Ended';
  startTime: number;
  endTime?: number;
  gameHash?: string;
  moves: string[];
};

export type GameState = {
  gameId: number;
  currentPlayerIndex: number;
  turnCount: string;
  directionClockwise: boolean;
  currentColor: string;
  currentValue: string;
  lastPlayedCardHash?: string;
  playerHands: Record<string, string[]>;
  deckHash: string;
  discardPileHash: string;
};

export type Session = {
  id: string;
  playerId: string;
  gameId: number;
  createdAt: number;
  updatedAt: number;
};