/**
 * ZK Cryptography Utilities
 * Uses Poseidon hash that matches Noir's external poseidon library
 * Migrated from Pedersen to Poseidon for zk-kit compatibility
 */

import { poseidon2, poseidon3, poseidon4 } from 'poseidon-lite';

// Domain separation constants (must match Noir circuits)
export const DOMAIN_CARD_UID = 1n;
export const DOMAIN_CARD_COMMITMENT = 2n;
export const DOMAIN_MERKLE_NODE = 3n;
export const DOMAIN_BITSET_COMPRESS = 4n;

export const MERKLE_DEPTH = 7;
export const DECK_SIZE = 108;

// BN254 field modulus
export const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Cached Barretenberg instance - still needed for proof generation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bbInstance: any = null;
let bbLoadPromise: Promise<void> | null = null;

/**
 * Initialize Barretenberg WASM (for proof generation)
 */
async function initBarretenberg(): Promise<typeof bbInstance> {
  if (bbInstance) return bbInstance;
  
  if (!bbLoadPromise) {
    bbLoadPromise = (async () => {
      if (typeof window === 'undefined') {
        throw new Error('Barretenberg can only be initialized in the browser');
      }
      
      const { Barretenberg } = await import('@aztec/bb.js');
      bbInstance = await Barretenberg.new();
      console.log('[ZK Crypto] Barretenberg initialized');
    })();
  }
  
  await bbLoadPromise;
  return bbInstance;
}

/**
 * Poseidon hash for 2 inputs
 * Matches Noir's poseidon::bn254::hash_2 exactly
 */
export function poseidonHash2(a: bigint, b: bigint): bigint {
  return poseidon2([a, b]);
}

/**
 * Poseidon hash for 3 inputs
 * Matches Noir's poseidon::bn254::hash_3 exactly
 */
export function poseidonHash3(a: bigint, b: bigint, c: bigint): bigint {
  return poseidon3([a, b, c]);
}

/**
 * Poseidon hash for 4 inputs
 * Matches Noir's poseidon::bn254::hash_4 exactly
 */
export function poseidonHash4(a: bigint, b: bigint, c: bigint, d: bigint): bigint {
  return poseidon4([a, b, c, d]);
}

/**
 * Hash a card commitment (Merkle leaf)
 * commitment = Poseidon(DOMAIN_CARD_COMMITMENT || card_uid || nonce)
 */
export function hashCardCommitment(cardUID: bigint, nonce: bigint): bigint {
  return poseidonHash3(DOMAIN_CARD_COMMITMENT, cardUID, nonce);
}

/**
 * Hash two Merkle tree nodes
 * node = Poseidon(left || right)
 * Note: No domain separation to be compatible with zk-kit LeanIMT
 */
export function hashMerkleNode(left: bigint, right: bigint): bigint {
  return poseidonHash2(left, right);
}

/**
 * Build a Merkle tree from leaves
 * Compatible with zk-kit LeanIMT
 */
export function buildMerkleTree(leaves: bigint[]): {
  root: bigint;
  layers: bigint[][];
} {
  // Pad leaves to power of 2
  const targetSize = Math.pow(2, MERKLE_DEPTH);
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length < targetSize) {
    paddedLeaves.push(0n);
  }
  
  const layers: bigint[][] = [paddedLeaves];
  let currentLayer = paddedLeaves;
  
  while (currentLayer.length > 1) {
    const nextLayer: bigint[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] ?? 0n;
      const parent = hashMerkleNode(left, right);
      nextLayer.push(parent);
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }
  
  return {
    root: currentLayer[0] ?? 0n,
    layers,
  };
}

/**
 * Generate a Merkle proof for a leaf at a given index
 */
export function generateMerkleProof(layers: bigint[][], index: number): {
  path: bigint[];
  indices: number[];
} {
  const path: bigint[] = [];
  const indices: number[] = [];
  
  let currentIndex = index;
  
  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i];
    const isRight = currentIndex % 2 === 1;
    const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
    
    path.push(layer[siblingIndex] ?? 0n);
    indices.push(isRight ? 1 : 0);
    
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  // Pad to MERKLE_DEPTH
  while (path.length < MERKLE_DEPTH) {
    path.push(0n);
    indices.push(0);
  }
  
  return { path, indices };
}

/**
 * Generate a random nonce
 */
export function generateNonce(): bigint {
  if (typeof window !== 'undefined' && window.crypto) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    let hex = '0x';
    bytes.forEach(b => hex += b.toString(16).padStart(2, '0'));
    return BigInt(hex) % FIELD_MODULUS;
  }
  // Fallback for non-browser
  return BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) % FIELD_MODULUS;
}

/**
 * Convert a field element to hex string
 */
export function fieldToHex(field: bigint): string {
  return '0x' + field.toString(16).padStart(64, '0');
}

/**
 * Convert hex string to field element
 */
export function hexToField(hex: string): bigint {
  if (!hex || hex === '0x' || hex === '') {
    console.warn('[ZK Crypto] hexToField received empty value:', hex);
    return 0n;
  }
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!cleanHex || cleanHex.length === 0) {
    console.warn('[ZK Crypto] hexToField has empty hex after cleanup:', hex);
    return 0n;
  }
  try {
    return BigInt('0x' + cleanHex);
  } catch (e) {
    console.error('[ZK Crypto] hexToField failed to parse:', hex, e);
    return 0n;
  }
}

// =====================================================
// LeanIMT Integration for zk-kit compatibility
// =====================================================

import { LeanIMT } from '@zk-kit/lean-imt';

/**
 * Hash function for LeanIMT - matches zk-kit binary_merkle_root
 */
export function leanIMTHash(a: bigint, b: bigint): bigint {
  return poseidonHash2(a, b);
}

/**
 * Create a LeanIMT instance with Poseidon hash
 * Compatible with zk-kit binary_merkle_root in Noir circuits
 */
export function createLeanIMT(leaves: bigint[] = []): LeanIMT<bigint> {
  const tree = new LeanIMT<bigint>(leanIMTHash);
  for (const leaf of leaves) {
    tree.insert(leaf);
  }
  return tree;
}

/**
 * Generate a Merkle proof from LeanIMT for use in Noir circuits
 * Returns the format expected by binary_merkle_root
 */
export function generateLeanIMTProof(tree: LeanIMT<bigint>, leafIndex: number): {
  leaf: bigint;
  siblings: bigint[];
  indices: number[];
  root: bigint;
} {
  const proof = tree.generateProof(leafIndex);
  
  // Convert siblings to fixed-size array for circuit
  const siblings: bigint[] = [...proof.siblings];
  const indices: number[] = [];
  
  // Calculate path indices from leaf index
  let idx = proof.index;
  for (let i = 0; i < proof.siblings.length; i++) {
    indices.push(idx & 1);
    idx >>= 1;
  }
  
  // Pad to MERKLE_DEPTH
  while (siblings.length < MERKLE_DEPTH) {
    siblings.push(0n);
    indices.push(0);
  }
  
  return {
    leaf: proof.leaf,
    siblings,
    indices,
    root: proof.root,
  };
}

/**
 * Verify a Merkle proof using LeanIMT verification
 */
export function verifyLeanIMTProof(
  leaf: bigint,
  siblings: bigint[],
  indices: number[],
  root: bigint
): boolean {
  let computed = leaf;
  
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i] === 0n && i >= Math.log2(DECK_SIZE)) {
      // Skip zero padding
      continue;
    }
    
    if (indices[i] === 0) {
      computed = leanIMTHash(computed, siblings[i]);
    } else {
      computed = leanIMTHash(siblings[i], computed);
    }
  }
  
  return computed === root;
}

// Export for backward compatibility - these are now synchronous
export { initBarretenberg };
