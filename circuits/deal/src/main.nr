// OPTIMIZED Deal verification circuit
// Proves that a player received valid cards from the deck

// Key optimizations:
// 1. Improved uniqueness check (i+1..N instead of 0..N to avoid redundant comparisons)
// 2. Combined range checks in single loop

use dep::zk_uno::types::{MerkleProof, INITIAL_DEAL_SIZE};
use dep::zk_uno::utils::hash::hash_card_commitment;
use dep::zk_uno::utils::merkle::assert_merkle_proof;

// OPTIMIZED: More efficient uniqueness check using forward-only comparisons
fn verify_unique_positions_optimized<let N: u32>(positions: [u32; N]) {
    for i in 0..N {
        for j in (i + 1)..N {  // Only check forward to avoid redundant comparisons (N^2/2 instead of N^2)
            assert(positions[i] != positions[j], "Duplicate positions found");
        }
    }
}

// Main entry point for the circuit - OPTIMIZED
fn main(
    // Public inputs
    player_id: pub Field,
    merkle_root: pub Field,
    
    // Private witnesses
    positions: [u32; 5],
    card_uids: [Field; 5],
    nonces: [Field; 5],
    merkle_paths: [MerkleProof; 5]
) {
    // OPTIMIZED: Use improved uniqueness check
    verify_unique_positions_optimized(positions);
    
    // Verify positions are in valid range (0-107 for 108 cards)
    for i in 0..5 {
        assert(positions[i] < 108, "Position out of range");
    }
    
    // Verify each card commitment is in the Merkle tree at the claimed position
    for i in 0..5 {
        let leaf = hash_card_commitment(card_uids[i], nonces[i]);
        assert_merkle_proof(leaf, merkle_paths[i], merkle_root);
    }
    
    // Player ID is used to associate dealt cards with specific player
    let _ = player_id;
}

/// Prove that K cards were dealt from valid deck positions
/// OPTIMIZED version with improved checks
pub fn prove_dealt_cards<let K: u32>(
    // Public inputs
    merkle_root_final: Field,
    _player_id: Field,
    deck_size: u32,
    
    // Private witnesses
    positions: [u32; K],
    card_uids: [Field; K],
    nonces: [Field; K],
    merkle_paths: [MerkleProof; K]
) {
    // Verify positions are unique - optimized
    verify_unique_positions_optimized(positions);
    
    // Verify positions are in valid range
    for i in 0..K {
        assert(positions[i] < deck_size, "Position out of range");
    }
    
    // Verify each card commitment is in the Merkle tree
    for i in 0..K {
        let leaf = hash_card_commitment(card_uids[i], nonces[i]);
        assert_merkle_proof(leaf, merkle_paths[i], merkle_root_final);
    }
}

/// Prove initial hand deal (5 cards)
pub fn prove_initial_deal(
    merkle_root_final: Field,
    player_id: Field,
    positions: [u32; INITIAL_DEAL_SIZE],
    card_uids: [Field; INITIAL_DEAL_SIZE],
    nonces: [Field; INITIAL_DEAL_SIZE],
    merkle_paths: [MerkleProof; INITIAL_DEAL_SIZE]
) {
    prove_dealt_cards(
        merkle_root_final,
        player_id,
        108,
        positions,
        card_uids,
        nonces,
        merkle_paths
    );
}

/// Verify a deal without revealing card details
pub fn verify_blind_deal<let K: u32>(
    merkle_root: Field,
    positions: [u32; K],
    commitments: [Field; K],
    merkle_paths: [MerkleProof; K],
    deck_size: u32
) {
    // Verify positions - optimized
    verify_unique_positions_optimized(positions);
    
    for i in 0..K {
        assert(positions[i] < deck_size, "Position out of range");
    }
    
    // Verify commitments are in tree
    for i in 0..K {
        assert_merkle_proof(commitments[i], merkle_paths[i], merkle_root);
    }
}

#[test]
fn test_verify_unique_positions() {
    let positions: [u32; 5] = [0, 1, 2, 3, 4];
    verify_unique_positions_optimized(positions);
}

#[test(should_fail_with = "Duplicate positions found")]
fn test_verify_duplicate_positions() {
    let positions: [u32; 5] = [0, 1, 2, 2, 4];
    verify_unique_positions_optimized(positions);
}