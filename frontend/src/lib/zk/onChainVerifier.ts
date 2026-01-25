import { createPublicClient, http, PublicClient } from 'viem';
import type { ZKProof } from './types';
import { VERIFIER_ADDRESSES, CircuitType } from '../../constants/unogameabi';

// Chain ID for Base Sepolia
const BASE_SEPOLIA_CHAIN_ID = 84532;
function getBaseSepoliaClient(): PublicClient {
  return createPublicClient({
    chain: {
      id: BASE_SEPOLIA_CHAIN_ID,
      name: 'Base Sepolia',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://sepolia.base.org'] },
      },
    },
    transport: http('https://sepolia.base.org'),
  }) as PublicClient;
}

function verifierLog(message: string, data?: unknown) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}] [OnChainVerifier] ${message}`, data !== undefined ? data : '');
}

function verifierError(message: string, error?: unknown) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.error(`[${timestamp}] [OnChainVerifier] ERROR: ${message}`, error !== undefined ? error : '');
}

export type VerifierCircuitType = 'shuffle' | 'deal' | 'draw' | 'play';

export interface OnChainVerifyResult {
  verified: boolean;
  txHash?: string;
  error?: string;
  gasUsed?: bigint;
}

export interface VerifierConfig {
  chainId: number;
  addresses: {
    shuffle: string;
    deal: string;
    draw: string;
    play: string;
  };
}

/**
 * ABI for the UltraHonk verifier contract
 * The verifier has a single verify function
 */
const VERIFIER_ABI = [
  {
    name: 'verify',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '_proof', type: 'bytes' },
      { name: '_publicInputs', type: 'bytes32[]' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/**
 * Format proof for on-chain verification
 * Converts ZKProof to the format expected by Solidity verifiers
 */
export function formatProofForContract(proof: ZKProof): {
  proofBytes: `0x${string}`;
  publicInputs: `0x${string}`[];
} {
  // Convert Uint8Array proof to hex bytes
  const proofBytes = ('0x' + Array.from(proof.proof)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')) as `0x${string}`;
  
  // Convert public inputs to bytes32 array
  // bb.js returns publicInputs as hex strings
  const publicInputs = proof.publicInputs.map(input => {
    const inputStr = String(input);
    // Remove 0x prefix if present, pad to 64 chars (32 bytes)
    const cleanHex = inputStr.startsWith('0x') ? inputStr.slice(2) : inputStr;
    return ('0x' + cleanHex.padStart(64, '0')) as `0x${string}`;
  });

  return { proofBytes, publicInputs };
}

/**
 * Format proof for on-chain verification with pairing points
 * For UltraHonk, we need to reconstruct the full proof format
 * The Solidity verifier expects:
 * - _proof: bytes containing pairing points + rest of proof
 * - _publicInputs: bytes32[] with the actual public inputs
 */
export function formatProofForContractWithPairingPoints(proof: ZKProof): {
  proofBytes: `0x${string}`;
  publicInputs: `0x${string}`[];
} {
  // The proof.proof from bb.js should already have pairing points at the start
  // Convert Uint8Array proof to hex bytes
  const proofBytes = ('0x' + Array.from(proof.proof)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')) as `0x${string}`;
  
  // Public inputs should NOT include pairing points
  // bb.js already separates them out
  const publicInputs = proof.publicInputs.map(input => {
    const inputStr = String(input);
    // Remove 0x prefix if present, pad to 64 chars (32 bytes)
    const cleanHex = inputStr.startsWith('0x') ? inputStr.slice(2) : inputStr;
    return ('0x' + cleanHex.padStart(64, '0')) as `0x${string}`;
  });

  return { proofBytes, publicInputs };
}

export async function verifyOnChainReadOnly(
  circuitType: VerifierCircuitType,
  proof: ZKProof,
  _publicClient?: unknown // Optional, we use our own dedicated client
): Promise<OnChainVerifyResult> {
  verifierLog(`Verifying ${circuitType} proof on-chain (read-only)...`);

  try {
    const verifierAddress = VERIFIER_ADDRESSES.baseSepolia[circuitType];
    if (!verifierAddress) {
      return { verified: false, error: `No verifier address for circuit: ${circuitType}` };
    }

    // Use our dedicated Base Sepolia client for verification
    // This ensures we always call the correct chain regardless of wallet state
    const client = getBaseSepoliaClient();
    verifierLog(`   Using dedicated Base Sepolia client (chain ID: ${BASE_SEPOLIA_CHAIN_ID})`);

    const { proofBytes, publicInputs } = formatProofForContractWithPairingPoints(proof);

    verifierLog(`   Verifier: ${verifierAddress}`);
    verifierLog(`   Proof bytes: ${proofBytes.length} chars (${(proofBytes.length - 2) / 2} bytes)`);
    verifierLog(`   Public inputs: ${publicInputs.length}`);
    verifierLog(`   First public input: ${publicInputs[0]?.slice(0, 20)}...`);

    // Call the verify function (view call, no gas)
    const result = await client.readContract({
      address: verifierAddress as `0x${string}`,
      abi: VERIFIER_ABI,
      functionName: 'verify',
      args: [proofBytes, publicInputs],
    });

    const verified = Boolean(result);
    verifierLog(`   Result: ${verified ? 'VERIFIED ✓' : 'FAILED ✗'}`);

    return { verified };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown verification error';
    
    // Parse common errors
    if (message.includes('returned no data')) {
      verifierError('Contract call returned no data. This could mean:', null);
      verifierError('  1. The contract does not exist on this chain', null);
      verifierError('  2. The proof format is incorrect', null);
      verifierError('  3. The ABI signature does not match', null);
      return { verified: false, error: 'Contract not found or proof format mismatch' };
    }
    
    if (message.includes('revert')) {
      verifierError('Proof verification reverted - proof is likely invalid');
      return { verified: false, error: 'Proof verification failed (reverted)' };
    }
    
    verifierError('On-chain verification failed:', error);
    return { verified: false, error: message };
  }
}

export async function verifyOnChainWithTransaction(
  circuitType: VerifierCircuitType,
  proof: ZKProof,
  walletClient: unknown,
  _publicClient?: unknown // Not used - we use our own dedicated client
): Promise<OnChainVerifyResult> {
  verifierLog(`Verifying ${circuitType} proof on-chain (with transaction)...`);

  try {
    const verifierAddress = VERIFIER_ADDRESSES.baseSepolia[circuitType];
    if (!verifierAddress) {
      return { verified: false, error: `No verifier address for circuit: ${circuitType}` };
    }

    // Use our dedicated Base Sepolia client for simulation and receipt
    const baseSepoliaClient = getBaseSepoliaClient();
    verifierLog(`   Using dedicated Base Sepolia client (chain ID: ${BASE_SEPOLIA_CHAIN_ID})`);

    const { proofBytes, publicInputs } = formatProofForContractWithPairingPoints(proof);

    verifierLog(`   Verifier: ${verifierAddress}`);
    verifierLog(`   Proof bytes: ${proofBytes.length} chars (${(proofBytes.length - 2) / 2} bytes)`);
    verifierLog(`   Public inputs: ${publicInputs.length}`);

    // First simulate to check it will succeed using our dedicated client
    verifierLog('   Simulating transaction...');
    const { request } = await baseSepoliaClient.simulateContract({
      address: verifierAddress as `0x${string}`,
      abi: VERIFIER_ABI,
      functionName: 'verify',
      args: [proofBytes, publicInputs],
    });

    verifierLog('   Simulation successful, submitting transaction...');

    // Submit the transaction (this will trigger MetaMask)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txHash = await (walletClient as any).writeContract(request);
    verifierLog(`   Transaction submitted: ${txHash}`);

    // Wait for confirmation using our dedicated client
    const receipt = await baseSepoliaClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    const verified = receipt.status === 'success';
    verifierLog(`   Transaction ${verified ? 'confirmed' : 'reverted'}: ${txHash}`);
    verifierLog(`   Gas used: ${receipt.gasUsed?.toString()}`);

    return {
      verified,
      txHash,
      gasUsed: receipt.gasUsed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for user rejection
    if (message.includes('User rejected') || message.includes('user rejected')) {
      verifierError('User rejected the transaction');
      return { verified: false, error: 'Transaction rejected by user' };
    }
    
    verifierError('On-chain verification transaction failed:', error);
    return { verified: false, error: message };
  }
}

export async function verifyOnChainWithTx(
  circuitType: VerifierCircuitType,
  proof: ZKProof,
  gameId: string,
  walletClient: unknown,
  publicClient: unknown,
  contractAddress: string
): Promise<OnChainVerifyResult> {
  verifierLog(`Submitting ${circuitType} proof to chain for game ${gameId}...`);

  try {
    const { proofBytes, publicInputs } = formatProofForContract(proof);

    // Map circuit type to enum value
    const circuitTypeEnum: Record<VerifierCircuitType, number> = {
      shuffle: CircuitType.Shuffle,
      deal: CircuitType.Deal,
      draw: CircuitType.Draw,
      play: CircuitType.Play,
    };

    // Import viem for encoding
    const viem = await import('viem');
    
    // Generate move hash from public inputs
    const moveHash = viem.keccak256(
      viem.encodeAbiParameters(
        [{ type: 'bytes32[]' }],
        [publicInputs]
      )
    );

    // ABI for commitMove function
    const commitMoveABI = [
      {
        name: 'commitMove',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'gameId', type: 'uint256' },
          { name: 'moveHash', type: 'bytes32' },
          { name: 'proof', type: 'bytes' },
          { name: 'publicInputs', type: 'bytes32[]' },
          { name: 'circuitType', type: 'uint8' },
        ],
        outputs: [],
      },
    ] as const;

    verifierLog(`   Contract: ${contractAddress}`);
    verifierLog(`   Move hash: ${moveHash}`);

    // Simulate transaction first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { request } = await (publicClient as any).simulateContract({
      address: contractAddress as `0x${string}`,
      abi: commitMoveABI,
      functionName: 'commitMove',
      args: [
        BigInt(gameId),
        moveHash,
        proofBytes,
        publicInputs,
        circuitTypeEnum[circuitType],
      ],
    });

    // Submit transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txHash = await (walletClient as any).writeContract(request);
    verifierLog(`   TX submitted: ${txHash}`);

    // Wait for confirmation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const receipt = await (publicClient as any).waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    const verified = receipt.status === 'success';
    verifierLog(`   TX ${verified ? 'confirmed' : 'reverted'}: ${txHash}`);

    return {
      verified,
      txHash,
      gasUsed: receipt.gasUsed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    verifierError('On-chain TX failed:', error);
    return { verified: false, error: message };
  }
}

export async function verifyProofStandalone(
  circuitType: VerifierCircuitType,
  proof: ZKProof,
  publicClient: unknown
): Promise<boolean> {
  const result = await verifyOnChainReadOnly(circuitType, proof, publicClient);
  return result.verified;
}

export function getVerifierConfig(chainId: number): VerifierConfig | null {
  if (chainId === BASE_SEPOLIA_CHAIN_ID) {
    return {
      chainId: BASE_SEPOLIA_CHAIN_ID,
      addresses: VERIFIER_ADDRESSES.baseSepolia,
    };
  }
  return null;
}
export function isOnChainVerificationAvailable(chainId: number): boolean {
  return getVerifierConfig(chainId) !== null;
}

export function getVerifierAddress(
  circuitType: VerifierCircuitType,
  chainId: number = BASE_SEPOLIA_CHAIN_ID
): string | null {
  const config = getVerifierConfig(chainId);
  return config?.addresses[circuitType] || null;
}

// Export types
export { VERIFIER_ABI, BASE_SEPOLIA_CHAIN_ID };
