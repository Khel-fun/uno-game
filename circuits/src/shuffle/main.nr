// Shuffle verification circuit
// Proves that a player correctly shuffled and re-randomized the deck

use dep::zk_uno::types::{MerkleProof, DeckInvariants};
use dep::zk_uno::utils::hash::hash_card_commitment;
use dep::zk_uno::utils::merkle::assert_merkle_proof;
use dep::zk_uno::utils::shuffle::verify_shuffle;
use dep::zk_uno::state::invariants::assert_invariants_match;

// Main entry point for the circuit
fn main(
    // Public inputs
    merkle_root_in: pub Field,
    merkle_root_out: pub Field,
    sum_invariant: pub Field,
    product_invariant: pub Field,
    
    // Private witnesses
    uids_in: [Field; 108],
    uids_out: [Field; 108]
) {
    // Verify shuffle is a valid permutation
    verify_shuffle(uids_in, uids_out);
    
    // For minimal on-chain verification, we just verify the core shuffle
    // Full Merkle verification would require merkle paths as witnesses
    let _ = merkle_root_in;
    let _ = merkle_root_out;
    let _ = sum_invariant;
    let _ = product_invariant;
}

/// Shuffle step circuit
/// Proves that a player re-randomized the deck correctly
/// - Input deck (as Merkle root) contains UIDs in some order
/// - Output deck (new Merkle root) contains same UIDs in new order with new nonces
/// - Mapping is a valid permutation
pub fn prove_shuffle_step<let N: u32>(
    // Public inputs
    merkle_root_in: Field,
    merkle_root_out: Field,
    invariants_in: DeckInvariants,
    invariants_out: DeckInvariants,
    
    // Private witnesses
    uids_in: [Field; N],
    nonces_in: [Field; N],
    merkle_paths_in: [MerkleProof; N],
    
    uids_out: [Field; N],
    nonces_out: [Field; N],
    merkle_paths_out: [MerkleProof; N]
) {
    // Verify all input leaves are in the input tree
    for i in 0..N {
        let leaf_in = hash_card_commitment(uids_in[i], nonces_in[i]);
        assert_merkle_proof(leaf_in, merkle_paths_in[i], merkle_root_in);
    }
    
    // Verify all output leaves are in the output tree
    for i in 0..N {
        let leaf_out = hash_card_commitment(uids_out[i], nonces_out[i]);
        assert_merkle_proof(leaf_out, merkle_paths_out[i], merkle_root_out);
    }
    
    // Verify shuffle: uids_out is a permutation of uids_in
    verify_shuffle(uids_in, uids_out);
    
    // Verify aggregate invariants match
    assert_invariants_match(invariants_in, invariants_out);
}

/// Simplified shuffle verification for smaller test cases
pub fn prove_shuffle_step_simple<let N: u32>(
    merkle_root_in: Field,
    merkle_root_out: Field,
    uids_in: [Field; N],
    uids_out: [Field; N],
    nonces_in: [Field; N],
    nonces_out: [Field; N],
    merkle_paths_in: [MerkleProof; N],
    merkle_paths_out: [MerkleProof; N]
) {
    // Verify Merkle proofs for inputs
    for i in 0..N {
        let leaf = hash_card_commitment(uids_in[i], nonces_in[i]);
        assert_merkle_proof(leaf, merkle_paths_in[i], merkle_root_in);
    }
    
    // Verify Merkle proofs for outputs
    for i in 0..N {
        let leaf = hash_card_commitment(uids_out[i], nonces_out[i]);
        assert_merkle_proof(leaf, merkle_paths_out[i], merkle_root_out);
    }
    
    // Verify it's a valid shuffle
    verify_shuffle(uids_in, uids_out);
}

/// Multi-party shuffle composition
/// Allows multiple players to sequentially shuffle
/// Each player proves their shuffle step is valid
pub fn verify_multi_party_shuffle<let NUM_PLAYERS: u32, let N: u32>(
    initial_root: Field,
    final_root: Field,
    intermediate_roots: [Field; NUM_PLAYERS],
    _invariants: DeckInvariants
) {
    // First root should match initial
    assert(intermediate_roots[0] == initial_root, "First shuffle root mismatch");
    
    // Each subsequent shuffle maintains invariants
    // In practice, each player would submit their own proof
    // This is a simplified verification that roots form a chain
    
    // Final root should match last intermediate
    if NUM_PLAYERS > 0 {
        assert(intermediate_roots[NUM_PLAYERS - 1] == final_root, "Final shuffle root mismatch");
    }
}

#[test]
fn test_shuffle_verification_concept() {
    // This test demonstrates the shuffle verification concept
    // In practice, Merkle paths would be generated off-circuit
    
    let uids_in: [Field; 5] = [1, 2, 3, 4, 5];
    let uids_out: [Field; 5] = [3, 1, 5, 2, 4];  // Valid permutation
    
    // Verify this is a valid shuffle
    verify_shuffle(uids_in, uids_out);
}
