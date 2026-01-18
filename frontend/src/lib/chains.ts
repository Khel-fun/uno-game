import { defineChain } from "thirdweb";

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "CELO",
    symbol: "CELO",
  },
  rpc: "https://forno.celo-sepolia.celo-testnet.org",
  blockExplorers: [
    {
      name: "Celoscan",
      url: "https://celo-sepolia.blockscout.com/",
    },
  ],
  testnet: true,
});
