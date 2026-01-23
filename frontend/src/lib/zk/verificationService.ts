import type { ZKProof, VerificationResult } from './types';

// Configuration
const ENABLE_LOCAL_VERIFICATION = true;
const ENABLE_ZKVERIFY_SUBMISSION = process.env.NEXT_PUBLIC_KURIER_API_KEY ? true : false;
const ENABLE_ONCHAIN_VERIFICATION = true;

// Contract addresses on Base Sepolia
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 
                         process.env.NEXT_PUBLIC_BASE_SEPOLIA_CONTRACT_ADDRESS || '';

function verifyLog(message: string, data?: unknown) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}] [Verify] ${message}`, data !== undefined ? data : '');
}

function verifyError(message: string, error?: unknown) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.error(`[${timestamp}] [Verify] ERROR: ${message}`, error !== undefined ? error : '');
}

export type CircuitType = 'shuffle' | 'deal' | 'draw' | 'play';

export interface VerificationOptions {
  /** Verify locally using WASM (fast, free) */
  localVerify?: boolean;
  /** Submit to zkVerify Kurier API (aggregated verification) */
  zkVerify?: boolean;
  /** Submit to on-chain contract (gas cost) */
  onChain?: boolean;
  /** Game ID for on-chain submission */
  gameId?: string;
}

export interface ComprehensiveVerificationResult {
  circuitType: CircuitType;
  /** Local (off-chain) verification result */
  local?: {
    verified: boolean;
    timeMs: number;
    error?: string;
  };
  /** zkVerify submission result */
  zkVerify?: {
    submitted: boolean;
    jobId?: string;
    status?: string;
    error?: string;
  };
  /** On-chain verification result */
  onChain?: {
    submitted: boolean;
    txHash?: string;
    verified?: boolean;
    error?: string;
  };
}

export async function verifyLocally(
  circuitType: CircuitType,
  proof: ZKProof
): Promise<VerificationResult> {
  const startTime = performance.now();
  verifyLog(`Verifying ${circuitType} proof locally...`);

  try {
    const proofService = await import('./proofService');
    
    let result: VerificationResult;
    switch (circuitType) {
      case 'shuffle':
        result = await proofService.verifyShuffleProof(proof);
        break;
      case 'deal':
        result = await proofService.verifyDealProof(proof);
        break;
      case 'draw':
        result = await proofService.verifyDrawProof(proof);
        break;
      case 'play':
        result = await proofService.verifyPlayProof(proof);
        break;
      default:
        return { valid: false, error: `Unknown circuit type: ${circuitType}` };
    }

    const duration = performance.now() - startTime;
    
    if (result.valid) {
      verifyLog(`${circuitType} proof verified locally in ${duration.toFixed(0)}ms [OK]`);
    } else {
      verifyError(`${circuitType} proof verification failed:`, result.error);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown verification error';
    verifyError(`Local verification error:`, error);
    return { valid: false, error: message };
  }
}

export async function submitToZkVerify(
  circuitType: CircuitType,
  proof: ZKProof
): Promise<{ submitted: boolean; jobId?: string; error?: string }> {
  if (!ENABLE_ZKVERIFY_SUBMISSION) {
    return { 
      submitted: false, 
      error: 'zkVerify not configured (missing NEXT_PUBLIC_KURIER_API_KEY)' 
    };
  }

  verifyLog(`Submitting ${circuitType} proof to zkVerify...`);

  try {
    const zkVerifyService = await import('./zkVerifyService');
    
    const response = await zkVerifyService.submitProofToZkVerify({
      circuitName: circuitType,
      proof,
    });

    verifyLog(`Proof submitted to zkVerify, job ID: ${response.jobId}`);
    
    return {
      submitted: true,
      jobId: response.jobId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'zkVerify submission failed';
    verifyError('zkVerify submission error:', error);
    return { submitted: false, error: message };
  }
}
export async function waitForZkVerifyResult(jobId: string): Promise<{
  status: string;
  verified: boolean;
  txHash?: string;
  error?: string;
}> {
  verifyLog(`Waiting for zkVerify verification: ${jobId}`);

  try {
    const zkVerifyService = await import('./zkVerifyService');
    const result = await zkVerifyService.waitForVerification(jobId);

    const verified = ['Finalized', 'Aggregated', 'AggregationPublished'].includes(result.status);
    
    if (verified) {
      verifyLog(`zkVerify verification complete: ${result.status} [OK]`);
    } else {
      verifyError(`zkVerify verification status: ${result.status}`);
    }

    return {
      status: result.status,
      verified,
      txHash: result.txHash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'zkVerify wait failed';
    verifyError('zkVerify wait error:', error);
    return { status: 'Failed', verified: false, error: message };
  }
}

function formatForContract(proof: ZKProof): { proofHex: string; publicInputsHex: string[] } {
  // Convert Uint8Array proof to hex
  const proofHex = '0x' + Array.from(proof.proof)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Convert public inputs to bytes32 hex
  const publicInputsHex = proof.publicInputs.map(input => {
    const value = BigInt(input);
    return '0x' + value.toString(16).padStart(64, '0');
  });

  return { proofHex, publicInputsHex };
}

export async function verifyOnChain(
  circuitType: CircuitType,
  proof: ZKProof,
  gameId: string,
  walletClient: unknown,
  publicClient: unknown
): Promise<{ submitted: boolean; txHash?: string; verified?: boolean; error?: string }> {
  if (!ENABLE_ONCHAIN_VERIFICATION || !CONTRACT_ADDRESS) {
    return {
      submitted: false,
      error: 'On-chain verification not configured (missing CONTRACT_ADDRESS)',
    };
  }

  verifyLog(`Submitting ${circuitType} proof to chain for game ${gameId}...`);

  try {
    const { proofHex, publicInputsHex } = formatForContract(proof);
    
    // Map circuit type to enum value
    const circuitTypeEnum: Record<CircuitType, number> = {
      shuffle: 0,
      deal: 1,
      draw: 2,
      play: 3,
    };

    // Generate move hash from public inputs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viem = await import('viem');
    const moveHash = viem.keccak256(
      viem.encodeAbiParameters(
        [{ type: 'bytes32[]' }],
        [publicInputsHex as `0x${string}`[]]
      )
    );

    // ABI for commitMove function
    const abi = [
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

    // Simulate transaction first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { request } = await (publicClient as any).simulateContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi,
      functionName: 'commitMove',
      args: [
        BigInt(gameId),
        moveHash,
        proofHex as `0x${string}`,
        publicInputsHex as `0x${string}`[],
        circuitTypeEnum[circuitType],
      ],
    });

    // Submit transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txHash = await (walletClient as any).writeContract(request);

    verifyLog(`Transaction submitted: ${txHash}`);

    // Wait for confirmation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const receipt = await (publicClient as any).waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    const verified = receipt.status === 'success';

    if (verified) {
      verifyLog(`On-chain verification successful`);
    } else {
      verifyError(`On-chain verification failed (reverted)`);
    }

    return {
      submitted: true,
      txHash,
      verified,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'On-chain verification failed';
    verifyError('On-chain verification error:', error);
    return { submitted: false, error: message };
  }
}

export async function verifyProofComprehensive(
  circuitType: CircuitType,
  proof: ZKProof,
  options: VerificationOptions = {}
): Promise<ComprehensiveVerificationResult> {
  const result: ComprehensiveVerificationResult = { circuitType };

  // Default options
  const {
    localVerify = ENABLE_LOCAL_VERIFICATION,
    zkVerify = false, // Off by default, user must opt-in
    onChain = false,  // Off by default, requires wallet
    gameId,
  } = options;

  // 1. Local verification (always fast and free)
  if (localVerify) {
    const startTime = performance.now();
    const localResult = await verifyLocally(circuitType, proof);
    result.local = {
      verified: localResult.valid,
      timeMs: performance.now() - startTime,
      error: localResult.error,
    };

    // If local verification fails, don't bother with other methods
    if (!localResult.valid) {
      verifyError(`Local verification failed, skipping zkVerify and on-chain`);
      return result;
    }
  }

  // 2. zkVerify submission (optional, aggregated)
  if (zkVerify && ENABLE_ZKVERIFY_SUBMISSION) {
    const zkResult = await submitToZkVerify(circuitType, proof);
    result.zkVerify = {
      submitted: zkResult.submitted,
      jobId: zkResult.jobId,
      error: zkResult.error,
    };
    
    // Note: We don't wait for zkVerify completion here (async aggregation)
    // Use waitForZkVerifyResult() to poll for completion
  }

  // 3. On-chain verification (optional, requires wallet)
  if (onChain && gameId) {
    // Note: For on-chain, caller must provide wallet clients
    // This is a placeholder - actual call requires wallet context
    result.onChain = {
      submitted: false,
      error: 'On-chain verification requires wallet context. Use verifyOnChain() directly.',
    };
  }

  return result;
}

export async function testLocalVerification(
  circuitType: CircuitType,
  proof: ZKProof
): Promise<boolean> {
  const result = await verifyLocally(circuitType, proof);
  console.log(`[Test] ${circuitType} local verification: ${result.valid ? 'PASS' : 'FAIL'}`);
  if (!result.valid && result.error) {
    console.log(`[Test] Error: ${result.error}`);
  }
  return result.valid;
}

// Export configuration status
export const verificationConfig = {
  localEnabled: ENABLE_LOCAL_VERIFICATION,
  zkVerifyEnabled: ENABLE_ZKVERIFY_SUBMISSION,
  onChainEnabled: ENABLE_ONCHAIN_VERIFICATION && !!CONTRACT_ADDRESS,
  contractAddress: CONTRACT_ADDRESS,
};
