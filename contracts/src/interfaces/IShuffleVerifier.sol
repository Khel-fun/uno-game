// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IUltraVerifier.sol";

/**
 * @title IShuffleVerifier
 * @notice Verifier interface for shuffle operation proofs
 * @dev Verifies that output deck is a valid permutation of input deck
 *
 * Public Inputs: NONE (all private witnesses)
 * 
 * Private Witnesses:
 * - uids_in[108]: Card UIDs before shuffle
 * - uids_out[108]: Card UIDs after shuffle
 * 
 * The circuit proves that uids_out is a valid permutation of uids_in
 * using the efficient check_shuffle algorithm. No card information
 * is leaked - the verification is entirely zero-knowledge.
 */
interface IShuffleVerifier is IUltraVerifier {}

