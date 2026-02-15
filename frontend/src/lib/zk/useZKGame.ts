'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useZK } from './ZKContext';
import {
  useShuffleProof,
  useDealProof,
  useDrawProof,
  usePlayProof,
} from './hooks';
import {
  deckToUIDs,
  buildShuffleInput,
  buildDealInput,
  buildDrawInput,
  buildPlayInput,
  createPlaceholderMerkleProof,
  CardCopyTracker,
  cardCodeToUID,
  parseCardCode,
} from './gameUtils';
import { generateNonce } from './cardUids';
import type { Field, ZKProof } from './types';

// Dynamic import for zkVerify service
const getZkVerifyService = () => import('./zkVerifyService');

// Notification helper - will be available if ZKProofPanel is mounted
function notifyZK(
  type: 'generating' | 'success' | 'error' | 'submitting',
  circuit: string,
  message: string
) {
  const zkNotify = (window as unknown as { zkNotify?: (type: string, circuit: string, message: string) => void }).zkNotify;
  if (zkNotify) {
    zkNotify(type, circuit, message);
  } else {
    // Fallback to console
    console.log(`[ZK ${type}] ${circuit}: ${message}`);
  }
}

export interface ZKGameProofs {
  shuffle?: { proof: ZKProof; jobId?: string; verified: boolean };
  deal?: { proof: ZKProof; jobId?: string; verified: boolean };
  draw?: { proof: ZKProof; jobId?: string; verified: boolean }[];
  play?: { proof: ZKProof; jobId?: string; verified: boolean }[];
}

export interface ZKGameState {
  /** Whether ZK is enabled for this game */
  enabled: boolean;
  /** Whether circuits are loaded */
  ready: boolean;
  /** Current proof generation status */
  status: 'idle' | 'generating' | 'submitting' | 'verified' | 'error';
  /** Error message if any */
  error: string | null;
  /** Generated proofs */
  proofs: ZKGameProofs;
  /** Stats */
  stats: {
    proofsGenerated: number;
    proofsVerified: number;
    totalGenerationTime: number;
  };
}

export interface ZKGameActions {
  /** Generate proof for shuffle operation */
  proveAndVerifyShuffle: (
    originalDeck: string[],
    shuffledDeck: string[]
  ) => Promise<{ success: boolean; proof?: ZKProof; error?: string }>;
  
  /** Generate proof for deal operation */
  proveAndVerifyDeal: (
    shuffledDeck: string[],
    playerHands: string[][]
  ) => Promise<{ success: boolean; proof?: ZKProof; error?: string }>;
  
  /** Generate proof for draw operation */
  proveAndVerifyDraw: (
    drawnCard: string,
    cardIndex: number,
    playerHand: string[]
  ) => Promise<{ success: boolean; proof?: ZKProof; error?: string }>;
  
  /** Generate proof for play operation */
  proveAndVerifyPlay: (
    playedCard: string,
    cardIndex: number,
    playerHand: string[],
    topCard: string,
    declaredColor?: 'red' | 'green' | 'blue' | 'yellow'
  ) => Promise<{ success: boolean; proof?: ZKProof; error?: string }>;
  
  /** Enable/disable ZK proofs */
  setEnabled: (enabled: boolean) => void;
  
  /** Reset all proofs */
  reset: () => void;
}

const initialState: ZKGameState = {
  enabled: true, // ZK proofs enabled by default
  ready: false,
  status: 'idle',
  error: null,
  proofs: {},
  stats: {
    proofsGenerated: 0,
    proofsVerified: 0,
    totalGenerationTime: 0,
  },
};

export function useZKGame(): [ZKGameState, ZKGameActions] {
  const zkContext = useZK();
  const [state, setState] = useState<ZKGameState>(initialState);
  
  // Proof hooks
  const shuffleProof = useShuffleProof();
  const dealProof = useDealProof();
  const drawProof = useDrawProof();
  const playProof = usePlayProof();
  
  // Track copy indices for card UID lookups
  const copyTrackerRef = useRef(new CardCopyTracker());

  // Update ready state when circuits load
  useEffect(() => {
    setState(prev => ({
      ...prev,
      ready: zkContext.isReady,
    }));
  }, [zkContext.isReady]);

  // Helper to submit proof to zkVerify
  const submitToZkVerify = useCallback(async (
    circuitName: string,
    proof: ZKProof
  ): Promise<{ jobId?: string; verified: boolean; error?: string }> => {
    if (!zkContext.isZkVerifyAvailable) {
      console.log('[ZK Game] zkVerify not available, skipping on-chain verification');
      return { verified: false };
    }
    
    try {
      const zkVerifyService = await getZkVerifyService();
      const response = await zkVerifyService.submitProofToZkVerify({ circuitName, proof });
      const result = await zkVerifyService.waitForVerification(response.jobId);
      
      // Check if status indicates successful verification
      const isVerified = ['Finalized', 'Aggregated', 'AggregationPublished'].includes(result.status);
      
      return {
        jobId: response.jobId,
        verified: isVerified,
      };
    } catch (error) {
      console.error('[ZK Game] zkVerify submission failed:', error);
      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [zkContext.isZkVerifyAvailable]);


  const proveAndVerifyShuffle = useCallback(async (
    originalDeck: string[],
    shuffledDeck: string[]
  ): Promise<{ success: boolean; proof?: ZKProof; error?: string }> => {
    if (!state.enabled) {
      return { success: true };
    }
    
    if (!zkContext.isReady) {
      return { success: false, error: 'Circuits not loaded' };
    }
    
    setState(prev => ({ ...prev, status: 'generating', error: null }));
    notifyZK('generating', 'shuffle', 'Generating shuffle proof...');
    
    const startTime = Date.now();
    
    try {
      // Convert deck codes to UIDs
      const originalUIDs = deckToUIDs(originalDeck);
      const shuffledUIDs = deckToUIDs(shuffledDeck);
      
      // Build shuffle input (only needs UIDs in and out per the ShuffleCircuitInput type)
      const input = buildShuffleInput(originalUIDs, shuffledUIDs);
      
      // Generate proof
      const proof = await shuffleProof.generate(input);
      
      if (!proof) {
        throw new Error('Proof generation failed');
      }
      
      const generationTime = Date.now() - startTime;
      notifyZK('success', 'shuffle', `Shuffle proof generated in ${generationTime}ms`);
      
      // Update state with proof
      setState(prev => ({
        ...prev,
        status: 'submitting',
        proofs: {
          ...prev.proofs,
          shuffle: { proof, verified: false },
        },
        stats: {
          ...prev.stats,
          proofsGenerated: prev.stats.proofsGenerated + 1,
          totalGenerationTime: prev.stats.totalGenerationTime + generationTime,
        },
      }));
      
      // Submit to zkVerify
      notifyZK('submitting', 'shuffle', 'Submitting to zkVerify...');
      const zkResult = await submitToZkVerify('shuffle', proof);
      
      setState(prev => ({
        ...prev,
        status: zkResult.verified ? 'verified' : 'idle',
        proofs: {
          ...prev.proofs,
          shuffle: {
            proof,
            jobId: zkResult.jobId,
            verified: zkResult.verified,
          },
        },
        stats: zkResult.verified
          ? { ...prev.stats, proofsVerified: prev.stats.proofsVerified + 1 }
          : prev.stats,
      }));
      
      if (zkResult.verified) {
        notifyZK('success', 'shuffle', 'Shuffle proof verified on-chain!');
      }
      
      return { success: true, proof };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      notifyZK('error', 'shuffle', `Shuffle proof failed: ${errorMsg}`);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMsg,
      }));
      return { success: false, error: errorMsg };
    }
  }, [state.enabled, zkContext.isReady, shuffleProof, submitToZkVerify]);

  const proveAndVerifyDeal = useCallback(async (
    shuffledDeck: string[],
    playerHands: string[][]
  ): Promise<{ success: boolean; proof?: ZKProof; error?: string }> => {
    if (!state.enabled) {
      return { success: true };
    }
    
    if (!zkContext.isReady) {
      return { success: false, error: 'Circuits not loaded' };
    }
    
    setState(prev => ({ ...prev, status: 'generating', error: null }));
    notifyZK('generating', 'deal', 'Generating deal proof...');
    
    const startTime = Date.now();
    
    try {
      // Convert hands to UIDs
      const handUIDs = playerHands.map(hand => deckToUIDs(hand));
      const flatCardUids = handUIDs.flat();
      const positions = flatCardUids.map((_, i) => i);
      const nonces = flatCardUids.map(() => generateNonce());
      
      // Create placeholder Merkle root and paths (in production, compute from deck)
      const merkleRoot = '0x0' as Field;
      const merklePaths = flatCardUids.map(() => ({
        path: Array(7).fill('0x0' as Field),
        indices: Array(7).fill(0),
      }));
      
      // Use first player ID as placeholder
      const playerId = '1' as Field;
      
      const input = buildDealInput(playerId, merkleRoot, positions, flatCardUids, nonces, merklePaths);
      
      // Generate proof
      const proof = await dealProof.generate(input);
      
      if (!proof) {
        throw new Error('Proof generation failed');
      }
      
      const generationTime = Date.now() - startTime;
      notifyZK('success', 'deal', `Deal proof generated in ${generationTime}ms`);
      
      setState(prev => ({
        ...prev,
        status: 'submitting',
        proofs: {
          ...prev.proofs,
          deal: { proof, verified: false },
        },
        stats: {
          ...prev.stats,
          proofsGenerated: prev.stats.proofsGenerated + 1,
          totalGenerationTime: prev.stats.totalGenerationTime + generationTime,
        },
      }));
      
      // Submit to zkVerify
      notifyZK('submitting', 'deal', 'Submitting to zkVerify...');
      const zkResult = await submitToZkVerify('deal', proof);
      
      setState(prev => ({
        ...prev,
        status: zkResult.verified ? 'verified' : 'idle',
        proofs: {
          ...prev.proofs,
          deal: {
            proof,
            jobId: zkResult.jobId,
            verified: zkResult.verified,
          },
        },
        stats: zkResult.verified
          ? { ...prev.stats, proofsVerified: prev.stats.proofsVerified + 1 }
          : prev.stats,
      }));
      
      if (zkResult.verified) {
        notifyZK('success', 'deal', 'Deal proof verified on-chain!');
      }
      
      return { success: true, proof };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      notifyZK('error', 'deal', `Deal proof failed: ${errorMsg}`);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMsg,
      }));
      return { success: false, error: errorMsg };
    }
  }, [state.enabled, zkContext.isReady, dealProof, submitToZkVerify]);

  
  const proveAndVerifyDraw = useCallback(async (
    drawnCard: string,
    cardIndex: number,
    playerHand: string[]
  ): Promise<{ success: boolean; proof?: ZKProof; error?: string }> => {
    if (!state.enabled) {
      return { success: true };
    }
    
    if (!zkContext.isReady) {
      return { success: false, error: 'Circuits not loaded' };
    }
    
    setState(prev => ({ ...prev, status: 'generating', error: null }));
    notifyZK('generating', 'draw', 'Generating draw proof...');
    
    const startTime = Date.now();
    
    try {
      copyTrackerRef.current.reset();
      const cardUid = cardCodeToUID(drawnCard, copyTrackerRef.current) || ('0x0' as Field);
      const handUIDs = deckToUIDs(playerHand);
      const merkleProof = createPlaceholderMerkleProof();
      const nonce = generateNonce();
      
      // Create placeholder consumed bits (108 bits)
      const oldConsumedBits = Array(108).fill(0);
      const newConsumedBits = [...oldConsumedBits];
      newConsumedBits[cardIndex] = 1;
      
      const input = buildDrawInput(
        merkleProof.root,         // merkleRoot
        '0x0' as Field,           // oldConsumedHash (placeholder)
        '0x0' as Field,           // newConsumedHash (placeholder)
        cardIndex,                 // oldConsumedCount
        cardIndex + 1,             // newConsumedCount
        cardIndex,                 // position
        cardUid,                   // card_uid
        nonce,                     // nonce
        {                          // merkle_path as MerkleProof struct
          path: merkleProof.path,
          indices: merkleProof.indices.map(idx => Number(idx)),
        },
        oldConsumedBits,           // old_consumed_bits
        newConsumedBits            // new_consumed_bits
      );
      
      // Generate proof
      const proof = await drawProof.generate(input);
      
      if (!proof) {
        throw new Error('Proof generation failed');
      }
      
      const generationTime = Date.now() - startTime;
      notifyZK('success', 'draw', `Draw proof generated in ${generationTime}ms`);
      
      const drawRecord = { proof, verified: false };
      
      setState(prev => ({
        ...prev,
        status: 'submitting',
        proofs: {
          ...prev.proofs,
          draw: [...(prev.proofs.draw || []), drawRecord],
        },
        stats: {
          ...prev.stats,
          proofsGenerated: prev.stats.proofsGenerated + 1,
          totalGenerationTime: prev.stats.totalGenerationTime + generationTime,
        },
      }));
      
      // Submit to zkVerify
      notifyZK('submitting', 'draw', 'Submitting to zkVerify...');
      const zkResult = await submitToZkVerify('draw', proof);
      
      setState(prev => {
        const draws = [...(prev.proofs.draw || [])];
        const lastIdx = draws.length - 1;
        if (lastIdx >= 0) {
          draws[lastIdx] = {
            proof,
            jobId: zkResult.jobId,
            verified: zkResult.verified,
          };
        }
        
        return {
          ...prev,
          status: zkResult.verified ? 'verified' : 'idle',
          proofs: { ...prev.proofs, draw: draws },
          stats: zkResult.verified
            ? { ...prev.stats, proofsVerified: prev.stats.proofsVerified + 1 }
            : prev.stats,
        };
      });
      
      if (zkResult.verified) {
        notifyZK('success', 'draw', 'Draw proof verified on-chain!');
      }
      
      return { success: true, proof };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      notifyZK('error', 'draw', `Draw proof failed: ${errorMsg}`);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMsg,
      }));
      return { success: false, error: errorMsg };
    }
  }, [state.enabled, zkContext.isReady, drawProof, submitToZkVerify]);

  const proveAndVerifyPlay = useCallback(async (
    playedCard: string,
    cardIndex: number,
    playerHand: string[],
    topCard: string,
    declaredColor?: 'red' | 'green' | 'blue' | 'yellow'
  ): Promise<{ success: boolean; proof?: ZKProof; error?: string }> => {
    if (!state.enabled) {
      return { success: true };
    }
    
    if (!zkContext.isReady) {
      return { success: false, error: 'Circuits not loaded' };
    }
    
    setState(prev => ({ ...prev, status: 'generating', error: null }));
    notifyZK('generating', 'play', 'Generating play proof...');
    
    const startTime = Date.now();
    
    try {
      copyTrackerRef.current.reset();
      const cardUid = cardCodeToUID(playedCard, copyTrackerRef.current) || ('0x0' as Field);
      copyTrackerRef.current.reset();
      const topCardUid = cardCodeToUID(topCard, copyTrackerRef.current) || ('0x0' as Field);
      const handUIDs = deckToUIDs(playerHand);
      
      // Parse card details for the circuit
      const playedParsed = parseCardCode(playedCard);
      const topParsed = parseCardCode(topCard);
      
      // Create placeholder data
      const gameId = '1' as Field;
      const playerId = '1' as Field;
      const moveCommitment = generateNonce();
      const handMerkleRoot = '0x0' as Field;
      const topCardCommitment = '0x0' as Field;
      const playedCardNonce = generateNonce();
      const merklePath = {
        path: Array(7).fill('0x0' as Field),
        indices: Array(7).fill(0),
      };
      const topCardNonce = generateNonce();
      const commitmentNonce = generateNonce();
      
      const input = buildPlayInput(
        gameId,
        playerId,
        moveCommitment,
        handMerkleRoot,
        topCardCommitment,
        playedParsed?.color ?? 0,
        playedParsed?.type ?? 0,
        playedParsed?.copyIndex ?? 0,
        playedCardNonce,
        merklePath,
        topParsed?.color ?? 0,
        topParsed?.type ?? 0,
        topParsed?.copyIndex ?? 0,
        topCardNonce,
        commitmentNonce
      );
      
      // Generate proof
      const proof = await playProof.generate(input);
      
      if (!proof) {
        throw new Error('Proof generation failed');
      }
      
      const generationTime = Date.now() - startTime;
      notifyZK('success', 'play', `Play proof generated in ${generationTime}ms`);
      
      const playRecord = { proof, verified: false };
      
      setState(prev => ({
        ...prev,
        status: 'submitting',
        proofs: {
          ...prev.proofs,
          play: [...(prev.proofs.play || []), playRecord],
        },
        stats: {
          ...prev.stats,
          proofsGenerated: prev.stats.proofsGenerated + 1,
          totalGenerationTime: prev.stats.totalGenerationTime + generationTime,
        },
      }));
      
      // Submit to zkVerify
      notifyZK('submitting', 'play', 'Submitting to zkVerify...');
      const zkResult = await submitToZkVerify('play', proof);
      
      setState(prev => {
        const plays = [...(prev.proofs.play || [])];
        const lastIdx = plays.length - 1;
        if (lastIdx >= 0) {
          plays[lastIdx] = {
            proof,
            jobId: zkResult.jobId,
            verified: zkResult.verified,
          };
        }
        
        return {
          ...prev,
          status: zkResult.verified ? 'verified' : 'idle',
          proofs: { ...prev.proofs, play: plays },
          stats: zkResult.verified
            ? { ...prev.stats, proofsVerified: prev.stats.proofsVerified + 1 }
            : prev.stats,
        };
      });
      
      if (zkResult.verified) {
        notifyZK('success', 'play', 'Play proof verified on-chain!');
      }
      
      return { success: true, proof };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      notifyZK('error', 'play', `Play proof failed: ${errorMsg}`);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMsg,
      }));
      return { success: false, error: errorMsg };
    }
  }, [state.enabled, zkContext.isReady, playProof, submitToZkVerify]);


  const setEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, enabled }));
  }, []);
  
  const reset = useCallback(() => {
    copyTrackerRef.current.reset();
    setState(initialState);
  }, []);

  return [
    state,
    {
      proveAndVerifyShuffle,
      proveAndVerifyDeal,
      proveAndVerifyDraw,
      proveAndVerifyPlay,
      setEnabled,
      reset,
    },
  ];
}
