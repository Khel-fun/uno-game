type UserStatus = "active" | "disconnected" | "kicked";

interface User {
  id: string; // UUID - permanent user identifier
  socketId: string | null; // Current socket connection ID
  walletAddress: string | null;
  room: string | null; // Optional - user may not be in a room yet
  name: string;
  status: UserStatus;
  lastSeenAt: number;
}

interface AddUserParams {
  id: string;
  room: string;
  walletAddress?: string;
}

interface AddUserResult {
  user?: User;
  error?: string;
  reused?: boolean;
}

interface ReconnectParams {
  room: string;
  walletAddress?: string;
  newId: string;
}

export type { User, UserStatus, AddUserParams, AddUserResult, ReconnectParams };
