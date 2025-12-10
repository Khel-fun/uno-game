/**
 * Wallet storage utilities for managing wallet address in localStorage
 * This ensures consistent user identification across page refreshes
 */

const WALLET_ADDRESS_KEY = 'zunno_wallet_address';
const USER_ID_KEY = 'zunno_user_id';

/**
 * Get the stored wallet address from localStorage
 * @returns The stored wallet address or null
 */
export function getStoredWalletAddress(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem(WALLET_ADDRESS_KEY);
  } catch (error) {
    console.error('Error reading wallet address from localStorage:', error);
    return null;
  }
}

/**
 * Store the wallet address in localStorage
 * @param address The wallet address to store
 */
export function setStoredWalletAddress(address: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(WALLET_ADDRESS_KEY, address);
  } catch (error) {
    console.error('Error storing wallet address in localStorage:', error);
  }
}

/**
 * Clear the stored wallet address from localStorage
 */
export function clearStoredWalletAddress(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(WALLET_ADDRESS_KEY);
  } catch (error) {
    console.error('Error clearing wallet address from localStorage:', error);
  }
}

/**
 * Get the current wallet address, preferring the connected wallet
 * Falls back to stored address if no wallet is connected
 * @param connectedAddress The currently connected wallet address
 * @returns The wallet address to use
 */
export function getCurrentWalletAddress(connectedAddress: string | undefined): string | null {
  // If wallet is connected, use that address and update storage
  if (connectedAddress) {
    setStoredWalletAddress(connectedAddress);
    return connectedAddress;
  }
  
  // Otherwise, try to get from localStorage
  return getStoredWalletAddress();
}

/**
 * Generate a unique user ID based on wallet address
 * This creates a consistent identifier for the user
 * @param walletAddress The wallet address
 * @returns A unique user ID
 */
export function generateUserId(walletAddress: string): string {
  // Use the wallet address as the user ID
  // This ensures the same user always has the same ID
  return `user_${walletAddress.toLowerCase()}`;
}

/**
 * Get or create a user ID for the current session
 * @param walletAddress The wallet address
 * @returns The user ID
 */
export function getUserId(walletAddress: string | null): string | null {
  if (!walletAddress) return null;
  return generateUserId(walletAddress);
}
