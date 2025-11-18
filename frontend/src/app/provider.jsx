"use client";

import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { config } from "../lib/wagmi";
import { WagmiProvider } from "wagmi";
import RecoilProvider from "../userstate/RecoilProvider";
import { MiniKitContextProvider } from "../providers/MiniKitProvider";
import { ThirdwebProvider } from "thirdweb/react";
import { SocketConnectionProvider } from "../context/SocketConnectionContext";

const queryClient = new QueryClient();

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RecoilProvider>
        <ThirdwebProvider>
          <WagmiProvider config={config}>
            <SocketConnectionProvider>
              <MiniKitContextProvider>{children}</MiniKitContextProvider>
            </SocketConnectionProvider>
          </WagmiProvider>
        </ThirdwebProvider>
      </RecoilProvider>
    </QueryClientProvider>
  );
}
