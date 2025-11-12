'use client';

import ProfilePage from '@/components/profile/ProfilePage';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { userAccountState } from '@/userstate/userState';
import BottomNavigation from '@/components/BottomNavigation';

export default function Profile() {
  const [userAccount, setUserAccount] = useRecoilState(userAccountState);
  const [isLoading, setIsLoading] = useState(false);

  // This function is kept for compatibility with ProfilePage component
  async function connectWallet() {
    try {
      setIsLoading(true);
      // This is just a placeholder for the ProfilePage component
      return null;
    } catch (error) {
      console.error(`Error: ${error}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // Check if user account exists in localStorage
    const storedPublicKey = localStorage.getItem('publicKey');
    if (storedPublicKey && !userAccount) {
      setUserAccount(storedPublicKey);
    }
  }, [userAccount, setUserAccount]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white">
      <div className="container mx-auto py-6 px-4 pb-24">
        <ProfilePage userAccount={userAccount} connectWallet={connectWallet} isLoading={isLoading} />
      </div>
      {/* <BottomNavigation /> */}
    </main>
  );
}
