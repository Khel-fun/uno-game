/**
 * useMiniPayTransaction Hook
 *
 * Custom hook for sending transactions with MiniPay fee abstraction support.
 * When using MiniPay on Celo, transactions can pay fees in cUSD instead of CELO.
 *
 * Usage:
 * const { sendMiniPayTransaction, isPending } = useMiniPayTransaction();
 * await sendMiniPayTransaction({ to, value, data });
 */

import { useWalletClient, useChainId, usePublicClient } from "wagmi";
import { useState } from "react";
import {
  isMiniPay,
  getFeeCurrency,
  supportsFeeAbstraction,
} from "@/utils/miniPayUtils";

interface TransactionRequest {
  to: `0x${string}`;
  value?: bigint | string;
  data?: `0x${string}`;
  gas?: bigint;
}

interface UseMiniPayTransactionReturn {
  sendMiniPayTransaction: (
    tx: TransactionRequest,
  ) => Promise<`0x${string}` | null>;
  isPending: boolean;
  error: Error | null;
}

export const useMiniPayTransaction = (): UseMiniPayTransactionReturn => {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMiniPayTransaction = async (
    tx: TransactionRequest,
  ): Promise<`0x${string}` | null> => {
    if (!walletClient) {
      const err = new Error("Wallet client not connected");
      setError(err);
      throw err;
    }

    setIsPending(true);
    setError(null);

    try {
      // Build transaction object
      const transaction: any = {
        to: tx.to,
        value: typeof tx.value === "string" ? BigInt(tx.value) : tx.value,
        data: tx.data,
        account: walletClient.account,
        chain: walletClient.chain,
      };

      // Add feeCurrency for Celo chains when using MiniPay or if fee abstraction is supported
      if (supportsFeeAbstraction(chainId)) {
        const feeCurrency = getFeeCurrency(chainId);
        if (feeCurrency && (isMiniPay() || true)) {
          // Allow fee abstraction for all wallets on Celo
          transaction.feeCurrency = feeCurrency;
        }
      }

      // Estimate gas if not provided (using publicClient)
      if (!tx.gas && publicClient) {
        transaction.gas = await publicClient.estimateGas(transaction);
      } else if (tx.gas) {
        transaction.gas = tx.gas;
      }

      // Send transaction
      const hash = await walletClient.sendTransaction(transaction);

      setIsPending(false);
      return hash;
    } catch (err) {
      const error = err as Error;
      setError(error);
      setIsPending(false);
      throw error;
    }
  };

  return {
    sendMiniPayTransaction,
    isPending,
    error,
  };
};
