
export type Field = string | bigint;

/** Merkle proof - struct with path and indices arrays */
export interface MerkleProof {
  path: Field[];
  indices: number[];
}

/** Card UID - Pedersen hash of (color, type, copy_index) */
export type CardUID = Field;

/** Bitset for tracking consumed cards - 108 bits */
export type ConsumedCardsBitset = boolean[];

/** UNO card colors - MUST match circuit's constants.nr */
export enum CardColor {
  WILD = 0,    // COLOR_WILD in circuit
  RED = 1,     // COLOR_RED in circuit
  GREEN = 2,   // COLOR_GREEN in circuit
  BLUE = 3,    // COLOR_BLUE in circuit
  YELLOW = 4,  // COLOR_YELLOW in circuit
}

/** UNO card types */
export enum CardType {
  ZERO = 0,
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  SKIP = 10,
  REVERSE = 11,
  DRAW_TWO = 12,
  WILD = 13,
  WILD_DRAW_FOUR = 14,
}

/** Card representation for circuit inputs */
export interface Card {
  color: CardColor;
  type: CardType;
  copyIndex: number; // 0-3 for wilds, 0-1 for number cards
}

/** Card commitment - hash of card details with nonce */
export interface CardCommitment {
  commitment: Field;
  nonce: Field;
}
/** Shuffle circuit input */
export interface ShuffleCircuitInput {
  /** Input deck of 108 card UIDs (private) */
  uids_in: Field[];
  /** Output shuffled deck of 108 card UIDs (private) */
  uids_out: Field[];
}

/** Shuffle circuit output - no return value, just verification */
export interface ShuffleCircuitOutput {
  verified: boolean;
}


/** Deal circuit input */
export interface DealCircuitInput {
  /** Player identifier (public) */
  player_id: Field;
  /** Merkle root of the deck (public) */
  merkle_root: Field;
  /** Positions of cards being dealt (private) */
  positions: number[];
  /** UIDs of cards being dealt (private) */
  card_uids: Field[];
  /** Nonces for card commitments (private) */
  nonces: Field[];
  /** Merkle proofs for each card (private) */
  merkle_paths: MerkleProof[];
}

/** Deal circuit output */
export interface DealCircuitOutput {
  verified: boolean;
}
/** Draw circuit input */
export interface DrawCircuitInput {
  /** Merkle root of the deck (public) */
  merkle_root: Field;
  /** Hash of previously consumed cards bitset (public) */
  old_consumed_hash: Field;
  /** Hash of new consumed cards bitset (public) */
  new_consumed_hash: Field;
  /** Previous consumed card count (public) */
  old_consumed_count: number;
  /** New consumed card count (public) */
  new_consumed_count: number;
  /** Position of card being drawn (private) */
  position: number;
  /** UID of card being drawn (private) */
  card_uid: Field;
  /** Nonce for card commitment (private) */
  nonce: Field;
  /** Merkle proof for the card (private) */
  merkle_path: MerkleProof;
  /** Previous consumed cards bitset (private) */
  old_consumed_bits: number[];
  /** New consumed cards bitset (private) */
  new_consumed_bits: number[];
}

/** Draw circuit output */
export interface DrawCircuitOutput {
  verified: boolean;
}

/** Play circuit input */
export interface PlayCircuitInput {
  /** Game identifier (public) */
  game_id: Field;
  /** Player identifier (public) */
  player_id: Field;
  /** Commitment to the move (public) */
  move_commitment: Field;
  /** Merkle root of player's hand (public) */
  hand_merkle_root: Field;
  /** Commitment to the top card on discard pile (public) */
  top_card_commitment: Field;
  /** Color of card being played (private) */
  played_card_color: number;
  /** Type of card being played (private) */
  played_card_type: number;
  /** Copy index of card being played (private) */
  played_card_copy: number;
  /** Nonce for played card (private) */
  played_card_nonce: Field;
  /** Merkle proof for played card in hand (private) */
  played_card_merkle_path: MerkleProof;
  /** Color of top card (private) */
  top_card_color: number;
  /** Type of top card (private) */
  top_card_type: number;
  /** Copy index of top card (private) */
  top_card_copy: number;
  /** Nonce for top card commitment (private) */
  top_card_nonce: Field;
  /** Nonce for move commitment (private) */
  commitment_nonce: Field;
}

/** Play circuit output */
export interface PlayCircuitOutput {
  verified: boolean;
}


/** Generated ZK proof */
export interface ZKProof {
  /** The proof bytes */
  proof: Uint8Array;
  /** Public inputs for verification */
  publicInputs: Field[];
  /** Verification key (optional, for caching) */
  verificationKey?: Uint8Array;
}

/** Proof verification result */
export interface VerificationResult {
  /** Whether the proof is valid */
  valid: boolean;
  /** Error message if verification failed */
  error?: string;
}

/**
 * Job status enum matching Kurier API response
 * @see https://docs.zkverify.io/tutorials/submit-proofs/typescript/kurier-api
 */
export type KurierJobStatus = 
  | 'Queued'
  | 'Valid'
  | 'Submitted'
  | 'IncludedInBlock'
  | 'Finalized'
  | 'AggregationPending'
  | 'Aggregated'
  | 'AggregationPublished'
  | 'Failed';

/** zkVerify Kurier submission response */
export interface KurierSubmitResponse {
  /** Job ID for tracking */
  jobId: string;
  /** Optimistic verification result */
  optimisticVerify?: 'success' | 'failed';
  /** Error message if failed */
  error?: string;
}

/** zkVerify verification status */
export interface KurierVerificationStatus {
  jobId: string;
  status: KurierJobStatus;
  txHash?: string;
  txExplorerUrl?: string;
  attestationId?: string;
  aggregatorUrl?: string;
  error?: string;
}

/** Circuit artifact paths and metadata */
export interface CircuitArtifact {
  /** Circuit name */
  name: string;
  /** Path to compiled circuit JSON */
  circuitPath: string;
  /** Path to verification key */
  vkPath: string;
}

/** All circuit artifacts */
export const CIRCUIT_ARTIFACTS: Record<string, CircuitArtifact> = {
  shuffle: {
    name: 'shuffle',
    circuitPath: '/circuits/shuffle_circuit.json',
    vkPath: '/circuits/shuffle_circuit_vk',
  },
  deal: {
    name: 'deal',
    circuitPath: '/circuits/deal_circuit.json',
    vkPath: '/circuits/deal_circuit_vk',
  },
  draw: {
    name: 'draw',
    circuitPath: '/circuits/draw_circuit.json',
    vkPath: '/circuits/draw_circuit_vk',
  },
  play: {
    name: 'play',
    circuitPath: '/circuits/play_circuit.json',
    vkPath: '/circuits/play_circuit_vk',
  },
};


/** Number of cards in UNO deck */
export const DECK_SIZE = 108;

/** Merkle tree depth */
export const MERKLE_DEPTH = 7;

/** Number of cards dealt initially */
export const INITIAL_HAND_SIZE = 5;

/** Maximum number of players */
export const MAX_PLAYERS = 6;
