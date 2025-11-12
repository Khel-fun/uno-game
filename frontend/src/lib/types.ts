import { ethers } from "ethers";

export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type CardValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild_draw4';

export interface Card {
  color: CardColor;
  value: CardValue;
}

export interface OffChainGameState {
    id: bigint;
    players: string[];
    isActive: boolean;
    currentPlayerIndex: number;
    lastActionTimestamp: bigint;
    turnCount: bigint;
    directionClockwise: boolean;
    playerHandsHash: { [address: string]: string };
    playerHands: { [address: string]: string[] };
    deckHash: string;
    discardPileHash: string;
    currentColor: CardColor | null;
    currentValue: CardValue | null;
    lastPlayedCardHash: string | null;
    stateHash: string;
    isStarted: boolean;
  }

export interface OnChainGameState {
    id: bigint;
    players: string[];
    status: number; // 0=NotStarted, 1=Started, 2=Ended
    startTime: bigint;
    endTime: bigint;
    gameHash: string;
    moves: string[];
}

export type ActionType = 'startGame' | 'playCard' | 'drawCard';

export interface Action {
  type: ActionType;
  player: string;
  cardHash?: string;
}

export interface UnoGameContract {
  createGame: (account: `0x${string}` | undefined) => Promise<any>;
  joinGame: (gameId: bigint, address: `0x${string}`| undefined) => Promise<any>;
  startGame: (gameId: bigint) => Promise<any>;
  commitMove: (gameId: bigint, moveHash: string) => Promise<any>;
  getGame: (gameId: bigint) => Promise<[
    bigint,           // id
    string[],         // players
    number,           // status
    bigint,           // startTime
    bigint,           // endTime
    string,           // gameHash
    string[]          // moves
  ]>;
  getGameActions: (gameId: bigint) => Promise<{ actionHash: string }[]>;
  endGame: (gameId: bigint, gameHash: string) => Promise<any>;
  getActiveGames: () => Promise<bigint[]>;
  getNotStartedGames: () => Promise<bigint[]>;
}