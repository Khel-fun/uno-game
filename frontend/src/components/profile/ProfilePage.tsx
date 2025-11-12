'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { WalletConnection } from '@/components/WalletConnection';

interface ProfilePageProps {
  userAccount: string | null;
  connectWallet: () => Promise<any>;
  isLoading: boolean;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ userAccount, connectWallet, isLoading }) => {
  const handleConnectWallet = async () => {
    try {
      await connectWallet();
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const [refreshKey, setRefreshKey] = useState(0);

  const handleBalanceAdded = () => {
    // Refresh the claimable balances list when a new balance is added
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-md rounded-xl shadow-lg p-8 text-white">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">User Profile</h1>
          <Link href="/play" className="bg-[#ff9000] hover:bg-[#ff7000] text-white font-bold py-2 px-4 rounded-full transition-colors">
            Back to Game
          </Link>
        </div>
        
        <div className="space-y-6">
          <div className="bg-black/30 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Wallet Address</h2>
            {userAccount ? (
              <div className="flex flex-col gap-2">
                <p className="font-mono break-all bg-black/20 p-3 rounded">{userAccount}</p>
                <p className="text-sm text-gray-300">This is your wallet address used for authentication and transactions.</p>
              </div>
            ) : (
              <div className="bg-black/20 p-4 rounded-lg">
                <p className="mb-4">No wallet connected. Please connect your wallet to view your profile.</p>
                <WalletConnection onConnect={(address) => {
                  if (address) setRefreshKey(prev => prev + 1);
                }} />
              </div>
            )}
          </div>
          
          {!userAccount && (
            <div className="bg-black/30 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Connect Your Wallet</h2>
              <WalletConnection onConnect={(address) => {
                if (address) setRefreshKey(prev => prev + 1);
              }} />
            </div>
          )}
          
          {/* <div className="bg-black/30 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Game Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-purple-500/20 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm">Games Played</p>
              </div>
              <div className="bg-green-500/20 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm">Wins</p>
              </div>
              <div className="bg-blue-500/20 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm">UNO Cards</p>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
