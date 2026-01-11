import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { celoSepolia } from '@/config/networks';

// Create Wagmi config with testnet chains only (Base Sepolia and Celo Sepolia)
export const wagmiConfig = createConfig({
  chains: [baseSepolia, celoSepolia],
  connectors: [
    coinbaseWallet({
      appName: 'Zunno',
    }),
    injected(), // Support for MetaMask and other injected wallets
  ],
  ssr: true,
  transports: {
    [baseSepolia.id]: http(),
    [celoSepolia.id]: http(),
  },
});
