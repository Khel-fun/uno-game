'use client';

import Image from 'next/image';

const Procedure = () => {
  const steps = [
    {
      image: '/connect-wallet.png',
      title: 'Connect Wallet',
      isButton: true
    },
    {
      image: '/join-room.png',
      title: 'Join Room',
      isButton: true
    },
    {
      image: '/waiting-room.png',
      title: 'Wait for Player 2 to Join',
      isButton: true
    },
    {
      image: '/game-start.png',
      title: 'Game Starts!',
      isButton: true
    }
  ];

  return (
    <section className="py-20 bg-[#0A0A0A] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h3 className="text-[#FDB813] text-xl mb-2">how to join and play game</h3>
          <h2 className="text-white text-6xl font-bold">LET'S START</h2>
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="grid grid-cols-2 gap-x-24 gap-y-32 relative z-10">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`relative ${
                  index % 2 === 0 ? 'transform -translate-y-8' : 'transform translate-y-8'
                }`}
              >
                <div className="relative w-72 h-72 mx-auto border-2 border-[#00D1FF]/30 rounded-lg overflow-hidden group">
                  <Image
                    src={step.image}
                    alt={step.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>

                {step.isButton && (
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                    <div className="bg-[#00D1FF] text-black px-6 py-2 rounded-md font-medium shadow-[0_0_20px_rgba(0,209,255,0.5)] whitespace-nowrap">
                      {step.title}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Procedure;
