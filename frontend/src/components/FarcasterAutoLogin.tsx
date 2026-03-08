"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useLoginToMiniApp } from "@privy-io/react-auth/farcaster";
import miniappSdk from "@farcaster/miniapp-sdk";

export function FarcasterAutoLogin() {
  const { ready, authenticated } = usePrivy();
  const { initLoginToMiniApp, loginToMiniApp } = useLoginToMiniApp();

  useEffect(() => {
    if (ready && !authenticated) {
      const login = async () => {
        try {
          // Check if we're in a Farcaster Mini App context
          if (typeof window === "undefined" || !miniappSdk?.context) {
            return;
          }

          console.log("[Farcaster] Attempting auto-login...");

          const { nonce } = await initLoginToMiniApp();
          const result = await miniappSdk.actions.signIn({ nonce });

          await loginToMiniApp({
            message: result.message,
            signature: result.signature,
          });

          console.log("[Farcaster] Auto-login successful");
        } catch (error) {
          console.error("[Farcaster] Auto-login failed:", error);
        }
      };

      login();
    }
  }, [ready, authenticated, initLoginToMiniApp, loginToMiniApp]);

  return null;
}
