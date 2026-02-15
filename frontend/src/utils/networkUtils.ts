import { SUPPORTED_NETWORKS, DEFAULT_NETWORK, getNetworkById } from '@/config/networks';

const NETWORK_STORAGE_KEY = 'zunno_selected_network';

/**
 * Get wagmi chain config for a specific chainId
 */
export const getNetworkForChain = (chainId: number) => {
  const network = getNetworkById(chainId);
  if (network) {
    return network.chain;
  }
  return DEFAULT_NETWORK.chain;
};

export const getSelectedNetwork = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_NETWORK.chain;
  }

  const storedNetworkId = localStorage.getItem(NETWORK_STORAGE_KEY);
  
  if (storedNetworkId) {
    const network = getNetworkById(parseInt(storedNetworkId));
    if (network) {
      return network.chain;
    }
  }
  
  return DEFAULT_NETWORK.chain;
};

export const getSelectedNetworkId = (): number => {
  if (typeof window === 'undefined') {
    return DEFAULT_NETWORK.id;
  }

  const storedNetworkId = localStorage.getItem(NETWORK_STORAGE_KEY);
  
  if (storedNetworkId) {
    return parseInt(storedNetworkId);
  }
  
  return DEFAULT_NETWORK.id;
};

export const setSelectedNetwork = (chainId: number) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(NETWORK_STORAGE_KEY, chainId.toString());
  }
};
