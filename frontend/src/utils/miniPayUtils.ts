/**
 * MiniPay Integration Utilities
 *
 * This file contains helper functions for detecting and integrating with MiniPay wallet.
 * MiniPay is a stablecoin wallet built into Opera Mini browser with 10M+ activations.
 *
 * Key Features:
 * - Auto-detection of MiniPay wallet
 * - Auto-connection when MiniPay is detected
 * - Support for fee abstraction with cUSD as fee currency
 * - Phone number to address resolution
 */

/**
 * Check if the user is using MiniPay wallet
 * @returns boolean indicating if MiniPay is detected
 */
export const isMiniPay = (): boolean => {
  if (typeof window === "undefined") return false;

  return !!(window.ethereum && (window.ethereum as any).isMiniPay);
};

/**
 * Get the connected address from MiniPay
 * @returns Promise<string | null> - The connected wallet address or null
 */
export const getMiniPayAddress = async (): Promise<string | null> => {
  if (!isMiniPay()) return null;

  try {
    const accounts = (await window.ethereum!.request({
      method: "eth_requestAccounts",
      params: [],
    })) as string[];

    // MiniPay injects one address in array format
    return accounts[0] || null;
  } catch (error) {
    console.error("Error getting MiniPay address:", error);
    return null;
  }
};

/**
 * Check if provider exists (MiniPay or other wallet)
 * @returns boolean indicating if any wallet provider is available
 */
export const hasWalletProvider = (): boolean => {
  return typeof window !== "undefined" && !!window.ethereum;
};

/**
 * cUSD token address on Celo Mainnet
 */
export const CUSD_MAINNET_ADDRESS =
  "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

/**
 * cUSD token address on Celo Sepolia Testnet
 */
export const CUSD_SEPOLIA_ADDRESS =
  "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1" as const;

/**
 * USDC token address on Celo Mainnet
 */
export const USDC_MAINNET_ADDRESS =
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as const;

/**
 * USDT token address on Celo Mainnet
 */
export const USDT_MAINNET_ADDRESS =
  "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e" as const;

/**
 * Get the appropriate fee currency address for the current chain
 * @param chainId - The chain ID
 * @returns The fee currency address or undefined
 */
export const getFeeCurrency = (chainId: number): `0x${string}` | undefined => {
  // Celo Sepolia Testnet (new chain ID)
  if (chainId === 11142220) {
    return CUSD_SEPOLIA_ADDRESS;
  }
  // Celo Mainnet
  if (chainId === 42220) {
    return CUSD_MAINNET_ADDRESS;
  }
  return undefined;
};

/**
 * Check if the current chain supports fee abstraction with cUSD
 * @param chainId - The chain ID
 * @returns boolean indicating if fee abstraction is supported
 */
export const supportsFeeAbstraction = (chainId: number): boolean => {
  return chainId === 11142220 || chainId === 42220;
};

/**
 * Verify that a contract exists at the given address
 * @param address - The contract address to check
 * @returns Promise<boolean> - True if contract code exists
 */
export const verifyContractExists = async (
  address: string,
): Promise<boolean> => {
  if (!window.ethereum) return false;

  try {
    const code = await window.ethereum.request({
      method: "eth_getCode",
      params: [address, "latest"],
    });

    // '0x' means no code at address
    return code !== "0x" && code !== null;
  } catch (error) {
    console.error("[MiniPay] Failed to verify contract:", error);
    return false;
  }
};

/**
 * Check cUSD balance for MiniPay user
 * @param userAddress - The user's wallet address
 * @param chainId - The chain ID
 * @returns Promise<string> - Balance in cUSD (human readable)
 */
export const checkCUSDBalance = async (
  userAddress: string,
  chainId: number,
): Promise<string> => {
  if (!window.ethereum) return "0";

  try {
    const cusdAddress = getFeeCurrency(chainId);
    if (!cusdAddress) return "0";

    // Get balance using eth_call to balanceOf function
    const data =
      "0x70a08231000000000000000000000000" +
      userAddress.slice(2).padStart(64, "0");

    const balance = await window.ethereum.request({
      method: "eth_call",
      params: [
        {
          to: cusdAddress,
          data: data,
        },
        "latest",
      ],
    });

    // Convert hex balance to decimal and format
    const balanceInWei = BigInt(balance as string);
    const balanceInCUSD = Number(balanceInWei) / 1e18;

    return balanceInCUSD.toFixed(2);
  } catch (error) {
    console.error("[MiniPay] Failed to check cUSD balance:", error);
    return "0";
  }
};

/**
 * Send a transaction using MiniPay with fee abstraction
 * Uses eth_sendTransaction directly with feeCurrency parameter
 * @param to - The recipient address
 * @param data - The transaction data
 * @param from - The sender address
 * @param chainId - The chain ID
 * @returns Promise<string> - The transaction hash
 */
export const sendMiniPayTransaction = async (
  to: string,
  data: string,
  from: string,
  chainId: number,
): Promise<string> => {
  if (!isMiniPay()) {
    throw new Error("Not in MiniPay environment");
  }

  const feeCurrency = getFeeCurrency(chainId);

  console.log("[MiniPay] Preparing transaction:", {
    to,
    from,
    data: data.substring(0, 20) + "...",
    chainId,
    feeCurrency,
  });

  try {
    // Build transaction params - MiniPay handles gas estimation internally
    const txParams: any = {
      from,
      to,
      data,
    };

    // Add feeCurrency if on Celo chain (required for fee abstraction)
    if (feeCurrency) {
      txParams.feeCurrency = feeCurrency;
    }

    console.log("[MiniPay] Sending transaction with params:", {
      from: txParams.from,
      to: txParams.to,
      data: txParams.data.substring(0, 20) + "...",
      feeCurrency: txParams.feeCurrency,
    });

    // MiniPay will estimate gas automatically - don't include gas/gasPrice
    // Including them can cause "divide by zero" errors
    const hash = await window.ethereum!.request({
      method: "eth_sendTransaction",
      params: [txParams],
    });

    console.log("[MiniPay] Transaction sent successfully:", hash);
    return hash as string;
  } catch (error: any) {
    console.error("[MiniPay] Transaction failed:", error);

    // Provide more helpful error messages
    let errorMessage = error?.message || error?.toString() || "Unknown error";

    // Parse common MiniPay errors
    if (errorMessage.toLowerCase().includes("divide by zero")) {
      errorMessage =
        "Transaction failed: Gas estimation error. Please ensure you have sufficient cUSD balance in your MiniPay wallet and you're on Celo Sepolia testnet.";
    } else if (errorMessage.toLowerCase().includes("insufficient funds")) {
      errorMessage =
        "Insufficient cUSD balance. Please add testnet cUSD to your MiniPay wallet. Get CELO from https://faucet.celo.org/celo-sepolia/ and swap for cUSD at https://app.mento.org/";
    } else if (errorMessage.toLowerCase().includes("user rejected")) {
      errorMessage = "Transaction cancelled by user";
    } else if (errorMessage.toLowerCase().includes("nonce")) {
      errorMessage =
        "Transaction nonce error. Please try again or refresh the page.";
    }

    throw new Error(errorMessage);
  }
};
