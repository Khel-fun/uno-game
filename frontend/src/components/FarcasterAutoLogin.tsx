"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useLoginToMiniApp } from "@privy-io/react-auth/farcaster";
import miniappSdk from "@farcaster/miniapp-sdk";

export function FarcasterAutoLogin() {
  const { ready, authenticated } = usePrivy();
  const { initLoginToMiniApp, loginToMiniApp } = useLoginToMiniApp();

  useEffect(() => {
    // Only attempt auto-login if:
    // 1. Privy is ready
    // 2. User is not already authenticated
    // 3. We're running in a Farcaster context
    if (ready && !authenticated) {
      const login = async () => {
        try {
          // Check if we're in a Farcaster Mini App context
          if (typeof window === "undefined" || !miniappSdk?.context) {
            return;
          }

          console.log("[Farcaster] Attempting auto-login...");

          // Initialize a new login attempt to get a nonce for the Farcaster wallet to sign
          const { nonce } = await initLoginToMiniApp();

          // Request a signature from Farcaster
          const result = await miniappSdk.actions.signIn({ nonce });

          // Send the received signature from Farcaster to Privy for authentication
          await loginToMiniApp({
            message: result.message,
            signature: result.signature,
          });

          console.log("[Farcaster] Auto-login successful");
        } catch (error) {
          console.error("[Farcaster] Auto-login failed:", error);
          // Fail silently - user can still use other login methods
        }
      };

      login();
    }
  }, [ready, authenticated, initLoginToMiniApp, loginToMiniApp]);

  // This component doesn't render anything
  return null;
}
