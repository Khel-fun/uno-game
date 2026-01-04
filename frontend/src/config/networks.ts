import { Chain } from 'wagmi/chains';

export const celo = {
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
  },
  blockExplorers: {
    default: { name: 'Celoscan', url: 'https://celoscan.io' },
  },
  testnet: false,
} as const satisfies Chain;

export const celoSepolia = {
  id: 11142220,
  name: 'Celo Sepolia',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo-sepolia.celo-testnet.org'] },
  },
  blockExplorers: {
    default: { name: 'Celoscan', url: 'https://celo-sepolia.blockscout.com/' },
  },
  testnet: true,
} as const satisfies Chain;

export interface NetworkConfig {
  id: number;
  name: string;
  displayName: string;
  icon: string;
  chain: Chain;
}

export const SUPPORTED_NETWORKS: NetworkConfig[] = [
  {
    id: 84532,
    name: 'baseSepolia',
    displayName: 'Base Sepolia',
    icon: '/base-logo.svg',
    chain: {
      id: 84532,
      name: 'Base Sepolia',
      nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://sepolia.base.org'] },
      },
      blockExplorers: {
        default: { name: 'Basescan', url: 'https://sepolia.basescan.org' },
      },
      testnet: true,
    } as const satisfies Chain,
  },
  {
    id: 11142220,
    name: 'celoSepolia',
    displayName: 'Celo Sepolia',
    icon: '/celo-logo.svg',
    chain: celoSepolia,
  },
];

// Additional networks available but not currently supported
// Uncomment and add to SUPPORTED_NETWORKS array when needed
/*
export const BASE_MAINNET: NetworkConfig = {
  id: 8453,
  name: 'base',
  displayName: 'Base',
  icon: '🔵',
  chain: {
    id: 8453,
    name: 'Base',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://mainnet.base.org'] },
    },
    blockExplorers: {
      default: { name: 'Basescan', url: 'https://basescan.org' },
    },
    testnet: false,
  } as const satisfies Chain,
};

export const CELO_MAINNET: NetworkConfig = {
  id: 42220,
  name: 'celo',
  displayName: 'Celo',
  icon: '🟢',
  chain: celo,
};
*/

export const DEFAULT_NETWORK = SUPPORTED_NETWORKS[0];

export const getNetworkById = (chainId: number): NetworkConfig | undefined => {
  return SUPPORTED_NETWORKS.find((network) => network.id === chainId);
};

export const getNetworkByName = (name: string): NetworkConfig | undefined => {
  return SUPPORTED_NETWORKS.find((network) => network.name === name);
};
