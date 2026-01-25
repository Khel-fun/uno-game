'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ZKProof } from '../lib/zk/types';

// Configuration
const ENABLE_REAL_PROOFS = true; // Set to false for simulation mode
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

// Callback type for proof tracking
export type OnProofGeneratedCallback = (circuitName: string, proof: ZKProof) => void;

// Types
interface GameState {
  gameId?: string;
  roomId?: string;
  turn: string;
  currentColor: string;
  currentNumber: string | number;
  playedCardsPile: string[];
  drawCardPile: string[];
  player1Deck: string[];
  player2Deck: string[];
  player3Deck?: string[];
  player4Deck?: string[];
  player5Deck?: string[];
  player6Deck?: string[];
  gameOver: boolean;
  totalPlayers: number;
}

interface ZKGameStats {
  proofsGenerated: number;
  proofsVerified: number;
  proofsSimulated: number;
  totalGenerationTime: number;
  lastProofType?: string;
  lastProofTime?: number;
  errors: number;
}

interface BackendPlayProofData {
  gameId: string;
  playerId: number;  // Backend returns numeric player ID
  playedCard: {
    cardStr: string;
    cardUID: string;
    nonce: string;
    commitment: string;
    merkleRoot: string;
    merkleProof: {
      path: string[];
      indices: number[];
    };
    color: number;
    cardType: number;
    copyIndex: number;
  };
  topCard?: {
    cardStr: string;
    cardUID: string;
    nonce: string;
    commitment: string;
    merkleRoot?: string;
    merkleProof?: {
      path: string[];
      indices: number[];
    };
    color: number;
    cardType: number;
    copyIndex: number;
  };
  merkleRoot: string;
  error?: string;
}

interface BackendDrawProofData {
  gameId: string;
  drawnCard: {
    cardStr: string;
    cardUID: string;
    nonce: string;
    commitment: string;
    merkleRoot: string;
    merkleProof: {
      path: string[];
      indices: number[];
    };
    position: number;
    oldConsumedBits: number[];
    newConsumedBits: number[];
    oldConsumedHash: string;
    newConsumedHash: string;
    oldConsumedCount: number;
    newConsumedCount: number;
  };
  merkleRoot: string;
  error?: string;
}

// Notification helper
function notifyZK(
  type: 'generating' | 'success' | 'error' | 'submitting' | 'info',
  circuit: string,
  message: string
) {
  const zkNotify = (window as unknown as { 
    zkNotify?: (type: string, circuit: string, message: string) => void 
  }).zkNotify;
  
  if (zkNotify) {
    zkNotify(type, circuit, message);
  }
  
  if (type === 'error') {
    console.warn(`[ZK] ${circuit}: ${message}`);
  } else {
    console.log(`[ZK] [${type}] ${circuit}: ${message}`);
  }
}

interface UseZKGameIntegrationOptions {
  /** Callback when a proof is generated (for tracking in ZKContext) */
  onProofGenerated?: OnProofGeneratedCallback;
}

export function useZKGameIntegration(options: UseZKGameIntegrationOptions = {}) {
  const { onProofGenerated } = options;
  
  const [stats, setStats] = useState<ZKGameStats>({
    proofsGenerated: 0,
    proofsVerified: 0,
    proofsSimulated: 0,
    totalGenerationTime: 0,
    errors: 0,
  });
  
  // Store callback in ref to avoid dependency issues
  const onProofGeneratedRef = useRef<OnProofGeneratedCallback | undefined>(onProofGenerated);
  useEffect(() => {
    onProofGeneratedRef.current = onProofGenerated;
  }, [onProofGenerated]);
  
  // Refs
  const prevGameStateRef = useRef<Partial<GameState>>({});
  const isGeneratingRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const gameIdRef = useRef<string | null>(null);
  
  // Initialize socket connection for ZK data requests
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Dynamic import to avoid SSR issues
    import('socket.io-client').then(({ io }) => {
      // Create a dedicated socket for ZK data
      const socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });
      
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('[ZK] Connected to backend for proof data');
      });
      
      socket.on('disconnect', () => {
        console.log('[ZK] Disconnected from backend');
      });
    }).catch((err) => {
      console.error('[ZK] Failed to load socket.io-client:', err);
    });
    
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);
  
  /**
   * Request play proof data from backend and generate proof
   */
  const generatePlayProof = useCallback(async (
    playedCard: string,
    playerHand: string[],
    topCard: string,
    playerId: string,
    gameId?: string
  ) => {
    if (isGeneratingRef.current) return null;
    isGeneratingRef.current = true;
    const startTime = performance.now();
    
    const effectiveGameId = gameId || gameIdRef.current;
    
    try {
      if (!ENABLE_REAL_PROOFS || !socketRef.current?.connected || !effectiveGameId) {
        // Simulation mode
        notifyZK('info', 'play', `[Sim] Would prove: ${playedCard} played on ${topCard}`);
        
        setStats(prev => ({
          ...prev,
          proofsSimulated: prev.proofsSimulated + 1,
          lastProofType: 'play',
          lastProofTime: performance.now() - startTime,
        }));
        
        return { simulated: true, card: playedCard };
      }
      
      notifyZK('generating', 'play', `Requesting proof data for ${playedCard}...`);
      
      // Request proof data from backend
      const proofData = await new Promise<BackendPlayProofData>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout requesting proof data')), 10000);
        
        socketRef.current!.emit('requestPlayProofData', {
          gameId: effectiveGameId,
          playedCard,
          topCard,
          playerHand,
          playerId,
        });
        
        socketRef.current!.once('playProofData', (data: BackendPlayProofData) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data);
          }
        });
      });
      
      notifyZK('generating', 'play', 'Generating ZK proof...');
      
      // Import proof service and crypto module dynamically
      const [proofService, crypto] = await Promise.all([
        import('../lib/zk/proofService'),
        import('../lib/zk/crypto'),
      ]);
      
      // Import card UIDs for lookup
      const { getCardUID } = await import('../lib/zk/cardUids');
      
      // Log backend data for debugging
      console.log('[ZK] Play proof data from backend:', {
        playedCard: proofData.playedCard,
        topCard: proofData.topCard,
        gameId: proofData.gameId,
        playerId: proofData.playerId,
      });
      
      // Validate backend data
      if (!proofData.playedCard || proofData.playedCard.color === undefined || proofData.playedCard.cardType === undefined) {
        throw new Error('Invalid played card data from backend');
      }
      
      // Get card UIDs from the lookup table (same as circuit's get_card_uid)
      const playedCardUID = getCardUID(
        proofData.playedCard.color,
        proofData.playedCard.cardType,
        proofData.playedCard.copyIndex || 0
      );
      
      if (!playedCardUID || playedCardUID === '0x' || playedCardUID.length < 10) {
        throw new Error(`Invalid card UID returned: ${playedCardUID}`);
      }
      
      const playedCardUIDField = crypto.hexToField(playedCardUID);
      
      // Use the actual nonce and commitment from the backend
      const playedCardNonce = proofData.playedCard.nonce || crypto.generateNonce().toString();
      
      // Use actual Merkle proof data from backend
      const playedCardMerklePath = proofData.playedCard.merkleProof || { path: Array(7).fill('0'), indices: Array(7).fill(0) };
      const topCardMerklePath = proofData.topCard?.merkleProof || { path: Array(7).fill('0'), indices: Array(7).fill(0) };
      
      // Build circuit input with actual backend values
      // All field values must be decimal strings (not hex)
      const input = {
        game_id: String(proofData.gameId || '1'),
        player_id: String(proofData.playerId || '1'),
        move_commitment: proofData.playedCard.commitment || playedCardUIDField.toString(),
        hand_merkle_root: proofData.playedCard.merkleRoot || playedCardUIDField.toString(),
        top_card_commitment: proofData.topCard?.commitment || '1',
        played_card_color: proofData.playedCard.color,
        played_card_type: proofData.playedCard.cardType,
        played_card_copy: proofData.playedCard.copyIndex || 0,
        played_card_nonce: playedCardNonce,
        played_card_merkle_path: {
          path: playedCardMerklePath.path.map(String),
          indices: playedCardMerklePath.indices.map(Number),
        },
        top_card_color: proofData.topCard?.color ?? 0,
        top_card_type: proofData.topCard?.cardType ?? 0,
        top_card_copy: proofData.topCard?.copyIndex ?? 0,
        top_card_nonce: proofData.topCard?.nonce || playedCardNonce,
        commitment_nonce: playedCardNonce,
      };
      
      console.log('[ZK] Play proof input prepared:', {
        game_id: input.game_id,
        player_id: input.player_id,
        played_card_color: input.played_card_color,
        played_card_type: input.played_card_type,
      });
      
      const proof = await proofService.generatePlayProof(input);
      const genDuration = performance.now() - startTime;
      
      notifyZK('success', 'play', `Proof generated in ${Math.round(genDuration)}ms`);
      
      // Verify locally after generation
      const verificationService = await import('../lib/zk/verificationService');
      const verifyResult = await verificationService.verifyLocally('play', proof);
      
      if (verifyResult.valid) {
        notifyZK('success', 'play', `Proof verified locally`);
        
        // Track the proof for on-chain verification UI
        if (onProofGeneratedRef.current) {
          onProofGeneratedRef.current('play', proof);
        }
        
        // Submit to zkVerify in the background (don't await - don't block gameplay)
        verificationService.submitToZkVerify('play', proof)
          .then(result => {
            if (result.submitted) {
              notifyZK('success', 'play', `Submitted to zkVerify (job: ${result.jobId})`);
              console.log('[ZK] zkVerify job ID:', result.jobId);
            } else if (result.error) {
              console.warn('[ZK] zkVerify submission skipped:', result.error);
            }
          })
          .catch(err => {
            console.warn('[ZK] zkVerify submission failed:', err);
          });
      } else {
        notifyZK('error', 'play', `Local verification failed: ${verifyResult.error}`);
      }
      
      const totalDuration = performance.now() - startTime;
      
      setStats(prev => ({
        ...prev,
        proofsGenerated: prev.proofsGenerated + 1,
        proofsVerified: prev.proofsVerified + (verifyResult.valid ? 1 : 0),
        totalGenerationTime: prev.totalGenerationTime + totalDuration,
        lastProofType: 'play',
        lastProofTime: totalDuration,
      }));
      
      return { ...proof, verified: verifyResult.valid };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifyZK('error', 'play', message);
      
      setStats(prev => ({
        ...prev,
        errors: prev.errors + 1,
        proofsSimulated: prev.proofsSimulated + 1,
        lastProofType: 'play',
        lastProofTime: performance.now() - startTime,
      }));
      
      return { simulated: true, card: playedCard, error: message };
    } finally {
      isGeneratingRef.current = false;
    }
  }, []);
  
  /**
   * Request draw proof data from backend and generate proof
   */
  const generateDrawProof = useCallback(async (
    drawnCard: string,
    deckPosition: number,
    gameId?: string
  ) => {
    if (isGeneratingRef.current) return null;
    isGeneratingRef.current = true;
    const startTime = performance.now();
    
    const effectiveGameId = gameId || gameIdRef.current;
    
    try {
      if (!ENABLE_REAL_PROOFS || !socketRef.current?.connected || !effectiveGameId) {
        // Simulation mode
        notifyZK('info', 'draw', `[Sim] Would prove: drew ${drawnCard} from position ${deckPosition}`);
        
        setStats(prev => ({
          ...prev,
          proofsSimulated: prev.proofsSimulated + 1,
          lastProofType: 'draw',
          lastProofTime: performance.now() - startTime,
        }));
        
        return { simulated: true, card: drawnCard };
      }
      
      notifyZK('generating', 'draw', `Requesting proof data for draw...`);
      
      // Request proof data from backend
      const proofData = await new Promise<BackendDrawProofData>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout requesting proof data')), 10000);
        
        socketRef.current!.emit('requestDrawProofData', {
          gameId: effectiveGameId,
          drawnCard,
          deckPosition,
        });
        
        socketRef.current!.once('drawProofData', (data: BackendDrawProofData) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data);
          }
        });
      });
      
      notifyZK('generating', 'draw', 'Generating ZK proof...');
      
      // Import modules dynamically
      const [proofService, crypto] = await Promise.all([
        import('../lib/zk/proofService'),
        import('../lib/zk/crypto'),
      ]);
      
      // Get card UID from the lookup table
      const { parseCardCode, getCardUID } = await import('../lib/zk/cardUids');
      
      // Parse the drawn card to get its UID
      const parsedCard = parseCardCode(proofData.drawnCard.cardStr);
      let cardUIDField: bigint;
      if (parsedCard) {
        const cardUIDHex = getCardUID(parsedCard.color, parsedCard.type, parsedCard.copyIndex);
        cardUIDField = crypto.hexToField(cardUIDHex);
      } else {
        // Fallback to backend UID
        cardUIDField = BigInt(proofData.drawnCard.cardUID || '1');
      }
      
      // Use the actual nonce from the backend
      const nonce = proofData.drawnCard.nonce || crypto.generateNonce().toString();
      
      // Get consumed bits arrays from backend or use defaults
      const oldConsumedBits = proofData.drawnCard.oldConsumedBits || Array(108).fill(0);
      const newConsumedBits = proofData.drawnCard.newConsumedBits || Array(108).fill(0);
      
      // Use actual values from backend
      const oldConsumedHash = proofData.drawnCard.oldConsumedHash || '1';
      const newConsumedHash = proofData.drawnCard.newConsumedHash || '1';
      
      // Use actual Merkle proof data from backend
      const drawnCardMerklePath = proofData.drawnCard.merkleProof || { path: Array(7).fill('0'), indices: Array(7).fill(0) };
      
      // Build circuit input with actual backend values
      const input = {
        merkle_root: proofData.drawnCard.merkleRoot || cardUIDField.toString(),
        old_consumed_hash: oldConsumedHash.startsWith?.('0x') ? BigInt(oldConsumedHash).toString() : String(oldConsumedHash),
        new_consumed_hash: newConsumedHash.startsWith?.('0x') ? BigInt(newConsumedHash).toString() : String(newConsumedHash),
        old_consumed_count: proofData.drawnCard.oldConsumedCount || 0,
        new_consumed_count: proofData.drawnCard.newConsumedCount || 1,
        position: proofData.drawnCard.position || 0,
        card_uid: proofData.drawnCard.cardUID || cardUIDField.toString(),
        nonce: nonce,
        merkle_path: {
          path: drawnCardMerklePath.path.map(String),
          indices: drawnCardMerklePath.indices.map(Number),
        },
        old_consumed_bits: oldConsumedBits,
        new_consumed_bits: newConsumedBits,
      };
      
      console.log('[ZK] Draw proof input prepared:', {
        position: input.position,
        old_consumed_count: input.old_consumed_count,
        new_consumed_count: input.new_consumed_count,
      });
      
      const proof = await proofService.generateDrawProof(input);
      const genDuration = performance.now() - startTime;
      
      notifyZK('success', 'draw', `Proof generated in ${Math.round(genDuration)}ms`);
      
      // Verify locally after generation
      const verificationService = await import('../lib/zk/verificationService');
      const verifyResult = await verificationService.verifyLocally('draw', proof);
      
      if (verifyResult.valid) {
        notifyZK('success', 'draw', `Proof verified locally`);
        
        // Track the proof for on-chain verification UI
        if (onProofGeneratedRef.current) {
          onProofGeneratedRef.current('draw', proof);
        }
        
        // Submit to zkVerify in the background (don't await - don't block gameplay)
        verificationService.submitToZkVerify('draw', proof)
          .then(result => {
            if (result.submitted) {
              notifyZK('success', 'draw', `Submitted to zkVerify (job: ${result.jobId})`);
              console.log('[ZK] zkVerify job ID:', result.jobId);
            } else if (result.error) {
              console.warn('[ZK] zkVerify submission skipped:', result.error);
            }
          })
          .catch(err => {
            console.warn('[ZK] zkVerify submission failed:', err);
          });
      } else {
        notifyZK('error', 'draw', `Local verification failed: ${verifyResult.error}`);
      }
      
      const totalDuration = performance.now() - startTime;
      
      setStats(prev => ({
        ...prev,
        proofsGenerated: prev.proofsGenerated + 1,
        proofsVerified: prev.proofsVerified + (verifyResult.valid ? 1 : 0),
        totalGenerationTime: prev.totalGenerationTime + totalDuration,
        lastProofType: 'draw',
        lastProofTime: totalDuration,
      }));
      
      return { ...proof, verified: verifyResult.valid };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifyZK('error', 'draw', message);
      
      setStats(prev => ({
        ...prev,
        errors: prev.errors + 1,
        proofsSimulated: prev.proofsSimulated + 1,
        lastProofType: 'draw',
        lastProofTime: performance.now() - startTime,
      }));
      
      return { simulated: true, card: drawnCard, error: message };
    } finally {
      isGeneratingRef.current = false;
    }
  }, []);
  
  /**
   * Handle game state changes and trigger appropriate proofs
   */
  const onGameStateChange = useCallback((
    newState: GameState,
    currentPlayer: string
  ) => {
    const prevState = prevGameStateRef.current;
    
    // Track game ID
    if (newState.gameId || newState.roomId) {
      gameIdRef.current = (newState.gameId || newState.roomId) as string;
    }
    
    // Detect card play (playedCardsPile grew)
    if (
      newState.playedCardsPile &&
      prevState.playedCardsPile &&
      newState.playedCardsPile.length > prevState.playedCardsPile.length
    ) {
      const playedCard = newState.playedCardsPile[newState.playedCardsPile.length - 1];
      const topCard = prevState.playedCardsPile[prevState.playedCardsPile.length - 1] || playedCard;
      
      // Get the player's current hand
      const playerKey = `player${getPlayerNumber(currentPlayer)}Deck` as keyof GameState;
      const playerHand = (newState[playerKey] as string[]) || [];
      
      // Generate play proof
      generatePlayProof(playedCard, playerHand, topCard, currentPlayer, gameIdRef.current || undefined);
    }
    
    // Detect card draw (drawCardPile shrunk)
    if (
      newState.drawCardPile &&
      prevState.drawCardPile &&
      newState.drawCardPile.length < prevState.drawCardPile.length
    ) {
      // Find what was drawn
      const playerNum = getPlayerNumber(currentPlayer);
      const playerDeckKey = `player${playerNum}Deck` as keyof GameState;
      const currentDeck = newState[playerDeckKey] as string[] | undefined;
      const prevDeck = prevState[playerDeckKey] as string[] | undefined;
      
      if (currentDeck && prevDeck && currentDeck.length > prevDeck.length) {
        const drawnCard = currentDeck[currentDeck.length - 1];
        const deckPosition = prevState.drawCardPile?.length || 0;
        
        // Generate draw proof
        generateDrawProof(drawnCard, deckPosition, gameIdRef.current || undefined);
      }
    }
    
    // Store current state for next comparison
    prevGameStateRef.current = { ...newState };
  }, [generatePlayProof, generateDrawProof]);
  
  return {
    isReady: true,
    isLoading: false,
    error: null,
    stats,
    onGameStateChange,
    generatePlayProof,
    generateDrawProof,
    realProofsEnabled: ENABLE_REAL_PROOFS,
  };
}

// Helper function
function getPlayerNumber(playerName: string): number {
  const match = playerName.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

export default useZKGameIntegration;
