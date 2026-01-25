// Merkle tree utilities for ZK UNO
// Uses zk-kit binary_merkle_root for LeanIMT compatibility

// Import from external poseidon library (noir-lang/poseidon)
use poseidon::poseidon::bn254::hash_2;
use binary_merkle_root::binary_merkle_root;

use crate::types::{MERKLE_DEPTH, MerkleProof};
use crate::utils::hash::hash_merkle_node;

/// Poseidon hasher compatible with zk-kit LeanIMT
/// This is the hash function used for Merkle tree nodes
pub fn poseidon_hasher(inputs: [Field; 2]) -> Field {
    hash_2(inputs)
}

/// Calculate Merkle root using zk-kit binary_merkle_root
/// Compatible with LeanIMT in TypeScript (@zk-kit/lean-imt)
/// 
/// Parameters:
/// - leaf: The leaf value to verify
/// - depth: The actual depth of the proof (can be less than MAX_DEPTH)
/// - indices: Direction bits (0 = left, 1 = right) for each level
/// - siblings: Sibling hashes at each level
pub fn compute_merkle_root(
    leaf: Field,
    depth: u32,
    indices: [u1; MERKLE_DEPTH],
    siblings: [Field; MERKLE_DEPTH]
) -> Field {
    binary_merkle_root(poseidon_hasher, leaf, depth, indices, siblings)
}

/// Verify a Merkle inclusion proof using zk-kit binary_merkle_root
/// Proves that a leaf exists at a specific position in the tree
pub fn verify_merkle_proof(
    leaf: Field,
    proof: MerkleProof,
    root: Field
) -> bool {
    let computed_root = compute_merkle_root(leaf, MERKLE_DEPTH, proof.indices, proof.path);
    computed_root == root
}

/// Assert that a Merkle proof is valid
pub fn assert_merkle_proof(
    leaf: Field,
    proof: MerkleProof,
    root: Field
) {
    let computed_root = compute_merkle_root(leaf, MERKLE_DEPTH, proof.indices, proof.path);
    assert(computed_root == root, "Invalid Merkle proof");
}

/// Verify a Merkle proof with dynamic depth
/// Useful when the tree depth varies
pub fn verify_merkle_proof_with_depth(
    leaf: Field,
    depth: u32,
    indices: [u1; MERKLE_DEPTH],
    siblings: [Field; MERKLE_DEPTH],
    root: Field
) -> bool {
    let computed_root = binary_merkle_root(poseidon_hasher, leaf, depth, indices, siblings);
    computed_root == root
}

/// Assert a Merkle proof with dynamic depth
pub fn assert_merkle_proof_with_depth(
    leaf: Field,
    depth: u32,
    indices: [u1; MERKLE_DEPTH],
    siblings: [Field; MERKLE_DEPTH],
    root: Field
) {
    let computed_root = binary_merkle_root(poseidon_hasher, leaf, depth, indices, siblings);
    assert(computed_root == root, "Invalid Merkle proof");
}

/// Verify multiple Merkle proofs against the same root
pub fn verify_multiple_proofs<let N: u32>(
    leaves: [Field; N],
    proofs: [MerkleProof; N],
    root: Field
) -> bool {
    let mut all_valid = true;
    
    for i in 0..N {
        let valid = verify_merkle_proof(leaves[i], proofs[i], root);
        all_valid = all_valid & valid;
    }
    
    all_valid
}

/// Assert multiple Merkle proofs are valid
pub fn assert_multiple_proofs<let N: u32>(
    leaves: [Field; N],
    proofs: [MerkleProof; N],
    root: Field
) {
    for i in 0..N {
        assert_merkle_proof(leaves[i], proofs[i], root);
    }
}

/// Compute Merkle root from a set of leaves (for testing)
/// Note: This is expensive in-circuit and should only be used for small trees
unconstrained pub fn compute_merkle_root_from_leaves<let N: u32>(leaves: [Field; N]) -> Field {
    assert(N > 0, "Cannot compute root of empty tree");
    assert(N <= 128, "Tree too large for MERKLE_DEPTH=7");
    
    // Pad to next power of 2
    let mut padded_size = 1;
    while padded_size < N {
        padded_size *= 2;
    }
    
    let mut current_level: [Field; 128] = [0; 128];
    
    // Initialize first level with leaves
    for i in 0..N {
        current_level[i] = leaves[i];
    }
    // Pad with zeros
    for i in N..padded_size {
        current_level[i] = 0;
    }
    
    // Build tree bottom-up
    let mut level_size = padded_size;
    while level_size > 1 {
        for i in 0..(level_size / 2) {
            current_level[i] = hash_merkle_node(
                current_level[i * 2],
                current_level[i * 2 + 1]
            );
        }
        level_size /= 2;
    }
    
    current_level[0]
}

/// Generate a Merkle path for a specific leaf index (for testing)
/// This is used off-circuit to prepare witness data
unconstrained pub fn generate_merkle_path<let N: u32>(
    leaves: [Field; N],
    leaf_index: u32
) -> MerkleProof {
    assert(leaf_index < N, "Leaf index out of bounds");
    assert(N <= 128, "Tree too large");
    
    let mut path: [Field; MERKLE_DEPTH] = [0; MERKLE_DEPTH];
    let mut indices: [u1; MERKLE_DEPTH] = [0; MERKLE_DEPTH];
    
    // Pad to next power of 2
    let mut padded_size = 1;
    while padded_size < N {
        padded_size *= 2;
    }
    
    let mut current_level: [Field; 128] = [0; 128];
    for i in 0..N {
        current_level[i] = leaves[i];
    }
    for i in N..padded_size {
        current_level[i] = 0;
    }
    
    let mut current_index = leaf_index;
    let mut level_size = padded_size;
    let mut depth = 0;
    
    while level_size > 1 & depth < MERKLE_DEPTH {
        let sibling_index = if current_index % 2 == 0 {
            current_index + 1
        } else {
            current_index - 1
        };
        
        path[depth] = current_level[sibling_index];
        indices[depth] = (current_index % 2) as u1;
        
        // Build next level
        for i in 0..(level_size / 2) {
            current_level[i] = hash_merkle_node(
                current_level[i * 2],
                current_level[i * 2 + 1]
            );
        }
        
        current_index /= 2;
        level_size /= 2;
        depth += 1;
    }
    
    MerkleProof { path, indices }
}

#[test]
fn test_merkle_proof_two_leaves() {
    let leaf0: Field = 100;
    let leaf1: Field = 200;
    
    // Compute root: hash(leaf0, leaf1)
    let root = hash_merkle_node(leaf0, leaf1);
    
    // Proof for first leaf (index 0, left side)
    let proof0 = MerkleProof {
        path: [leaf1, 0, 0, 0, 0, 0, 0],
        indices: [0, 0, 0, 0, 0, 0, 0]  // 0 means leaf is on left
    };
    
    // Verify using binary_merkle_root with depth 1
    let computed_root = binary_merkle_root(poseidon_hasher, leaf0, 1, proof0.indices, proof0.path);
    assert(computed_root == root, "Merkle root computation failed");
}

#[test]
fn test_merkle_proof_four_leaves() {
    let leaf0: Field = 100;
    let leaf1: Field = 200;
    let leaf2: Field = 300;
    let leaf3: Field = 400;
    
    // Level 1 hashes
    let hash01 = hash_merkle_node(leaf0, leaf1);
    let hash23 = hash_merkle_node(leaf2, leaf3);
    
    // Root
    let root = hash_merkle_node(hash01, hash23);
    
    // Proof for leaf0 (index 0)
    // Path: [leaf1, hash23, 0, 0, 0, 0, 0]
    // Indices: [0, 0, ...] (left at both levels)
    let proof0 = MerkleProof {
        path: [leaf1, hash23, 0, 0, 0, 0, 0],
        indices: [0, 0, 0, 0, 0, 0, 0]
    };
    
    let computed_root = binary_merkle_root(poseidon_hasher, leaf0, 2, proof0.indices, proof0.path);
    assert(computed_root == root, "Merkle root computation failed for leaf0");
}
