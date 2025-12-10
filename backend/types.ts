// Type definitions for the backend

export interface User {
  id: string;
  name: string;
  room: string;
}

export interface AddUserResult {
  newUser?: User;
  error?: string;
}

export interface GameLog {
  gameId: string;
  winner: string;
  players: string[];
  duration: number;
  timestamp: string;
}
