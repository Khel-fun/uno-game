'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

const Feature = () => {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const features = [
    {
      title: "User-Friendly UI",
      description: "Enjoy the classic fun of UNO with a modern twist. Our intuitive interface is designed for all players — whether you're a casual gamer or a crypto enthusiast, jumping into a game has never been easier.",
      image: "/homePage/user-ui.jpg"
    },
    {
      title: "Gaming Experience",
      description: "Multiplayer Matchmaking - Play with friends or join global online matches.",
      image: "/homePage/gaming.jpg"
    },
    {
      title: "Powered by Blockchain",
      description: "Experience true ownership, transparency, and fairness in every game.",
      image: "/homePage/Decentralise_gaming.jpeg"
    }
  ];

  const nextFeature = useCallback(() => {
    setCurrentFeature((prev) => (prev === features.length - 1 ? 0 : prev + 1));
  }, [features.length]);

  const prevFeature = useCallback(() => {
    setCurrentFeature((prev) => (prev === 0 ? features.length - 1 : prev - 1));
  }, [features.length]);

  const goToFeature = (index) => {
    setCurrentFeature(index);
    // Pause autoplay temporarily when manually navigating
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 5000);
  };

  // Auto-advance carousel
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      nextFeature();
    }, 4000);
    
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextFeature]);

  return (
    <section className="py-20 bg-[#0A0A0A]">
      <div className="container mx-auto px-4">
        <div className="mb-12">
          <h3 className="text-[#FDB813] text-xl mb-2">Features</h3>
          <h2 className="text-white text-4xl font-bold">What we bring to the table</h2>
        </div>

        <div className="relative overflow-hidden">
          {/* Main carousel */}
          <div className="relative h-[500px] md:h-[400px] w-full">
            {features.map((feature, index) => (
              <div 
                key={index}
                className={`absolute inset-0 transition-all duration-700 ease-in-out ${getSlidePosition(index, currentFeature, features.length)}`}
              >
                <div className="relative h-full w-full rounded-2xl overflow-hidden">
                  <Image
                    src={feature.image}
                    alt={feature.title}
                    fill
                    className="object-cover"
                    priority={index === currentFeature}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent">
                    <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                      <h3 className="text-2xl md:text-3xl font-semibold mb-3">{feature.title}</h3>
                      <p className="text-base md:text-lg opacity-90">{feature.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation buttons */}
          <button
            onClick={() => {
              prevFeature();
              setIsAutoPlaying(false);
              setTimeout(() => setIsAutoPlaying(true), 5000);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all z-20"
            aria-label="Previous feature"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="white"
              className="w-5 h-5 md:w-6 md:h-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => {
              nextFeature();
              setIsAutoPlaying(false);
              setTimeout(() => setIsAutoPlaying(true), 5000);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all z-20"
            aria-label="Next feature"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="white"
              className="w-5 h-5 md:w-6 md:h-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Indicators */}
          <div className="flex justify-center mt-6 gap-3">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => goToFeature(index)}
                className={`w-3 h-3 rounded-full transition-all ${index === currentFeature ? 'bg-[#FDB813] w-8' : 'bg-white/30 hover:bg-white/50'}`}
                aria-label={`Go to feature ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// Helper function to determine slide position
function getSlidePosition(index, currentIndex, totalSlides) {
  // Current slide is visible
  if (index === currentIndex) {
    return 'translate-x-0 opacity-100 z-10';
  }
  
  // Next slide (to the right)
  if (index === (currentIndex + 1) % totalSlides) {
    return 'translate-x-full opacity-0';
  }
  
  // Previous slide (to the left)
  if (index === (currentIndex - 1 + totalSlides) % totalSlides) {
    return '-translate-x-full opacity-0';
  }
  
  // All other slides (hidden)
  return 'translate-x-full opacity-0';
}

export default Feature;
