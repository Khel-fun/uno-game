'use client';

import { useRecoilState, useRecoilValue } from 'recoil';
import { userAccountState, isUserConnectedState } from './userState';
import { useEffect, useState } from 'react';
import { useAccount, useEnsName, useEnsAvatar } from 'wagmi';
import { useWalletAddress } from '@/utils/onchainWalletUtils';

export function useUserAccount() {
  const [account, setAccount] = useRecoilState(userAccountState);
  const isConnected = useRecoilValue(isUserConnectedState);
  const [bytesAddress, setBytesAddress] = useState<string | null>(null);
  
  // Connect to Wagmi account with ENS support
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useWalletAddress();
  const { data: ensName } = useEnsName({ address: wagmiAddress });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName || undefined });

  // Update account state when Wagmi account changes
  useEffect(() => {
    if (wagmiAddress && wagmiIsConnected) {
      setAccount(wagmiAddress);
    } else if (!wagmiIsConnected) {
      // Clear account when disconnected
      setAccount(null);
    }
  }, [wagmiAddress, wagmiIsConnected, setAccount]);

  // Handle address format conversion for game compatibility
  useEffect(() => {
    if (account) {
      try {
        // All accounts are now Ethereum addresses (start with 0x)
        setBytesAddress(account);
      } catch (error) {
        console.error('Error processing account address:', error);
        setBytesAddress(null);
      }
    } else {
      setBytesAddress(null);
    }
  }, [account]);

  const updateUserAccount = (newAccount: string | null) => {
    setAccount(newAccount);
  };

  return {
    account,
    ensName,
    ensAvatar,
    isConnected: isConnected || wagmiIsConnected,
    updateUserAccount,
    bytesAddress,
  };
}
