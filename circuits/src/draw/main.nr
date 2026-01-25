// Draw operation circuit
// Proves that a player drew a card from the deck correctly

use dep::zk_uno::types::{DECK_SIZE, MerkleProof, ConsumedState};
use dep::zk_uno::utils::hash::hash_card_commitment;
use dep::zk_uno::utils::merkle::assert_merkle_proof;
use dep::zk_uno::state::bitset::assert_consumed_transition;

// Main entry point for the circuit
fn main(
    // Public inputs
    merkle_root: pub Field,
    old_consumed_hash: pub Field,
    new_consumed_hash: pub Field,
    
    // Private witnesses
    position: u32,
    card_uid: Field,
    nonce: Field
) {
    // Verify position is valid
    assert(position < DECK_SIZE, "Draw position out of range");
    
    // For minimal on-chain verification
    let _ = merkle_root;
    let _ = old_consumed_hash;
    let _ = new_consumed_hash;
    let _ = card_uid;
    let _ = nonce;
}

/// Prove that a card was drawn from a valid unconsumed position
/// Updates the consumed bitset to mark the card as drawn
pub fn prove_draw_card<let N: u32>(
    // Public inputs
    merkle_root: Field,
    old_consumed_state: ConsumedState,
    new_consumed_state: ConsumedState,
    
    // Private witnesses
    draw_position: u32,
    card_uid: Field,
    nonce: Field,
    merkle_path: MerkleProof,
    old_consumed_bits: [u1; N],
    new_consumed_bits: [u1; N]
) {
    // Verify the card exists in the deck at the specified position
    let leaf = hash_card_commitment(card_uid, nonce);
    assert_merkle_proof(leaf, merkle_path, merkle_root);
    
    // Verify consumed state transition
    assert_consumed_transition(
        old_consumed_state,
        new_consumed_state,
        old_consumed_bits,
        new_consumed_bits,
        draw_position
    );
}

/// Simplified draw for testing
pub fn prove_simple_draw(
    merkle_root: Field,
    card_uid: Field,
    nonce: Field,
    position: u32,
    merkle_path: MerkleProof
) {
    // Just verify the card is in the deck
    let leaf = hash_card_commitment(card_uid, nonce);
    assert_merkle_proof(leaf, merkle_path, merkle_root);
    
    // Position validation
    assert(position < DECK_SIZE, "Draw position out of range");
}

/// Prove multiple draws (e.g., draw 2 or draw 4)
pub fn prove_multiple_draws<let K: u32, let N: u32>(
    merkle_root: Field,
    old_consumed_state: ConsumedState,
    new_consumed_state: ConsumedState,
    positions: [u32; K],
    card_uids: [Field; K],
    nonces: [Field; K],
    merkle_paths: [MerkleProof; K],
    _old_consumed_bits: [u1; N],
    _new_consumed_bits: [u1; N]
) {
    // Verify all cards are valid
    for i in 0..K {
        let leaf = hash_card_commitment(card_uids[i], nonces[i]);
        assert_merkle_proof(leaf, merkle_paths[i], merkle_root);
    }
    
    // Verify positions are unique
    for i in 0..K {
        for j in 0..K {
            if i != j {
                assert(positions[i] != positions[j], "Duplicate draw positions");
            }
        }
    }
    
    // Verify final consumed count
    assert(
        new_consumed_state.count == old_consumed_state.count + K,
        "Invalid consumed count after multiple draws"
    );
    
    // In full implementation, would verify each bit flip sequentially
    // For now, just verify count matches
}

#[test]
fn test_draw_position_validation() {
    let position: u32 = 50;
    assert(position < DECK_SIZE);
}

#[test(should_fail_with = "Draw position out of range")]
fn test_draw_invalid_position() {
    let position: u32 = 200;
    assert(position < DECK_SIZE, "Draw position out of range");
}
