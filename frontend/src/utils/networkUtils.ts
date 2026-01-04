import { SUPPORTED_NETWORKS, DEFAULT_NETWORK, getNetworkById } from '@/config/networks';
import { defineChain } from 'thirdweb';

const NETWORK_STORAGE_KEY = 'zunno_selected_network';

export const getSelectedNetwork = () => {
  if (typeof window === 'undefined') {
    return convertToThirdwebChain(DEFAULT_NETWORK.chain);
  }

  const storedNetworkId = localStorage.getItem(NETWORK_STORAGE_KEY);
  
  if (storedNetworkId) {
    const network = getNetworkById(parseInt(storedNetworkId));
    if (network) {
      return convertToThirdwebChain(network.chain);
    }
  }
  
  return convertToThirdwebChain(DEFAULT_NETWORK.chain);
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

const convertToThirdwebChain = (wagmiChain: any) => {
  return defineChain({
    id: wagmiChain.id,
    name: wagmiChain.name,
    nativeCurrency: wagmiChain.nativeCurrency,
    rpc: wagmiChain.rpcUrls.default.http[0],
    blockExplorers: wagmiChain.blockExplorers ? [{
      name: wagmiChain.blockExplorers.default.name,
      url: wagmiChain.blockExplorers.default.url,
    }] : undefined,
    testnet: wagmiChain.testnet || false,
  });
};
