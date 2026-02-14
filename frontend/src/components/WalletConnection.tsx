"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAccount, useConnect, useSwitchChain } from "wagmi";
import { isMiniPay } from "@/utils/miniPayUtils";
import { celoSepolia as celoSepoliaNetwork } from "@/config/networks";

interface WalletConnectionProps {
  onConnect?: (publicKey: string | null) => void;
}

export function WalletConnection({ onConnect }: WalletConnectionProps) {
  const [hideMiniPayConnectBtn, setHideMiniPayConnectBtn] = useState(false);
  const { login, authenticated, ready, user, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const { address, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { connect, connectors } = useConnect();

  // MiniPay auto-connect on mount
  useEffect(() => {
    const initMiniPay = async () => {
      if (typeof window !== "undefined" && isMiniPay()) {
        setHideMiniPayConnectBtn(true);

        try {
          await window.ethereum!.request({
            method: "eth_requestAccounts",
            params: [],
          });
        } catch (error) {
          console.error("[MiniPay] Failed to request accounts:", error);
          return;
        }

        const injectedConnector = connectors.find(
          (connector) => connector.id === "injected",
        );

        if (!injectedConnector) {
          console.error("[MiniPay] Injected connector not found");
          return;
        }

        if (!isConnected) {
          try {
            await connect({ connector: injectedConnector });
          } catch (error) {
            console.error("[MiniPay] Connection failed:", error);
          }
        }
      }
    };

    initMiniPay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch to Celo Sepolia for MiniPay
  useEffect(() => {
    if (isMiniPay() && isConnected && switchChain) {
      switchChain({ chainId: celoSepoliaNetwork.id });
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "zunno_selected_network",
          celoSepoliaNetwork.id.toString(),
        );
      }
    }
  }, [isConnected, switchChain]);

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

  // MiniPay connected state
  if (hideMiniPayConnectBtn && isConnected && address) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-sm text-green-500 font-medium">
          ✓ Connected via MiniPay
        </div>
        <div className="text-xs text-gray-400">
          {address.substring(0, 6)}...{address.substring(address.length - 4)}
        </div>
      </div>
    );
  }

  // MiniPay connecting state
  if (hideMiniPayConnectBtn && !isConnected) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-sm text-yellow-500 animate-pulse">
          🔄 Connecting to MiniPay...
        </div>
        <div className="text-xs text-gray-400">
          Please approve in MiniPay wallet
        </div>
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
