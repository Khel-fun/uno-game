/**
 * ZK Proof Panel Component
 * Shows real-time ZK proof status during gameplay
 * Includes on-chain verification functionality
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useZK, type ProofRecord } from '../../lib/zk';
import { useWalletClient, useSwitchChain } from 'wagmi';

// ============================================================================
// Types
// ============================================================================

interface ProofNotification {
  id: string;
  type: 'generating' | 'success' | 'error' | 'submitting';
  circuit: string;
  message: string;
  timestamp: number;
}

// ============================================================================
// ZK Status Icon
// ============================================================================

function ZKIcon({ status }: { status: 'idle' | 'loading' | 'ready' | 'error' }) {
  const statusColors = {
    idle: 'text-gray-400',
    loading: 'text-yellow-400 animate-spin',
    ready: 'text-green-400',
    error: 'text-red-400',
  };

  return (
    <svg
      className={`w-5 h-5 ${statusColors[status]}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

// ============================================================================
// Proof Notification Toast
// ============================================================================

function ProofNotificationToast({ notification, onDismiss }: { 
  notification: ProofNotification; 
  onDismiss: () => void;
}) {
  const typeStyles = {
    generating: 'bg-yellow-500/90 border-yellow-400',
    success: 'bg-green-500/90 border-green-400',
    error: 'bg-red-500/90 border-red-400',
    submitting: 'bg-blue-500/90 border-blue-400',
  };

  const typeIcons = {
    generating: '⏳',
    success: '✓',
    error: '✗',
    submitting: '📡',
  };

  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`${typeStyles[notification.type]} border text-white text-sm px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-3 min-w-[280px]`}
    >
      <span className="text-lg">{typeIcons[notification.type]}</span>
      <div className="flex-1">
        <div className="font-medium">ZK Proof: {notification.circuit}</div>
        <div className="text-xs opacity-90">{notification.message}</div>
      </div>
      <button 
        onClick={onDismiss}
        className="text-white/70 hover:text-white transition-colors"
      >
        ✕
      </button>
    </motion.div>
  );
}

// ============================================================================
// On-Chain Verification Section
// ============================================================================

interface OnChainVerificationSectionProps {
  proofs: ProofRecord[];
}

function OnChainVerificationSection({ proofs }: OnChainVerificationSectionProps) {
  // Wallet hook for transaction-based verification
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, {
    verified: boolean;
    error?: string;
    txHash?: string;
    recorded?: boolean;
  }>>({});
  const [showAll, setShowAll] = useState(false);

  const handleVerifyOnChain = useCallback(async (proof: ProofRecord) => {
    console.log('[ZKProofPanel] Starting verification for', proof.circuitName, {
      proofLength: proof.proof.proof.length,
      publicInputsCount: proof.proof.publicInputs.length,
    });

    setVerifyingId(proof.id);
    
    try {
      // Dynamic import to avoid SSR issues
      const onChainVerifier = await import('../../lib/zk/onChainVerifier');
      
      // Map circuit name to verifier type
      const circuitType = proof.circuitName as 'shuffle' | 'deal' | 'draw' | 'play';
      
      // No need to pass publicClient - the verifier creates its own dedicated Base Sepolia client
      const result = await onChainVerifier.verifyOnChainReadOnly(
        circuitType,
        proof.proof
      );

      setVerificationResults(prev => ({
        ...prev,
        [proof.id]: { verified: result.verified, error: result.error },
      }));

      // Show notification
      const zkNotify = (window as unknown as { 
        zkNotify?: (type: string, circuit: string, message: string) => void 
      }).zkNotify;
      
      if (zkNotify) {
        if (result.verified) {
          zkNotify('success', circuitType, 'On-chain verification successful! ✓');
        } else {
          zkNotify('error', circuitType, `On-chain verification failed: ${result.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      setVerificationResults(prev => ({
        ...prev,
        [proof.id]: { verified: false, error: message },
      }));
    } finally {
      setVerifyingId(null);
    }
  }, []);

  // Record verification on-chain (requires wallet, costs gas)
  const handleRecordOnChain = useCallback(async (proof: ProofRecord) => {
    console.log('[ZKProofPanel] Record on-chain clicked', {
      hasWalletClient: !!walletClient,
      walletChainId: walletClient?.chain?.id,
    });

    if (!walletClient) {
      const zkNotify = (window as unknown as { 
        zkNotify?: (type: string, circuit: string, message: string) => void 
      }).zkNotify;
      zkNotify?.('error', proof.circuitName, 'Please connect your wallet');
      return;
    }

    // Check wallet's chain and switch if needed
    const walletChainId = walletClient.chain?.id;
    if (walletChainId !== 84532) {
      console.log('[ZKProofPanel] Wrong chain:', walletChainId, 'switching to Base Sepolia (84532)...');
      const zkNotify = (window as unknown as { 
        zkNotify?: (type: string, circuit: string, message: string) => void 
      }).zkNotify;
      
      try {
        zkNotify?.('submitting', proof.circuitName, 'Switching to Base Sepolia...');
        await switchChainAsync({ chainId: 84532 });
        console.log('[ZKProofPanel] Chain switched successfully to Base Sepolia');
      } catch (switchError) {
        console.error('[ZKProofPanel] Chain switch failed:', switchError);
        zkNotify?.('error', proof.circuitName, 'Failed to switch to Base Sepolia. Please switch manually.');
        return;
      }
    }

    console.log('[ZKProofPanel] Recording on-chain for', proof.circuitName, {
      proofLength: proof.proof.proof.length,
      publicInputsCount: proof.proof.publicInputs.length,
    });

    setRecordingId(proof.id);
    
    try {
      const onChainVerifier = await import('../../lib/zk/onChainVerifier');
      const circuitType = proof.circuitName as 'shuffle' | 'deal' | 'draw' | 'play';
      
      // Only walletClient is needed - the verifier uses its own Base Sepolia client
      const result = await onChainVerifier.verifyOnChainWithTransaction(
        circuitType,
        proof.proof,
        walletClient
      );

      setVerificationResults(prev => ({
        ...prev,
        [proof.id]: { 
          verified: result.verified, 
          error: result.error,
          txHash: result.txHash,
          recorded: result.verified,
        },
      }));

      const zkNotify = (window as unknown as { 
        zkNotify?: (type: string, circuit: string, message: string) => void 
      }).zkNotify;
      
      if (zkNotify) {
        if (result.verified) {
          zkNotify('success', circuitType, `Recorded on-chain! TX: ${result.txHash?.slice(0, 10)}...`);
        } else {
          zkNotify('error', circuitType, `Recording failed: ${result.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Recording failed';
      setVerificationResults(prev => ({
        ...prev,
        [proof.id]: { verified: false, error: message },
      }));
    } finally {
      setRecordingId(null);
    }
  }, [walletClient, switchChainAsync]);

  const handleVerifyAll = useCallback(async () => {
    for (const proof of proofs.slice(0, 10)) {
      if (!verificationResults[proof.id]) {
        await handleVerifyOnChain(proof);
      }
    }
  }, [proofs, verificationResults, handleVerifyOnChain]);

  const displayProofs = showAll ? proofs : proofs.slice(0, 5);
  const unverifiedCount = proofs.filter(p => !verificationResults[p.id]).length;

  return (
    <div className="bg-white/5 rounded-lg p-3 text-xs space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-gray-300">On-Chain Verification</div>
        {unverifiedCount > 0 && (
          <button
            onClick={handleVerifyAll}
            disabled={verifyingId !== null}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs transition-colors"
          >
            Verify All ({unverifiedCount})
          </button>
        )}
      </div>

      {/* Verification uses dedicated Base Sepolia RPC - no wallet needed */}
      <div className="text-green-400/60 text-xs mb-1">
        ✓ Verifying on Base Sepolia
      </div>

      <div className="space-y-1 max-h-[200px] overflow-y-auto">
        {displayProofs.map((proof) => {
          const result = verificationResults[proof.id];
          const isVerifying = verifyingId === proof.id;
          
          return (
            <div 
              key={proof.id}
              className="flex items-center justify-between bg-white/5 rounded px-2 py-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 capitalize">{proof.circuitName}</span>
                <span className="text-gray-600 text-[10px]">
                  {new Date(proof.timestamp).toLocaleTimeString()}
                </span>
              </div>
              
              <div className="flex items-center gap-1">
                {result ? (
                  <div className="flex items-center gap-2">
                    <span className={result.verified ? 'text-green-400' : 'text-red-400'}>
                      {result.verified ? '✓ Verified' : `✗ ${result.error || 'Failed'}`}
                    </span>
                    {result.recorded && result.txHash && (
                      <a 
                        href={`https://sepolia.basescan.org/tx/${result.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-[10px]"
                        title="View on BaseScan"
                      >
                        📜 TX
                      </a>
                    )}
                    {result.verified && !result.recorded && (
                      <button
                        onClick={() => handleRecordOnChain(proof)}
                        disabled={recordingId === proof.id}
                        className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-[10px] transition-colors"
                        title="Record verification on-chain (costs gas)"
                      >
                        {recordingId === proof.id ? '⟳' : '📜 Record'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleVerifyOnChain(proof)}
                      disabled={isVerifying || recordingId === proof.id}
                      className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white transition-colors"
                      title="Verify proof (free, no gas)"
                    >
                      {isVerifying ? (
                        <span className="flex items-center gap-1">
                          <span className="animate-spin">⟳</span>
                        </span>
                      ) : (
                        'Verify'
                      )}
                    </button>
                    <button
                      onClick={() => handleRecordOnChain(proof)}
                      disabled={isVerifying || recordingId === proof.id}
                      className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-[10px] transition-colors"
                      title="Record on-chain (costs gas)"
                    >
                      {recordingId === proof.id ? (
                        <span className="animate-spin">⟳</span>
                      ) : (
                        '📜'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-gray-500 pt-1 border-t border-white/10">
        <span>Verify = Free (read-only)</span>
        <span>📜 = Record on-chain (gas)</span>
      </div>

      {proofs.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-center text-gray-400 hover:text-white transition-colors"
        >
          {showAll ? 'Show Less' : `Show All (${proofs.length})`}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// ZK Proof Panel
// ============================================================================

interface ZKProofPanelProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  stats?: {
    proofsGenerated: number;
    proofsVerified: number;
    totalGenerationTime: number;
  };
}

export function ZKProofPanel({ enabled, onToggle, stats }: ZKProofPanelProps) {
  const zkContext = useZK();
  const [isExpanded, setIsExpanded] = useState(false);
  const [notifications, setNotifications] = useState<ProofNotification[]>([]);

  // Add a notification
  const addNotification = useCallback((
    type: ProofNotification['type'],
    circuit: string,
    message: string
  ) => {
    const notification: ProofNotification = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      circuit,
      message,
      timestamp: Date.now(),
    };
    setNotifications(prev => [notification, ...prev].slice(0, 5));
  }, []);

  // Dismiss a notification
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Expose addNotification globally for other components to use
  useEffect(() => {
    (window as unknown as { zkNotify?: typeof addNotification }).zkNotify = addNotification;
    return () => {
      delete (window as unknown as { zkNotify?: typeof addNotification }).zkNotify;
    };
  }, [addNotification]);

  const getStatusText = () => {
    if (!enabled) return 'Disabled';
    if (zkContext.isLoading) return 'Loading circuits...';
    if (zkContext.error) return 'Error';
    if (zkContext.isReady) return 'Ready';
    return 'Initializing...';
  };

  const getStatusColor = () => {
    if (!enabled) return 'bg-gray-600';
    if (zkContext.isLoading) return 'bg-yellow-500';
    if (zkContext.error) return 'bg-red-500';
    if (zkContext.isReady) return 'bg-green-500';
    return 'bg-gray-500';
  };

  return (
    <>
      {/* Notification Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {notifications.map(notification => (
            <ProofNotificationToast
              key={notification.id}
              notification={notification}
              onDismiss={() => dismissNotification(notification.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Main Panel */}
      <div className="fixed bottom-4 right-4 z-50">
        <motion.div
          layout
          className="bg-black/80 backdrop-blur-md rounded-xl border border-white/10 text-white overflow-hidden shadow-2xl"
        >
          {/* Header - Always visible */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ZKIcon status={
                zkContext.isLoading ? 'loading' : 
                zkContext.isReady ? 'ready' : 
                zkContext.error ? 'error' : 'idle'
              } />
              <span className="font-medium">ZK Proofs</span>
              <span className={`${getStatusColor()} px-2 py-0.5 rounded-full text-xs`}>
                {getStatusText()}
              </span>
            </div>
            <motion.span
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className="text-gray-400"
            >
              ▼
            </motion.span>
          </button>

          {/* Expanded Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-white/10"
              >
                <div className="p-4 space-y-4">
                  {/* Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Enable ZK Proofs</span>
                    <button
                      onClick={() => onToggle(!enabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        enabled ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <motion.div
                        animate={{ x: enabled ? 24 : 2 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
                      />
                    </button>
                  </div>

                  {/* Stats */}
                  {enabled && stats && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-gray-400 text-xs">Generated</div>
                        <div className="text-2xl font-bold">{stats.proofsGenerated}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-gray-400 text-xs">Verified</div>
                        <div className="text-2xl font-bold text-green-400">{stats.proofsVerified}</div>
                      </div>
                      {stats.proofsGenerated > 0 && (
                        <div className="col-span-2 bg-white/5 rounded-lg p-3">
                          <div className="text-gray-400 text-xs">Avg Generation Time</div>
                          <div className="text-lg font-medium">
                            {Math.round(stats.totalGenerationTime / stats.proofsGenerated)}ms
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* zkVerify Status */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">zkVerify (Kurier API)</span>
                    <span className={zkContext.isZkVerifyAvailable ? 'text-green-400' : 'text-gray-500'}>
                      {zkContext.isZkVerifyAvailable ? '● Connected' : '○ Not configured'}
                    </span>
                  </div>

                  {/* On-Chain Verification Status */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">On-Chain (Solidity)</span>
                    <span className="text-green-400">
                      ● Available
                    </span>
                  </div>

                  {/* Recent Proofs & On-Chain Verification */}
                  {enabled && zkContext.isReady && zkContext.recentProofs.length > 0 && (
                    <OnChainVerificationSection proofs={zkContext.recentProofs} />
                  )}

                  {/* Verification Methods Info */}
                  {enabled && zkContext.isReady && (
                    <div className="bg-white/5 rounded-lg p-3 text-xs space-y-1">
                      <div className="font-medium text-gray-300 mb-2">Verification Methods:</div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-gray-400">Local (NoirJS WASM)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={zkContext.isZkVerifyAvailable ? 'text-green-400' : 'text-gray-500'}>
                          {zkContext.isZkVerifyAvailable ? '✓' : '○'}
                        </span>
                        <span className="text-gray-400">zkVerify Network</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-gray-400">On-Chain (Base Sepolia)</span>
                      </div>
                    </div>
                  )}

                  {/* Error Display */}
                  {zkContext.error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-sm text-red-300">
                      {zkContext.error}
                    </div>
                  )}

                  {/* Info */}
                  {enabled && zkContext.isReady && (
                    <div className="text-xs text-gray-500 text-center">
                      ZK proofs are generated locally using NoirJS
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
}

// ============================================================================
// Helper to trigger notifications from anywhere
// ============================================================================

export function notifyZKProof(
  type: 'generating' | 'success' | 'error' | 'submitting',
  circuit: string,
  message: string
) {
  const zkNotify = (window as unknown as { zkNotify?: (type: string, circuit: string, message: string) => void }).zkNotify;
  if (zkNotify) {
    zkNotify(type, circuit, message);
  }
}

export default ZKProofPanel;
