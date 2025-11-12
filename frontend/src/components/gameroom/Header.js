import React from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {WalletConnection} from "../WalletConnection";
import { useWalletAddress } from "@/utils/onchainWalletUtils";

function Header({ roomCode }) {
    const { address, isConnected } = useWalletAddress();

  return (
    <div className="topInfo">
      <div className="flex items-center justify-between px-4 w-full">
        <div className="flex items-center space-x-3">
          <div className="w-16 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden">
            <Link href="/">
              <img src="/images/logo.png" alt="" />
            </Link>
          </div>
        </div>

        {isConnected && (
          <div className="flex items-center space-x-2">
            <WalletConnection />
          </div>
        )}
      </div>
    </div>
  );
}
const MemoizedHeader = React.memo(Header);
export default MemoizedHeader;
