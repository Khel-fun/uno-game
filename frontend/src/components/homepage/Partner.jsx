'use client';

import Image from 'next/image';

const Partner = () => {
  return (
    <section className="py-20 bg-[#0A0A0A] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at center, #ffffff 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
          opacity: 0.1
        }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="mb-16">
          <h3 className="text-[#FDB813] text-2xl mb-2 relative inline-block">
            Our Partner
            <div className="absolute -left-24 top-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent to-[#FDB813]" />
          </h3>
        </div>

        <div className="max-w-2xl mx-auto text-center">
          <div className="relative w-96 h-96 mx-auto mb-8">
            <Image
              src="/diamante_logo.png"
              alt="Diamante Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          
          <h2 className="text-6xl font-bold text-white mb-6" style={{
            textShadow: '0 0 20px rgba(255, 255, 255, 0.5)'
          }}>
            DIAMANTE
          </h2>
          
          <p className="text-white/80 text-lg max-w-xl mx-auto">
            Partnering with Diamante to bring you the next generation of blockchain gaming experiences.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Partner;
