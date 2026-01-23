// Dynamic imports for WASM modules - these will only be loaded on the client
type NoirType = typeof import('@noir-lang/noir_js').Noir;
type UltraHonkBackendType = typeof import('@aztec/bb.js').UltraHonkBackend;
type BarretenbergType = typeof import('@aztec/bb.js').Barretenberg;
type CompiledCircuitType = import('@noir-lang/types').CompiledCircuit;
type InputMapType = import('@noir-lang/types').InputMap;

import {
  Field,
  ZKProof,
  VerificationResult,
  CIRCUIT_ARTIFACTS,
  CircuitArtifact,
  ShuffleCircuitInput,
  DealCircuitInput,
  DrawCircuitInput,
  PlayCircuitInput,
} from './types';

/**
 * Convert a Field (hex string or bigint) to decimal string for Noir
 * Noir circuits expect field elements as decimal strings, not hex
 */
function fieldToDecimalString(field: Field | number | undefined | null): string {
  if (field === undefined || field === null) {
    return '0';
  }
  if (typeof field === 'bigint') {
    return field.toString();
  }
  if (typeof field === 'number') {
    return field.toString();
  }
  if (typeof field === 'string') {
    if (!field || field === '0x' || field === '') {
      return '0';
    }
    if (field.startsWith('0x') || field.startsWith('0X')) {
      try {
        return BigInt(field).toString();
      } catch {
        console.error('[ZK] Failed to convert hex to decimal:', field);
        return '0';
      }
    }
    // Already decimal or other format
    return field;
  }
  return '0';
}

let Noir: NoirType | null = null;
let UltraHonkBackend: UltraHonkBackendType | null = null;
let Barretenberg: BarretenbergType | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let barretenbergApi: any = null;
let modulesLoaded = false;
let wasmInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize WASM modules for Noir
 * This must be called before any Noir operations
 * Uses explicit WASM URL fetching per NoirJS documentation
 */
async function initializeWasm(): Promise<void> {
  if (wasmInitialized) return;
  
  console.log('[ZK] Initializing WASM modules...');
  
  try {
    // Import WASM initialization functions
    const [initNoirC, initACVM] = await Promise.all([
      import('@noir-lang/noirc_abi').then(m => m.default),
      import('@noir-lang/acvm_js').then(m => m.default),
    ]);
    
    // Initialize WASM modules - the init functions handle their own WASM loading
    // in Node.js/browser environments when called without arguments
    await Promise.all([
      initACVM(),
      initNoirC(),
    ]);
    
    wasmInitialized = true;
    console.log('[ZK] WASM modules initialized successfully');
  } catch (error) {
    console.error('[ZK] Failed to initialize WASM modules:', error);
    throw new Error(`WASM initialization failed: ${error}`);
  }
}

async function loadModules(): Promise<void> {
  // Use a singleton promise to prevent duplicate initialization
  if (initializationPromise) {
    return initializationPromise;
  }
  
  if (modulesLoaded) return;
  
  if (typeof window === 'undefined') {
    throw new Error('ZK modules can only be loaded in the browser');
  }

  initializationPromise = (async () => {
    console.log('[ZK] Loading Noir and Barretenberg modules...');
    
    try {
      // First initialize WASM modules
      await initializeWasm();
      
      // Then load the main modules
      const [noirModule, bbModule] = await Promise.all([
        import('@noir-lang/noir_js'),
        import('@aztec/bb.js'),
      ]);

      Noir = noirModule.Noir as unknown as NoirType;
      UltraHonkBackend = bbModule.UltraHonkBackend as unknown as UltraHonkBackendType;
      Barretenberg = bbModule.Barretenberg as unknown as BarretenbergType;
      
      // Initialize Barretenberg API for advanced operations
      console.log('[ZK] Initializing Barretenberg API...');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      barretenbergApi = await (Barretenberg as any).new();
      console.log('[ZK] Barretenberg API initialized successfully');
      
      modulesLoaded = true;
      console.log('[ZK] All modules loaded successfully');
    } catch (error) {
      console.error('[ZK] Failed to load modules:', error);
      initializationPromise = null; // Reset to allow retry
      throw error;
    }
  })();
  
  return initializationPromise;
}

interface CachedCircuit {
  compiled: CompiledCircuitType;
  noir: InstanceType<NoirType>;
  backend: InstanceType<UltraHonkBackendType>;
  vk: Uint8Array | null;
}

const circuitCache: Map<string, CachedCircuit> = new Map();
async function loadCircuit(artifact: CircuitArtifact): Promise<CachedCircuit> {
  await loadModules();
  if (!Noir || !UltraHonkBackend) {
    throw new Error('Modules not loaded');
  }

  const cached = circuitCache.get(artifact.name);
  if (cached) {
    return cached;
  }

  console.log(`[ZK] Loading circuit: ${artifact.name}`);

  // Fetch the compiled circuit JSON
  const response = await fetch(artifact.circuitPath);
  if (!response.ok) {
    throw new Error(`Failed to load circuit ${artifact.name}: ${response.statusText}`);
  }

  const compiled: CompiledCircuitType = await response.json();

  // Initialize Noir and backend
  // bb.js 3.0.0: UltraHonkBackend takes bytecode and barretenberg API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noir = new (Noir as any)(compiled);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const backend = new (UltraHonkBackend as any)(compiled.bytecode, barretenbergApi);

  // Try to load verification key if it exists
  let vk: Uint8Array | null = null;
  try {
    const vkResponse = await fetch(artifact.vkPath);
    if (vkResponse.ok) {
      const vkBuffer = await vkResponse.arrayBuffer();
      vk = new Uint8Array(vkBuffer);
    }
  } catch {
    console.log(`[ZK] No precomputed VK for ${artifact.name}, will generate on first proof`);
  }

  const circuitData: CachedCircuit = { compiled, noir, backend, vk };
  circuitCache.set(artifact.name, circuitData);

  console.log(`[ZK] Circuit ${artifact.name} loaded successfully`);
  return circuitData;
}

/**
 * Get or generate verification key for a circuit
 * Uses keccakZK option for EVM-compatible ZK verification
 * (BaseZKHonkVerifier requires ZK-enabled proofs)
 */
async function getVerificationKey(circuit: CachedCircuit): Promise<Uint8Array> {
  if (circuit.vk) {
    return circuit.vk;
  }

  console.log('[ZK] Generating verification key (keccakZK for EVM ZK verifiers)...');
  const vk = await circuit.backend.getVerificationKey({ keccakZK: true });
  circuit.vk = vk;
  return vk;
}

async function generateProof(
  circuitName: string,
  inputs: InputMapType
): Promise<ZKProof> {
  const artifact = CIRCUIT_ARTIFACTS[circuitName];
  if (!artifact) {
    throw new Error(`Unknown circuit: ${circuitName}`);
  }

  console.log(`[ZK] Generating proof for ${circuitName}...`);
  console.log(`[ZK] Circuit inputs:`, JSON.stringify(inputs, null, 2));
  
  // Validate inputs - check for empty hex values
  const validateInputs = (obj: Record<string, unknown>, path = ''): void => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      if (value === '0x' || value === '' || value === undefined || value === null) {
        console.error(`[ZK] Invalid input at ${currentPath}:`, value);
        throw new Error(`Invalid circuit input at ${currentPath}: ${value}`);
      }
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, i) => {
            if (typeof item === 'object' && item !== null) {
              validateInputs(item as Record<string, unknown>, `${currentPath}[${i}]`);
            } else if (item === '0x' || item === '' || item === undefined || item === null) {
              console.error(`[ZK] Invalid input at ${currentPath}[${i}]:`, item);
              throw new Error(`Invalid circuit input at ${currentPath}[${i}]: ${item}`);
            }
          });
        } else {
          validateInputs(value as Record<string, unknown>, currentPath);
        }
      }
    }
  };
  
  try {
    validateInputs(inputs as Record<string, unknown>);
  } catch (e) {
    console.error('[ZK] Input validation failed:', e);
    throw e;
  }
  
  const startTime = performance.now();

  const circuit = await loadCircuit(artifact);

  // Execute the circuit to get the witness
  console.log(`[ZK] Executing circuit with inputs...`);
  const { witness } = await circuit.noir.execute(inputs);

  // Generate the proof with keccakZK option for EVM-compatible ZK verification
  // (BaseZKHonkVerifier contracts require ZK-enabled proofs)
  console.log(`[ZK] Generating proof (keccakZK for EVM ZK verifiers)...`);
  const proof = await circuit.backend.generateProof(witness, { keccakZK: true });

  // Get verification key
  const vk = await getVerificationKey(circuit);

  const endTime = performance.now();
  console.log(`[ZK] Proof generated in ${(endTime - startTime).toFixed(0)}ms`);

  return {
    proof: proof.proof,
    publicInputs: proof.publicInputs as Field[],
    verificationKey: vk,
  };
}

/**
 * Verify a proof locally
 */
async function verifyProofLocally(
  circuitName: string,
  proof: ZKProof
): Promise<VerificationResult> {
  const artifact = CIRCUIT_ARTIFACTS[circuitName];
  if (!artifact) {
    return { valid: false, error: `Unknown circuit: ${circuitName}` };
  }

  try {
    console.log(`[ZK] Verifying proof for ${circuitName}...`);
    const circuit = await loadCircuit(artifact);
    
    // Use keccakZK option for EVM-compatible ZK verification
    const isValid = await circuit.backend.verifyProof({
      proof: proof.proof,
      publicInputs: proof.publicInputs as string[],
    }, { keccakZK: true });

    return { valid: isValid };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error',
    };
  }
}

export async function generateShuffleProof(
  input: ShuffleCircuitInput
): Promise<ZKProof> {
  return generateProof('shuffle', {
    uids_in: input.uids_in.map(String),
    uids_out: input.uids_out.map(String),
  });
}

/**
 * Generate a deal proof
 * Proves that cards were correctly dealt from the deck
 */
export async function generateDealProof(
  input: DealCircuitInput
): Promise<ZKProof> {
  return generateProof('deal', {
    player_id: String(input.player_id),
    merkle_root: String(input.merkle_root),
    positions: input.positions.map(String),
    card_uids: input.card_uids.map(String),
    nonces: input.nonces.map(String),
    merkle_paths: input.merkle_paths.map(mp => ({
      path: mp.path.map(String),
      indices: mp.indices.map(String),
    })),
  });
}

export async function generateDrawProof(
  input: DrawCircuitInput
): Promise<ZKProof> {
  // Convert all field values to decimal strings for Noir
  const circuitInput = {
    merkle_root: fieldToDecimalString(input.merkle_root),
    old_consumed_hash: fieldToDecimalString(input.old_consumed_hash),
    new_consumed_hash: fieldToDecimalString(input.new_consumed_hash),
    old_consumed_count: String(input.old_consumed_count),
    new_consumed_count: String(input.new_consumed_count),
    position: String(input.position),
    card_uid: fieldToDecimalString(input.card_uid),
    nonce: fieldToDecimalString(input.nonce),
    merkle_path: {
      path: input.merkle_path.path.map(fieldToDecimalString),
      indices: input.merkle_path.indices.map(String),
    },
    old_consumed_bits: input.old_consumed_bits.map(String),
    new_consumed_bits: input.new_consumed_bits.map(String),
  };
  
  console.log('[ZK] Draw circuit input:', {
    merkle_root: circuitInput.merkle_root.slice(0, 20) + '...',
    card_uid: circuitInput.card_uid.slice(0, 20) + '...',
    position: circuitInput.position,
  });
  
  return generateProof('draw', circuitInput);
}

export async function generatePlayProof(
  input: PlayCircuitInput
): Promise<ZKProof> {
  // Convert all field values to decimal strings for Noir
  const circuitInput = {
    game_id: fieldToDecimalString(input.game_id),
    player_id: fieldToDecimalString(input.player_id),
    move_commitment: fieldToDecimalString(input.move_commitment),
    hand_merkle_root: fieldToDecimalString(input.hand_merkle_root),
    top_card_commitment: fieldToDecimalString(input.top_card_commitment),
    played_card_color: String(input.played_card_color),
    played_card_type: String(input.played_card_type),
    played_card_copy: String(input.played_card_copy),
    played_card_nonce: fieldToDecimalString(input.played_card_nonce),
    played_card_merkle_path: {
      path: input.played_card_merkle_path.path.map(fieldToDecimalString),
      indices: input.played_card_merkle_path.indices.map(String),
    },
    top_card_color: String(input.top_card_color),
    top_card_type: String(input.top_card_type),
    top_card_copy: String(input.top_card_copy),
    top_card_nonce: fieldToDecimalString(input.top_card_nonce),
    commitment_nonce: fieldToDecimalString(input.commitment_nonce),
  };
  
  console.log('[ZK] Play circuit input:', {
    game_id: circuitInput.game_id,
    player_id: circuitInput.player_id,
    played_card_color: circuitInput.played_card_color,
    played_card_type: circuitInput.played_card_type,
  });
  
  return generateProof('play', circuitInput);
}

export async function verifyShuffleProof(proof: ZKProof): Promise<VerificationResult> {
  return verifyProofLocally('shuffle', proof);
}

export async function verifyDealProof(proof: ZKProof): Promise<VerificationResult> {
  return verifyProofLocally('deal', proof);
}

export async function verifyDrawProof(proof: ZKProof): Promise<VerificationResult> {
  return verifyProofLocally('draw', proof);
}

export async function verifyPlayProof(proof: ZKProof): Promise<VerificationResult> {
  return verifyProofLocally('play', proof);
}

export function proofToHex(proof: Uint8Array): string {
  return '0x' + Array.from(proof).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert hex string back to proof bytes
 */
export function hexToProof(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Preload all circuits for faster proof generation
 */
export async function preloadCircuits(): Promise<void> {
  console.log('[ZK] Preloading all circuits...');
  const startTime = performance.now();

  await Promise.all([
    loadCircuit(CIRCUIT_ARTIFACTS.shuffle),
    loadCircuit(CIRCUIT_ARTIFACTS.deal),
    loadCircuit(CIRCUIT_ARTIFACTS.draw),
    loadCircuit(CIRCUIT_ARTIFACTS.play),
  ]);

  const endTime = performance.now();
  console.log(`[ZK] All circuits preloaded in ${(endTime - startTime).toFixed(0)}ms`);
}

/**
 * Clear the circuit cache (useful for memory management)
 * Note: bb.js 3.0 UltraHonkBackend doesn't require explicit destroy
 */
export function clearCircuitCache(): void {
  circuitCache.clear();
  console.log('[ZK] Circuit cache cleared');
}

// Export types for external use
export type { ZKProof, VerificationResult };
