import { ethers } from 'ethers';
import { UnoGameContract } from './types';
import UNOContractJson from '../constants/UnoGame.json';
import * as dotenv from 'dotenv';

dotenv.config();

declare global {
  interface Window {
    ethereum?: any;
  }
}

async function verifyContract(provider: ethers.Provider, address: string) {
  const code = await provider.getCode(address);
  if (code === '0x') {
    throw new Error('No contract deployed at the specified address');
  }
  console.log('Contract verified at address:', address);
}

export async function getContractNew() {
  try {
    const rpcUrl = 'https://sepolia.base.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const KEY = process.env.NEXT_PUBLIC_PRIVATE_KEY;

    if (!KEY) {
      throw new Error('Private key is missing');
    }

    const wallet = new ethers.Wallet(KEY, provider);
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error('Contract address is missing');
    }
    const contractABI = UNOContractJson.abi;

    await verifyContract(provider, contractAddress);

    const gameContract = new ethers.Contract(
      contractAddress,
      contractABI,
      wallet
    ) as ethers.Contract & UnoGameContract;
    console.log('Contract connected with wallet:', wallet.address);

    return { contract: gameContract, wallet: wallet.address };
  } catch (error) {
    console.error('Failed to connect to contract:', error);
    
    return { account: null, contract: null };
  }
}