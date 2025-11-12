'use client';

import { useAccount, useDisconnect } from 'wagmi';
import { useUserAccount } from '@/userstate/useUserAccount';
import { useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useWalletAddress } from '@/utils/onchainWalletUtils';

/**
 * Custom hook to manage wallet connection state
 */
export function useWallet() {
  const {address, isConnected} = useWalletAddress();
  const { chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { account, updateUserAccount } = useUserAccount();
  const { toast } = useToast();

  // Update Recoil state when Wagmi account changes
  useEffect(() => {
    if (address && isConnected) {
      updateUserAccount(address);
    }
  }, [address, isConnected, updateUserAccount]);

  // Handle wallet disconnection
  const handleDisconnect = useCallback(() => {
    disconnect();
    updateUserAccount(null);
    
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
      duration: 3000,
    });
  }, [disconnect, updateUserAccount, toast]);

  // Handle network change
  useEffect(() => {
    if (chainId) {
      console.log(`Connected to chain ID: ${chainId}`);
    }
  }, [chainId]);

  return {
    address,
    isConnected,
    chainId,
    disconnect: handleDisconnect,
    account
  };
}
