// Simplified shuffle verification circuit
// Proves that output deck is a valid permutation of input deck
// WITHOUT expensive Merkle tree verification

use dep::zk_uno::utils::shuffle::check_shuffle;

// Main entry point for the circuit
// Only verifies permutation - no Merkle trees, no invariants needed
fn main(
    // Private witnesses - actual card UIDs
    uids_in: [Field; 108],
    uids_out: [Field; 108]
) {
    // Verify shuffle is a valid permutation
    // This ensures every card in output exists in input
    // and output is a valid reordering
    check_shuffle(uids_in, uids_out);
}

#[test]
fn test_simplified_shuffle() {
    // Test the simplified shuffle verification
    let uids_in: [Field; 5] = [1, 2, 3, 4, 5];
    let uids_out: [Field; 5] = [3, 1, 5, 2, 4];  // Valid permutation
    
    // Verify this is a valid shuffle
    check_shuffle(uids_in, uids_out);
}
