import { Chain } from "wagmi/chains";

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
    id: 84532,
    name: "baseSepolia",
    displayName: "Base Sepolia",
    icon: "/base-logo.svg",
    chain: baseSepolia,
    contractAddress: process.env.NEXT_PUBLIC_BASE_SEPOLIA_CONTRACT_ADDRESS,
  },
];

export const DEFAULT_NETWORK = SUPPORTED_NETWORKS[0];

/**
 * The active chain ID used across the app.
 * Change DEFAULT_NETWORK (index above) to switch the entire app to a different chain.
 */
export const DEFAULT_CHAIN_ID = DEFAULT_NETWORK.id;
export const DEFAULT_CHAIN = DEFAULT_NETWORK.chain;

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
