// Core type definitions for ZK UNO

/// Merkle tree depth (supports up to 128 leaves for 108 cards)
pub global MERKLE_DEPTH: u32 = 7;

/// Total number of UNO cards in the deck
pub global DECK_SIZE: u32 = 108;

/// Maximum number of cards a player can hold
pub global MAX_HAND_SIZE: u32 = 20;

/// Number of cards dealt initially per player
pub global INITIAL_DEAL_SIZE: u32 = 5;

/// Card color enumeration
/// 0 = Wild (colorless)
/// 1 = Red
/// 2 = Green  
/// 3 = Blue
/// 4 = Yellow
pub struct CardColor {
    pub value: u8
}

impl CardColor {
    pub fn wild() -> Self { CardColor { value: 0 } }
    pub fn red() -> Self { CardColor { value: 1 } }
    pub fn green() -> Self { CardColor { value: 2 } }
    pub fn blue() -> Self { CardColor { value: 3 } }
    pub fn yellow() -> Self { CardColor { value: 4 } }
    
    pub fn is_wild(self) -> bool { self.value == 0 }
    pub fn is_valid(self) -> bool { self.value <= 4 }
}

/// Card type enumeration
/// 0-9 = Number cards
/// 10 = Skip
/// 11 = Reverse
/// 12 = Draw Two
/// 13 = Wild
/// 14 = Wild Draw Four
pub struct CardType {
    pub value: u8
}

impl CardType {
    pub fn number(n: u8) -> Self { 
        assert(n <= 9);
        CardType { value: n } 
    }
    pub fn skip() -> Self { CardType { value: 10 } }
    pub fn reverse() -> Self { CardType { value: 11 } }
    pub fn draw_two() -> Self { CardType { value: 12 } }
    pub fn wild() -> Self { CardType { value: 13 } }
    pub fn wild_draw_four() -> Self { CardType { value: 14 } }
    
    pub fn is_wild(self) -> bool { self.value >= 13 }
    pub fn is_action(self) -> bool { self.value >= 10 }
    pub fn is_number(self) -> bool { self.value <= 9 }
    pub fn is_valid(self) -> bool { self.value <= 14 }
}

/// Complete card representation with unique identifier
pub struct Card {
    pub color: CardColor,
    pub card_type: CardType,
    pub copy_index: u8,  // For handling duplicates
}

impl Card {
    pub fn new(color: CardColor, card_type: CardType, copy_index: u8) -> Self {
        Card { color, card_type, copy_index }
    }
    
    pub fn is_valid(self) -> bool {
        self.color.is_valid() & self.card_type.is_valid()
    }
}

/// Card commitment - hash of card UID and nonce
struct CardCommitment {
    leaf: Field,  // Poseidon(card_uid, nonce)
}

/// Merkle proof for card inclusion
pub struct MerkleProof {
    pub path: [Field; MERKLE_DEPTH],
    pub indices: [u1; MERKLE_DEPTH],  // 0 = left, 1 = right
}

/// Deck state represented by Merkle root
struct DeckState {
    pub root: Field,
    pub card_count: u32,
}

/// Player hand representation (private)
struct PlayerHand {
    cards: [Field; MAX_HAND_SIZE],  // Card UIDs
    nonces: [Field; MAX_HAND_SIZE],
    count: u32,
}

/// Consumed cards bitset state
pub struct ConsumedState {
    pub root: Field,  // Commitment to bitset
    pub count: u32,   // Number of consumed cards
}

/// Aggregate invariants for deck integrity
pub struct DeckInvariants {
    pub sum_uid: Field,      // Sum of all card UIDs
    pub product_uid: Field,  // Product of all card UIDs (with offset)
    pub count: u32,
}

/// Game state transition
struct StateTransition {
    old_state: DeckState,
    new_state: DeckState,
    consumed_old: ConsumedState,
    consumed_new: ConsumedState,
}
