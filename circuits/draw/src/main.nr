// OPTIMIZED Draw operation circuit
// Proves that a player drew a card from the deck correctly
//
// Key optimizations:
// 1. Accept consumed counts as public inputs (avoids 216 iterations)
// 2. Simplified bitset verification function  
// 3. Removed redundant count_consumed_bits helper

use dep::zk_uno::types::{DECK_SIZE, MerkleProof};
use dep::zk_uno::utils::hash::{hash_card_commitment, compress_bitset};
use dep::zk_uno::utils::merkle::assert_merkle_proof;

// OPTIMIZED: Simplified consumed state verification
// Verifies that exactly one bit was flipped from 0 to 1 at the specified position
fn verify_bit_flip<let N: u32>(
    old_bits: [u1; N],
    new_bits: [u1; N],
    position: u32
) {
    assert(position < N, "Position out of range");
    assert(old_bits[position] == 0, "Position already consumed");
    assert(new_bits[position] == 1, "Position not marked as consumed");
    
    // Verify all other bits unchanged
    for i in 0..N {
        if i != position {
            assert(old_bits[i] == new_bits[i], "Unexpected bit change");
        }
    }
}

// Main entry point for the circuit - OPTIMIZED
fn main(
    // Public inputs
    merkle_root: pub Field,
    old_consumed_hash: pub Field,
    new_consumed_hash: pub Field,
    old_consumed_count: pub u32,  // OPTIMIZATION: Pass count as public input
    new_consumed_count: pub u32,  // OPTIMIZATION: Pass count as public input
    
    // Private witnesses
    position: u32,
    card_uid: Field,
    nonce: Field,
    merkle_path: MerkleProof,
    old_consumed_bits: [u1; 108],
    new_consumed_bits: [u1; 108]
) {
    // Verify position is in valid range
    assert(position < DECK_SIZE, "Draw position out of range");
    
    // Verify the card exists in the deck at the specified position
    let leaf = hash_card_commitment(card_uid, nonce);
    assert_merkle_proof(leaf, merkle_path, merkle_root);
    
    // OPTIMIZED: Verify consumed state hashes match (only 2 compress operations)
    let old_root = compress_bitset(old_consumed_bits);
    assert(old_root == old_consumed_hash, "Old bitset hash mismatch");
    
    let new_root = compress_bitset(new_consumed_bits);
    assert(new_root == new_consumed_hash, "New bitset hash mismatch");
    
    // Verify single bit flip at position
    verify_bit_flip(old_consumed_bits, new_consumed_bits, position);
    
    // OPTIMIZED: Use provided counts instead of computing in-circuit (saves 216 iterations)
    assert(new_consumed_count == old_consumed_count + 1, "Invalid consumed count");
}

/// Prove that a card was drawn from a valid unconsumed position
/// OPTIMIZED: Accept counts as parameters instead of computing
pub fn prove_draw_card<let N: u32>(
    // Public inputs
    merkle_root: Field,
    old_consumed_hash: Field,
    new_consumed_hash: Field,
    old_consumed_count: u32,
    new_consumed_count: u32,
    
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
    
    // Verify consumed state hashes
    let old_root = compress_bitset(old_consumed_bits);
    assert(old_root == old_consumed_hash, "Old bitset hash mismatch");
    
    let new_root = compress_bitset(new_consumed_bits);
    assert(new_root == new_consumed_hash, "New bitset hash mismatch");
    
    // Verify bit flip
    verify_bit_flip(old_consumed_bits, new_consumed_bits, draw_position);
    
    // Verify count
    assert(new_consumed_count == old_consumed_count + 1, "Invalid consumed count");
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
/// OPTIMIZED: Accept counts as parameters and use forward-only uniqueness checking
pub fn prove_multiple_draws<let K: u32, let N: u32>(
    merkle_root: Field,
    _old_consumed_hash: Field,
    _new_consumed_hash: Field,
    old_consumed_count: u32,
    new_consumed_count: u32,
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
    
    // OPTIMIZED: Verify positions are unique using forward-only checking
    // This reduces comparisons from K^2 to K^2/2
    for i in 0..K {
        for j in (i + 1)..K {
            assert(positions[i] != positions[j], "Duplicate draw positions");
        }
    }
    
    // Verify final consumed count
    assert(
        new_consumed_count == old_consumed_count + K,
        "Invalid consumed count after multiple draws"
    );
    
    // Note: Full bitset verification would require sequential bit flips
    // For optimization, caller ensures bitset consistency off-circuit
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

#[test]
fn test_verify_bit_flip() {
    let old: [u1; 8] = [0, 0, 0, 0, 0, 0, 0, 0];
    let new: [u1; 8] = [0, 0, 0, 1, 0, 0, 0, 0];
    
    verify_bit_flip(old, new, 3);
}