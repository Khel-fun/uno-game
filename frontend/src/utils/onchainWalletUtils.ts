/**
 * OnchainKit wallet utilities for Game of Uno
 */
import { useAccount } from "wagmi";
import { useActiveAccount } from "thirdweb/react";
import { useEffect, useState } from "react";
import { isMiniPay, getMiniPayAddress } from "./miniPayUtils";
import { getContractAddress } from "@/config/networks";

/**
 * Hook to get the connected wallet address
 * @returns The connected wallet address and connection status
 */
export function useWalletAddress() {
  const activeAccount = useActiveAccount();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const [miniPayAddress, setMiniPayAddress] = useState<string | null>(null);
  const [isMiniPayWallet, setIsMiniPayWallet] = useState(false);

  // Detect MiniPay and fetch address directly
  useEffect(() => {
    const initMiniPay = async () => {
      if (typeof window !== "undefined" && isMiniPay()) {
        setIsMiniPayWallet(true);

        // Fetch address directly from MiniPay
        const mpAddress = await getMiniPayAddress();
        setMiniPayAddress(mpAddress);
      }
    };

    initMiniPay();
  }, []);

  // Use MiniPay address if available, otherwise use thirdweb or wagmi
  const address =
    isMiniPayWallet && miniPayAddress
      ? miniPayAddress
      : activeAccount?.address || wagmiAddress;

  const isConnected = isMiniPayWallet
    ? !!miniPayAddress
    : !!activeAccount?.address || wagmiConnected;

  return { address, isConnected };
}

/**
 * Convert Ethereum address to a format compatible with the game
 * This function can be expanded as needed to handle any address format conversions
 * @param address The Ethereum address
 * @returns The formatted address for game use
 */
export function formatAddressForGame(
  address: string | undefined,
): string | null {
  return address || null;
}

/**
 * Get the contract address for the current network
 * @param chainId The chain ID of the network
 * @returns The contract address for the network
 */
export function getNetworkContractAddress(chainId: number): string {
  return getContractAddress(chainId);
}
