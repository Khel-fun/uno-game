"use client";

/**
 * MiniKit utility functions to help with integration
 */

// Celo Sepolia chain ID
export const CELO_SEPOLIA_CHAIN_ID = 11142220;

// Get MiniKit chain configuration for Celo Sepolia
export const getMiniKitChain = () => {
  // This is a simplified chain object that works with MiniKit
  // We're avoiding the type issues by using a simple object with just the required properties
  return {
    id: CELO_SEPOLIA_CHAIN_ID,
    name: "Celo Sepolia",
    network: "celo-sepolia",
    nativeCurrency: {
      name: "CELO",
      symbol: "CELO",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ["https://forno.celo-sepolia.celo-testnet.org"],
      },
      public: {
        http: ["https://forno.celo-sepolia.celo-testnet.org"],
      },
    },
  };
};

// Get MiniKit API key from environment variables
export const getMiniKitApiKey = () => {
  return process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || "";
};

export const getMiniKitProjectId = () => {
  return process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_ID || "";
};

// Check if MiniKit is properly configured
export const isMiniKitConfigured = () => {
  const apiKey = getMiniKitApiKey();
  return apiKey !== undefined && apiKey !== "";
};

// Define the Mode type to match OnchainKit's expected type
type Mode = "dark" | "light";

// Get MiniKit appearance configuration
export const getMiniKitAppearance = () => {
  return {
    name: "Zunno",
    mode: "dark" as Mode,
    theme: "default",
  };
};
