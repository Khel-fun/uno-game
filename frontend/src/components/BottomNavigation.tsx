'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useWalletAddress } from '@/utils/onchainWalletUtils';

export default function BottomNavigation() {
  const pathname = usePathname();
  const { isConnected } = useWalletAddress();

  // Don't show navigation if wallet is not connected
  if (!isConnected) {
    return null;
  }

  const navItems = [
    {
      href: '/',
      label: 'Home',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      href: '/play',
      label: 'Games',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <path d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 10C16 11.1046 15.1046 12 14 12C12.8954 12 12 11.1046 12 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 10C8 11.1046 8.89543 12 10 12C11.1046 12 12 11.1046 12 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      href: '/profile',
      label: 'Profile',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 overflow-hidden">
      {/* Glossy background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f0c29] to-[#302b63] opacity-95 backdrop-blur-md border-t border-white/10"></div>
      
      {/* Glossy shine overlay */}
      {/* <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-transparent to-white/10 pointer-events-none"></div> */}
      
      <div className="relative flex items-center justify-around py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-all duration-300 ${isActive 
                ? 'transform scale-110' 
                : 'hover:scale-105'}`}
            >
              <div className={`w-7 h-7 mb-1 relative ${isActive ? '' : 'opacity-80'}`}>
                {/* Icon container with glossy effect for active items */}
                <div className={`absolute inset-0 rounded-full ${isActive ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/30' : ''}`}></div>
                
                {/* Icon with glow effect when active */}
                <div className={`relative z-10 p-1 ${isActive 
                  ? 'text-white drop-shadow-[0_0_8px_rgba(59,130,246,0.7)]' 
                  : 'text-gray-300'}`}>
                  {item.icon}
                </div>
                
                {/* Shine effect on active icons */}
                {isActive && <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-t-full"></div>}
              </div>
              
              <span className={`text-xs font-medium transition-all ${isActive 
                ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' 
                : 'text-gray-300'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
