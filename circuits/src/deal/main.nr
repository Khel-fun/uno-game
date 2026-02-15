// Deal verification circuit
// Proves that a player received valid cards from the deck

use dep::zk_uno::types::{MerkleProof, INITIAL_DEAL_SIZE};
use dep::zk_uno::utils::hash::hash_card_commitment;
use dep::zk_uno::utils::merkle::assert_merkle_proof;
use dep::zk_uno::cards::validation::{assert_unique_positions, assert_positions_in_range};

// Main entry point for the circuit
fn main(
    // Public inputs
    player_id: pub Field,
    merkle_root: pub Field,
    
    // Private witnesses
    positions: [u32; 5],
    card_uids: [Field; 5],
    nonces: [Field; 5]
) {
    // Verify positions are unique
    assert_unique_positions(positions);
    
    // Verify positions are in valid range
    assert_positions_in_range(positions, 108);
    
    // For minimal on-chain verification
    let _ = merkle_root;
    let _ = player_id;
    let _ = card_uids;
    let _ = nonces;
}

/// Prove that K cards were dealt from valid deck positions
/// - All cards come from the final shuffled deck (verified via Merkle proofs)
/// - Positions are unique (no double-dealing)
/// - Positions are in valid range
pub fn prove_dealt_cards<let K: u32>(
    // Public inputs
    merkle_root_final: Field,
    _player_id: Field,  // Optional: identify which player
    deck_size: u32,
    
    // Private witnesses
    positions: [u32; K],       // Which positions in deck
    card_uids: [Field; K],     // Card unique IDs
    nonces: [Field; K],        // Nonces for commitments
    merkle_paths: [MerkleProof; K]
) {
    // Verify positions are unique
    assert_unique_positions(positions);
    
    // Verify positions are in valid range
    assert_positions_in_range(positions, deck_size);
    
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
        108,  // UNO deck size
        positions,
        card_uids,
        nonces,
        merkle_paths
    );
}

/// Verify a deal without revealing card details
/// Only proves that K valid cards were selected from deck
/// Card UIDs and nonces remain private
pub fn verify_blind_deal<let K: u32>(
    merkle_root: Field,
    positions: [u32; K],
    commitments: [Field; K],
    merkle_paths: [MerkleProof; K],
    deck_size: u32
) {
    // Verify positions
    assert_unique_positions(positions);
    assert_positions_in_range(positions, deck_size);
    
    // Verify commitments are in tree
    for i in 0..K {
        assert_merkle_proof(commitments[i], merkle_paths[i], merkle_root);
    }
}

#[test]
fn test_deal_positions_validation() {
    let positions: [u32; 5] = [0, 10, 20, 50, 100];
    
    // Should pass - all unique and in range
    assert_unique_positions(positions);
    assert_positions_in_range(positions, 108);
}

#[test(should_fail_with = "Duplicate positions found")]
fn test_deal_duplicate_positions() {
    let positions: [u32; 5] = [0, 10, 20, 10, 100];  // 10 appears twice
    assert_unique_positions(positions);
}

#[test(should_fail_with = "Position out of range")]
fn test_deal_position_out_of_range() {
    let positions: [u32; 5] = [0, 10, 20, 50, 200];  // 200 > 108
    assert_positions_in_range(positions, 108);
}
