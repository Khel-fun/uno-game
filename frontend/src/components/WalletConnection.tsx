"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useEffect, useState } from "react";
import { useActiveAccount, ConnectButton } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { client } from "@/utils/thirdWebClient";
import { celoSepolia } from "@/lib/chains";
import { isMiniPay } from "@/utils/miniPayUtils";
import { celoSepolia as celoSepoliaWagmi } from "@/config/networks";

const wallet = inAppWallet();

interface WalletConnectionProps {
  onConnect?: (publicKey: string | null) => void;
}

export function WalletConnection({ onConnect }: WalletConnectionProps) {
  // State to hide connect button when MiniPay is detected
  const [hideMiniPayConnectBtn, setHideMiniPayConnectBtn] = useState(false);

  // Use wagmi's useAccount directly for proper connection state
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { connect, connectors } = useConnect();

  // Once connected, you can access the active account
  const activeAccount = useActiveAccount();

  // MiniPay auto-connect on mount - only run once
  useEffect(() => {
    const initMiniPay = async () => {
      if (typeof window !== "undefined" && isMiniPay()) {
        console.log("[MiniPay] MiniPay wallet detected!");
        setHideMiniPayConnectBtn(true);

        // Request accounts first (required by MiniPay)
        try {
          const accounts = await window.ethereum!.request({
            method: "eth_requestAccounts",
            params: [],
          });
          console.log("[MiniPay] Accounts requested:", accounts);
        } catch (error) {
          console.error("[MiniPay] Failed to request accounts:", error);
          return;
        }

        // Find the injected connector
        const injectedConnector = connectors.find(
          (connector) => connector.id === "injected",
        );

        if (!injectedConnector) {
          console.error("[MiniPay] Injected connector not found");
          return;
        }

        // Auto-connect if not already connected
        if (!isConnected) {
          console.log("[MiniPay] Initiating connection...");
          try {
            await connect({ connector: injectedConnector });
            console.log("[MiniPay] Connection initiated successfully");
          } catch (error) {
            console.error("[MiniPay] Connection failed:", error);
          }
        } else {
          console.log("[MiniPay] Already connected");
        }
      }
    };

    initMiniPay();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch to Celo Sepolia when connected via MiniPay and update localStorage
  useEffect(() => {
    if (isMiniPay() && isConnected && switchChain) {
      console.log("[MiniPay] Connected! Switching to Celo Sepolia...");
      switchChain({ chainId: celoSepoliaWagmi.id });
      // Update localStorage so ThirdWeb uses the correct network
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "zunno_selected_network",
          celoSepoliaWagmi.id.toString(),
        );
      }
    }
  }, [isConnected, switchChain]);

  // Log connection status for debugging
  useEffect(() => {
    if (hideMiniPayConnectBtn) {
      console.log("[MiniPay] Status:", {
        isConnected,
        address,
        chainId: isConnected ? "connected" : "not connected",
      });
    }
  }, [isConnected, address, hideMiniPayConnectBtn]);

  // When address changes or subaccount is selected, notify parent component
  useEffect(() => {
    if (onConnect) {
      const activeAddress = address;
      onConnect(activeAddress || null);
    }
  }, [address, onConnect]);

  const wallets = [
    inAppWallet({ auth: { options: ["google", "email", "apple"] } }),
    createWallet("io.metamask"),
    createWallet("com.coinbase.wallet"),
    createWallet("me.rainbow"),
  ];

  return (
    <div className="flex flex-col gap-4 items-center">
      {/* Show MiniPay status when detected and connected */}
      {hideMiniPayConnectBtn && isConnected && address && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-sm text-green-500 font-medium">
            ✓ Connected via MiniPay
          </div>
          <div className="text-xs text-gray-400">
            {address.substring(0, 6)}...{address.substring(address.length - 4)}
          </div>
        </div>
      )}

      {/* Show connecting message for MiniPay before connection */}
      {hideMiniPayConnectBtn && !isConnected && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-sm text-yellow-500 animate-pulse">
            🔄 Connecting to MiniPay...
          </div>
          <div className="text-xs text-gray-400">
            Please approve in MiniPay wallet
          </div>
        </div>
      )}

      {/* Conditionally render Connect Button - hide when MiniPay is detected */}
      {!hideMiniPayConnectBtn && (
        <div className="max-w-xs">
          <ConnectButton
            client={client}
            chain={celoSepolia}
            wallets={wallets}
          />
        </div>
      )}
    </div>
  );
}
