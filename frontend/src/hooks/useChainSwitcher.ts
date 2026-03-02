"use client";

import { useCallback } from "react";
import { useSwitchChain, useAccount } from "wagmi";
import { DEFAULT_CHAIN_ID } from "@/config/networks";

/**
 * Hook that provides a function to ensure the wallet is on the correct chain
 * before sending a transaction. Call `ensureCorrectChain()` before any
 * sendTransaction call — it resolves once the wallet is on DEFAULT_CHAIN_ID.
 */
export function useChainSwitcher() {
  const { switchChainAsync } = useSwitchChain();
  const { chain } = useAccount();

  const ensureCorrectChain = useCallback(async () => {
    if (!chain || chain.id === DEFAULT_CHAIN_ID) {
      return; // Already on the correct chain or not connected
    }

    console.log(
      `[useChainSwitcher] Wrong chain ${chain.id}, switching to ${DEFAULT_CHAIN_ID}...`
    );

    await switchChainAsync({ chainId: DEFAULT_CHAIN_ID });

    console.log("[useChainSwitcher] Chain switched successfully");
  }, [chain, switchChainAsync]);

  const isCorrectChain = chain?.id === DEFAULT_CHAIN_ID;

  return { ensureCorrectChain, isCorrectChain };
}
