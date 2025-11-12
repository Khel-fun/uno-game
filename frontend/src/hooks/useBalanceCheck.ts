/**
 * Hook to check if user has sufficient ETH balance for gas fees
 */
import { useState, useEffect } from 'react';
import { useBalance } from 'wagmi';
import { useWalletAddress } from '@/utils/onchainWalletUtils';

const MIN_BALANCE_ETH = 0.00001; // Minimum balance required for transactions

export function useBalanceCheck() {
  const { address, isConnected } = useWalletAddress();
  const [hasLowBalance, setHasLowBalance] = useState(false);
  
  const { data: balanceData, refetch } = useBalance({
    address: address as `0x${string}`,
  });

  useEffect(() => {
    if (balanceData) {
      const balanceInEth = parseFloat(balanceData.formatted);
      setHasLowBalance(balanceInEth < MIN_BALANCE_ETH);
    }
  }, [balanceData]);

  const checkBalance = async (): Promise<boolean> => {
    if (!isConnected || !address) {
      return false;
    }

    const result = await refetch();
    if (result.data) {
      const balanceInEth = parseFloat(result.data.formatted);
      const isLow = balanceInEth < MIN_BALANCE_ETH;
      setHasLowBalance(isLow);
      return !isLow; // Return true if balance is sufficient
    }
    
    return false;
  };

  return {
    hasLowBalance,
    checkBalance,
    balance: balanceData?.formatted,
    refetchBalance: refetch,
  };
}
