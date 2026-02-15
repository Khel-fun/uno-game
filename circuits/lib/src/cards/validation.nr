// Card validation utilities

use crate::types::Card;
use crate::cards::encoding::encode_card;

/// Verify that all cards in an array are unique (no duplicate UIDs) - OPTIMIZED
pub fn verify_unique_cards<let N: u32>(cards: [Card; N]) -> bool {
    let mut all_unique = true;
    
    for i in 0..N {
        let uid_i = encode_card(cards[i]);
        for j in (i + 1)..N {
            let uid_j = encode_card(cards[j]);
            if uid_i == uid_j {
                all_unique = false;
            }
        }
    }
    
    all_unique
}

/// Assert that all cards are unique - OPTIMIZED with forward-only checking
pub fn assert_unique_cards<let N: u32>(cards: [Card; N]) {
    for i in 0..N {
        let uid_i = encode_card(cards[i]);
        for j in (i + 1)..N {
            let uid_j = encode_card(cards[j]);
            assert(uid_i != uid_j, "Duplicate cards found in deck");
        }
    }
}

/// Verify that all card UIDs in an array are unique - OPTIMIZED
pub fn verify_unique_uids<let N: u32>(uids: [Field; N]) -> bool {
    let mut all_unique = true;
    
    for i in 0..N {
        for j in (i + 1)..N {
            if uids[i] == uids[j] {
                all_unique = false;
            }
        }
    }
    
    all_unique
}

/// Assert that all UIDs are unique - OPTIMIZED with forward-only checking
pub fn assert_unique_uids<let N: u32>(uids: [Field; N]) {
    for i in 0..N {
        for j in (i + 1)..N {
            assert(uids[i] != uids[j], "Duplicate UIDs found");
        }
    }
}

/// Verify a card is structurally valid
pub fn verify_card_valid(card: Card) -> bool {
    card.is_valid()
}

/// Assert a card is valid
pub fn assert_card_valid(card: Card) {
    assert(card.is_valid(), "Invalid card");
}

/// Verify all cards in array are valid
pub fn verify_all_cards_valid<let N: u32>(cards: [Card; N]) -> bool {
    let mut all_valid = true;
    
    for i in 0..N {
        if !cards[i].is_valid() {
            all_valid = false;
        }
    }
    
    all_valid
}

/// Assert all cards are valid
pub fn assert_all_cards_valid<let N: u32>(cards: [Card; N]) {
    for i in 0..N {
        assert_card_valid(cards[i]);
    }
}

/// Verify that positions array contains no duplicates - OPTIMIZED
pub fn verify_unique_positions<let N: u32>(positions: [u32; N]) -> bool {
    let mut all_unique = true;
    
    for i in 0..N {
        for j in (i + 1)..N {
            if positions[i] == positions[j] {
                all_unique = false;
            }
        }
    }
    
    all_unique
}

/// Assert positions are unique - OPTIMIZED with forward-only checking
pub fn assert_unique_positions<let N: u32>(positions: [u32; N]) {
    for i in 0..N {
        for j in (i + 1)..N {
            assert(positions[i] != positions[j], "Duplicate positions found");
        }
    }
}

/// Verify positions are within valid range for deck
pub fn verify_positions_in_range<let N: u32>(positions: [u32; N], max_position: u32) -> bool {
    let mut all_valid = true;
    
    for i in 0..N {
        if positions[i] >= max_position {
            all_valid = false;
        }
    }
    
    all_valid
}

/// Assert positions are in valid range
pub fn assert_positions_in_range<let N: u32>(positions: [u32; N], max_position: u32) {
    for i in 0..N {
        assert(positions[i] < max_position, "Position out of range");
    }
}

#[test]
fn test_verify_unique_uids() {
    let uids1: [Field; 5] = [1, 2, 3, 4, 5];
    assert(verify_unique_uids(uids1));
    
    let uids2: [Field; 5] = [1, 2, 3, 4, 4];  // Duplicate
    assert(!verify_unique_uids(uids2));
}

#[test]
fn test_verify_unique_positions() {
    let pos1: [u32; 5] = [0, 1, 2, 3, 4];
    assert(verify_unique_positions(pos1));
    
    let pos2: [u32; 5] = [0, 1, 2, 2, 4];  // Duplicate
    assert(!verify_unique_positions(pos2));
}

#[test]
fn test_verify_positions_in_range() {
    let positions: [u32; 5] = [0, 10, 20, 50, 100];
    assert(verify_positions_in_range(positions, 108));
    assert(!verify_positions_in_range(positions, 50));  // 100 is out of range
}

#[test(should_fail_with = "Position out of range")]
fn test_assert_positions_in_range_fails() {
    let positions: [u32; 3] = [0, 50, 200];
    assert_positions_in_range(positions, 108);
}
