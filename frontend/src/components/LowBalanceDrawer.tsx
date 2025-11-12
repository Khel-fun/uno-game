"use client";

import React from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

interface LowBalanceDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function LowBalanceDrawer({ open, onClose }: LowBalanceDrawerProps) {
  const handleGetFaucet = () => {
    window.open('https://portal.cdp.coinbase.com/products/faucet', '_blank');
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-xl border-none shadow-indigo-500/20">
        <DrawerHeader className="text-center">
          <DrawerTitle className="text-xl font-bold text-white">⚠️ Insufficient Balance</DrawerTitle>
          <DrawerDescription className="text-base text-gray-300 mt-2">
            You don't have enough ETH to pay for transaction gas fees. Please add funds to your wallet to continue.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="gap-4 pb-8">
          <Button 
            onClick={handleGetFaucet} 
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-6 rounded-lg shadow-lg hover:shadow-indigo-500/50 transition-all hover:scale-105"
          >
             Get ETH from Faucet
          </Button>
          <DrawerClose asChild>
            <Button 
              variant="outline" 
              className="w-full border-2 border-indigo-500/50 bg-slate-800/50 hover:bg-slate-700/50 text-white font-semibold py-6 rounded-lg transition-all hover:scale-105" 
              onClick={onClose}
            >
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
