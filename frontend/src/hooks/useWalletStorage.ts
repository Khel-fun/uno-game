/**
 * Hook to manage wallet address in localStorage
 * This ensures consistent user identification across page refreshes
 */

import { useEffect } from 'react';
import { useWalletAddress } from '@/utils/onchainWalletUtils';
import { 
  getCurrentWalletAddress, 
  setStoredWalletAddress, 
  getStoredWalletAddress 
} from '@/utils/walletStorage';

/**
 * Hook that manages wallet address in localStorage
 * Automatically updates localStorage when wallet connects/disconnects
 * @returns The current wallet address (from connected wallet or localStorage)
 */
export function useWalletStorage() {
  const { address: connectedAddress, isConnected } = useWalletAddress();

  // Update localStorage whenever wallet address changes
  useEffect(() => {
    if (connectedAddress) {
      // console.log('Wallet connected, storing address:', connectedAddress);
      setStoredWalletAddress(connectedAddress);
    }
  }, [connectedAddress]);

  // Get the current wallet address (prefer connected, fallback to stored)
  const currentAddress = getCurrentWalletAddress(connectedAddress);

  return {
    address: currentAddress,
    isConnected,
    storedAddress: getStoredWalletAddress(),
    connectedAddress,
  };
}
