import shuffleArray from './shuffleArray';

/**
 * Card handling utilities for UNO game
 */

/**
 * Draw a card with automatic reshuffle if draw pile is empty
 * @returns {Object} - { card, newDrawPile, newPlayedCardsPile, reshuffled }
 */
export const drawCardWithReshuffle = (drawCardPile, playedCardsPile) => {
  let copiedDrawPile = [...drawCardPile];
  let updatedPlayedPile = [...playedCardsPile];
  let reshuffled = false;
  
  // Check if draw pile is empty and needs reshuffling
  if (copiedDrawPile.length === 0 && updatedPlayedPile.length > 1) {
    // Keep the top card (the one just played)
    const topCard = updatedPlayedPile[updatedPlayedPile.length - 1];
    
    // Take all other cards from the discard pile
    const cardsToReshuffle = updatedPlayedPile.slice(0, updatedPlayedPile.length - 1);
    
    // Shuffle these cards
    copiedDrawPile = shuffleArray([...cardsToReshuffle]);
    updatedPlayedPile = [topCard];
    reshuffled = true;
    
    console.log('Reshuffled discard pile into draw pile. New draw pile size:', copiedDrawPile.length);
  }
  
  // Draw a card if possible
  const card = copiedDrawPile.length > 0 ? copiedDrawPile.pop() : null;
  
  return {
    card,
    newDrawPile: copiedDrawPile,
    newPlayedCardsPile: updatedPlayedPile,
    reshuffled,
  };
};

/**
 * Draw multiple cards with reshuffle support
 */
export const drawMultipleCards = (count, drawCardPile, playedCardsPile) => {
  const drawnCards = [];
  let currentDrawPile = [...drawCardPile];
  let currentPlayedPile = [...playedCardsPile];
  let reshuffled = false;
  
  for (let i = 0; i < count; i++) {
    const result = drawCardWithReshuffle(currentDrawPile, currentPlayedPile);
    
    if (result.card) {
      drawnCards.push(result.card);
    }
    
    currentDrawPile = result.newDrawPile;
    currentPlayedPile = result.newPlayedCardsPile;
    
    if (result.reshuffled) {
      reshuffled = true;
    }
  }
  
  return {
    cards: drawnCards,
    newDrawPile: currentDrawPile,
    newPlayedCardsPile: currentPlayedPile,
    reshuffled,
  };
};

/**
 * Reshuffle the discard pile when draw pile is empty
 */
export const reshuffleDiscardPile = (playedCardsPile) => {
  // Make sure we have played cards to reshuffle (at least 2, since we keep the top card)
  if (playedCardsPile.length < 2) {
    return null; // Not enough cards to reshuffle
  }
  
  // Keep the top card of the discard pile
  const topCard = playedCardsPile[playedCardsPile.length - 1];
  
  // Take all other cards from the discard pile
  const cardsToReshuffle = playedCardsPile.slice(0, playedCardsPile.length - 1);
  
  // Shuffle these cards
  const newDrawPile = shuffleArray([...cardsToReshuffle]);
  
  return {
    newDrawPile,
    newPlayedCardsPile: [topCard],
  };
};

/**
 * Remove a card from a player's deck
 */
export const removeCardFromDeck = (deck, card) => {
  const removeIndex = deck.indexOf(card);
  if (removeIndex === -1) return deck;
  
  return [...deck.slice(0, removeIndex), ...deck.slice(removeIndex + 1)];
};

/**
 * Add a card to a player's deck
 */
export const addCardToDeck = (deck, card) => {
  return [...deck, card];
};

/**
 * Add multiple cards to a player's deck
 */
export const addCardsToDeck = (deck, cards) => {
  return [...deck, ...cards];
};
