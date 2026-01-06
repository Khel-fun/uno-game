"use client";

import { useState, useEffect } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import {
  NetworkConfig,
  SUPPORTED_NETWORKS,
  DEFAULT_NETWORK,
  getNetworkById,
} from "@/config/networks";
import { isMiniPay } from "@/utils/miniPayUtils";

const NETWORK_STORAGE_KEY = "zunno_selected_network";

export function useNetworkSelection() {
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const [selectedNetwork, setSelectedNetwork] =
    useState<NetworkConfig>(DEFAULT_NETWORK);
  const [isLoading, setIsLoading] = useState(false);
  const [isInMiniPay, setIsInMiniPay] = useState(false);

  // Detect MiniPay on mount
  useEffect(() => {
    setIsInMiniPay(isMiniPay());
  }, []);

  useEffect(() => {
    const storedNetworkId = localStorage.getItem(NETWORK_STORAGE_KEY);

    if (storedNetworkId) {
      const network = getNetworkById(parseInt(storedNetworkId));
      if (network) {
        setSelectedNetwork(network);
      }
    } else if (chain) {
      const currentNetwork = getNetworkById(chain.id);
      if (currentNetwork) {
        setSelectedNetwork(currentNetwork);
        localStorage.setItem(NETWORK_STORAGE_KEY, chain.id.toString());
      }
    }
  }, [chain]);

  const switchNetwork = async (network: NetworkConfig) => {
    try {
      setIsLoading(true);

      if (switchChain) {
        await switchChain({ chainId: network.id });
      }

      setSelectedNetwork(network);
      localStorage.setItem(NETWORK_STORAGE_KEY, network.id.toString());
    } catch (error) {
      console.error("Failed to switch network:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedNetworkId = (): number => {
    const storedNetworkId = localStorage.getItem(NETWORK_STORAGE_KEY);
    if (storedNetworkId) {
      return parseInt(storedNetworkId);
    }
    return DEFAULT_NETWORK.id;
  };

  // Filter networks based on MiniPay detection
  const availableNetworks = isInMiniPay
    ? SUPPORTED_NETWORKS.filter((network) => network.name === "celoSepolia")
    : SUPPORTED_NETWORKS;

  return {
    selectedNetwork,
    switchNetwork,
    isLoading,
    supportedNetworks: availableNetworks,
    getSelectedNetworkId,
    currentChainId: chain?.id,
    isInMiniPay,
  };
}
