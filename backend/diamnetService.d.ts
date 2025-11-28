// Type definitions for diamnetService.js
export function createClaimableBalance(winnerAddress: string): Promise<{
  success: boolean;
  [key: string]: any;
}>;
