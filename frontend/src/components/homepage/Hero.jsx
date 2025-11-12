'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import StyledButton from "../styled-button";

const Hero = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const router = useRouter();

  // Auto-switch slides every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((current) => (current === 1 ? 0 : 1));
    }, 20000); // 30 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  const slides =  {
      "title": "LEVEL UP NEW",
      "subtitle": "EXPERIENCE",
      "image": "/images/hero-1.png",
      "logo": "/images/logo.png"
    }

  return (
    <section className="relative min-h-screen bg-[#0A0A0A]">
      <div className="relative w-full h-screen">
        <div className="absolute inset-0">
          <Image
            src={slides["image"]}
            alt="Hero background"
            fill
            className="object-cover transition-opacity duration-500"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/80 to-transparent" />
        </div>

        <div className="absolute inset-0 flex flex-col items-start justify-center z-10 px-8 md:px-16 lg:px-24">
          <div className="mb-8">
            <Image
              src={slides["logo"]}
              alt="Zunno Logo"
              width={200}
              height={60}
              className="rounded-full"
            />
            <p className="text-white/80 text-lg">Blockchain's 1st Uno game</p>
          </div>

          {/* <div className="space-y-2">
            <h1 className="text-6xl md:text-7xl text-white font-bold tracking-wider">
              {slides["title"]}
            </h1>
            <h1 className="text-6xl md:text-7xl text-white font-bold tracking-wider">
              {slides["subtitle"]}
            </h1>
          </div> */}

          {/* <div className="flex gap-4 mt-12">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-12 h-12 rounded-full text-xl font-bold transition-all duration-300 ${currentSlide === index
                    ? 'bg-white text-black'
                    : 'bg-black/20 text-white border-2 border-white hover:bg-white/20'
                  }`}
              >
                {index + 1}
              </button>
            ))}
          </div> */}

          <StyledButton onClick={() => router.push("/play")} roundedStyle='rounded-full' className='bg-[#ff9000] text-2xl mt-6'>Start Game</StyledButton>
        </div>

        {/* <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-8 text-2xl text-white/50">
          <span className={currentSlide === 0 ? 'text-white' : ''}>01</span>
          <span className={currentSlide === 1 ? 'text-white' : ''}>02</span>
        </div> */}
      </div>
    </section>
  );
};

export default Hero;
