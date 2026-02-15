/**
 * Generate canonical card UIDs using Poseidon hash
 * This script generates UIDs compatible with both:
 * - Noir circuits (using noir-lang/poseidon)
 * - TypeScript frontend (using poseidon-lite)
 * 
 * Run with: node scripts/generate_poseidon_uids.js
 */

const { poseidon4 } = require('poseidon-lite');
const fs = require('fs');
const path = require('path');

// Domain separation constant (must match circuits/lib/src/constants.nr)
const DOMAIN_CARD_UID = 1n;

// Color constants
const COLOR_WILD = 0;
const COLOR_RED = 1;
const COLOR_GREEN = 2;
const COLOR_BLUE = 3;
const COLOR_YELLOW = 4;

// Card type constants  
const TYPE_WILD = 13;
const TYPE_WILD_DRAW_FOUR = 14;

/**
 * Generate card UID using Poseidon4 hash
 * uid = Poseidon(DOMAIN_CARD_UID, color, cardType, copyIndex)
 */
function generateCardUID(color, cardType, copyIndex) {
  const uid = poseidon4([DOMAIN_CARD_UID, BigInt(color), BigInt(cardType), BigInt(copyIndex)]);
  return uid;
}

/**
 * Generate all 108 card UIDs in the canonical order
 */
function generateAllCardUIDs() {
  const uids = [];
  const comments = [];
  
  // Wild cards first (8 total)
  // Wild (TYPE_WILD = 13): 4 copies
  for (let copy = 0; copy < 4; copy++) {
    const uid = generateCardUID(COLOR_WILD, TYPE_WILD, copy);
    uids.push(uid);
    comments.push(`Wild Wild #${copy + 1}`);
  }
  
  // Wild Draw Four (TYPE_WILD_DRAW_FOUR = 14): 4 copies
  for (let copy = 0; copy < 4; copy++) {
    const uid = generateCardUID(COLOR_WILD, TYPE_WILD_DRAW_FOUR, copy);
    uids.push(uid);
    comments.push(`Wild Wild Draw Four #${copy + 1}`);
  }
  
  // Colored cards (4 colors x 25 cards = 100 total)
  const colorNames = ['', 'Red', 'Green', 'Blue', 'Yellow'];
  const typeNames = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', 'Draw Two'];
  
  for (let color = COLOR_RED; color <= COLOR_YELLOW; color++) {
    // Type 0 (Zero): 1 copy
    const zeroUid = generateCardUID(color, 0, 0);
    uids.push(zeroUid);
    comments.push(`${colorNames[color]} 0`);
    
    // Types 1-9: 2 copies each
    for (let cardType = 1; cardType <= 9; cardType++) {
      for (let copy = 0; copy < 2; copy++) {
        const uid = generateCardUID(color, cardType, copy);
        uids.push(uid);
        comments.push(`${colorNames[color]} ${cardType} #${copy + 1}`);
      }
    }
    
    // Action cards (Skip=10, Reverse=11, Draw Two=12): 2 copies each
    for (let cardType = 10; cardType <= 12; cardType++) {
      for (let copy = 0; copy < 2; copy++) {
        const uid = generateCardUID(color, cardType, copy);
        uids.push(uid);
        comments.push(`${colorNames[color]} ${typeNames[cardType]} #${copy + 1}`);
      }
    }
  }
  
  return { uids, comments };
}

/**
 * Format UID as 0x-prefixed hex string with proper padding
 */
function formatHex(uid) {
  return '0x' + uid.toString(16).padStart(64, '0');
}

/**
 * Generate Noir code for card_uids.nr
 */
function generateNoirCode(uids, comments) {
  let code = `// Precomputed canonical card UIDs for all 108 UNO cards
// Generated using Poseidon4 hash with DOMAIN_CARD_UID = 1
// Compatible with poseidon-lite and noir-lang/poseidon
// Generated: ${new Date().toISOString()}

pub global CANONICAL_DECK_UIDS: [Field; 108] = [
`;

  for (let i = 0; i < uids.length; i++) {
    const hex = formatHex(uids[i]);
    const comma = i < uids.length - 1 ? ',' : '';
    code += `    ${hex}${comma}  // ${comments[i]}\n`;
  }
  
  code += `];

/// Get card UID from components using precomputed lookup table
/// This is MUCH faster than dynamic hashing (30-40% constraint reduction)
pub fn get_card_uid(color: u8, card_type: u8, copy_index: u8) -> Field {
    // Calculate index into CANONICAL_DECK_UIDS array
    // Index formula matches card generation order:
    // - Wild cards: indices 0-7
    // - Colored cards: indices 8-107 (25 cards per color * 4 colors)
    
    let idx = if color == 0 {
        // Wild cards
        if card_type == 13 {
            // Wild: indices 0-3
            copy_index as u32
        } else {
            // Wild Draw Four (type 14): indices 4-7
            4 + (copy_index as u32)
        }
    } else {
        // Colored cards: each color has 25 cards
        let color_offset = 8 + ((color - 1) as u32) * 25;
        
        if card_type == 0 {
            // Zero: first card in color
            color_offset
        } else if card_type <= 9 {
            // Number cards 1-9: 2 copies each
            color_offset + 1 + ((card_type - 1) as u32) * 2 + (copy_index as u32)
        } else {
            // Action cards (Skip=10, Reverse=11, Draw Two=12): 2 copies each
            color_offset + 19 + ((card_type - 10) as u32) * 2 + (copy_index as u32)
        }
    };
    
    CANONICAL_DECK_UIDS[idx]
}
`;

  return code;
}

/**
 * Generate TypeScript code for cardUids.ts
 */
function generateTypeScriptCode(uids, comments) {
  let code = `/**
 * Precomputed canonical card UIDs for all 108 UNO cards
 * Generated using Poseidon4 hash with DOMAIN_CARD_UID = 1
 * Compatible with poseidon-lite and noir-lang/poseidon
 * Generated: ${new Date().toISOString()}
 */

export const CANONICAL_CARD_UIDS: readonly string[] = [
`;

  for (let i = 0; i < uids.length; i++) {
    const hex = formatHex(uids[i]);
    const comma = i < uids.length - 1 ? ',' : '';
    code += `  '${hex}'${comma} // ${comments[i]}\n`;
  }
  
  code += `] as const;

/**
 * Get card UID from components using precomputed lookup table
 * This matches the Noir circuit's get_card_uid function
 */
export function getCardUID(color: number, cardType: number, copyIndex: number = 0): string {
  let idx: number;
  
  if (color === 0) {
    // Wild cards
    if (cardType === 13) {
      // Wild: indices 0-3
      idx = copyIndex;
    } else {
      // Wild Draw Four (type 14): indices 4-7
      idx = 4 + copyIndex;
    }
  } else {
    // Colored cards: each color has 25 cards
    const colorOffset = 8 + (color - 1) * 25;
    
    if (cardType === 0) {
      // Zero: first card in color
      idx = colorOffset;
    } else if (cardType <= 9) {
      // Number cards 1-9: 2 copies each
      idx = colorOffset + 1 + (cardType - 1) * 2 + copyIndex;
    } else {
      // Action cards (Skip=10, Reverse=11, Draw Two=12): 2 copies each
      idx = colorOffset + 19 + (cardType - 10) * 2 + copyIndex;
    }
  }
  
  return CANONICAL_CARD_UIDS[idx];
}

/**
 * Get all card UIDs as an array (useful for deck initialization)
 */
export function getAllCardUIDs(): string[] {
  return [...CANONICAL_CARD_UIDS];
}

/**
 * Get card UID from card string (e.g., "R5", "G_Skip", "W", "W4")
 * Note: For cards with multiple copies, returns the first copy's UID
 * Use getCardUID(color, type, copyIndex) for specific copies
 */
export function getCardUIDFromString(cardStr: string): string | undefined {
  // Parse card string
  const colorChar = cardStr[0].toUpperCase();
  const rest = cardStr.slice(1);
  
  let color: number;
  switch (colorChar) {
    case 'W': color = 0; break;
    case 'R': color = 1; break;
    case 'G': color = 2; break;
    case 'B': color = 3; break;
    case 'Y': color = 4; break;
    default: return undefined;
  }
  
  let cardType: number;
  if (color === 0) {
    // Wild cards
    cardType = rest === '4' || rest === '_D4' || rest === 'D4' ? 14 : 13;
  } else {
    // Parse card type
    const num = parseInt(rest, 10);
    if (!isNaN(num) && num >= 0 && num <= 9) {
      cardType = num;
    } else if (rest.includes('Skip') || rest === 'S') {
      cardType = 10;
    } else if (rest.includes('Reverse') || rest === 'R') {
      cardType = 11;
    } else if (rest.includes('Draw') || rest === 'D2' || rest === '+2') {
      cardType = 12;
    } else {
      return undefined;
    }
  }
  
  return getCardUID(color, cardType, 0);
}
`;

  return code;
}

// Main execution
const { uids, comments } = generateAllCardUIDs();

console.log('Generated', uids.length, 'card UIDs using Poseidon4');
console.log('');

// Output paths (relative to frontend directory)
const noirPath = path.resolve(__dirname, '..', '..', 'circuits', 'lib', 'src', 'card_uids.nr');
const tsPath = path.resolve(__dirname, '..', 'src', 'lib', 'zk', 'cardUids.ts');

// Generate and write files
const noirCode = generateNoirCode(uids, comments);
const tsCode = generateTypeScriptCode(uids, comments);

// Ensure directories exist
const noirDir = path.dirname(noirPath);
const tsDir = path.dirname(tsPath);

if (!fs.existsSync(noirDir)) {
  fs.mkdirSync(noirDir, { recursive: true });
}
if (!fs.existsSync(tsDir)) {
  fs.mkdirSync(tsDir, { recursive: true });
}

fs.writeFileSync(noirPath, noirCode);
console.log('Wrote Noir code to:', noirPath);

fs.writeFileSync(tsPath, tsCode);
console.log('Wrote TypeScript code to:', tsPath);

console.log('');
console.log('Done! Card UIDs regenerated with Poseidon hash.');
console.log('');
console.log('First 5 UIDs (for verification):');
for (let i = 0; i < 5; i++) {
  console.log(`  ${i}: ${formatHex(uids[i])} // ${comments[i]}`);
}
