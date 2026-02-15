/**
 * zkVerify Kurier Service
 * Handles proof submission and verification via zkVerify's Kurier API 
 * Endpoints:
 * - POST /api/v1/submit-proof/{apiKey} - Submit a proof
 * - GET /api/v1/job-status/{apiKey}/{jobId} - Check job status
 * - POST /api/v1/register-vk/{apiKey} - Register verification key
 * - GET /api/v1/status - Check API status
 */

import type { ZKProof } from './types';
import { proofToHex } from './proofService';


// Kurier API base URL - Testnet by default
const KURIER_API_BASE = process.env.NEXT_PUBLIC_KURIER_API_URL || 'https://api-testnet.kurier.xyz/api/v1';

// API Key - should be set in environment variables
const KURIER_API_KEY = process.env.NEXT_PUBLIC_KURIER_API_KEY;

// Polling interval for status checks (ms)
const POLL_INTERVAL = 3000;

// Maximum polling attempts (3 minutes at 3s intervals)
const MAX_POLL_ATTEMPTS = 60;

function zkLog(message: string, data?: unknown) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}] [zkVerify] ${message}`, data !== undefined ? data : '');
}

function zkError(message: string, error?: unknown) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.error(`[${timestamp}] [zkVerify] ERROR: ${message}`, error !== undefined ? error : '');
}

export type KurierJobStatus = 
  | 'Queued'
  | 'Valid'
  | 'Submitted'
  | 'IncludedInBlock'
  | 'Finalized'
  | 'AggregationPending'
  | 'Aggregated'
  | 'AggregationPublished'
  | 'Failed';

/**
 * Response from submitting a proof
 */
export interface KurierSubmitResponse {
  jobId: string;
  optimisticVerify?: 'success' | 'failed';
  error?: string;
}

/**
 * Response from checking job status
 */
export interface KurierVerificationStatus {
  jobId: string;
  status: KurierJobStatus;
  txHash?: string;
  txExplorerUrl?: string;
  attestationId?: string;
  aggregatorUrl?: string;
  error?: string;
}
interface KurierSubmitPayload {
  proofType: 'ultrahonk' | 'groth16' | 'ultraplonk' | 'risc0' | 'plonky2' | 'sp1' | 'fflonk' | 'ezkl';
  vkRegistered: boolean;
  proofData: {
    /** Hex string for proof (with or without 0x prefix) */
    proof: string;
    /** Array of hex strings for public signals */
    publicSignals: string[];
    /** Hex string for verification key OR vkHash if registered */
    vk: string;
  };
  /** Optional: chain ID for aggregation on destination chain */
  chainId?: number;
}

/**
 * Response from registering a verification key
 */
interface RegisterVKResponse {
  vkHash: string;
  registered: boolean;
}

interface KurierStatusResponse {
  status: string;
  version?: string;
}
export interface SubmitProofOptions {
  /** Circuit name for identification */
  circuitName: string;
  /** The proof to submit */
  proof: ZKProof;
  /** Optional: Whether VK is already registered (default: false) */
  vkRegistered?: boolean;
  /** Optional metadata for tracking */
  metadata?: Record<string, string>;
}

/**
 * Submit a proof to zkVerify for on-chain verification
 */
export async function submitProofToZkVerify(
  options: SubmitProofOptions
): Promise<KurierSubmitResponse> {
  const { circuitName, proof, vkRegistered = false } = options;

  if (!KURIER_API_KEY) {
    throw new Error('KURIER_API_KEY is not configured. Please set NEXT_PUBLIC_KURIER_API_KEY environment variable.');
  }

  if (!proof.verificationKey) {
    throw new Error('Verification key is required for zkVerify submission');
  }

  zkLog(`Submitting ${circuitName} proof to Kurier...`);
  zkLog(`   API Base: ${KURIER_API_BASE}`);
  zkLog(`   Proof size: ${proof.proof.length} bytes`);
  zkLog(`   Public inputs: ${proof.publicInputs.length}`);

  // Format proof as hex string (with 0x prefix)
  // bb.js proof.proof is Uint8Array
  const proofHex = proofToHex(proof.proof);
  
  // Format VK as hex string (with 0x prefix)
  // bb.js verificationKey is Uint8Array
  const vkHex = proofToHex(proof.verificationKey);
  
  // Format public signals as hex strings
  // bb.js returns publicInputs as hex strings (already 0x-prefixed)
  // zkverify docs show: publicInputs.split("\n").slice(0,-1) - simple array of strings
  const publicSignals = proof.publicInputs.map(input => {
    const inputStr = String(input);
    // Keep the format as-is - zkverify expects hex strings
    return inputStr;
  });

  // Build payload matching zkverify docs exactly
  // From docs: { proofType, vkRegistered, proofData: { proof, publicSignals, vk } }
  const payload: KurierSubmitPayload = {
    proofType: 'ultrahonk',
    vkRegistered,
    proofData: {
      proof: proofHex,
      publicSignals,
      vk: vkHex,
    },
  };

  zkLog(`   Payload structure: proofType=${payload.proofType}, vkRegistered=${vkRegistered}`);
  zkLog(`   Proof hex length: ${proofHex.length} chars`);
  zkLog(`   VK hex length: ${vkHex.length} chars`);
  zkLog(`   Public signals count: ${publicSignals.length}`);
  zkLog(`   Public signals sample: ${JSON.stringify(publicSignals.slice(0, 2))}`);
  
  // Debug: Log first few chars of proof and VK to help diagnose format issues
  zkLog(`   Proof starts with: ${proofHex.substring(0, 30)}...`);
  zkLog(`   VK starts with: ${vkHex.substring(0, 30)}...`);
  
  // Log full payload structure (without full hex values) for debugging
  zkLog(`   Full payload structure:`, JSON.stringify({
    proofType: payload.proofType,
    vkRegistered: payload.vkRegistered,
    proofData: {
      proof: `${proofHex.substring(0, 20)}... (${proofHex.length} chars)`,
      publicSignals: `[${publicSignals.length} items]`,
      vk: `${vkHex.substring(0, 20)}... (${vkHex.length} chars)`,
    },
  }));

  const url = `${KURIER_API_BASE}/submit-proof/${KURIER_API_KEY}`;

  try {
    zkLog(`   Sending POST to: ${url.replace(KURIER_API_KEY!, '***')}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (!response.ok) {
      zkError(`API error (${response.status}):`, data);
      // Log full error details for debugging
      if (data.details) {
        zkError(`   Validation errors:`, JSON.stringify(data.details, null, 2));
      }
      if (data.code) {
        zkError(`   Error code: ${data.code}`);
      }
      // Construct detailed error message
      const errorDetails = data.details?.map((d: { path: string; message: string }) => 
        `${d.path}: ${d.message}`
      ).join('; ') || '';
      const errorMessage = [data.message, data.error, errorDetails, `HTTP ${response.status}`]
        .filter(Boolean)
        .join(' - ');
      throw new Error(errorMessage);
    }

    zkLog(`Proof submitted successfully`);
    zkLog(`   Job ID: ${data.jobId}`);
    if (data.optimisticVerify) {
      zkLog(`   Optimistic verify: ${data.optimisticVerify}`);
    }

    return data as KurierSubmitResponse;
  } catch (error) {
    zkError('Failed to submit proof:', error);
    throw error;
  }
}


/**
 * Check the verification status of a submitted proof
 */
export async function getVerificationStatus(
  jobId: string
): Promise<KurierVerificationStatus> {
  if (!KURIER_API_KEY) {
    throw new Error('KURIER_API_KEY is not configured');
  }

  const url = `${KURIER_API_BASE}/job-status/${KURIER_API_KEY}/${jobId}`;

  try {
    zkLog(`Checking status for job: ${jobId}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      zkError(`Status check failed (${response.status}):`, data);
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    zkLog(`   Status: ${data.status}`);
    if (data.txHash) {
      zkLog(`   TX Hash: ${data.txHash}`);
    }

    return data as KurierVerificationStatus;
  } catch (error) {
    zkError('Failed to get verification status:', error);
    throw error;
  }
}

/**
 * Check if a job status indicates completion (success or failure)
 */
function isTerminalStatus(status: KurierJobStatus): boolean {
  return ['Finalized', 'Aggregated', 'AggregationPublished', 'Failed'].includes(status);
}

/**
 * Check if a job status indicates successful verification
 */
function isSuccessStatus(status: KurierJobStatus): boolean {
  return ['Finalized', 'Aggregated', 'AggregationPublished'].includes(status);
}

/**
 * Wait for a proof to be verified on-chain
 * Polls the status until verified or failed
 */
export async function waitForVerification(
  jobId: string,
  onStatusUpdate?: (status: KurierVerificationStatus) => void
): Promise<KurierVerificationStatus> {
  zkLog(`Waiting for verification of job: ${jobId}`);

  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const status = await getVerificationStatus(jobId);
    
    if (onStatusUpdate) {
      onStatusUpdate(status);
    }

    if (isSuccessStatus(status.status)) {
      zkLog(`Proof verified on-chain`);
      if (status.txHash) {
        zkLog(`   TX: ${status.txHash}`);
      }
      if (status.txExplorerUrl) {
        zkLog(`   Explorer: ${status.txExplorerUrl}`);
      }
      return status;
    }

    if (status.status === 'Failed') {
      zkError(`Verification failed: ${status.error || 'Unknown error'}`);
      throw new Error(`Verification failed: ${status.error || 'Unknown error'}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    attempts++;
    
    if (attempts % 10 === 0) {
      zkLog(`   Still waiting... (attempt ${attempts}/${MAX_POLL_ATTEMPTS})`);
    }
  }

  throw new Error('Verification timeout - max polling attempts exceeded');
}

export interface BatchProof {
  circuitName: string;
  proof: ZKProof;
  metadata?: Record<string, string>;
}

export interface BatchSubmitResult {
  successful: Array<{ circuitName: string; jobId: string }>;
  failed: Array<{ circuitName: string; error: string }>;
}

/**
 * Submit multiple proofs in parallel
 */
export async function submitProofsBatch(
  proofs: BatchProof[]
): Promise<BatchSubmitResult> {
  zkLog(`Submitting batch of ${proofs.length} proofs...`);

  const results = await Promise.allSettled(
    proofs.map(p => submitProofToZkVerify(p))
  );

  const successful: Array<{ circuitName: string; jobId: string }> = [];
  const failed: Array<{ circuitName: string; error: string }> = [];

  results.forEach((result, index) => {
    const circuitName = proofs[index].circuitName;
    
    if (result.status === 'fulfilled') {
      successful.push({ circuitName, jobId: result.value.jobId });
    } else {
      failed.push({ 
        circuitName, 
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error' 
      });
    }
  });

  zkLog(`Batch complete: ${successful.length} successful, ${failed.length} failed`);
  return { successful, failed };
}

/**
 * Register a verification key with zkVerify
 * This is typically done once per circuit deployment
 */
export async function registerVerificationKey(
  circuitName: string,
  vk: Uint8Array
): Promise<RegisterVKResponse> {
  if (!KURIER_API_KEY) {
    throw new Error('KURIER_API_KEY is not configured');
  }

  zkLog(`Registering VK for circuit: ${circuitName}`);

  const url = `${KURIER_API_BASE}/register-vk/${KURIER_API_KEY}`;

  // From zkverify docs: { proofType, vk }
  const payload = {
    proofType: 'ultrahonk',
    vk: proofToHex(vk),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (!response.ok) {
      zkError(`VK registration failed (${response.status}):`, data);
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    zkLog(`VK registered with hash: ${data.vkHash}`);
    return data as RegisterVKResponse;
  } catch (error) {
    zkError('Failed to register VK:', error);
    throw error;
  }
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  timestamp: string;
}

// Cache the health status to avoid spamming requests
let cachedHealthStatus: HealthStatus | null = null;
let lastHealthCheck = 0;
const HEALTH_CHECK_CACHE_MS = 60000; // Cache for 1 minute

/**
 * Check if the Kurier API is available
 * Uses the /status endpoint
 */
export async function checkKurierHealth(): Promise<HealthStatus> {
  const now = Date.now();
  
  // Return cached status if still valid
  if (cachedHealthStatus && (now - lastHealthCheck) < HEALTH_CHECK_CACHE_MS) {
    return cachedHealthStatus;
  }

  // If no API key, mark as not configured
  if (!KURIER_API_KEY) {
    cachedHealthStatus = {
      status: 'down',
      version: 'not-configured',
      timestamp: new Date().toISOString(),
    };
    lastHealthCheck = now;
    return cachedHealthStatus;
  }

  try {
    const url = `${KURIER_API_BASE}/status`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data: KurierStatusResponse = await response.json();
      cachedHealthStatus = {
        status: 'healthy',
        version: data.version || 'kurier-api',
        timestamp: new Date().toISOString(),
      };
      zkLog(`Kurier API healthy (${cachedHealthStatus.version})`);
    } else {
      cachedHealthStatus = {
        status: 'degraded',
        version: 'unknown',
        timestamp: new Date().toISOString(),
      };
      zkLog(`Kurier API degraded (HTTP ${response.status})`);
    }
  } catch (error) {
    // Network error or CORS - just assume it's available if key is set
    // The actual submission will fail if there's a real issue
    cachedHealthStatus = {
      status: 'healthy',
      version: 'assumed-available',
      timestamp: new Date().toISOString(),
    };
    zkLog(`Kurier API assumed available (key configured)`);
  }
  
  lastHealthCheck = now;
  return cachedHealthStatus;
}

/**
 * Check if Kurier is configured and available
 */
export async function isKurierAvailable(): Promise<boolean> {
  if (!KURIER_API_KEY) {
    zkLog('WARNING: Kurier API key not configured');
    return false;
  }

  try {
    const health = await checkKurierHealth();
    const available = health.status !== 'down';
    zkLog(`Kurier available: ${available}`);
    return available;
  } catch {
    return false;
  }
}

export type { HealthStatus };
