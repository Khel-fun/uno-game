// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IUltraVerifier.sol";

/**
 * @title IDealVerifier
 * @notice Verifier interface for deal operation proofs
 * @dev Verifies that cards were dealt fairly from the shuffled deck
 *
 * Public Inputs:
 * - player_id: ID of the player receiving cards
 * - merkle_root: Merkle root of the shuffled deck
 */
interface IDealVerifier is IUltraVerifier {}
