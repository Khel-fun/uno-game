// Poseidon hashing utilities for ZK UNO
// Migrated from Pedersen to Poseidon for zk-kit compatibility

// Import from external poseidon library (noir-lang/poseidon)
use poseidon::poseidon::bn254::hash_2;
use poseidon::poseidon::bn254::hash_3;
use poseidon::poseidon::bn254::hash_4;

use crate::constants::{DOMAIN_CARD_UID, DOMAIN_CARD_COMMITMENT, DOMAIN_MERKLE_NODE, DOMAIN_BITSET_COMPRESS};

/// Poseidon hash wrapper for 2 elements
/// Compatible with zk-kit LeanIMT
pub fn poseidon_hash_2(a: Field, b: Field) -> Field {
    hash_2([a, b])
}

/// Poseidon hash wrapper for array (used by binary_merkle_root)
pub fn poseidon_hasher(inputs: [Field; 2]) -> Field {
    hash_2(inputs)
}

/// Hash a card to generate unique identifier
/// card_uid = Poseidon(domain || color || type || copy_index)
/// 
/// DEPRECATED: Use get_card_uid() from card_uids module instead for better performance
/// This function is kept for testing/validation purposes only
pub fn hash_card_uid(color: u8, card_type: u8, copy_index: u8) -> Field {
    hash_4([
        DOMAIN_CARD_UID,
        color as Field,
        card_type as Field,
        copy_index as Field
    ])
}

/// Create card commitment (Merkle leaf)
/// commitment = Poseidon(DOMAIN_CARD_COMMITMENT || card_uid || nonce)
pub fn hash_card_commitment(card_uid: Field, nonce: Field) -> Field {
    hash_3([DOMAIN_CARD_COMMITMENT, card_uid, nonce])
}

/// Hash two Merkle tree nodes
/// node = Poseidon(left || right)
/// Note: No domain separation for Merkle nodes to be compatible with zk-kit LeanIMT
pub fn hash_merkle_node(left: Field, right: Field) -> Field {
    hash_2([left, right])
}

/// Hash two Merkle tree nodes with domain separation (legacy, for backward compatibility)
pub fn hash_merkle_node_with_domain(left: Field, right: Field) -> Field {
    hash_3([DOMAIN_MERKLE_NODE, left, right])
}

/// Compress a bitset chunk using Poseidon
/// Used for bitset state commitments
pub fn hash_bitset_chunk(bits: [u1; 16]) -> Field {
    // Convert bits to Fields - we'll hash in groups
    let mut value: Field = DOMAIN_BITSET_COMPRESS;
    for i in 0..16 {
        // Pack bits into a single field for efficient hashing
        value = value * 2 + bits[i] as Field;
    }
    hash_2([DOMAIN_BITSET_COMPRESS, value])
}

/// Iteratively compress a full bitset
/// Takes chunks of bits and builds a commitment tree
pub fn compress_bitset<let N: u32>(bits: [u1; N]) -> Field {
    assert(N > 0, "Bitset cannot be empty");
    
    // For small bitsets, hash directly
    if N <= 16 {
        let mut chunk: [u1; 16] = [0; 16];
        for i in 0..N {
            chunk[i] = bits[i];
        }
        hash_bitset_chunk(chunk)
    } else {
        // For larger bitsets, recursively hash chunks
        let chunk_count = (N + 15) / 16;  // Ceiling division
        let mut chunk_hashes: [Field; 7] = [0; 7];  // Max 7 chunks for 108 bits
        
        for chunk_idx in 0..chunk_count {
            let start = chunk_idx * 16;
            let end = if start + 16 < N { start + 16 } else { N };
            
            let mut chunk: [u1; 16] = [0; 16];
            for i in 0..(end - start) {
                chunk[i] = bits[start + i];
            }
            
            if chunk_idx < 7 {
                chunk_hashes[chunk_idx] = hash_bitset_chunk(chunk);
            }
        }
        
        // Hash all chunk hashes together using Merkle-like structure
        let mut result = chunk_hashes[0];
        for i in 1..chunk_count {
            if i < 7 {
                result = hash_merkle_node(result, chunk_hashes[i]);
            }
        }
        
        result
    }
}

/// Aggregate sum of field elements
pub fn aggregate_sum<let N: u32>(values: [Field; N]) -> Field {
    let mut sum: Field = 0;
    for i in 0..N {
        sum += values[i];
    }
    sum
}

/// Aggregate product of field elements with offset to avoid zero
pub fn aggregate_product<let N: u32>(values: [Field; N], offset: Field) -> Field {
    let mut product: Field = 1;
    for i in 0..N {
        product *= (offset + values[i]);
    }
    product
}

#[test]
fn test_hash_card_uid() {
    let uid1 = hash_card_uid(1, 5, 0);  // Red 5, copy 0
    let uid2 = hash_card_uid(1, 5, 1);  // Red 5, copy 1
    let uid3 = hash_card_uid(2, 5, 0);  // Green 5, copy 0
    
    // Different copy indices should give different UIDs
    assert(uid1 != uid2);
    // Different colors should give different UIDs
    assert(uid1 != uid3);
}

#[test]
fn test_hash_card_commitment() {
    let uid = hash_card_uid(1, 5, 0);
    let nonce1: Field = 12345;
    let nonce2: Field = 54321;
    
    let commit1 = hash_card_commitment(uid, nonce1);
    let commit2 = hash_card_commitment(uid, nonce2);
    
    // Same card with different nonces should give different commitments
    assert(commit1 != commit2);
}

#[test]
fn test_hash_merkle_node() {
    let left: Field = 123;
    let right: Field = 456;
    
    let node1 = hash_merkle_node(left, right);
    let node2 = hash_merkle_node(right, left);
    
    // Order matters
    assert(node1 != node2);
}

#[test]
fn test_aggregate_sum() {
    let values: [Field; 5] = [1, 2, 3, 4, 5];
    let sum = aggregate_sum(values);
    assert(sum == 15);
}

#[test]
fn test_aggregate_product() {
    let values: [Field; 3] = [1, 2, 3];
    let offset: Field = 0;
    let product = aggregate_product(values, offset);
    assert(product == 6);  // 1 * 2 * 3 = 6
}
