"use client";

import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { config } from "../lib/wagmi";
import { WagmiProvider } from "wagmi";
import RecoilProvider from "../userstate/RecoilProvider";
import { MiniKitContextProvider } from "../providers/MiniKitProvider";
import { ThirdwebProvider } from "thirdweb/react";
import { SocketConnectionProvider } from "../context/SocketConnectionContext";

// Dynamically import ZKProvider to avoid SSR issues with WASM
const ZKProvider = dynamic(
  () => import("../lib/zk/ZKContext").then((mod) => mod.ZKProvider),
  { ssr: false }
);

const queryClient = new QueryClient();

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RecoilProvider>
        <ThirdwebProvider>
          <WagmiProvider config={config}>
            <SocketConnectionProvider>
              <ZKProvider autoLoad={true}>
                <MiniKitContextProvider>{children}</MiniKitContextProvider>
              </ZKProvider>
            </SocketConnectionProvider>
          </WagmiProvider>
        </ThirdwebProvider>
      </RecoilProvider>
    </QueryClientProvider>
  );
}
