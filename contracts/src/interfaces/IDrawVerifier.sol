// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IUltraVerifier.sol";

/**
 * @title IDrawVerifier
 * @notice Verifier interface for draw operation proofs
 * @dev Verifies that a player drew a valid card from an unconsumed position
 *
 * Public Inputs:
 * - merkle_root: Merkle root of the deck
 * - old_consumed_hash: Hash of consumed cards bitset before draw
 * - new_consumed_hash: Hash of consumed cards bitset after draw
 */
interface IDrawVerifier is IUltraVerifier {}
