// Card deck utilities (replaces packOfCards.ts)
import { CardNotation } from "../../types";

// Full UNO deck (108 cards)
export const PACK_OF_CARDS: CardNotation[] = [
  // Red (25 cards)
  "0R",
  "1R",
  "1R",
  "2R",
  "2R",
  "3R",
  "3R",
  "4R",
  "4R",
  "5R",
  "5R",
  "6R",
  "6R",
  "7R",
  "7R",
  "8R",
  "8R",
  "9R",
  "9R",
  "skipR",
  "skipR",
  "_R",
  "_R",
  "D2R",
  "D2R",
  // Green (25 cards)
  "0G",
  "1G",
  "1G",
  "2G",
  "2G",
  "3G",
  "3G",
  "4G",
  "4G",
  "5G",
  "5G",
  "6G",
  "6G",
  "7G",
  "7G",
  "8G",
  "8G",
  "9G",
  "9G",
  "skipG",
  "skipG",
  "_G",
  "_G",
  "D2G",
  "D2G",
  // Blue (25 cards)
  "0B",
  "1B",
  "1B",
  "2B",
  "2B",
  "3B",
  "3B",
  "4B",
  "4B",
  "5B",
  "5B",
  "6B",
  "6B",
  "7B",
  "7B",
  "8B",
  "8B",
  "9B",
  "9B",
  "skipB",
  "skipB",
  "_B",
  "_B",
  "D2B",
  "D2B",
  // Yellow (25 cards)
  "0Y",
  "1Y",
  "1Y",
  "2Y",
  "2Y",
  "3Y",
  "3Y",
  "4Y",
  "4Y",
  "5Y",
  "5Y",
  "6Y",
  "6Y",
  "7Y",
  "7Y",
  "8Y",
  "8Y",
  "9Y",
  "9Y",
  "skipY",
  "skipY",
  "_Y",
  "_Y",
  "D2Y",
  "D2Y",
  // Wild (8 cards)
  "W",
  "W",
  "W",
  "W",
  "D4W",
  "D4W",
  "D4W",
  "D4W",
];

// Parse card notation to color/value
export function parseCard(notation: CardNotation): {
  color: string;
  value: string;
} {
  const colorMap: Record<string, string> = {
    R: "red",
    G: "green",
    B: "blue",
    Y: "yellow",
    W: "wild",
  };

  const lastChar = notation.slice(-1);
  const color = colorMap[lastChar] || "wild";

  let value = notation.slice(0, -1);

  // Map special notations
  if (value === "_") value = "reverse";
  else if (value === "skip") value = "skip";
  else if (value === "D2") value = "draw2";
  else if (value === "D4") value = "draw4";
  else if (value === "") value = "wild";

  return { color, value };
}

// Fisher-Yates shuffle
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Generate hash for a card using simple string hash
export function hashCard(
  notation: CardNotation,
  gameId: string,
  index: number
): string {
  const str = `${gameId}-${notation}-${index}-${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).padStart(16, '0').substring(0, 16);
}

// Create shuffled deck with hashes and mappings
export function createDeck(gameId: string) {
  const shuffled = shuffle(PACK_OF_CARDS);

  const mappings = shuffled.map((notation, index) => {
    const { color, value } = parseCard(notation);
    const cardHash = hashCard(notation, gameId, index);

    return { cardHash, color, value };
  });

  const deckHashes = mappings.map((m) => m.cardHash);

  return { mappings, deckHashes };
}
