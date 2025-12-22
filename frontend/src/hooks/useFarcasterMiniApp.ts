"use client";

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export const useFarcasterMiniApp = () => {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isFarcasterContext, setIsFarcasterContext] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initSDK = async () => {
      try {
        // Check if we're in a Farcaster context
        const context = sdk.context;
        setIsFarcasterContext(!!context);
        setIsSDKLoaded(true);
      } catch (err) {
        console.error('Failed to initialize Farcaster SDK:', err);
        setIsSDKLoaded(true);
        setIsFarcasterContext(false);
      }
    };

    initSDK();
  }, []);

  const addMiniApp = async () => {
    if (!isSDKLoaded) {
      setError('SDK not loaded yet');
      return false;
    }

    if (!isFarcasterContext) {
      setError('Not in a Farcaster context');
      return false;
    }

    setIsAdding(true);
    setError(null);

    try {
      await sdk.actions.addMiniApp();
      setIsAdding(false);
      return true;
    } catch (err) {
      console.error('Failed to add miniapp:', err);
      setError(err instanceof Error ? err.message : 'Failed to add miniapp');
      setIsAdding(false);
      return false;
    }
  };

  return {
    isSDKLoaded,
    isFarcasterContext,
    isAdding,
    error,
    addMiniApp,
  };
};
