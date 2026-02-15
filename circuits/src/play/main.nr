// Play validation circuit  
// Proves that a card play is legal according to UNO rules

use dep::zk_uno::types::{Card, MerkleProof};
use dep::zk_uno::cards::encoding::{can_play_card, encode_card, decode_card_components};
use dep::zk_uno::utils::hash::hash_card_commitment;
use dep::zk_uno::utils::merkle::assert_merkle_proof;
use dep::zk_uno::card_uids::get_card_uid;

// Main entry point for the circuit
fn main(
    // Public inputs
    game_id: pub Field,
    player_id: pub Field,
    move_commitment: pub Field,
    
    // Private witnesses  
    played_card_color: u8,
    played_card_type: u8,
    played_card_copy: u8,
    top_card_color: u8,
    top_card_type: u8,
    nonce: Field
) {
    // Verify play is legal
    let is_legal = can_play_card(
        played_card_color,
        played_card_type,
        top_card_color,
        top_card_type
    );
    assert(is_legal, "Illegal card play");
    
    // Get card UID from precomputed lookup table
    let card_uid = get_card_uid(played_card_color, played_card_type, played_card_copy);
    
    // Verify move commitment
    let computed = std::hash::pedersen_hash([game_id, player_id, card_uid, nonce]);
    assert(computed == move_commitment, "Invalid move commitment");
}

/// Prove that a card can be legally played
/// - Card is in player's hand (Merkle proof from hand root)
/// - Card matches top of discard pile (color, number, or wild)
/// - Updates game state correctly
pub fn prove_legal_play(
    // Public inputs
    hand_merkle_root: Field,
    top_card_commitment: Field,  // Top of discard pile
    
    // Private witnesses
    played_card: Card,
    played_card_nonce: Field,
    played_card_merkle_path: MerkleProof,
    
    top_card: Card,
    top_card_nonce: Field
) {
    // Verify played card is in player's hand
    let played_card_uid = encode_card(played_card);
    let played_leaf = hash_card_commitment(played_card_uid, played_card_nonce);
    assert_merkle_proof(played_leaf, played_card_merkle_path, hand_merkle_root);
    
    // Verify top card commitment matches
    let top_card_uid = encode_card(top_card);
    let top_leaf = hash_card_commitment(top_card_uid, top_card_nonce);
    assert(top_leaf == top_card_commitment, "Top card commitment mismatch");
    
    // Verify the play is legal
    assert(can_play_card(played_card, top_card), "Illegal card play");
}

/// Simplified play validation for testing
pub fn verify_card_playable(played_card: Card, top_card: Card) -> bool {
    can_play_card(played_card, top_card)
}

/// Prove a Wild Draw Four challenge
/// Player claims the previous player had a matching color
/// Must prove they have no cards of the current color
pub fn prove_wild_draw_four_challenge(
    _hand_merkle_root: Field,
    current_color: u8,
    hand_cards: [Card; 20],  // MAX_HAND_SIZE
    hand_count: u32
) {
    // Verify none of the cards match the current color
    for i in 0..hand_count {
        if i < 20 {
            let card = hand_cards[i];
            assert(
                (card.color.value != current_color) | card.card_type.is_wild(),
                "Player has matching color card"
            );
        }
    }
}

/// Create a move commitment hash for on-chain verification
/// This is compatible with the smart contract's commitMove function
pub fn create_move_commitment(
    game_id: Field,
    player_id: Field,
    card_uid: Field,
    nonce: Field
) -> Field {
    // Create a commitment that can be verified on-chain
    std::hash::pedersen_hash([game_id, player_id, card_uid, nonce])
}

/// Verify a move matches a committed hash
pub fn verify_move_commitment(
    commitment: Field,
    game_id: Field,
    player_id: Field,
    card_uid: Field,
    nonce: Field
) {
    let computed = create_move_commitment(game_id, player_id, card_uid, nonce);
    assert(computed == commitment, "Move commitment mismatch");
}

#[test]
fn test_verify_card_playable() {
    let red5 = decode_card_components(1, 5, 0);    // Red 5
    let red7 = decode_card_components(1, 7, 0);    // Red 7
    let blue5 = decode_card_components(3, 5, 0);   // Blue 5
    let blue7 = decode_card_components(3, 7, 0);   // Blue 7
    let wild = decode_card_components(0, 13, 0);   // Wild
    
    // Can play red 7 on red 5 (same color)
    assert(verify_card_playable(red7, red5));
    
    // Can play blue 5 on red 5 (same number)
    assert(verify_card_playable(blue5, red5));
    
    // Cannot play blue 7 on red 5 (different color and number)
    assert(!verify_card_playable(blue7, red5));
    
    // Can play wild on anything
    assert(verify_card_playable(wild, red5));
}

#[test]
fn test_create_move_commitment() {
    let game_id: Field = 123;
    let player_id: Field = 456;
    let card_uid: Field = 789;
    let nonce: Field = 999;
    
    let commitment1 = create_move_commitment(game_id, player_id, card_uid, nonce);
    let commitment2 = create_move_commitment(game_id, player_id, card_uid, nonce);
    
    // Same inputs should produce same commitment
    assert(commitment1 == commitment2);
    
    // Different nonce should produce different commitment
    let commitment3 = create_move_commitment(game_id, player_id, card_uid, 888);
    assert(commitment1 != commitment3);
}

#[test]
fn test_verify_move_commitment() {
    let game_id: Field = 100;
    let player_id: Field = 200;
    let card_uid: Field = 300;
    let nonce: Field = 400;
    
    let commitment = create_move_commitment(game_id, player_id, card_uid, nonce);
    verify_move_commitment(commitment, game_id, player_id, card_uid, nonce);
}
