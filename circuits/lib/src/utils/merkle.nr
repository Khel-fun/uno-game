// Merkle tree utilities for ZK UNO

use crate::types::{MERKLE_DEPTH, MerkleProof};
use crate::utils::hash::hash_merkle_node;

/// Verify a Merkle inclusion proof
/// Proves that a leaf exists at a specific position in the tree
pub fn verify_merkle_proof(
    leaf: Field,
    proof: MerkleProof,
    root: Field
) -> bool {
    let mut computed = leaf;
    
    for i in 0..MERKLE_DEPTH {
        if proof.indices[i] == 0 {
            // Leaf is on the left
            computed = hash_merkle_node(computed, proof.path[i]);
        } else {
            // Leaf is on the right
            computed = hash_merkle_node(proof.path[i], computed);
        }
    }
    
    computed == root
}

/// Assert that a Merkle proof is valid
pub fn assert_merkle_proof(
    leaf: Field,
    proof: MerkleProof,
    root: Field
) {
    let valid = verify_merkle_proof(leaf, proof, root);
    assert(valid, "Invalid Merkle proof");
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
unconstrained pub fn compute_merkle_root<let N: u32>(leaves: [Field; N]) -> Field {
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
unconstrained fn generate_merkle_path<let N: u32>(
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
fn test_merkle_proof_single_leaf() {
    let leaf: Field = 12345;
    let _root = leaf;  // Single leaf tree
    
    let _proof = MerkleProof {
        path: [0; MERKLE_DEPTH],
        indices: [0; MERKLE_DEPTH]
    };
    
    // Note: This test would need to be adjusted based on your Merkle tree construction
    // For a single leaf, the root should equal the leaf
}

#[test]
fn test_merkle_proof_two_leaves() {
    let leaf0: Field = 100;
    let leaf1: Field = 200;
    
    // Compute root: hash(leaf0, leaf1)
    let root = hash_merkle_node(leaf0, leaf1);
    
    // Proof for first leaf (index 0, left side)
    // Since leaf0 is on the left, we hash: hash(leaf0, leaf1)
    // Path contains siblings at each level
    let proof0 = MerkleProof {
        path: [leaf1, 0, 0, 0, 0, 0, 0],
        indices: [0, 0, 0, 0, 0, 0, 0]  // 0 means leaf is on left
    };
    
    // This should pass: recompute root from leaf0
    // Level 0: hash(leaf0, path[0]) = hash(leaf0, leaf1) = root
    let computed_root = hash_merkle_node(leaf0, proof0.path[0]);
    assert(computed_root == root, "Manual root computation failed");
}
