import { Chain } from "wagmi/chains";
import { createConfig } from "wagmi";
import { http } from "viem";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { celoSepolia } from "@/config/networks";

export const arbitriumSepolia = {
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia-rollup.arbitrum.io/rpc"] },
  },
  blockExplorers: {
    default: { name: "arbiscan", url: "https://sepolia.arbiscan.io" },
  },
  testnet: true,
} as const satisfies Chain;

export const config = createConfig({
  chains: [celoSepolia],
  connectors: [
    coinbaseWallet({
      appName: "Zunno",
    }),
    injected(), // Support for MiniPay and other injected wallets
  ],
  ssr: true,
  transports: {
    [celoSepolia.id]: http(),
  },
});
