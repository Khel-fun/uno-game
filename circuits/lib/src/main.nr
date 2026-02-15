// ZK UNO - Main Circuit Entry Points
// Zero-Knowledge proof circuits for trustless UNO game
//
// This file can be compiled with different entry points:
// - Shuffle: Verify deck shuffle permutation
// - Deal: Verify cards dealt to player
// - Draw: Verify card drawn from deck
// - Play: Verify legal card play

pub mod types;
pub mod constants;
pub mod utils;
pub mod cards;
pub mod state;
pub mod circuits;

// Default main entry point - Shuffle circuit
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
    circuits::shuffle_main::main_shuffle(
        merkle_root_in,
        merkle_root_out,
        sum_invariant,
        product_invariant,
        uids_in,
        uids_out
    );
}

// Export public functions for different circuit types
// These can be compiled separately for different proof purposes

#[export]
fn shuffle_circuit(
    _merkle_root_in: Field,
    _merkle_root_out: Field,
    uids_in: [Field; 108],
    uids_out: [Field; 108]
) {
    utils::shuffle::verify_shuffle(uids_in, uids_out);
}

#[export]
fn deal_circuit(
    _merkle_root: Field,
    _player_id: Field,
    positions: [u32; 5],
    _card_uids: [Field; 5],
    _nonces: [Field; 5]
) {
    cards::validation::assert_unique_positions(positions);
    cards::validation::assert_positions_in_range(positions, 108);
}

#[export]
fn play_circuit(
    _hand_root: Field,
    _top_card_commit: Field,
    played_card_color: u8,
    played_card_type: u8,
    played_card_copy: u8,
    top_card_color: u8,
    top_card_type: u8,
    top_card_copy: u8
) {
    let played = cards::encoding::decode_card_components(
        played_card_color,
        played_card_type,
        played_card_copy
    );
    
    let top = cards::encoding::decode_card_components(
        top_card_color,
        top_card_type,
        top_card_copy
    );
    
    assert(cards::encoding::can_play_card(played, top), "Illegal play");
}

#[test]
fn test_main_circuit_types() {
    // Test basic type system
    let color = types::CardColor::red();
    let card_type = types::CardType::number(5);
    
    assert(color.value == 1);
    assert(card_type.value == 5);
}

#[test]
fn test_card_encoding_integration() {
    let (uids, cards_arr) = cards::encoding::generate_canonical_deck();
    
    // Verify first card is Wild
    assert(cards_arr[0].card_type.value == 13);
    
    // Verify UIDs are unique (spot check)
    assert(uids[0] != uids[1]);
    assert(uids[50] != uids[51]);
}

#[test]
fn test_shuffle_integration() {
    let original: [Field; 8] = [1, 2, 3, 4, 5, 6, 7, 8];
    let shuffled: [Field; 8] = [3, 1, 5, 2, 7, 4, 8, 6];
    
    utils::shuffle::verify_shuffle(original, shuffled);
}

#[test]
fn test_play_validation_integration() {
    let red5 = cards::encoding::decode_card_components(1, 5, 0);
    let red7 = cards::encoding::decode_card_components(1, 7, 0);
    let wild = cards::encoding::decode_card_components(0, 13, 0);
    
    assert(cards::encoding::can_play_card(red7, red5));  // Same color
    assert(cards::encoding::can_play_card(wild, red5));  // Wild matches anything
}
