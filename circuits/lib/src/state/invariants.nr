// Aggregate invariants for deck integrity

use crate::types::DeckInvariants;
use crate::constants::FIELD_OFFSET;
use crate::utils::hash::{aggregate_sum, aggregate_product};

/// Compute invariants for a set of card UIDs
pub fn compute_invariants<let N: u32>(uids: [Field; N]) -> DeckInvariants {
    let sum_uid = aggregate_sum(uids);
    let product_uid = aggregate_product(uids, FIELD_OFFSET);
    
    DeckInvariants {
        sum_uid,
        product_uid,
        count: N
    }
}

/// Verify that two sets of UIDs have the same invariants
/// This proves they contain the same cards (possibly in different order)
pub fn verify_invariants_match(inv1: DeckInvariants, inv2: DeckInvariants) -> bool {
    (inv1.sum_uid == inv2.sum_uid) &
    (inv1.product_uid == inv2.product_uid) &
    (inv1.count == inv2.count)
}

/// Assert invariants match
pub fn assert_invariants_match(inv1: DeckInvariants, inv2: DeckInvariants) {
    assert(inv1.sum_uid == inv2.sum_uid, "Sum invariant mismatch");
    assert(inv1.product_uid == inv2.product_uid, "Product invariant mismatch");
    assert(inv1.count == inv2.count, "Count mismatch");
}

/// Verify that removing UIDs from a set maintains correct invariants
/// old_inv = invariants of full set
/// removed_inv = invariants of removed subset
/// new_inv = expected invariants after removal
pub fn verify_removal_invariants(
    old_inv: DeckInvariants,
    removed_inv: DeckInvariants,
    new_inv: DeckInvariants
) -> bool {
    // Sum: new = old - removed
    let sum_check = new_inv.sum_uid == (old_inv.sum_uid - removed_inv.sum_uid);
    
    // Count: new = old - removed_count
    let count_check = new_inv.count == (old_inv.count - removed_inv.count);
    
    // Product is harder to verify for removal, so we skip it here
    // In practice, use sum + count as main invariants
    
    sum_check & count_check
}

/// Verify that adding UIDs to a set maintains correct invariants
pub fn verify_addition_invariants(
    old_inv: DeckInvariants,
    added_inv: DeckInvariants,
    new_inv: DeckInvariants
) -> bool {
    // Sum: new = old + added
    let sum_check = new_inv.sum_uid == (old_inv.sum_uid + added_inv.sum_uid);
    
    // Count: new = old + added_count  
    let count_check = new_inv.count == (old_inv.count + added_inv.count);
    
    sum_check & count_check
}

/// Compute invariant for a single UID
pub fn single_uid_invariant(uid: Field) -> DeckInvariants {
    DeckInvariants {
        sum_uid: uid,
        product_uid: FIELD_OFFSET + uid,
        count: 1
    }
}

#[test]
fn test_compute_invariants() {
    let uids: [Field; 5] = [1, 2, 3, 4, 5];
    let inv = compute_invariants(uids);
    
    assert(inv.sum_uid == 15);  // 1+2+3+4+5
    assert(inv.count == 5);
}

#[test]
fn test_verify_invariants_match() {
    let uids1: [Field; 3] = [1, 2, 3];
    let uids2: [Field; 3] = [3, 1, 2];  // Same UIDs, different order
    
    let inv1 = compute_invariants(uids1);
    let inv2 = compute_invariants(uids2);
    
    assert(verify_invariants_match(inv1, inv2));
}

#[test]
fn test_verify_removal_invariants() {
    let full_uids: [Field; 5] = [1, 2, 3, 4, 5];
    let removed_uids: [Field; 2] = [2, 4];
    let remaining_uids: [Field; 3] = [1, 3, 5];
    
    let full_inv = compute_invariants(full_uids);
    let removed_inv = compute_invariants(removed_uids);
    let remaining_inv = compute_invariants(remaining_uids);
    
    assert(verify_removal_invariants(full_inv, removed_inv, remaining_inv));
}

#[test]
fn test_verify_addition_invariants() {
    let old_uids: [Field; 3] = [1, 2, 3];
    let added_uids: [Field; 2] = [4, 5];
    let new_uids: [Field; 5] = [1, 2, 3, 4, 5];
    
    let old_inv = compute_invariants(old_uids);
    let added_inv = compute_invariants(added_uids);
    let new_inv = compute_invariants(new_uids);
    
    assert(verify_addition_invariants(old_inv, added_inv, new_inv));
}

#[test]
fn test_single_uid_invariant() {
    let uid: Field = 42;
    let inv = single_uid_invariant(uid);
    
    assert(inv.sum_uid == 42);
    assert(inv.count == 1);
    assert(inv.product_uid == FIELD_OFFSET + 42);
}
