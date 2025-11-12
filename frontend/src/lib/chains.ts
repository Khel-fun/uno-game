import { defineChain } from "thirdweb";

export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Base Sepolia",
    symbol: "ETH",
  },
  rpc: "https://sepolia.base.org",
  blockExplorers: [{
      name: "BaseScan",
      url: "https://sepolia.basescan.org",
  }],
  testnet: true,
});

