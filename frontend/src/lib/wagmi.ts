import { Chain, base, baseSepolia } from 'wagmi/chains';
import { createConfig } from 'wagmi';
import { http } from 'viem';
import { coinbaseWallet, injected } from 'wagmi/connectors';

export const arbitriumSepolia = {
    id: 421614,
    name: 'Arbitrum Sepolia',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://sepolia-rollup.arbitrum.io/rpc'] },
    },
    blockExplorers: {
        default: { name: 'arbiscan', url: 'https://sepolia.arbiscan.io' },
    },
    testnet: true,
} as const satisfies Chain;

export const config = createConfig({
    chains: [baseSepolia],
    connectors: [
        coinbaseWallet({
            appName: 'Zunno',
        }),
        injected(), // Support for MetaMask and other injected wallets
    ],
    ssr: true,
    transports: {
        // [arbitriumSepolia.id]: http(),
        // [base.id]: http(),
        [baseSepolia.id]: http(),
    },
});