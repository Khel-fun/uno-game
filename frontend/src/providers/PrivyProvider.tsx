"use client";

import type React from "react";
import { PrivyProvider as PrivyAuthProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { createConfig } from "wagmi";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import {
  baseSepolia,
  celoSepolia,
} from "@/config/networks";

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";

// Single wagmi config for the entire app - used by Privy's WagmiProvider
export const privyWagmiConfig = createConfig({
  chains: [baseSepolia, celoSepolia],
  connectors: [
    coinbaseWallet({ appName: "Zunno" }),
    injected(), // MiniPay and other injected wallets
    ...(wcProjectId
      ? [
          walletConnect({
            projectId: wcProjectId,
            metadata: {
              name: "Zunno",
              description: "ZK UNO on-chain",
              url: "https://zunno.xyz",
              icons: ["https://zunno.xyz/images/logo.png"],
            },
            showQrModal: false, // Privy handles the modal
          }),
        ]
      : []),
  ],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
    [celoSepolia.id]: http("https://rpc.ankr.com/celo_sepolia"),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function PrivyProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivyAuthProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        // Appearance
        appearance: {
          theme: "dark",
          accentColor: "#6366f1",
          logo: "/images/logo.png",
          landingHeader: "Welcome to Zunno",
          loginMessage: "Connect to play ZK UNO on-chain",
          // Show social/email logins first, wallets below
          showWalletLoginFirst: false,
          walletChainType: "ethereum-only",
          // Only list wallets that reliably show icons
          walletList: [
            "metamask",
            "coinbase_wallet",
            "rainbow",
            "wallet_connect",
            "detected_ethereum_wallets",
          ],
        },
        // Login methods - social logins + wallet
        loginMethods: [
          "email",
          "google",
          "twitter",
          "discord",
          "github",
          "apple",
          "farcaster",
          "wallet",
        ],
        // Embedded wallets
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        // MFA configuration
        mfa: {
          noPromptOnMfaRequired: false,
        },
        // Default chain
        defaultChain: baseSepolia,
        // Supported chains
        supportedChains: [baseSepolia, celoSepolia],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={privyWagmiConfig}>
          {children}
        </PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyAuthProvider>
  );
}
