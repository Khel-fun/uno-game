// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IUltraVerifier.sol";

/**
 * @title IPlayVerifier
 * @notice Verifier interface for card play proofs
 * @dev Verifies that a card play is legal according to UNO rules
 *
 * Public Inputs:
 * - game_id: Unique identifier for the game
 * - player_id: ID of the player making the move
 * - move_commitment: Commitment hash for the move
 * - hand_merkle_root: Merkle root of player's hand
 * - top_card_commitment: Commitment of top card on discard pile
 */
interface IPlayVerifier is IUltraVerifier {}
