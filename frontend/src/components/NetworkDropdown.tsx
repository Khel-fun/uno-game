'use client';

import { useState, useRef, useEffect } from 'react';
import { useNetworkSelection } from '@/hooks/useNetworkSelection';
import { NetworkConfig } from '@/config/networks';

export default function NetworkDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { selectedNetwork, switchNetwork, isLoading, supportedNetworks } = useNetworkSelection();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNetworkChange = async (network: NetworkConfig) => {
    try {
      await switchNetwork(network);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch network:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-900 to-slate-800 border border-indigo-500/30 rounded-lg hover:border-indigo-500/50 transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <img src={selectedNetwork.icon} alt={selectedNetwork.displayName} className="w-6 h-6" />
        <span className="text-white font-medium text-sm lg:text-base">
          {selectedNetwork.displayName}
        </span>
        <svg
          className={`w-4 h-4 text-white transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-gradient-to-br from-slate-900 to-slate-800 border border-indigo-500/30 rounded-lg shadow-2xl overflow-hidden z-50">
          <div className="py-1">
            {supportedNetworks.map((network) => (
              <button
                key={network.id}
                onClick={() => handleNetworkChange(network)}
                disabled={isLoading}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 ${
                  selectedNetwork.id === network.id
                    ? 'bg-indigo-500/20 border-l-4 border-indigo-500'
                    : 'hover:bg-slate-700/50 border-l-4 border-transparent'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <img src={network.icon} alt={network.displayName} className="w-8 h-8" />
                <div className="flex-1">
                  <div className="text-white font-medium text-sm">{network.displayName}</div>
                  {network.chain.testnet && (
                    <div className="text-xs text-gray-400">Testnet</div>
                  )}
                </div>
                {selectedNetwork.id === network.id && (
                  <svg
                    className="w-5 h-5 text-indigo-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
