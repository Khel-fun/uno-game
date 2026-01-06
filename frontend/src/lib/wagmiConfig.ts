import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { celoSepolia } from "@/config/networks";

// Create Wagmi config with Celo Sepolia testnet only
// MiniPay uses injected connector and supports Celo Sepolia with fee abstraction (cUSD)
export const wagmiConfig = createConfig({
  chains: [celoSepolia],
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
    [celoSepolia.id]: http(),
  },
});
