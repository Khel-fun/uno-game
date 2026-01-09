import { Chain } from "wagmi/chains";

export const celo = {
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo.org"] },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://celoscan.io" },
  },
  testnet: false,
} as const satisfies Chain;

export const celoSepolia = {
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://celo-sepolia.blockscout.com/" },
  },
  testnet: true,
} as const satisfies Chain;

export const baseSepolia = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia.base.org"] },
  },
  blockExplorers: {
    default: { name: "Basescan", url: "https://sepolia.basescan.org" },
  },
  testnet: true,
} as const satisfies Chain;

export interface NetworkConfig {
  id: number;
  name: string;
  displayName: string;
  icon: string;
  chain: Chain;
  contractAddress?: string;
}

export const SUPPORTED_NETWORKS: NetworkConfig[] = [
  {
    id: 11142220,
    name: "celoSepolia",
    displayName: "Celo Sepolia",
    icon: "/celo-logo.svg",
    chain: celoSepolia,
    contractAddress: process.env.NEXT_PUBLIC_CELO_SEPOLIA_CONTRACT_ADDRESS,
  },
  {
    id: 84532,
    name: "baseSepolia",
    displayName: "Base Sepolia",
    icon: "/base-logo.svg",
    chain: baseSepolia,
    contractAddress: process.env.NEXT_PUBLIC_BASE_SEPOLIA_CONTRACT_ADDRESS,
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

/**
 * Get contract address for a specific network
 * @param chainId - The chain ID of the network
 * @returns The contract address for the network, or empty string if not found
 */
export const getContractAddress = (chainId: number): string => {
  const network = getNetworkById(chainId);
  return network?.contractAddress || "";
};
/**
 * Check if a chain ID is supported
 * @param chainId - The chain ID to check
 * @returns True if the chain is supported, false otherwise
 */
export const isSupportedChain = (chainId: number): boolean => {
  return SUPPORTED_NETWORKS.some((network) => network.id === chainId);
};

/**
 * Get list of supported chain IDs
 * @returns Array of supported chain IDs
 */
export const getSupportedChainIds = (): number[] => {
  return SUPPORTED_NETWORKS.map((network) => network.id);
};
