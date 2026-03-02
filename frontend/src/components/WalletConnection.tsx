"use client";

import { useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";

interface WalletConnectionProps {
  onConnect?: (publicKey: string | null) => void;
}

export function WalletConnection({ onConnect }: WalletConnectionProps) {
  const { login, authenticated, ready, connectWallet } = usePrivy();
  const { address, isConnected } = useAccount();

  // Notify parent when address changes
  useEffect(() => {
    if (onConnect) {
      onConnect(address || null);
    }
  }, [address, onConnect]);

  // If already authenticated (e.g. social login) but no wallet connected,
  // use connectWallet() to prompt wallet linking.
  // Otherwise, open the full Privy login modal.
  const handleConnect = useCallback(() => {
    if (authenticated && !isConnected) {
      connectWallet();
    } else {
      login();
    }
  }, [authenticated, isConnected, connectWallet, login]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Connect button (shown when NOT authenticated OR authenticated but no wallet)
  return (
    <button
      onClick={handleConnect}
      className="group relative overflow-hidden rounded-xl transition-all duration-300 ease-out"
    >
      {/* Animated gradient border */}
      <div className="absolute -inset-[2px] rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-75 group-hover:opacity-100 transition-opacity duration-300 animate-gradient-shift" />

      {/* Button content */}
      <div className="relative flex items-center gap-3 px-6 py-3 rounded-[10px] bg-gray-900/95 backdrop-blur-sm transition-all duration-300 group-hover:bg-gray-900/80">
        <span className="text-white font-semibold text-sm tracking-wide">
          Connect Wallet
        </span>
      </div>
    </button>
  );
}
