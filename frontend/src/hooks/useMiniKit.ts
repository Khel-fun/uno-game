'use client';

import { useEffect, useState } from 'react';
import { useMiniKit as useOnchainKitMiniKit } from '@coinbase/onchainkit/minikit';

/**
 * Custom hook to use MiniKit functionality in the Zunno app
 * This wraps the OnchainKit MiniKit hook and provides additional functionality
 */
export function useMiniKit() {
  // Get the MiniKit context from OnchainKit
  const miniKit = useOnchainKitMiniKit();
  const [isReady, setIsReady] = useState(false);

  // Initialize MiniKit when the component mounts
  useEffect(() => {
    if (!miniKit.isFrameReady) {
      try {
        miniKit.setFrameReady();
        setIsReady(true);
      } catch (error) {
        console.error('Error initializing MiniKit:', error);
      }
    } else {
      setIsReady(true);
    }
  }, [miniKit]);

  return {
    ...miniKit,
    isReady,
  };
}
