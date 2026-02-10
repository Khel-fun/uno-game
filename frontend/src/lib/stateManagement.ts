import { ethers } from 'ethers';
import { OffChainGameState, OnChainGameState, Action, Card, UnoGameContract } from './types';
import { initializeOffChainState, applyActionToOffChainState, hashState, isValidPlay, hashAction, hashCard } from './gameLogic';

const localActionCache: { [gameId: string]: Action[] } = {};
const localPlayerHands: { [gameId: string]: { [playerAddress: string]: Card[] } } = {};

export async function reconstructOffChainState(
    contract: UnoGameContract,
    gameId: bigint,
    playerAddress: string
  ): Promise<OffChainGameState> {
    const gameData = await contract.getGame(gameId);
    const players = gameData.players; // GameView struct field
  
    let offChainState = initializeOffChainState(gameId, players);
  
    localActionCache[gameId.toString()] = [];
  
    // Note: getGameActions does not exist on the current contract.
    // Game action replay is handled via off-chain socket state, not on-chain.
    // This function currently just initializes a fresh off-chain state.
  
    return offChainState;
  }

  function reconstructActionFromHash(actionHash: string, playerAddress: string, gameId: bigint): Action {
    const cachedActions = localActionCache[gameId.toString()] || [];
    const matchingAction = cachedActions.find(action => hashAction(action) === actionHash);
    
    if (matchingAction) {
      return matchingAction;
    }
  
    // If action is not in cache, create a placeholder
    return {
      type: 'playCard',
      player: playerAddress,
      cardHash: ethers.keccak256(ethers.toUtf8Bytes('placeholder'))
    };
  }

  export function verifyOffChainState(offChainState: OffChainGameState, onChainState: [
    bigint,           // id (0)
    string,           // creator (1)
    string[],         // players (2)
    number,           // status (3)
    boolean,          // isPrivate (4)
    string,           // gameCodeHash (5)
    bigint,           // maxPlayers (6)
    bigint,           // startTime (7)
    bigint,           // endTime (8)
    string,           // deckCommitment (9)
    string[]          // moveCommitments (10)
  ]): boolean {
    return hashState(offChainState) === onChainState[9]; // deckCommitment at index 9
  }

  export function updateOffChainState(currentState: OffChainGameState, action: Action): OffChainGameState {
    return applyActionToOffChainState(currentState, action);
  }

  export function createAction(actionType: 'playCard' | 'drawCard', player: string, card?: Card): Action {
    if (actionType === 'playCard' && card) {
      return {
        type: 'playCard',
        player,
        cardHash: hashCard(card)
      };
    } else {
      return {
        type: 'drawCard',
        player
      };
    }
  }

  /*
  export async function submitAction(
    contract: UnoGameContract, 
    gameId: bigint, 
    action: Action, 
    card?: Card
  ): Promise<void> {
    const actionHash = hashAction(action);
    
    // Determine special card effects
    const isReverse = card?.value === 'reverse';
    const isSkip = card?.value === 'skip';
    const isDrawTwo = card?.value === 'draw2';
    const isWildDrawFour = card?.value === 'wild_draw4';
  
    const tx = await contract.submitAction(
      gameId,
      actionHash,
      action.player
    );
  
    await tx.wait();
  
    
    if (!localActionCache[gameId.toString()]) {
      localActionCache[gameId.toString()] = [];
    }
    localActionCache[gameId.toString()].push(action);
    
  }*/

  export function getPlayerHand(gameId: bigint, playerAddress: string): Card[] {
    const gameHands = localPlayerHands[gameId.toString()];
    if (gameHands && gameHands[playerAddress]) {
      return gameHands[playerAddress];
    }
    return [];
  }

  export function setPlayerHand(gameId: bigint, playerAddress: string, hand: Card[]): void {
    if (!localPlayerHands[gameId.toString()]) {
      localPlayerHands[gameId.toString()] = {};
    }
    localPlayerHands[gameId.toString()][playerAddress] = hand;
  }

  export function isPlayerTurn(offChainState: OffChainGameState, playerAddress: string): boolean {
    return offChainState.players[offChainState.currentPlayerIndex] === playerAddress;
  }

  export function initializePlayerHands(gameId: bigint, players: string[], deck: Card[]): void {
    const gameHands: { [playerAddress: string]: Card[] } = {};
    players.forEach(player => {
      gameHands[player] = deck.splice(0, 7);
    });
    localPlayerHands[gameId.toString()] = gameHands;
  }