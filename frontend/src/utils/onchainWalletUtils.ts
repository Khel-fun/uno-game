/**
 * OnchainKit wallet utilities for Game of Uno
 */
import { useAccount } from 'wagmi';
import { useActiveAccount } from "thirdweb/react";
/**
 * Hook to get the connected wallet address
 * @returns The connected wallet address and connection status
 */
export function useWalletAddress() {
  const activeAccount = useActiveAccount();
  const address = activeAccount?.address
  const isConnected = address ? true : false
  // const { address, isConnected } = useAccount();
  return { address, isConnected };
}

/**
 * Convert Ethereum address to a format compatible with the game
 * This function can be expanded as needed to handle any address format conversions
 * @param address The Ethereum address
 * @returns The formatted address for game use
 */
export function formatAddressForGame(address: string | undefined): string | null {
  return address || null;
}
