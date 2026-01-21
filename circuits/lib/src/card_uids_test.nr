// Validation tests for card UID lookup table
// Ensures precomputed values match dynamic hashing

use dep::zk_uno::card_uids::{get_card_uid, CANONICAL_DECK_UIDS};
use dep::zk_uno::utils::hash::hash_card_uid;

#[test]
fn test_lookup_matches_dynamic_wild_cards() {
    // Test Wild cards (type 13)
    for i in 0..4 {
        let from_lookup = get_card_uid(0, 13, i as u8);
        let from_hash = hash_card_uid(0, 13, i as u8);
        assert(from_lookup == from_hash, "Wild card mismatch");
    }
    
    // Test Wild Draw Four (type 14)
    for i in 0..4 {
        let from_lookup = get_card_uid(0, 14, i as u8);
        let from_hash = hash_card_uid(0, 14, i as u8);
        assert(from_lookup == from_hash, "Wild Draw Four mismatch");
    }
}

#[test]
fn test_lookup_matches_dynamic_colored_cards() {
    // Test all 4 colors
    for color in 1..5 {
        // Test zero card
        let lookup_zero = get_card_uid(color as u8, 0, 0);
        let hash_zero = hash_card_uid(color as u8, 0, 0);
        assert(lookup_zero == hash_zero, "Zero card mismatch");
        
        // Test number cards 1-9 (2 copies each)
        for num in 1..10 {
            for copy in 0..2 {
                let from_lookup = get_card_uid(color as u8, num as u8, copy as u8);
                let from_hash = hash_card_uid(color as u8, num as u8, copy as u8);
                assert(from_lookup == from_hash, "Number card mismatch");
            }
        }
        
        // Test action cards: Skip (10), Reverse (11), Draw Two (12)
        for action_type in 10..13 {
            for copy in 0..2 {
                let from_lookup = get_card_uid(color as u8, action_type as u8, copy as u8);
                let from_hash = hash_card_uid(color as u8, action_type as u8, copy as u8);
                assert(from_lookup == from_hash, "Action card mismatch");
            }
        }
    }
}

#[test]
fn test_all_108_uids_unique() {
    // Verify all 108 UIDs in lookup table are unique
    for i in 0..108 {
        for j in 0..108 {
            if i != j {
                assert(
                    CANONICAL_DECK_UIDS[i] != CANONICAL_DECK_UIDS[j],
                    "Duplicate UID found in lookup table"
                );
            }
        }
    }
}

#[test]
fn test_specific_cards() {
    // Test specific well-known cards
    
    // Red 5, copy 0
    let red_5 = get_card_uid(1, 5, 0);
    let red_5_hash = hash_card_uid(1, 5, 0);
    assert(red_5 == red_5_hash, "Red 5 mismatch");
    
    // Blue Skip, copy 1
    let blue_skip = get_card_uid(3, 10, 1);
    let blue_skip_hash = hash_card_uid(3, 10, 1);
    assert(blue_skip == blue_skip_hash, "Blue Skip mismatch");
    
    // Yellow Draw Two, copy 0
    let yellow_draw_two = get_card_uid(4, 12, 0);
    let yellow_draw_two_hash = hash_card_uid(4, 12, 0);
    assert(yellow_draw_two == yellow_draw_two_hash, "Yellow Draw Two mismatch");
    
    // Wild
    let wild = get_card_uid(0, 13, 0);
    let wild_hash = hash_card_uid(0, 13, 0);
    assert(wild == wild_hash, "Wild mismatch");
}

#[test]
fn test_index_calculation() {
    // Test that index calculation is correct
    
    // Wild cards should be at indices 0-7
    assert(get_card_uid(0, 13, 0) == CANONICAL_DECK_UIDS[0], "Wild #1 index wrong");
    assert(get_card_uid(0, 13, 3) == CANONICAL_DECK_UIDS[3], "Wild #4 index wrong");
    assert(get_card_uid(0, 14, 0) == CANONICAL_DECK_UIDS[4], "Wild Draw Four #1 index wrong");
    assert(get_card_uid(0, 14, 3) == CANONICAL_DECK_UIDS[7], "Wild Draw Four #4 index wrong");
    
    // Red 0 should be at index 8
    assert(get_card_uid(1, 0, 0) == CANONICAL_DECK_UIDS[8], "Red 0 index wrong");
    
    // Red 1 #1 should be at index 9
    assert(get_card_uid(1, 1, 0) == CANONICAL_DECK_UIDS[9], "Red 1 #1 index wrong");
    
    // Green 0 should be at index 33 (8 wilds + 25 red cards)
    assert(get_card_uid(2, 0, 0) == CANONICAL_DECK_UIDS[33], "Green 0 index wrong");
    
    // Blue 0 should be at index 58 (8 wilds + 50 red+green cards)
    assert(get_card_uid(3, 0, 0) == CANONICAL_DECK_UIDS[58], "Blue 0 index wrong");
    
    // Yellow 0 should be at index 83 (8 wilds + 75 red+green+blue cards)
    assert(get_card_uid(4, 0, 0) == CANONICAL_DECK_UIDS[83], "Yellow 0 index wrong");
}
