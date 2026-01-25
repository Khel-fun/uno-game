import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { celoSepolia, baseSepolia } from "@/config/networks";

// Create Wagmi config with both Celo Sepolia and Base Sepolia testnets
// MiniPay uses injected connector and supports Celo Sepolia with fee abstraction (cUSD)
// Base Sepolia is supported for regular browser wallets
export const wagmiConfig = createConfig({
  chains: [baseSepolia, celoSepolia],
  connectors: [
    coinbaseWallet({
      appName: "Zunno",
    }),
    // MiniPay uses injected wallet provider
    // When window.ethereum.isMiniPay is true, this connector will be used
    injected(), // Support for MiniPay and other injected wallets
  ],
  ssr: true,
  transports: {
    [baseSepolia.id]: http(),
    [celoSepolia.id]: http(),
  },
});
