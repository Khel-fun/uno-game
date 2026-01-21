"use client";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { useMemo } from "react";
import { http, createConfig } from "wagmi";
import { celoSepolia, baseSepolia } from "@/config/networks";

export function useWagmiConfig() {
  const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "";
  if (!projectId) {
    const providerErrMessage =
      "To connect to all Wallets you need to provide a NEXT_PUBLIC_WC_PROJECT_ID env variable";
    throw new Error(providerErrMessage);
  }

  return useMemo(() => {
    const connectors = connectorsForWallets(
      [
        {
          groupName: "Recommended Wallet",
          wallets: [coinbaseWallet],
        },
        {
          groupName: "Other Wallets",
          wallets: [rainbowWallet, metaMaskWallet],
        },
      ],
      {
        appName: "zunno",
        projectId,
      },
    );

    const wagmiConfig = createConfig({
      chains: [baseSepolia, celoSepolia],
      // turn off injected provider discovery
      multiInjectedProviderDiscovery: false,
      ssr: true,
      transports: {
        [baseSepolia.id]: http(),
        [celoSepolia.id]: http(),
      },
    });

    return wagmiConfig;
  }, [projectId]);
}
