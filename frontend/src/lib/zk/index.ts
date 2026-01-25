/**
 * ZK Library for UNO Game
 * Main entry point - exports all ZK-related functionality
 */

// Types
export * from './types';

// Card UIDs
export * from './cardUids';

// Game Utilities (card code mapping, proof input builders)
export * from './gameUtils';

// Proof Service
export {
  generateShuffleProof,
  generateDealProof,
  generateDrawProof,
  generatePlayProof,
  verifyShuffleProof,
  verifyDealProof,
  verifyDrawProof,
  verifyPlayProof,
  proofToHex,
  hexToProof,
  preloadCircuits,
  clearCircuitCache,
} from './proofService';

// zkVerify Service
export {
  submitProofToZkVerify,
  getVerificationStatus,
  waitForVerification,
  submitProofsBatch,
  registerVerificationKey,
  checkKurierHealth,
  isKurierAvailable,
} from './zkVerifyService';

// Verification Service (unified local + on-chain verification)
export {
  verifyLocally,
  submitToZkVerify,
  waitForZkVerifyResult,
  verifyOnChain,
  verifyProofComprehensive,
  testLocalVerification,
  verificationConfig,
  type CircuitType,
  type VerificationOptions,
  type ComprehensiveVerificationResult,
} from './verificationService';

// Direct On-Chain Verifier (standalone Solidity verifier calls)
export {
  verifyOnChainReadOnly,
  verifyOnChainWithTx,
  verifyProofStandalone,
  formatProofForContract,
  getVerifierConfig,
  getVerifierAddress,
  isOnChainVerificationAvailable,
  BASE_SEPOLIA_CHAIN_ID,
  VERIFIER_ABI,
  type VerifierCircuitType,
  type OnChainVerifyResult,
  type VerifierConfig,
} from './onChainVerifier';

// React Hooks
export {
  useShuffleProof,
  useDealProof,
  useDrawProof,
  usePlayProof,
  usePreloadCircuits,
  useZkVerifyStatus,
  useZkVerifyJob,
  useCircuitCleanup,
  useOnChainVerify,
  type ProofStatus,
  type UseProofState,
  type UseProofActions,
  type UseProofResult,
  type UseOnChainVerifyState,
  type UseOnChainVerifyResult,
} from './hooks';

// ZK Game Hook (high-level game integration)
export { useZKGame } from './useZKGame';
export type { ZKGameState, ZKGameActions, ZKGameProofs } from './useZKGame';

// Context Provider
export { ZKProvider, useZK } from './ZKContext';
