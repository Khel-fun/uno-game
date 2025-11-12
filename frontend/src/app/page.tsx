'use client';

import { useEffect } from 'react';
import Hero from "@/components/homepage/Hero"
import Navbar from "@/components/homepage/Navbar"
import About from "@/components/homepage/About"
import Footer from "@/components/homepage/Footer"
import Feature from "@/components/homepage/Feature"
import Partner from "@/components/homepage/Partner"
import Procedure from "@/components/homepage/Procedure"
import { useMiniKit } from "@/hooks/useMiniKit";
import BottomNavigation from "@/components/BottomNavigation";


export default function Home() {
  const { isFrameReady, setFrameReady } = useMiniKit();

  // Initialize MiniKit when the component mounts
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  return (
    <main className="bg-black overflow-hidden">
      <div className="">
        <Navbar />
        <Hero />
        <div className="relative">
          <About />
          <Feature />
          {/* <Partner /> */}
          <Procedure />
        </div>
        <div className="relative">
          <Footer />
        </div>
      </div>
      {/* <BottomNavigation /> */}
    </main>
  )
}