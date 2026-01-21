import { defineChain } from "thirdweb";

export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Ethereum",
    symbol: "ETH",
  },
  rpc: "https://sepolia.base.org",
  blockExplorers: [
    {
      name: "Basescan",
      url: "https://sepolia.basescan.org",
    },
  ],
  testnet: true,
});

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "CELO",
    symbol: "CELO",
  },
  rpc: "https://rpc.ankr.com/celo_sepolia",
  blockExplorers: [
    {
      name: "Celoscan",
      url: "https://celo-sepolia.blockscout.com/",
    },
  ],
  testnet: true,
});
