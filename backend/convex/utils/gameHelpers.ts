// Game logic helpers (replaces gameStateManager logic)

// Generate game hash using simple string hash
export function generateGameHash(state: any): string {
  const str = JSON.stringify(state);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).padStart(16, '0').substring(0, 16);
}

// Calculate next player index
export function getNextPlayerIndex(
  currentIndex: number,
  playerCount: number,
  clockwise: boolean
): number {
  if (clockwise) {
    return (currentIndex + 1) % playerCount;
  } else {
    return (currentIndex - 1 + playerCount) % playerCount;
  }
}

// Skip one player (for Skip card)
export function skipPlayer(
  currentIndex: number,
  playerCount: number,
  clockwise: boolean
): number {
  const next = getNextPlayerIndex(currentIndex, playerCount, clockwise);
  return getNextPlayerIndex(next, playerCount, clockwise);
}

// Reverse direction
export function reverseDirection(clockwise: boolean): boolean {
  return !clockwise;
}

// Check if card can be played
export function canPlayCard(
  cardColor: string,
  cardValue: string,
  currentColor: string | undefined,
  currentValue: string | undefined
): boolean {
  // Wild cards can always be played
  if (cardColor === "wild") return true;

  // No current card (game start) - any card can be played
  if (!currentColor && !currentValue) return true;

  // Match color or value
  return cardColor === currentColor || cardValue === currentValue;
}

// Deal initial hands
export function dealHands(
  deckHashes: string[],
  playerCount: number,
  cardsPerPlayer: number = 7
): {
  hands: Record<string, string[]>;
  remainingDeck: string[];
} {
  const hands: Record<string, string[]> = {};
  let currentIndex = 0;

  // Deal cards to each player
  for (let i = 0; i < playerCount; i++) {
    hands[`player_${i}`] = deckHashes.slice(
      currentIndex,
      currentIndex + cardsPerPlayer
    );
    currentIndex += cardsPerPlayer;
  }

  // Remaining cards stay in deck
  const remainingDeck = deckHashes.slice(currentIndex);

  return { hands, remainingDeck };
}
