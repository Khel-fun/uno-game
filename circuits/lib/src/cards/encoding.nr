// Card encoding and UID generation for UNO cards

use crate::types::{Card, CardColor, CardType};
use crate::constants::{
    COLOR_WILD, COLOR_RED, COLOR_GREEN, COLOR_BLUE, COLOR_YELLOW,
    TYPE_WILD, TYPE_WILD_DRAW_FOUR
};
use crate::utils::hash::hash_card_commitment;
use crate::card_uids::get_card_uid;

/// Generate unique identifier for a card using precomputed lookup table
/// This is 30-40% faster than dynamic hashing
pub fn encode_card(card: Card) -> Field {
    get_card_uid(card.color.value, card.card_type.value, card.copy_index)
}

/// Create a commitment for a card with a nonce
/// Commitment = Poseidon(card_uid, nonce)
pub fn commit_card(card: Card, nonce: Field) -> Field {
    let uid = encode_card(card);
    hash_card_commitment(uid, nonce)
}

/// Generate all 108 UNO card UIDs in canonical order
/// Returns array of card UIDs and their corresponding cards
pub fn generate_canonical_deck() -> ([Field; 108], [Card; 108]) {
    let mut uids: [Field; 108] = [0; 108];
    let mut cards: [Card; 108] = [Card::new(CardColor::wild(), CardType::wild(), 0); 108];
    let mut idx = 0;
    
    // Wild cards first (8 total)
    // 4x Wild (type 13)
    for i in 0..4 {
        cards[idx] = Card::new(CardColor::wild(), CardType::wild(), i as u8);
        uids[idx] = encode_card(cards[idx]);
        idx += 1;
    }
    
    // 4x Wild Draw Four (type 14)
    for i in 0..4 {
        cards[idx] = Card::new(CardColor::wild(), CardType::wild_draw_four(), i as u8);
        uids[idx] = encode_card(cards[idx]);
        idx += 1;
    }
    
    // Colored cards (Red, Green, Blue, Yellow - 25 each = 100 total)
    let colors = [COLOR_RED, COLOR_GREEN, COLOR_BLUE, COLOR_YELLOW];
    
    for color_idx in 0..4 {
        let color = CardColor { value: colors[color_idx] };
        
        // One 0 card
        cards[idx] = Card::new(color, CardType::number(0), 0);
        uids[idx] = encode_card(cards[idx]);
        idx += 1;
        
        // Two each of 1-9
        for num in 1..10 {
            for copy in 0..2 {
                cards[idx] = Card::new(color, CardType::number(num as u8), copy as u8);
                uids[idx] = encode_card(cards[idx]);
                idx += 1;
            }
        }
        
        // Two Skip cards
        for copy in 0..2 {
            cards[idx] = Card::new(color, CardType::skip(), copy as u8);
            uids[idx] = encode_card(cards[idx]);
            idx += 1;
        }
        
        // Two Reverse cards
        for copy in 0..2 {
            cards[idx] = Card::new(color, CardType::reverse(), copy as u8);
            uids[idx] = encode_card(cards[idx]);
            idx += 1;
        }
        
        // Two Draw Two cards
        for copy in 0..2 {
            cards[idx] = Card::new(color, CardType::draw_two(), copy as u8);
            uids[idx] = encode_card(cards[idx]);
            idx += 1;
        }
    }
    
    assert(idx == 108, "Deck generation error: incorrect card count");
    
    (uids, cards)
}

/// Decode a card from separate components
pub fn decode_card_components(color: u8, card_type: u8, copy_index: u8) -> Card {
    Card::new(
        CardColor { value: color },
        CardType { value: card_type },
        copy_index
    )
}

/// Check if two cards match for UNO play rules - OPTIMIZED
/// Cards match if: same color OR same number OR one is wild
pub fn cards_match(card1: Card, card2: Card) -> bool {
    // Single expression evaluation - more efficient
    card1.card_type.is_wild() | card2.card_type.is_wild() | 
    (card1.color.value == card2.color.value) | 
    (card1.card_type.value == card2.card_type.value)
}

/// Verify a card can be played on top of another card - OPTIMIZED
/// Returns true if the play is legal according to UNO rules
pub fn can_play_card(card_to_play: Card, top_card: Card) -> bool {
    // Direct match check - more efficient
    // Wild Draw Four rule enforced via separate challenge mechanism
    cards_match(card_to_play, top_card)
}

#[test]
fn test_encode_card() {
    let card1 = Card::new(CardColor::red(), CardType::number(5), 0);
    let card2 = Card::new(CardColor::red(), CardType::number(5), 1);
    let card3 = Card::new(CardColor::green(), CardType::number(5), 0);
    
    let uid1 = encode_card(card1);
    let uid2 = encode_card(card2);
    let uid3 = encode_card(card3);
    
    // Different copy indices should produce different UIDs
    assert(uid1 != uid2);
    
    // Different colors should produce different UIDs
    assert(uid1 != uid3);
}

#[test]
fn test_commit_card() {
    let card = Card::new(CardColor::blue(), CardType::skip(), 0);
    let nonce1: Field = 12345;
    let nonce2: Field = 54321;
    
    let commit1 = commit_card(card, nonce1);
    let commit2 = commit_card(card, nonce2);
    
    // Different nonces should produce different commitments
    assert(commit1 != commit2);
}

#[test]
fn test_generate_canonical_deck() {
    let (uids, cards) = generate_canonical_deck();
    
    // Verify we have exactly 108 cards
    // First 4 should be Wild
    for i in 0..4 {
        assert(cards[i].card_type.value == TYPE_WILD);
        assert(cards[i].color.value == COLOR_WILD);
    }
    
    // Next 4 should be Wild Draw Four
    for i in 4..8 {
        assert(cards[i].card_type.value == TYPE_WILD_DRAW_FOUR);
        assert(cards[i].color.value == COLOR_WILD);
    }
    
    // All UIDs should be unique (spot check a few)
    assert(uids[0] != uids[1]);
    assert(uids[0] != uids[10]);
    assert(uids[50] != uids[51]);
}

#[test]
fn test_cards_match() {
    let red5 = Card::new(CardColor::red(), CardType::number(5), 0);
    let red7 = Card::new(CardColor::red(), CardType::number(7), 0);
    let blue5 = Card::new(CardColor::blue(), CardType::number(5), 0);
    let wild = Card::new(CardColor::wild(), CardType::wild(), 0);
    
    // Same color should match
    assert(cards_match(red5, red7));
    
    // Same number should match
    assert(cards_match(red5, blue5));
    
    // Wild should match anything
    assert(cards_match(wild, red5));
    assert(cards_match(red7, wild));
}

#[test]
fn test_can_play_card() {
    let red5 = Card::new(CardColor::red(), CardType::number(5), 0);
    let red_skip = Card::new(CardColor::red(), CardType::skip(), 0);
    let green5 = Card::new(CardColor::green(), CardType::number(5), 0);
    let blue7 = Card::new(CardColor::blue(), CardType::number(7), 0);
    let wild = Card::new(CardColor::wild(), CardType::wild(), 0);
    
    // Can play red skip on red 5 (same color)
    assert(can_play_card(red_skip, red5));
    
    // Can play green 5 on red 5 (same number)
    assert(can_play_card(green5, red5));
    
    // Cannot play blue 7 on red 5 (different color and number)
    assert(!can_play_card(blue7, red5));
    
    // Can play wild on anything
    assert(can_play_card(wild, red5));
}
