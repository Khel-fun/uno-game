import { ethers } from "ethers";
import { UnoGameContract } from "./types";
import UNOContractJson from "../constants/UnoGame.json";
import { getContractAddress } from "@/config/networks";
import * as dotenv from "dotenv";

dotenv.config();

declare global {
  interface Window {
    ethereum?: any;
  }
}

async function verifyContract(provider: ethers.Provider, address: string) {
  const code = await provider.getCode(address);
  if (code === "0x") {
    throw new Error("No contract deployed at the specified address");
  }
  // console.log('Contract verified at address:', address);
}

/**
 * Get RPC URL for a specific chain
 */
function getRpcUrl(chainId: number): string {
  const rpcUrls: Record<number, string> = {
    11142220: "https://forno.celo-sepolia.celo-testnet.org", // Celo Sepolia
    84532: "https://sepolia.base.org", // Base Sepolia
  };

  const rpcUrl = rpcUrls[chainId];
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chain ID: ${chainId}`);
  }

  return rpcUrl;
}

export async function getContractNew(chainId: number) {
  try {
    const rpcUrl = getRpcUrl(chainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const KEY = process.env.NEXT_PUBLIC_PRIVATE_KEY;

    if (!KEY) {
      throw new Error("Private key is missing");
    }

    const wallet = new ethers.Wallet(KEY, provider);
    const contractAddress = getContractAddress(chainId);
    if (!contractAddress) {
      throw new Error(`Contract address not found for chain ID: ${chainId}`);
    }
    const contractABI = UNOContractJson.abi;

    await verifyContract(provider, contractAddress);

    const gameContract = new ethers.Contract(
      contractAddress,
      contractABI,
      wallet,
    ) as ethers.Contract & UnoGameContract;
    // console.log('Contract connected with wallet:', wallet.address);

    return { contract: gameContract, wallet: wallet.address };
  } catch (error) {
    console.error("Failed to connect to contract:", error);

    return { account: null, contract: null };
  }
}
