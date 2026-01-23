/**
 * ZK Game Wrapper Component
 * Wraps the Game component with ZK proof functionality
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useZK, useZKGame } from '../../lib/zk';
import { PACK_OF_CARDS } from '../../utils/packOfCards';

// ============================================================================
// ZK Status Badge Component
// ============================================================================

interface ZKStatusBadgeProps {
  zkState: ReturnType<typeof useZKGame>[0];
}

export function ZKStatusBadge({ zkState }: ZKStatusBadgeProps) {
  const statusColors: Record<string, string> = {
    idle: 'bg-gray-500',
    generating: 'bg-yellow-500 animate-pulse',
    submitting: 'bg-blue-500 animate-pulse',
    verified: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end space-y-2">
      {/* Main Status Badge */}
      <div className={`px-3 py-1.5 rounded-full text-white text-xs font-medium flex items-center gap-2 ${statusColors[zkState.status] || 'bg-gray-500'}`}>
        <span className="w-2 h-2 rounded-full bg-white opacity-75" />
        <span>ZK: {zkState.status.toUpperCase()}</span>
      </div>
      
      {/* Stats */}
      {zkState.enabled && (
        <div className="bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg">
          <div className="flex gap-4">
            <span>Proofs: {zkState.stats.proofsGenerated}</span>
            <span>Verified: {zkState.stats.proofsVerified}</span>
          </div>
          {zkState.stats.totalGenerationTime > 0 && (
            <div className="text-gray-300 mt-1">
              Avg: {Math.round(zkState.stats.totalGenerationTime / Math.max(1, zkState.stats.proofsGenerated))}ms
            </div>
          )}
        </div>
      )}
      
      {/* Error Display */}
      {zkState.error && (
        <div className="bg-red-500/90 text-white text-xs px-3 py-2 rounded-lg max-w-xs">
          {zkState.error}
        </div>
      )}
      
      {/* Ready State */}
      {!zkState.ready && zkState.enabled && (
        <div className="bg-yellow-500/90 text-black text-xs px-3 py-2 rounded-lg">
          Loading ZK circuits...
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ZK Toggle Button
// ============================================================================

interface ZKToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function ZKToggle({ enabled, onToggle }: ZKToggleProps) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        enabled
          ? 'bg-green-600 hover:bg-green-700 text-white'
          : 'bg-gray-600 hover:bg-gray-700 text-white'
      }`}
    >
      ZK Proofs: {enabled ? 'ON' : 'OFF'}
    </button>
  );
}

// ============================================================================
// ZK Game Wrapper Hook
// ============================================================================

interface UseZKGameWrapperOptions {
  room: string;
  currentUser: string;
  isComputerMode: boolean;
  playerCount: number;
}

/**
 * Hook that provides ZK-enhanced game callbacks
 */
export function useZKGameWrapper(options: UseZKGameWrapperOptions) {
  const zkContext = useZK();
  const [zkState, zkActions] = useZKGame();
  
  // Ref to track original deck order
  const originalDeckRef = useRef<string[]>([...PACK_OF_CARDS]);
  
  // Load circuits when entering game
  useEffect(() => {
    if (!zkContext.isReady && !zkContext.isLoading) {
      zkContext.loadCircuits();
    }
  }, [zkContext.isReady, zkContext.isLoading]);
  
  // Enhanced shuffle with ZK proof
  const zkShuffle = useCallback(async (shuffledDeck: string[]) => {
    if (!zkState.enabled) return { shuffled: shuffledDeck };
    
    console.log('[ZK Game] Generating shuffle proof...');
    const result = await zkActions.proveAndVerifyShuffle(
      originalDeckRef.current,
      shuffledDeck
    );
    
    if (result.success) {
      console.log('[ZK Game] Shuffle proof generated and verified');
    } else {
      console.error('[ZK Game] Shuffle proof failed:', result.error);
    }
    
    return { shuffled: shuffledDeck, zkResult: result };
  }, [zkState.enabled, zkActions]);
  
  // Enhanced deal with ZK proof
  const zkDeal = useCallback(async (shuffledDeck: string[], playerHands: string[][]) => {
    if (!zkState.enabled) return { playerHands };
    
    console.log('[ZK Game] Generating deal proof...');
    const result = await zkActions.proveAndVerifyDeal(shuffledDeck, playerHands);
    
    if (result.success) {
      console.log('[ZK Game] Deal proof generated and verified');
    } else {
      console.error('[ZK Game] Deal proof failed:', result.error);
    }
    
    return { playerHands, zkResult: result };
  }, [zkState.enabled, zkActions]);
  
  // Enhanced draw with ZK proof
  const zkDraw = useCallback(async (
    drawnCard: string,
    cardIndex: number,
    playerHand: string[]
  ) => {
    if (!zkState.enabled) return { drawnCard };
    
    console.log('[ZK Game] Generating draw proof...');
    const result = await zkActions.proveAndVerifyDraw(
      drawnCard,
      cardIndex,
      playerHand
    );
    
    if (result.success) {
      console.log('[ZK Game] Draw proof generated and verified');
    } else {
      console.error('[ZK Game] Draw proof failed:', result.error);
    }
    
    return { drawnCard, zkResult: result };
  }, [zkState.enabled, zkActions]);
  
  // Enhanced play with ZK proof
  const zkPlay = useCallback(async (
    playedCard: string,
    cardIndex: number,
    playerHand: string[],
    topCard: string,
    declaredColor?: 'red' | 'green' | 'blue' | 'yellow'
  ) => {
    if (!zkState.enabled) return { playedCard };
    
    console.log('[ZK Game] Generating play proof...');
    const result = await zkActions.proveAndVerifyPlay(
      playedCard,
      cardIndex,
      playerHand,
      topCard,
      declaredColor
    );
    
    if (result.success) {
      console.log('[ZK Game] Play proof generated and verified');
    } else {
      console.error('[ZK Game] Play proof failed:', result.error);
    }
    
    return { playedCard, zkResult: result };
  }, [zkState.enabled, zkActions]);
  
  // Reset on game end
  const zkReset = useCallback(() => {
    originalDeckRef.current = [...PACK_OF_CARDS];
    zkActions.reset();
  }, [zkActions]);
  
  return {
    zkContext,
    zkState,
    zkActions,
    callbacks: {
      zkShuffle,
      zkDeal,
      zkDraw,
      zkPlay,
      zkReset,
    },
  };
}

// ============================================================================
// Export
// ============================================================================

export default { ZKStatusBadge, ZKToggle, useZKGameWrapper };
