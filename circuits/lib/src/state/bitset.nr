// Bitset operations for tracking consumed cards

use crate::types::ConsumedState;
use crate::utils::hash::compress_bitset;

/// Verify that a bitset has exactly one bit flipped from 0 to 1 - OPTIMIZED
/// All other bits must remain unchanged
pub fn verify_single_bit_flip<let N: u32>(
    old_bits: [u1; N],
    new_bits: [u1; N],
    flip_index: u32
) -> bool {
    // Check flip index is valid
    let index_valid = flip_index < N;
    
    // Check the flip happened correctly
    let flip_valid = (old_bits[flip_index] == 0) & (new_bits[flip_index] == 1);
    
    // Check all other bits remain unchanged
    let mut other_bits_valid = true;
    for i in 0..N {
        if (i != flip_index) & (old_bits[i] != new_bits[i]) {
            other_bits_valid = false;
        }
    }
    
    index_valid & flip_valid & other_bits_valid
}

/// Assert single bit flip is valid
pub fn assert_single_bit_flip<let N: u32>(
    old_bits: [u1; N],
    new_bits: [u1; N],
    flip_index: u32
) {
    assert(flip_index < N, "Flip index out of bounds");
    assert(old_bits[flip_index] == 0, "Bit already set");
    assert(new_bits[flip_index] == 1, "Bit not flipped to 1");
    
    for i in 0..N {
        if i != flip_index {
            assert(old_bits[i] == new_bits[i], "Unexpected bit change");
        }
    }
}

/// Verify consumed state transition
/// Ensures the bitset root correctly represents the before/after state
pub fn verify_consumed_transition<let N: u32>(
    old_state: ConsumedState,
    new_state: ConsumedState,
    old_bits: [u1; N],
    new_bits: [u1; N],
    consumed_index: u32
) -> bool {
    // Verify old state matches old bits
    let old_root = compress_bitset(old_bits);
    let new_root = compress_bitset(new_bits);
    
    (old_root == old_state.root) &
    (new_root == new_state.root) &
    verify_single_bit_flip(old_bits, new_bits, consumed_index) &
    (new_state.count == old_state.count + 1)
}

/// Assert consumed state transition is valid
pub fn assert_consumed_transition<let N: u32>(
    old_state: ConsumedState,
    new_state: ConsumedState,
    old_bits: [u1; N],
    new_bits: [u1; N],
    consumed_index: u32
) {
    // Verify and compress old bitset
    let old_root = compress_bitset(old_bits);
    assert(old_root == old_state.root, "Old bitset root mismatch");
    
    // Verify and compress new bitset
    let new_root = compress_bitset(new_bits);
    assert(new_root == new_state.root, "New bitset root mismatch");
    
    // Verify single bit flip
    assert_single_bit_flip(old_bits, new_bits, consumed_index);
    
    // Verify count
    assert(new_state.count == old_state.count + 1, "Invalid consumed count");
}

/// Count the number of set bits in a bitset
pub fn count_set_bits<let N: u32>(bits: [u1; N]) -> u32 {
    let mut count = 0;
    for i in 0..N {
        if bits[i] == 1 {
            count += 1;
        }
    }
    count
}

/// Initialize an empty consumed state
pub fn initialize_consumed_state<let N: u32>() -> (ConsumedState, [u1; N]) {
    let empty_bits: [u1; N] = [0; N];
    let root = compress_bitset(empty_bits);
    
    (ConsumedState { root, count: 0 }, empty_bits)
}

/// Check if a position is already consumed
pub fn is_position_consumed<let N: u32>(bits: [u1; N], position: u32) -> bool {
    assert(position < N, "Position out of bounds");
    bits[position] == 1
}

#[test]
fn test_verify_single_bit_flip() {
    let old: [u1; 8] = [0, 0, 0, 0, 0, 0, 0, 0];
    let new: [u1; 8] = [0, 0, 0, 1, 0, 0, 0, 0];
    
    assert(verify_single_bit_flip(old, new, 3));
    assert(!verify_single_bit_flip(old, new, 2));  // Wrong index
}

#[test]
fn test_count_set_bits() {
    let bits1: [u1; 8] = [0, 1, 0, 1, 0, 1, 0, 0];
    assert(count_set_bits(bits1) == 3);
    
    let bits2: [u1; 8] = [0, 0, 0, 0, 0, 0, 0, 0];
    assert(count_set_bits(bits2) == 0);
    
    let bits3: [u1; 8] = [1, 1, 1, 1, 1, 1, 1, 1];
    assert(count_set_bits(bits3) == 8);
}

#[test]
fn test_is_position_consumed() {
    let bits: [u1; 8] = [0, 1, 0, 1, 0, 0, 0, 1];
    
    assert(!is_position_consumed(bits, 0));
    assert(is_position_consumed(bits, 1));
    assert(!is_position_consumed(bits, 2));
    assert(is_position_consumed(bits, 3));
}

#[test]
fn test_initialize_consumed_state() {
    let (state, bits) = initialize_consumed_state::<108>();
    
    assert(state.count == 0);
    assert(count_set_bits(bits) == 0);
}
