"use client";

import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSwitchChain, useAccount } from "wagmi";
import { DEFAULT_CHAIN_ID } from "@/config/networks";

/**
 * Global component that ensures the connected wallet is always on Base Sepolia.
 * Placed inside PrivyProviderWrapper so it runs for ALL login methods
 * (Privy social, Farcaster, external wallets, etc.)
 */
export function ChainEnforcer() {
  const { authenticated } = usePrivy();
  const { switchChain } = useSwitchChain();
  const { chain, isConnected } = useAccount();
  const hasSwitched = useRef(false);

  useEffect(() => {
    if (!authenticated || !isConnected || !chain || !switchChain) {
      hasSwitched.current = false;
      return;
    }

    if (chain.id !== DEFAULT_CHAIN_ID && !hasSwitched.current) {
      hasSwitched.current = true;
      console.log(
        `[ChainEnforcer] Wallet on chain ${chain.id} (${chain.name}), switching to Base Sepolia (${DEFAULT_CHAIN_ID})...`
      );
      switchChain(
        { chainId: DEFAULT_CHAIN_ID },
        {
          onSuccess: () => {
            console.log("[ChainEnforcer] Successfully switched to Base Sepolia");
          },
          onError: (err) => {
            console.error("[ChainEnforcer] Failed to switch chain:", err);
            hasSwitched.current = false;
          },
        }
      );
    }
  }, [authenticated, isConnected, chain, switchChain]);

  return null;
}
