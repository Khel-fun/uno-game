'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import type { ZKProof, KurierVerificationStatus } from './types';

// Dynamically import proof service functions to avoid SSR issues
const getProofService = () => import('./proofService');
const getZkVerifyService = () => import('./zkVerifyService');

export interface ZKContextState {
  /** Whether circuits are loaded and ready */
  isReady: boolean;
  /** Whether circuits are currently loading */
  isLoading: boolean;
  /** Whether zkVerify (Kurier) is available */
  isZkVerifyAvailable: boolean;
  /** Any initialization error */
  error: string | null;
  /** Recent proofs generated (for tracking) */
  recentProofs: ProofRecord[];
}

export interface ProofRecord {
  id: string;
  circuitName: string;
  timestamp: Date;
  proof: ZKProof;
  jobId?: string;
  zkVerifyStatus?: KurierVerificationStatus;
}

export interface ZKContextActions {
  /** Manually trigger circuit preloading */
  loadCircuits: () => Promise<void>;
  /** Clear the circuit cache */
  clearCache: () => void;
  /** Add a proof to recent proofs tracking */
  trackProof: (circuitName: string, proof: ZKProof) => string;
  /** Update proof tracking with zkVerify info */
  updateProofTracking: (id: string, jobId: string, status?: KurierVerificationStatus) => void;
  /** Clear recent proofs */
  clearProofHistory: () => void;
}

export type ZKContextValue = ZKContextState & ZKContextActions;

const ZKContext = createContext<ZKContextValue | undefined>(undefined);


export interface ZKProviderProps {
  children: ReactNode;
  /** Auto-load circuits on mount (default: true) */
  autoLoad?: boolean;
  /** Maximum number of proofs to keep in history (default: 50) */
  maxProofHistory?: number;
}

export function ZKProvider({ 
  children, 
  autoLoad = true,
  maxProofHistory = 50 
}: ZKProviderProps) {
  const [state, setState] = useState<ZKContextState>({
    isReady: false,
    isLoading: false,
    isZkVerifyAvailable: false,
    error: null,
    recentProofs: [],
  });

  // Ref to prevent duplicate loading (React StrictMode protection)
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);

  // Load circuits
  const loadCircuits = useCallback(async () => {
    // Use refs to prevent duplicate loading in StrictMode
    if (loadingRef.current || loadedRef.current) {
      console.log('[ZK Context] Circuits already loading or loaded, skipping...');
      return;
    }

    loadingRef.current = true;
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('[ZK Context] Loading circuits...');
      const proofService = await getProofService();
      await proofService.preloadCircuits();
      
      // Also check zkVerify availability
      const zkVerifyService = await getZkVerifyService();
      const zkVerifyAvailable = await zkVerifyService.isKurierAvailable();
      
      loadedRef.current = true;
      setState(prev => ({
        ...prev,
        isReady: true,
        isLoading: false,
        isZkVerifyAvailable: zkVerifyAvailable,
      }));
      
      console.log('[ZK Context] Circuits loaded, zkVerify available:', zkVerifyAvailable);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load circuits';
      console.error('[ZK Context] Load error:', error);
      loadingRef.current = false; // Allow retry on error
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []); // No dependencies - refs handle state

  // Clear cache
  const clearCache = useCallback(async () => {
    const proofService = await getProofService();
    proofService.clearCircuitCache();
    // Reset refs to allow reloading
    loadingRef.current = false;
    loadedRef.current = false;
    setState(prev => ({
      ...prev,
      isReady: false,
    }));
  }, []);

  // Track a proof
  const trackProof = useCallback((circuitName: string, proof: ZKProof): string => {
    const id = `${circuitName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const record: ProofRecord = {
      id,
      circuitName,
      timestamp: new Date(),
      proof,
    };

    setState(prev => ({
      ...prev,
      recentProofs: [record, ...prev.recentProofs].slice(0, maxProofHistory),
    }));

    return id;
  }, [maxProofHistory]);

  // Update proof tracking
  const updateProofTracking = useCallback((
    id: string,
    jobId: string,
    status?: KurierVerificationStatus
  ) => {
    setState(prev => ({
      ...prev,
      recentProofs: prev.recentProofs.map(p =>
        p.id === id ? { ...p, jobId, zkVerifyStatus: status } : p
      ),
    }));
  }, []);

  // Clear history
  const clearProofHistory = useCallback(() => {
    setState(prev => ({ ...prev, recentProofs: [] }));
  }, []);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadCircuits();
    }
  }, [autoLoad, loadCircuits]);

  // Periodically check zkVerify availability (only if API key is configured)
  useEffect(() => {
    // Only poll if there's a chance zkVerify is available
    const apiKey = process.env.NEXT_PUBLIC_KURIER_API_KEY;
    if (!apiKey) {
      console.log('[ZK Context] zkVerify API key not configured, skipping health checks');
      return;
    }

    const checkZkVerify = async () => {
      try {
        const zkVerifyService = await getZkVerifyService();
        const health = await zkVerifyService.checkKurierHealth();
        setState(prev => ({
          ...prev,
          isZkVerifyAvailable: health.status !== 'down',
        }));
      } catch {
        setState(prev => ({
          ...prev,
          isZkVerifyAvailable: false,
        }));
      }
    };

    // Initial check
    checkZkVerify();

    // Check every 2 minutes to reduce load
    const interval = setInterval(checkZkVerify, 120000);
    return () => clearInterval(interval);
  }, []);

  const value: ZKContextValue = {
    ...state,
    loadCircuits,
    clearCache,
    trackProof,
    updateProofTracking,
    clearProofHistory,
  };

  return (
    <ZKContext.Provider value={value}>
      {children}
    </ZKContext.Provider>
  );
}
export function useZK(): ZKContextValue {
  const context = useContext(ZKContext);
  
  if (!context) {
    throw new Error('useZK must be used within a ZKProvider');
  }
  
  return context;
}
