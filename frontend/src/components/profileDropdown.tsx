"use client";

import { useState, useRef, useEffect } from "react";
import { useDisconnect, useActiveWallet } from "thirdweb/react";
import { useToast } from "@/components/ui/use-toast";

interface ProfileDropdownProps {
  address: string;
}

export default function ProfileDropdown({ address }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { disconnect } = useDisconnect();
  const wallet = useActiveWallet();
  const { toast } = useToast();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleDisconnect = async () => {
    try {
      if(!wallet) return;
      disconnect(wallet);
      toast({
        title: "Wallet Disconnected",
        variant: "success",
        description: "Successfully disconnected wallet",
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect wallet. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-lg overflow-hidden hover:ring-2 hover:ring-white/20 transition-all duration-200"
      >
        <img 
          src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${address}`} 
          alt="Profile"
          className="w-full h-full object-cover"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-64 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl shadow-xl z-50">
          {/* User Info Section */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <img 
                src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${address}`} 
                alt="Profile"
                className="w-12 h-12 rounded-lg"
              />
              <div>
                <p className="text-white font-medium">Wallet Connected</p>
                <p className="text-gray-400 text-sm font-mono">{formatAddress(address)}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center space-x-3 px-3 py-2 text-left text-red-400 hover:bg-red-500/10 rounded-lg transition-colors duration-200"
            >
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="text-red-400"
              >
                <path 
                  d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <polyline 
                  points="16,17 21,12 16,7" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <line 
                  x1="21" 
                  y1="12" 
                  x2="9" 
                  y2="12" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              <span>Disconnect Wallet</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
