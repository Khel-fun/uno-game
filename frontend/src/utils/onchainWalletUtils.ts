/**
 * OnchainKit wallet utilities for Game of Uno
 */
import { useAccount } from 'wagmi';
import { useActiveAccount, useConnect } from "thirdweb/react";
import { client } from "@/utils/thirdWebClient";
import { useState, useEffect } from 'react';

/**
 * Hook to get the connected wallet address
 * @returns The connected wallet address and connection status
 */
export function useWalletAddress() {
  const activeAccount = useActiveAccount();
  const { connect, isConnecting } = useConnect();
  const [storedAddress, setStoredAddress] = useState<string | undefined>(undefined);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // Sync with localStorage
  useEffect(() => {
    const savedAddress = localStorage.getItem("uno_wallet_address");
    
    if (activeAccount?.address) {
      localStorage.setItem("uno_wallet_address", activeAccount.address);
      setStoredAddress(activeAccount.address);
    } else if (savedAddress) {
      setStoredAddress(savedAddress);
    }
    setIsStorageLoaded(true);
  }, [activeAccount]);

  // Update local storage every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeAccount?.address) {
        localStorage.setItem("uno_wallet_address", activeAccount.address);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeAccount]);

  const finalAddress = activeAccount?.address || storedAddress;
  const isConnected = !!finalAddress;
  
  // We are loading if Thirdweb is connecting OR if we haven't checked storage yet
  const isLoading = isConnecting || !isStorageLoaded;
  
  return { address: finalAddress, isConnected, isConnecting: isLoading };
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
