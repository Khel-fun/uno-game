'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ShuffleCircuitInput,
  DealCircuitInput,
  DrawCircuitInput,
  PlayCircuitInput,
  ZKProof,
  VerificationResult,
} from './types';

export type ProofStatus = 
  | 'idle'
  | 'generating'
  | 'generated'
  | 'verifying'
  | 'verified'
  | 'submitting'
  | 'submitted'
  | 'on-chain-pending'
  | 'on-chain-verified'
  | 'error';

export interface KurierVerificationStatusLocal {
  jobId: string;
  status: string;
  transactionHash?: string;
  explorerUrl?: string;
  attestationId?: string;
}

export interface UseProofState {
  /** Current status of the proof operation */
  status: ProofStatus;
  /** The generated proof, if available */
  proof: ZKProof | null;
  /** Local verification result */
  localVerification: VerificationResult | null;
  /** zkVerify job ID, if submitted */
  jobId: string | null;
  /** zkVerify verification status */
  zkVerifyStatus: KurierVerificationStatusLocal | null;
  /** Error message, if any */
  error: string | null;
  /** Time taken to generate the proof in milliseconds */
  proofTime: number | null;
}

export interface UseProofActions<TInput> {
  /** Generate a proof from the given input */
  generate: (input: TInput) => Promise<ZKProof | null>;
  /** Verify the proof locally */
  verifyLocally: () => Promise<boolean>;
  /** Submit the proof to zkVerify for on-chain verification */
  submitToZkVerify: (metadata?: Record<string, string>) => Promise<string | null>;
  /** Wait for zkVerify verification to complete */
  waitForZkVerify: () => Promise<KurierVerificationStatusLocal | null>;
  /** Reset the state */
  reset: () => void;
}

export type UseProofResult<TInput> = UseProofState & UseProofActions<TInput>;



export function useShuffleProof(): UseProofResult<ShuffleCircuitInput> {
  const [state, setState] = useState<UseProofState>({
    status: 'idle',
    proof: null,
    localVerification: null,
    jobId: null,
    zkVerifyStatus: null,
    error: null,
    proofTime: null,
  });

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const safeSetState = useCallback((updates: Partial<UseProofState>) => {
    if (isMounted.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const generate = useCallback(async (input: ShuffleCircuitInput): Promise<ZKProof | null> => {
    safeSetState({ status: 'generating', error: null, proofTime: null });
    const startTime = performance.now();

    try {
      const proofService = await import('./proofService');
      const proof = await proofService.generateShuffleProof(input);
      const endTime = performance.now();
      
      safeSetState({
        status: 'generated',
        proof,
        proofTime: endTime - startTime,
      });
      
      return proof;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Proof generation failed';
      safeSetState({ status: 'error', error: message });
      console.error('[ZK Hook] shuffle proof generation failed:', error);
      return null;
    }
  }, [safeSetState]);

  const verifyLocally = useCallback(async (): Promise<boolean> => {
    if (!state.proof) {
      safeSetState({ error: 'No proof to verify' });
      return false;
    }

    safeSetState({ status: 'verifying' });

    try {
      const proofService = await import('./proofService');
      const result = await proofService.verifyShuffleProof(state.proof);
      
      safeSetState({
        status: result.valid ? 'verified' : 'error',
        localVerification: result,
        error: result.valid ? null : result.error || 'Verification failed',
      });

      return result.valid;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      safeSetState({ status: 'error', error: message });
      return false;
    }
  }, [state.proof, safeSetState]);

  const submitToZkVerify = useCallback(async (
    metadata?: Record<string, string>
  ): Promise<string | null> => {
    if (!state.proof) {
      safeSetState({ error: 'No proof to submit' });
      return null;
    }

    safeSetState({ status: 'submitting' });

    try {
      const zkVerifyService = await import('./zkVerifyService');
      const response = await zkVerifyService.submitProofToZkVerify({ circuitName: 'shuffle', proof: state.proof });

      safeSetState({
        status: 'submitted',
        jobId: response.jobId,
        zkVerifyStatus: {
          jobId: response.jobId,
          status: 'Queued', // Initial status after submission
        },
      });

      return response.jobId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'zkVerify submission failed';
      safeSetState({ status: 'error', error: message });
      return null;
    }
  }, [state.proof, safeSetState]);

  const waitForZkVerify = useCallback(async (): Promise<KurierVerificationStatusLocal | null> => {
    if (!state.jobId) {
      safeSetState({ error: 'No job ID to wait for' });
      return null;
    }

    safeSetState({ status: 'on-chain-pending' });

    try {
      const zkVerifyService = await import('./zkVerifyService');
      const finalStatus = await zkVerifyService.waitForVerification(state.jobId);

      const statusObj: KurierVerificationStatusLocal = {
        jobId: state.jobId,
        status: finalStatus.status,
        transactionHash: finalStatus.txHash,
        explorerUrl: finalStatus.txExplorerUrl,
        attestationId: finalStatus.attestationId,
      };

      safeSetState({
        status: 'on-chain-verified',
        zkVerifyStatus: statusObj,
      });

      return statusObj;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'zkVerify verification failed';
      safeSetState({ status: 'error', error: message });
      return null;
    }
  }, [state.jobId, safeSetState]);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      proof: null,
      localVerification: null,
      jobId: null,
      zkVerifyStatus: null,
      error: null,
      proofTime: null,
    });
  }, []);

  return {
    ...state,
    generate,
    verifyLocally,
    submitToZkVerify,
    waitForZkVerify,
    reset,
  };
}

export function useDealProof(): UseProofResult<DealCircuitInput> {
  const [state, setState] = useState<UseProofState>({
    status: 'idle',
    proof: null,
    localVerification: null,
    jobId: null,
    zkVerifyStatus: null,
    error: null,
    proofTime: null,
  });

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const safeSetState = useCallback((updates: Partial<UseProofState>) => {
    if (isMounted.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const generate = useCallback(async (input: DealCircuitInput): Promise<ZKProof | null> => {
    safeSetState({ status: 'generating', error: null, proofTime: null });
    const startTime = performance.now();

    try {
      const proofService = await import('./proofService');
      const proof = await proofService.generateDealProof(input);
      const endTime = performance.now();
      
      safeSetState({
        status: 'generated',
        proof,
        proofTime: endTime - startTime,
      });
      
      return proof;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Proof generation failed';
      safeSetState({ status: 'error', error: message });
      console.error('[ZK Hook] deal proof generation failed:', error);
      return null;
    }
  }, [safeSetState]);

  const verifyLocally = useCallback(async (): Promise<boolean> => {
    if (!state.proof) {
      safeSetState({ error: 'No proof to verify' });
      return false;
    }

    safeSetState({ status: 'verifying' });

    try {
      const proofService = await import('./proofService');
      const result = await proofService.verifyDealProof(state.proof);
      
      safeSetState({
        status: result.valid ? 'verified' : 'error',
        localVerification: result,
        error: result.valid ? null : result.error || 'Verification failed',
      });

      return result.valid;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      safeSetState({ status: 'error', error: message });
      return false;
    }
  }, [state.proof, safeSetState]);

  const submitToZkVerify = useCallback(async (): Promise<string | null> => {
    if (!state.proof) {
      safeSetState({ error: 'No proof to submit' });
      return null;
    }

    safeSetState({ status: 'submitting' });

    try {
      const zkVerifyService = await import('./zkVerifyService');
      const response = await zkVerifyService.submitProofToZkVerify({ circuitName: 'deal', proof: state.proof });

      safeSetState({
        status: 'submitted',
        jobId: response.jobId,
        zkVerifyStatus: {
          jobId: response.jobId,
          status: 'Queued',
        },
      });

      return response.jobId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'zkVerify submission failed';
      safeSetState({ status: 'error', error: message });
      return null;
    }
  }, [state.proof, safeSetState]);

  const waitForZkVerify = useCallback(async (): Promise<KurierVerificationStatusLocal | null> => {
    if (!state.jobId) {
      safeSetState({ error: 'No job ID to wait for' });
      return null;
    }

    safeSetState({ status: 'on-chain-pending' });

    try {
      const zkVerifyService = await import('./zkVerifyService');
      const finalStatus = await zkVerifyService.waitForVerification(state.jobId);

      const statusObj: KurierVerificationStatusLocal = {
        jobId: state.jobId,
        status: finalStatus.status,
        transactionHash: finalStatus.txHash,
        explorerUrl: finalStatus.txExplorerUrl,
        attestationId: finalStatus.attestationId,
      };

      safeSetState({
        status: 'on-chain-verified',
        zkVerifyStatus: statusObj,
      });

      return statusObj;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'zkVerify verification failed';
      safeSetState({ status: 'error', error: message });
      return null;
    }
  }, [state.jobId, safeSetState]);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      proof: null,
      localVerification: null,
      jobId: null,
      zkVerifyStatus: null,
      error: null,
      proofTime: null,
    });
  }, []);

  return {
    ...state,
    generate,
    verifyLocally,
    submitToZkVerify,
    waitForZkVerify,
    reset,
  };
}

export function useDrawProof(): UseProofResult<DrawCircuitInput> {
  const [state, setState] = useState<UseProofState>({
    status: 'idle',
    proof: null,
    localVerification: null,
    jobId: null,
    zkVerifyStatus: null,
    error: null,
    proofTime: null,
  });

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const safeSetState = useCallback((updates: Partial<UseProofState>) => {
    if (isMounted.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const generate = useCallback(async (input: DrawCircuitInput): Promise<ZKProof | null> => {
    safeSetState({ status: 'generating', error: null, proofTime: null });
    const startTime = performance.now();

    try {
      const proofService = await import('./proofService');
      const proof = await proofService.generateDrawProof(input);
      const endTime = performance.now();
      
      safeSetState({
        status: 'generated',
        proof,
        proofTime: endTime - startTime,
      });
      
      return proof;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Proof generation failed';
      safeSetState({ status: 'error', error: message });
      console.error('[ZK Hook] draw proof generation failed:', error);
      return null;
    }
  }, [safeSetState]);

  const verifyLocally = useCallback(async (): Promise<boolean> => {
    if (!state.proof) {
      safeSetState({ error: 'No proof to verify' });
      return false;
    }

    safeSetState({ status: 'verifying' });

    try {
      const proofService = await import('./proofService');
      const result = await proofService.verifyDrawProof(state.proof);
      
      safeSetState({
        status: result.valid ? 'verified' : 'error',
        localVerification: result,
        error: result.valid ? null : result.error || 'Verification failed',
      });

      return result.valid;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      safeSetState({ status: 'error', error: message });
      return false;
    }
  }, [state.proof, safeSetState]);

  const submitToZkVerify = useCallback(async (): Promise<string | null> => {
    if (!state.proof) {
      safeSetState({ error: 'No proof to submit' });
      return null;
    }

    safeSetState({ status: 'submitting' });

    try {
      const zkVerifyService = await import('./zkVerifyService');
      const response = await zkVerifyService.submitProofToZkVerify({ circuitName: 'draw', proof: state.proof });

      safeSetState({
        status: 'submitted',
        jobId: response.jobId,
        zkVerifyStatus: {
          jobId: response.jobId,
          status: 'Queued',
        },
      });

      return response.jobId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'zkVerify submission failed';
      safeSetState({ status: 'error', error: message });
      return null;
    }
  }, [state.proof, safeSetState]);

  const waitForZkVerify = useCallback(async (): Promise<KurierVerificationStatusLocal | null> => {
    if (!state.jobId) {
      safeSetState({ error: 'No job ID to wait for' });
      return null;
    }

    safeSetState({ status: 'on-chain-pending' });

    try {
      const zkVerifyService = await import('./zkVerifyService');
      const finalStatus = await zkVerifyService.waitForVerification(state.jobId);

      const statusObj: KurierVerificationStatusLocal = {
        jobId: state.jobId,
        status: finalStatus.status,
        transactionHash: finalStatus.txHash,
        explorerUrl: finalStatus.txExplorerUrl,
        attestationId: finalStatus.attestationId,
      };

      safeSetState({
        status: 'on-chain-verified',
        zkVerifyStatus: statusObj,
      });

      return statusObj;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'zkVerify verification failed';
      safeSetState({ status: 'error', error: message });
      return null;
    }
  }, [state.jobId, safeSetState]);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      proof: null,
      localVerification: null,
      jobId: null,
      zkVerifyStatus: null,
      error: null,
      proofTime: null,
    });
  }, []);

  return {
    ...state,
    generate,
    verifyLocally,
    submitToZkVerify,
    waitForZkVerify,
    reset,
  };
}

export function usePlayProof(): UseProofResult<PlayCircuitInput> {
  const [state, setState] = useState<UseProofState>({
    status: 'idle',
    proof: null,
    localVerification: null,
    jobId: null,
    zkVerifyStatus: null,
    error: null,
    proofTime: null,
  });

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const safeSetState = useCallback((updates: Partial<UseProofState>) => {
    if (isMounted.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const generate = useCallback(async (input: PlayCircuitInput): Promise<ZKProof | null> => {
    safeSetState({ status: 'generating', error: null, proofTime: null });
    const startTime = performance.now();

    try {
      const proofService = await import('./proofService');
      const proof = await proofService.generatePlayProof(input);
      const endTime = performance.now();
      
      safeSetState({
        status: 'generated',
        proof,
        proofTime: endTime - startTime,
      });
      
      return proof;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Proof generation failed';
      safeSetState({ status: 'error', error: message });
      console.error('[ZK Hook] play proof generation failed:', error);
      return null;
    }
  }, [safeSetState]);

  const verifyLocally = useCallback(async (): Promise<boolean> => {
    if (!state.proof) {
      safeSetState({ error: 'No proof to verify' });
      return false;
    }

    safeSetState({ status: 'verifying' });

    try {
      const proofService = await import('./proofService');
      const result = await proofService.verifyPlayProof(state.proof);
      
      safeSetState({
        status: result.valid ? 'verified' : 'error',
        localVerification: result,
        error: result.valid ? null : result.error || 'Verification failed',
      });

      return result.valid;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      safeSetState({ status: 'error', error: message });
      return false;
    }
  }, [state.proof, safeSetState]);

  const submitToZkVerify = useCallback(async (): Promise<string | null> => {
    if (!state.proof) {
      safeSetState({ error: 'No proof to submit' });
      return null;
    }

    safeSetState({ status: 'submitting' });

    try {
      const zkVerifyService = await import('./zkVerifyService');
      const response = await zkVerifyService.submitProofToZkVerify({ circuitName: 'play', proof: state.proof });

      safeSetState({
        status: 'submitted',
        jobId: response.jobId,
        zkVerifyStatus: {
          jobId: response.jobId,
          status: 'Queued',
        },
      });

      return response.jobId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'zkVerify submission failed';
      safeSetState({ status: 'error', error: message });
      return null;
    }
  }, [state.proof, safeSetState]);

  const waitForZkVerify = useCallback(async (): Promise<KurierVerificationStatusLocal | null> => {
    if (!state.jobId) {
      safeSetState({ error: 'No job ID to wait for' });
      return null;
    }

    safeSetState({ status: 'on-chain-pending' });

    try {
      const zkVerifyService = await import('./zkVerifyService');
      const finalStatus = await zkVerifyService.waitForVerification(state.jobId);

      const statusObj: KurierVerificationStatusLocal = {
        jobId: state.jobId,
        status: finalStatus.status,
        transactionHash: finalStatus.txHash,
        explorerUrl: finalStatus.txExplorerUrl,
        attestationId: finalStatus.attestationId,
      };

      safeSetState({
        status: 'on-chain-verified',
        zkVerifyStatus: statusObj,
      });

      return statusObj;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'zkVerify verification failed';
      safeSetState({ status: 'error', error: message });
      return null;
    }
  }, [state.jobId, safeSetState]);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      proof: null,
      localVerification: null,
      jobId: null,
      zkVerifyStatus: null,
      error: null,
      proofTime: null,
    });
  }, []);

  return {
    ...state,
    generate,
    verifyLocally,
    submitToZkVerify,
    waitForZkVerify,
    reset,
  };
}


/**
 * Hook to preload all circuits on mount
 * Use this in your app's root to improve proof generation speed
 */
export function usePreloadCircuits() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (isLoaded || isLoading) return;
      
      setIsLoading(true);
      try {
        const proofService = await import('./proofService');
        await proofService.preloadCircuits();
        if (!cancelled) {
          setIsLoaded(true);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to preload circuits');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isLoading]);

  return { isLoaded, isLoading, error };
}

/**
 * Hook to check zkVerify availability
 */
export function useZkVerifyStatus() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      setIsChecking(true);
      try {
        const zkVerifyService = await import('./zkVerifyService');
        const available = await zkVerifyService.isKurierAvailable();
        if (!cancelled) {
          setIsAvailable(available);
        }
      } catch {
        if (!cancelled) {
          setIsAvailable(false);
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isAvailable, isChecking };
}

/**
 * Hook to track a zkVerify job status
 */
export function useZkVerifyJob(jobId: string | null) {
  const [status, setStatus] = useState<KurierVerificationStatusLocal | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setStatus(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      setIsPolling(true);
      
      try {
        const zkVerifyService = await import('./zkVerifyService');
        const newStatus = await zkVerifyService.getVerificationStatus(jobId);
        
        if (!cancelled) {
          setStatus({
            jobId,
            status: newStatus.status,
            transactionHash: newStatus.txHash,
            explorerUrl: newStatus.txExplorerUrl,
            attestationId: newStatus.attestationId,
          });
          
          // Continue polling if still pending (using Kurier status values)
          const isPending = ['Queued', 'Valid', 'Submitted', 'IncludedInBlock', 'AggregationPending'].includes(newStatus.status);
          if (isPending) {
            setTimeout(poll, 3000);
          } else {
            setIsPolling(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to get status');
          setIsPolling(false);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return { status, isPolling, error };
}

/**
 * Hook to cleanup circuit cache on unmount
 * Use this sparingly - usually you want to keep circuits cached
 */
export function useCircuitCleanup() {
  useEffect(() => {
    return () => {
      import('./proofService').then(proofService => {
        proofService.clearCircuitCache();
      });
    };
  }, []);
}

export interface UseOnChainVerifyState {
  isVerifying: boolean;
  verified: boolean | null;
  txHash: string | null;
  error: string | null;
}

export interface UseOnChainVerifyResult {
  state: UseOnChainVerifyState;
  verifyReadOnly: (
    circuitType: 'shuffle' | 'deal' | 'draw' | 'play',
    proof: ZKProof,
    publicClient: unknown
  ) => Promise<boolean>;
  reset: () => void;
}

/**
 * Hook for direct on-chain proof verification using Solidity verifiers
 * This is a fallback when zkVerify/Kurier is not working
 */
export function useOnChainVerify(): UseOnChainVerifyResult {
  const [state, setState] = useState<UseOnChainVerifyState>({
    isVerifying: false,
    verified: null,
    txHash: null,
    error: null,
  });

  const verifyReadOnly = useCallback(async (
    circuitType: 'shuffle' | 'deal' | 'draw' | 'play',
    proof: ZKProof,
    publicClient: unknown
  ): Promise<boolean> => {
    setState({ isVerifying: true, verified: null, txHash: null, error: null });

    try {
      const onChainVerifier = await import('./onChainVerifier');
      const result = await onChainVerifier.verifyOnChainReadOnly(circuitType, proof, publicClient);

      setState({
        isVerifying: false,
        verified: result.verified,
        txHash: result.txHash || null,
        error: result.error || null,
      });

      return result.verified;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'On-chain verification failed';
      setState({ isVerifying: false, verified: false, txHash: null, error: message });
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isVerifying: false, verified: null, txHash: null, error: null });
  }, []);

  return { state, verifyReadOnly, reset };
}
