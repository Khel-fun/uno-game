/**
 * ZK Cryptography Module for UNO Game
 * 
 * This module provides:
 * - Pre-computed card UIDs matching the Noir circuits (Poseidon hashes)
 * - Merkle tree construction for card proofs
 * - Card commitment generation using Poseidon hash
 * - Consumed bitset tracking
 * 
 * The card UIDs are pre-computed in the Noir circuits using Poseidon hash.
 * We use poseidon-lite to match the zk-kit binary_merkle_root implementation.
 */

const crypto = require('crypto');
const { poseidon2, poseidon3, poseidon4 } = require('poseidon-lite');

// Domain separation constants (must match Noir circuits in constants.nr)
const DOMAIN_CARD_UID = 1n;
const DOMAIN_CARD_COMMITMENT = 2n;
const DOMAIN_MERKLE_NODE = 3n;
const DOMAIN_BITSET_COMPRESS = 4n;

// Merkle tree depth (supports 128 leaves for 108 cards)
const MERKLE_DEPTH = 7;
const DECK_SIZE = 108;

// BN254 field modulus
const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Pre-computed canonical card UIDs from the Noir circuits
 * These are Poseidon hashes computed as: Poseidon4(DOMAIN_CARD_UID, color, type, copy_index)
 * Order: Wild cards first (0-7), then Red/Green/Blue/Yellow (8-107)
 * 
 * This lookup table MUST match circuits/lib/src/card_uids.nr exactly!
 * Generated using Poseidon with domain separation (compatible with poseidon-lite and noir-lang/poseidon)
 */
const CANONICAL_DECK_UIDS = [
  // Wild cards (color=0)
  0x2a6cdcd8bc3579aa55dabad85ac4befebd94577e5cd744b0000c7f991aac8d35n,  // Wild #1
  0x15399bce9bc49ae4d02c35bed3d49c9a037b8e58ab6b051ef899431edd11b830n,  // Wild #2
  0x1546f2bffd7b8bd9cd757f6ced26d90f754e761f9a1be54ff44d44f7265ea5f2n,  // Wild #3
  0x29e9824b0cb5b33b70aaca8b51ff0f92facfe1a20ef68c0f5512316c8700591dn,  // Wild #4
  0x1ce369677b9f9cfc766cbee339f60e802a732ba037f9d7e50fd48c2ebaefb30dn,  // Wild Draw Four #1
  0x164fe74299a3c3b92e981f907f6728502612bd28a6c526ba9042c3f50ce86a91n,  // Wild Draw Four #2
  0x25bd560e37269af2e95ae09b34b9894d414e005ce080279c1bc4fc57ae4208e7n,  // Wild Draw Four #3
  0x03eccf45d37cef180014221f09d623ce92d0115dba81ec1477fc5d907c3c3b99n,  // Wild Draw Four #4
  // Red cards (color=1)
  0x290e07b037fe093e2249c0391aab6ace363b7bb02ae91a7ca16eeef20e61872cn,  // Red 0
  0x264dc17664ff9f8c44a0132b7fe8870790b247534ac24837805ba3a2b6b9cc27n,  // Red 1 #1
  0x082c9c370a0d24f4416fbc414a37681f78442d27d86385991c17d6fc0c4b7d71n,  // Red 1 #2
  0x0bbbe2d1134ffcd86f36468e0980cf9db64a3e8c3104ed5d7ced8485902d46cen,  // Red 2 #1
  0x2dfef6d06612a809f339947a930e12a910519ec20b301f8b4cc6ed586a4c9d40n,  // Red 2 #2
  0x0e0e38810d3fe1b184b62136ead9b60621ab68a5c45f0db98d90d13d81dfb1d6n,  // Red 3 #1
  0x283e815c77748a442009d2a82a2895fb08db7462a73e08541d71f7e8c71a5977n,  // Red 3 #2
  0x275e04157c917424c3fb591d2f8a4c15d0d6b7a5fa7b7edf764d12a3aa3c1d70n,  // Red 4 #1
  0x014a5e5ad3db0828edb192cebbe741d667880be4b48144f2c248b7d07f2d58f7n,  // Red 4 #2
  0x216a55f1ff49c2ff8bde56c99b7c66ec76925ddc4861fa43d552ecede2006574n,  // Red 5 #1
  0x0105b9d588e1f042329040a5f524c6b1d601f7cf47bde07850bd45a36c80d8b1n,  // Red 5 #2
  0x228e002822495e7dfe4ae13f49353596128401fa96b72569c1bedfaa1c42e26cn,  // Red 6 #1
  0x2442869ceb0ac29b2cac3f7582a26c55cbc1f4742ecfabbb12a03bf6e67c5084n,  // Red 6 #2
  0x2b63d010e718f2875d46f81a57a93a7bd3f9af42d1cb9afcd4963f1359b0c30fn,  // Red 7 #1
  0x14d48a72e760be0f5aee0b107606ed3a1431502610640717ecde12337d540c18n,  // Red 7 #2
  0x16de5a1453a41d166b394b4fd37b107e6b3400df4d0fe7dd5459b701744138cdn,  // Red 8 #1
  0x1c2544a0ef7810c290e6852c4df8c88a883ed4672c1820aeec91dc0901ac4624n,  // Red 8 #2
  0x01c6875604be6e2b115dd25c83cfc19e3ebedbac6d2fd616315765b48eef0df2n,  // Red 9 #1
  0x22f250e8c8dee74ed18f75f2d581bd14fb2ed3af1c94c02b007883515ffdb98en,  // Red 9 #2
  0x0f7fb5a3b011777375bda214f28cdcf1b922ab217f2250475b1900fb15b80cc5n,  // Red Skip #1
  0x0bc3c3d00dfbbf97833124abe896e3e024403f9bc9b29365dc54d74da5322f63n,  // Red Skip #2
  0x2649d74c6f8b1d669960bfd7946ade5d27f27727b1ddb1efcfc4ac5e2122777dn,  // Red Reverse #1
  0x065cfa6a7ce9c6e0a739a555cb7671c5a180583114fbd951f9a2d889873e63d9n,  // Red Reverse #2
  0x0da41a1be463a052cf6199f0a4092719ef453c09f802c5dde8be79319e89899bn,  // Red Draw Two #1
  0x269bb337d0870d5edf941a8d3947ed39599b2d21a1c4ccc52f3e07593ff081adn,  // Red Draw Two #2
  // Green cards (color=2)
  0x02dc834ec657d422e97259ba5ce787ae225f1a8cd7046f8f5ff279563beafc97n,  // Green 0
  0x258f8b5681ac53d9038296e0ad9e87a1295faa392a70a1b0d2af3848526e0536n,  // Green 1 #1
  0x177792f32a498909bfadd9265b5213ee6a46a5bab3c8468a1ecb9f7eb62c6df6n,  // Green 1 #2
  0x2af305c79b4cd9305d158cb1a862f2a21cb6460b0ebc895ff98a395e16a52bdcn,  // Green 2 #1
  0x0e7d9c04474b4bc212f06e7888f03c8f73c5e321d7e966c11096168e7384d012n,  // Green 2 #2
  0x236cd68db884faf57fdda2de4b912d04801cca1aadf48485f3ceb3678390963dn,  // Green 3 #1
  0x14eddc90614876ec83764308ffb6219a24096d180c787007dab2a1c1951684e7n,  // Green 3 #2
  0x24a63bf3b98935ddecccff63763b24dda9b4b65e7fcb2b9ad2466787f3dee92bn,  // Green 4 #1
  0x237b677989006e49aa5473def7d36326590a75da9f239b9df17a66dfdb41df8fn,  // Green 4 #2
  0x10f21b57287074ebaf214a9e7dd0916de66ae915b88558868791eba498df4f76n,  // Green 5 #1
  0x1c00aba23809d159cc9d2a4307ff0ef0a1df0bc8eb38bec81a0823d508d550a6n,  // Green 5 #2
  0x0191b3ed873ed731da935f279c6be46b49da5f1371a5020ca50fd23491c3f264n,  // Green 6 #1
  0x12c93b329cb147602143333684025c523f7c7187872feeae5354b19de6d35264n,  // Green 6 #2
  0x26a633e726a56a3a3799671a3ac492226c8c2432157dfdb0e5e61c2d6d7d65ddn,  // Green 7 #1
  0x0a6df0d0867bb51cb24c7a07e4479e88a43725f8d0d492280d81cbc4ac467530n,  // Green 7 #2
  0x2bc8bf362dc8bc2f1bce9d11865639a91f6945e48578204fcc6751201c8703ecn,  // Green 8 #1
  0x032a65d905241b5c74931b5517a7063739c24f539f6faa82fb517fbf761dbfd3n,  // Green 8 #2
  0x05c73ccaad7b8f4e598205307dda738de982f2c1fb3198c32bf99443efd2b15bn,  // Green 9 #1
  0x2e1d181eb89684fa6f34f23bc33892f046ce18af9d1805b66c561769e7cf08c9n,  // Green 9 #2
  0x1d5f9040199e3492df82b381b8670ea3eab41ef4d894bd762c1681ae098f3a72n,  // Green Skip #1
  0x2253a1cee2dbe25f773a3406ded09dd3f3896930d9512b2a28f0df1dc398c802n,  // Green Skip #2
  0x06abedcce5a8e2e5d50cec44543ff9e29199ace189feebd41670bb440e07b671n,  // Green Reverse #1
  0x0d429f12fc5b3ebedbfc4411cfb660d55c9e7b5db6fb8b98514c0b8be9a6a0b5n,  // Green Reverse #2
  0x177ae05f701913d5e89c51ccfd0724c4b6514fea92420cb39f8a7faa7157aec8n,  // Green Draw Two #1
  0x1fae4554954f30227d49cf99c984c70fbb24aec477de689f767ed3c3187aea38n,  // Green Draw Two #2
  // Blue cards (color=3)
  0x25693890c50b902aac15d4308230c2c922a358729eef2802a22c51c9e1f019efn,  // Blue 0
  0x1388b3f46f44f34ef1e07532bead1bd235b8f3ae9fe5af36273cb292b045da34n,  // Blue 1 #1
  0x1dfbf5e4ec5c30e823c661abde7a2e9fc895cf74f3bdb5fd61ab2e509c544ed4n,  // Blue 1 #2
  0x051e476b08ca4c8f249c2df4ab18ca04084665cda109b9c0ea0b04964bd7064en,  // Blue 2 #1
  0x171c5c53a2480d77f7d88ff8a90ec57d71ce808152e6f9ace752d07562b7a612n,  // Blue 2 #2
  0x16dcd75a4bcee4cbb3f99b1894eca5584a954eeeb16ec2b1326e69cda2065990n,  // Blue 3 #1
  0x1efb1b56b120fbfd03df3131212887aecaa2a51bb2bb9d5638ecc9f08de9c365n,  // Blue 3 #2
  0x19299f5a75f5587871f7818ad35f6a627514e3c6aadf7e5d80e3e17e8c264571n,  // Blue 4 #1
  0x057aefa7433a203d89bffe78a25905cccfe4bd0c6c9c413181d3c4bf4ef45714n,  // Blue 4 #2
  0x002a259ebf8de94944b5fd37dbf31f4966be6f1fff3a4d7faf9badf7ff0451b0n,  // Blue 5 #1
  0x25710833df4924b83109f3ff52ea0f4b326b51da3e9810315d369e6f3c09718bn,  // Blue 5 #2
  0x1f55ff2289b939e46b6321f0bf6179587c62b889835b4bee11cc2c84108555ecn,  // Blue 6 #1
  0x0bfcfea65405f7e02b2758bfc44d20b07bb32319af54c0b8f7678db41a844001n,  // Blue 6 #2
  0x1a70f3eb711501510063904245011928d8dac8f3457fe51c9509b43f98f6c3d9n,  // Blue 7 #1
  0x25ad74283fd1d43651a5fbff60454ad4fa860efa365a504eadf57adee32c190bn,  // Blue 7 #2
  0x0ef74d9971389dcff0dab3a8b7b37ac26f5eee91ebb1a3f232689cd3c3aafe36n,  // Blue 8 #1
  0x26afab7ef3570f335e1ed1009b3c0ce2e27b0dbbdfd9f2fa39785473a26a0609n,  // Blue 8 #2
  0x28ef608d993f9bc10e06c39e2c68ab5e44e86d7e1b85e32674aeae1be45e6368n,  // Blue 9 #1
  0x0f64c91db7387f3d6d28fb1b988c3419d347986097481d694579ed46547ff39bn,  // Blue 9 #2
  0x29456feaad0f728f73c61dd157a31b35647b8d5208baf40e46755856ecf3e4aan,  // Blue Skip #1
  0x1c268e9912e19bab84c4730b969d7ee2448eadfa8f97b6a9c5d28d0daf18eb2an,  // Blue Skip #2
  0x2ed811d54066ed3682067598f1e3346def0e0113ad337a317fb127b48374305bn,  // Blue Reverse #1
  0x09d1ef63614b647bafabb592a304beee282551e8464a67fb3df1cee191cb5fd8n,  // Blue Reverse #2
  0x2089075a59919d59e06293bcaccd8bed1b0b66580b3c5d9c8fd1aa5224095d7an,  // Blue Draw Two #1
  0x2868da79cb45664728a477cea620f524515dc43ba658aef66ab0d6f755d8e1d4n,  // Blue Draw Two #2
  // Yellow cards (color=4)
  0x03297eb97224fb8532ee8e917df87d2e8267aa7893280edb1a215d3d53a0bb55n,  // Yellow 0
  0x2ccc5c94119c33942303bf6e4efed1a78a5f338cf29084ea76fd800774711d12n,  // Yellow 1 #1
  0x07d9350ff03d6775bee6ed54a5dcfc0dfc5a5f181cd0df757ffbe99034dcdeb0n,  // Yellow 1 #2
  0x20b3d3ed8ba7c28d14db6b037922e57ea32ca939cc87b3f162ba31f4832981c8n,  // Yellow 2 #1
  0x20d49c5b50d32dee4599679c52b55a1fd2a300720ba202779322cf47d50be4ccn,  // Yellow 2 #2
  0x0add253819efcc07148368577893035e523c6103719cf78ed38e98ab2a3a7435n,  // Yellow 3 #1
  0x15abd07fc015bd165cb58847b9c02fc3b785cc07c9de5aa5b0c1795d3f5dc429n,  // Yellow 3 #2
  0x0a5237f423813656dd2b128cae60898e2617f77ef671f612cc55dcb46d6d1889n,  // Yellow 4 #1
  0x214f72d0ab97b9331f5611ad27c9949b410a48005de288db33fce5a34c835588n,  // Yellow 4 #2
  0x26828a77f3d96afc22fe442797f59b001f43d788345d7a0a131eb4bb4755c49cn,  // Yellow 5 #1
  0x1e8d26984fe3e8cc7eaaa27d86d2e9ed11c230af7aa69630188be900322d73aen,  // Yellow 5 #2
  0x18cb992f10e5ba5fbdb31750bd108decdbdb2d7271646f61e343083e2797ded5n,  // Yellow 6 #1
  0x106094007938a20bdc92b4f55916514c97aa6c22709da2b0b64a0c6a0e514cc2n,  // Yellow 6 #2
  0x102ac4be4f30ec59f197de96592dfc96ab172151385dacd93d85b9d42c0e14b5n,  // Yellow 7 #1
  0x16ca85a5ce5b6b932293e5c39a18f138c861487e32b58e913d7460ffddd928e6n,  // Yellow 7 #2
  0x23076b3c1f6792d6aae0d6097443ce32681940bf1522702a0c5eb0dc52a9da1an,  // Yellow 8 #1
  0x2a1db3d09714673a39cb34e6d824dd00e3c24e1fa188efde8d1db57f33f2f489n,  // Yellow 8 #2
  0x2f080167c8513cd5a9e58b71ba48e2ef766c1a01a4929621f87d493f1d44c7can,  // Yellow 9 #1
  0x0a56b5bf3703125883a0c9d471e51a1be79d69d0a9a4d97013da1ab5cbabdc29n,  // Yellow 9 #2
  0x22736225a8fabe8d98dcfda0bfc33d1e1de62882b4d8b817730b67e1f75dcb3dn,  // Yellow Skip #1
  0x18170b1295633adcbc77e52a3004e1e5d6eacf35b8c5fbbe86a2019e68bfddfbn,  // Yellow Skip #2
  0x0002d5a2dc39f62a2f23ccc8c3d0fcb70307a1727ac925b919f4061420dbc359n,  // Yellow Reverse #1
  0x0282815f9649c24c08593d598b8aea5d8336edb3140ffd23a024160ad55924fbn,  // Yellow Reverse #2
  0x1f6220caaeaf51e1b7125da7e8e00fe224e2eea30309c773156fdfbb9174ea4an,  // Yellow Draw Two #1
  0x197e2a97ae54ac57b82f9cebf80397a7d6dde166950d68c6f9d79e1418066c8bn   // Yellow Draw Two #2
];

/**
 * Hash a bitset chunk using Poseidon - matches circuits/lib/src/utils/hash.nr: hash_bitset_chunk
 * Pack 16 bits into a field value, then hash with domain separation
 */
function hashBitsetChunk(bits) {
  // Pack bits into a single BigInt value (same as circuit: value = value * 2 + bit)
  let value = DOMAIN_BITSET_COMPRESS;
  for (let i = 0; i < 16; i++) {
    value = value * 2n + BigInt(bits[i] || 0);
  }
  return poseidon2([DOMAIN_BITSET_COMPRESS, value]);
}

/**
 * Get card UID from the pre-computed lookup table (matches Noir get_card_uid)
 * This is the CORRECT way to get UIDs - using pre-computed Poseidon hashes
 */
function getCardUID(color, cardType, copyIndex) {
  // Calculate index into CANONICAL_DECK_UIDS array
  // Index formula matches card generation order in circuits
  let idx;
  
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
  
  if (idx < 0 || idx >= DECK_SIZE) {
    throw new Error(`Invalid card index ${idx} for color=${color}, type=${cardType}, copy=${copyIndex}`);
  }
  
  return CANONICAL_DECK_UIDS[idx];
}

/**
 * Generate a card commitment (Merkle leaf) using Poseidon hash
 * commitment = Poseidon3(DOMAIN_CARD_COMMITMENT, card_uid, nonce)
 * Must match circuits/lib/src/utils/hash.nr: hash_card_commitment
 */
function generateCardCommitment(cardUID, nonce) {
  return poseidon3([DOMAIN_CARD_COMMITMENT, cardUID, nonce]);
}

/**
 * Hash two Merkle nodes using Poseidon2
 * node = Poseidon2(left, right)
 * NO domain separation - matches zk-kit binary_merkle_root and circuits
 * Must match circuits/lib/src/utils/merkle.nr: poseidon_hasher
 */
function hashMerkleNode(left, right) {
  return poseidon2([left, right]);
}

/**
 * Generate a random nonce
 */
function generateNonce() {
  const bytes = crypto.randomBytes(16);
  return BigInt('0x' + bytes.toString('hex')) % FIELD_MODULUS;
}

/**
 * Parse a card string (e.g., "5R", "D2B", "W") into color/type/copy
 * Returns { color, cardType, cardName }
 */
function parseCard(cardStr) {
  if (!cardStr) return null;
  
  // Wild cards
  if (cardStr === 'W') {
    return { color: 0, cardType: 13, cardName: 'Wild' };
  }
  if (cardStr === 'D4W') {
    return { color: 0, cardType: 14, cardName: 'Wild Draw Four' };
  }
  
  // Color mapping
  const colorMap = { 'R': 1, 'G': 2, 'B': 3, 'Y': 4 };
  
  // Skip card: skipR, skipG, etc.
  if (cardStr.startsWith('skip')) {
    const colorChar = cardStr.charAt(4);
    return { color: colorMap[colorChar] || 0, cardType: 10, cardName: 'Skip' };
  }
  
  // Reverse card: _R, _G, etc.
  if (cardStr.startsWith('_')) {
    const colorChar = cardStr.charAt(1);
    return { color: colorMap[colorChar] || 0, cardType: 11, cardName: 'Reverse' };
  }
  
  // Draw Two card: D2R, D2G, etc.
  if (cardStr.startsWith('D2')) {
    const colorChar = cardStr.charAt(2);
    return { color: colorMap[colorChar] || 0, cardType: 12, cardName: 'Draw Two' };
  }
  
  // Number card: 0R, 5B, 9Y, etc.
  const num = parseInt(cardStr.charAt(0), 10);
  if (!isNaN(num) && num >= 0 && num <= 9) {
    const colorChar = cardStr.charAt(1);
    return { color: colorMap[colorChar] || 0, cardType: num, cardName: `${num}` };
  }
  
  return null;
}

/**
 * Build a Merkle tree from an array of leaves
 * Returns { root, layers } where layers[0] = leaves, layers[n] = root
 * 
 * IMPORTANT: Always pads to 2^MERKLE_DEPTH leaves to match circuit expectations.
 * The circuit uses binary_merkle_root with depth=MERKLE_DEPTH, so we must have
 * exactly that many levels in the tree.
 */
function buildMerkleTree(leaves) {
  if (leaves.length === 0) {
    return { root: 0n, layers: [[]] };
  }
  
  // Always pad to 2^MERKLE_DEPTH to match circuit's fixed depth
  // MERKLE_DEPTH = 7, so targetSize = 128
  const targetSize = Math.pow(2, MERKLE_DEPTH);
  let paddedLeaves = [...leaves];
  while (paddedLeaves.length < targetSize) {
    paddedLeaves.push(0n); // Pad with zeros
  }
  
  const layers = [paddedLeaves];
  let currentLayer = paddedLeaves;
  
  while (currentLayer.length > 1) {
    const nextLayer = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1];
      nextLayer.push(hashMerkleNode(left, right));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }
  
  return { root: currentLayer[0] || 0n, layers };
}

/**
 * Generate a Merkle proof for a leaf at a given index
 * Returns { path, indices } matching the MerkleProof struct in Noir
 */
function generateMerkleProof(layers, leafIndex) {
  const path = [];
  const indices = [];
  
  let currentIndex = leafIndex;
  
  for (let level = 0; level < layers.length - 1 && level < MERKLE_DEPTH; level++) {
    const layer = layers[level];
    const isLeft = currentIndex % 2 === 0;
    const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
    
    path.push(layer[siblingIndex] || 0n);
    indices.push(isLeft ? 0 : 1);
    
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  // Pad to MERKLE_DEPTH
  while (path.length < MERKLE_DEPTH) {
    path.push(0n);
    indices.push(0);
  }
  
  return { path, indices };
}

/**
 * ZK Game State Manager
 * Tracks cryptographic state for a game
 */
class ZKGameState {
  constructor(gameId) {
    this.gameId = gameId;
    this.cards = new Map(); // cardStr -> { uid, nonce, commitment, index }
    this.deck = []; // Array of card strings in deck order
    this.merkleTree = null;
    this.consumedBits = new Array(DECK_SIZE).fill(0);
    this.consumedCount = 0;
    this.cardCopyTracker = new Map(); // "color-type" -> count (for tracking copy indices)
  }
  
  /**
   * Initialize the ZK state with a shuffled deck
   */
  initializeDeck(shuffledDeck) {
    this.deck = [...shuffledDeck];
    this.cards.clear();
    this.cardCopyTracker.clear();
    
    const leaves = [];
    
    for (let i = 0; i < shuffledDeck.length; i++) {
      const cardStr = shuffledDeck[i];
      const parsed = parseCard(cardStr);
      if (!parsed) continue;
      
      // Track copy index
      const copyKey = `${parsed.color}-${parsed.cardType}`;
      const copyIndex = this.cardCopyTracker.get(copyKey) || 0;
      this.cardCopyTracker.set(copyKey, copyIndex + 1);
      
      // Get UID from pre-computed lookup table and generate commitment
      const uid = getCardUID(parsed.color, parsed.cardType, copyIndex);
      const nonce = generateNonce();
      const commitment = generateCardCommitment(uid, nonce);
      
      this.cards.set(`${cardStr}-${i}`, {
        cardStr,
        uid,
        nonce,
        commitment,
        index: i,
        color: parsed.color,
        cardType: parsed.cardType,
        copyIndex,
      });
      
      leaves.push(commitment);
    }
    
    // Build Merkle tree
    this.merkleTree = buildMerkleTree(leaves);
    this.consumedBits = new Array(DECK_SIZE).fill(0);
    this.consumedCount = 0;
    
    // Log first card for debugging
    console.log(`[ZK] Deck initialized: ${leaves.length} cards, merkleRoot=${this.merkleTree.root.toString().slice(0, 20)}...`);
    
    return {
      merkleRoot: this.merkleTree.root.toString(),
      cardCount: this.deck.length,
    };
  }
  
  /**
   * Get ZK data for a card at a specific deck position
   */
  getCardZKData(cardStr, deckPosition) {
    const key = `${cardStr}-${deckPosition}`;
    const cardData = this.cards.get(key);
    
    if (!cardData) {
      // Card not found - try to find by just cardStr
      for (const [k, v] of this.cards.entries()) {
        if (v.cardStr === cardStr && !v.consumed) {
          return this.getCardZKDataByKey(k);
        }
      }
      return null;
    }
    
    return this.getCardZKDataByKey(key);
  }
  
  getCardZKDataByKey(key) {
    const cardData = this.cards.get(key);
    if (!cardData) return null;
    
    const proof = generateMerkleProof(this.merkleTree.layers, cardData.index);
    
    return {
      cardUID: cardData.uid.toString(),
      nonce: cardData.nonce.toString(),
      commitment: cardData.commitment.toString(),
      merkleRoot: this.merkleTree.root.toString(),
      merkleProof: {
        path: proof.path.map(p => p.toString()),
        indices: proof.indices,
      },
      color: cardData.color,
      cardType: cardData.cardType,
      copyIndex: cardData.copyIndex,
      index: cardData.index,
    };
  }
  
  /**
   * Mark a card as consumed (drawn or played)
   * Returns the ZK data needed for proof generation
   */
  consumeCard(cardStr, deckPosition) {
    const zkData = this.getCardZKData(cardStr, deckPosition);
    if (!zkData) return null;
    
    const position = zkData.index;
    if (position >= DECK_SIZE) return null;
    
    // Get old state
    const oldConsumedBits = [...this.consumedBits];
    const oldConsumedCount = this.consumedCount;
    const oldConsumedHash = this.compressBitset(oldConsumedBits);
    
    // Update state
    this.consumedBits[position] = 1;
    this.consumedCount++;
    
    // Get new state
    const newConsumedBits = [...this.consumedBits];
    const newConsumedHash = this.compressBitset(newConsumedBits);
    
    // Mark as consumed
    const key = `${cardStr}-${deckPosition}`;
    const cardData = this.cards.get(key);
    if (cardData) cardData.consumed = true;
    
    return {
      ...zkData,
      position,
      oldConsumedBits,
      newConsumedBits,
      oldConsumedHash: oldConsumedHash.toString(),
      newConsumedHash: newConsumedHash.toString(),
      oldConsumedCount,
      newConsumedCount: this.consumedCount,
    };
  }
  
  /**
   * Compress a bitset into a hash
   * Matches circuits/lib/src/utils/hash.nr: compress_bitset
   */
  compressBitset(bits) {
    // Simple compression - hash the bits in chunks of 16
    const chunkSize = 16;
    const chunkHashes = [];
    
    for (let i = 0; i < bits.length; i += chunkSize) {
      const chunk = bits.slice(i, i + chunkSize);
      while (chunk.length < chunkSize) chunk.push(0);
      chunkHashes.push(hashBitsetChunk(chunk));
    }
    
    // Combine chunk hashes using Merkle-like structure
    let result = chunkHashes[0] || 0n;
    for (let i = 1; i < chunkHashes.length; i++) {
      result = hashMerkleNode(result, chunkHashes[i]);
    }
    
    return result;
  }
  
  /**
   * Get the current Merkle root
   */
  getMerkleRoot() {
    return this.merkleTree?.root?.toString() || '0';
  }
  
  /**
   * Get consumed state for proof generation
   */
  getConsumedState() {
    return {
      bits: [...this.consumedBits],
      count: this.consumedCount,
      hash: this.compressBitset(this.consumedBits).toString(),
    };
  }
  
  /**
   * Serialize the ZK state for storage
   */
  toJSON() {
    const cardsArray = [];
    for (const [key, value] of this.cards.entries()) {
      cardsArray.push({
        key,
        ...value,
        uid: value.uid.toString(),
        nonce: value.nonce.toString(),
        commitment: value.commitment.toString(),
      });
    }
    
    return {
      gameId: this.gameId,
      deck: this.deck,
      cards: cardsArray,
      merkleRoot: this.merkleTree?.root?.toString() || '0',
      consumedBits: this.consumedBits,
      consumedCount: this.consumedCount,
    };
  }
  
  /**
   * Restore from serialized state
   */
  static fromJSON(json) {
    const state = new ZKGameState(json.gameId);
    state.deck = json.deck || [];
    state.consumedBits = json.consumedBits || new Array(DECK_SIZE).fill(0);
    state.consumedCount = json.consumedCount || 0;
    
    // Restore cards map
    const leaves = [];
    for (const card of json.cards || []) {
      const commitment = BigInt(card.commitment);
      state.cards.set(card.key, {
        ...card,
        uid: BigInt(card.uid),
        nonce: BigInt(card.nonce),
        commitment,
      });
      leaves.push(commitment);
    }
    
    // Rebuild Merkle tree
    if (leaves.length > 0) {
      state.merkleTree = buildMerkleTree(leaves);
    }
    
    return state;
  }
}

// Store for active game ZK states
const zkGameStates = new Map();

/**
 * Get or create ZK state for a game
 */
function getZKGameState(gameId) {
  if (!zkGameStates.has(gameId)) {
    zkGameStates.set(gameId, new ZKGameState(gameId));
  }
  return zkGameStates.get(gameId);
}

/**
 * Initialize ZK state for a new game
 */
function initializeZKGame(gameId, shuffledDeck) {
  const zkState = new ZKGameState(gameId);
  const result = zkState.initializeDeck(shuffledDeck);
  zkGameStates.set(gameId, zkState);
  return {
    ...result,
    zkState: zkState.toJSON(),
  };
}

/**
 * Extract numeric player ID from various formats
 * "Player 1" -> 1, "Player 2" -> 2, "0xabc..." -> hash to number, etc.
 */
function parsePlayerId(playerId) {
  if (typeof playerId === 'number') return playerId;
  if (!playerId) return 0;
  
  const str = String(playerId);
  
  // Extract number from "Player N" format
  const match = str.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // For wallet addresses, take last 8 hex chars and convert to number
  if (str.startsWith('0x') && str.length > 10) {
    const lastBytes = str.slice(-8);
    return parseInt(lastBytes, 16) % 1000000; // Keep it reasonable
  }
  
  return 0;
}

/**
 * Get ZK proof data for playing a card
 */
function getPlayProofData(gameId, playedCard, topCard, playerHand, playerId) {
  const zkState = zkGameStates.get(gameId);
  if (!zkState) {
    return { error: 'ZK state not found for game' };
  }
  
  // Convert player ID to numeric
  const numericPlayerId = parsePlayerId(playerId);
  
  // Find the played card in the deck
  let playedCardData = null;
  for (const [key, data] of zkState.cards.entries()) {
    if (data.cardStr === playedCard && !data.consumed) {
      playedCardData = zkState.getCardZKDataByKey(key);
      break;
    }
  }
  
  if (!playedCardData) {
    return { error: 'Played card not found in ZK state' };
  }
  
  // Find top card data
  let topCardData = null;
  for (const [key, data] of zkState.cards.entries()) {
    if (data.cardStr === topCard) {
      topCardData = zkState.getCardZKDataByKey(key);
      break;
    }
  }
  
  // Compute move commitment: poseidon4([game_id, player_id, played_card_uid, commitment_nonce])
  // Must match circuits/play/src/main.nr: hash_4([game_id, player_id, played_card_uid, commitment_nonce])
  const gameIdBigInt = BigInt(gameId || 0);
  const playerIdBigInt = BigInt(numericPlayerId);
  const cardUID = BigInt(playedCardData.cardUID);
  const nonce = BigInt(playedCardData.nonce);
  const moveCommitment = poseidon4([gameIdBigInt, playerIdBigInt, cardUID, nonce]);
  
  return {
    gameId: String(gameId),
    playerId: numericPlayerId,
    playedCard: {
      cardStr: playedCard,
      ...playedCardData,
      commitment: moveCommitment.toString(), // Use computed move commitment
    },
    topCard: topCardData ? {
      cardStr: topCard,
      ...topCardData,
    } : null,
    merkleRoot: zkState.getMerkleRoot(),
    handMerkleRoot: zkState.getMerkleRoot(), // Use deck merkle root for hand
    consumedState: zkState.getConsumedState(),
  };
}

/**
 * Get ZK proof data for drawing a card
 */
function getDrawProofData(gameId, drawnCard, deckPosition) {
  const zkState = zkGameStates.get(gameId);
  if (!zkState) {
    return { error: 'ZK state not found for game' };
  }
  
  // Consume the card and get proof data
  const consumeData = zkState.consumeCard(drawnCard, deckPosition);
  if (!consumeData) {
    return { error: 'Failed to consume card' };
  }
  
  return {
    gameId,
    drawnCard: {
      cardStr: drawnCard,
      ...consumeData,
    },
    merkleRoot: zkState.getMerkleRoot(),
  };
}

module.exports = {
  ZKGameState,
  getZKGameState,
  initializeZKGame,
  getPlayProofData,
  getDrawProofData,
  parseCard,
  getCardUID,
  generateCardCommitment,
  generateNonce,
  buildMerkleTree,
  generateMerkleProof,
  CANONICAL_DECK_UIDS,
  MERKLE_DEPTH,
  DECK_SIZE,
};
