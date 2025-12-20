"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useEffect } from "react";
import { useActiveAccount, ConnectButton } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { client } from "@/utils/thirdWebClient";
import { baseSepolia } from "@/lib/chains";
import { useWalletAddress } from "@/utils/onchainWalletUtils";

const wallet = inAppWallet();

interface WalletConnectionProps {
  onConnect?: (publicKey: string | null) => void;
}

export function WalletConnection({ onConnect }: WalletConnectionProps) {

  // Use Wagmi hooks for Base Account integration
  const { address } = useWalletAddress();
  const { disconnect } = useDisconnect();

  const { connect } = useConnect();
  // Once connected, you can access the active account
  const activeAccount = useActiveAccount();

  // When address changes or subaccount is selected, notify parent component
  useEffect(() => {
    if (onConnect) {
      const activeAddress = address;
      onConnect(activeAddress || null);
    }
  }, [address, onConnect]);

  const wallets = [
    inAppWallet({ auth: { options: ["google", "email", "apple"] } }),
    createWallet("io.metamask"),
    createWallet("com.coinbase.wallet"),
    createWallet("me.rainbow"),
  ];

  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="max-w-xs">
        <ConnectButton 
        client={client} 
        chain={baseSepolia} 
        wallets={wallets}
        />
      </div>
    </div>
  );
}

// https://keys.coinbase.com/connect?sdkName=%40coinbase%2Fwallet-sdk&sdkVersion=4.3.0&origin=http%3A%2F%2Flocalhost%3A3000&coop=null

// https://keys.coinbase.com/sign/eth-request-accounts?sdkName=%40coinbase%2Fwallet-sdk&sdkVersion=4.3.6&origin=https%3A%2F%2Fwww.zunno.xyz&coop=null