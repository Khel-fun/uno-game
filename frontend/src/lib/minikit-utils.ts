'use client';

/**
 * MiniKit utility functions to help with integration
 */

// Base Sepolia chain ID
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// Get MiniKit chain configuration
export const getMiniKitChain = () => {
  // This is a simplified chain object that works with MiniKit
  // We're avoiding the type issues by using a simple object with just the required properties
  return {
    id: BASE_SEPOLIA_CHAIN_ID,
    name: 'Base Sepolia',
    network: 'base-sepolia',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ['https://sepolia.base.org'],
      },
      public: {
        http: ['https://sepolia.base.org'],
      },
    },
  };
};

// Get MiniKit API key from environment variables
export const getMiniKitApiKey = () => {
  return process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || '';
};

export const getMiniKitProjectId = () => {
  return process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_ID || '';
};

// Check if MiniKit is properly configured
export const isMiniKitConfigured = () => {
  const apiKey = getMiniKitApiKey();
  return apiKey !== undefined && apiKey !== '';
};

// Define the Mode type to match OnchainKit's expected type
type Mode = 'dark' | 'light';

// Get MiniKit appearance configuration
export const getMiniKitAppearance = () => {
  return {
    name: 'Zunno',
    mode: 'dark' as Mode,
    theme: 'default',
  };
};
