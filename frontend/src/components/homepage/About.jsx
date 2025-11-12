'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { fadeIn, staggerContainer } from '@/utils/motion';

const About = () => {
  const stats = [
    { number: '30k', label: 'Active Users' },
    { number: '30k', label: 'Active Users' },
    { number: '30k', label: 'Active Users' },
    { number: '30k', label: 'Active Users' },
  ];

  return (
    <section className="py-20 bg-[#0A0A0A] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: false, amount: 0.25 }}
            className="relative"
          >
            <motion.h2
              variants={fadeIn('right', 'tween', 0.2, 1)}
              className="text-[120px] md:text-[180px] font-bold text-white/5 leading-none select-none"
            >
              2025
            </motion.h2>
            <motion.div
              variants={fadeIn('up', 'tween', 0.3, 1)}
              className="relative w-full h-[400px] mt-8 transform hover:scale-105 transition-transform duration-500"
            >
              <Image
                src="/uno-cards.png"
                alt="UNO Cards"
                fill
                className="object-contain drop-shadow-[0_0_30px_rgba(255,144,0,0.3)]"
                priority
              />
            </motion.div>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: false, amount: 0.25 }}
            className="text-white lg:pl-8"
          >
            <motion.h3
              variants={fadeIn('left', 'tween', 0.2, 1)}
              className="text-[#FDB813] text-2xl mb-4 font-semibold tracking-wide"
            >
              LEADING GAMING HUB
            </motion.h3>
            <motion.h2
              variants={fadeIn('left', 'tween', 0.3, 1)}
              className="text-4xl md:text-5xl font-bold mb-6"
            >
              About Us
            </motion.h2>
            <motion.p
              variants={fadeIn('left', 'tween', 0.4, 1)}
              className="text-lg text-gray-300 mb-12 leading-relaxed"
            >
              Zunno is a cutting-edge, multiplayer digital adaptation of the classic UNO game, now enhanced with bloackchain technology to ensure privacy, fairness, and security in every game. Whether you're a casual player or a competitive strategist, it offers a revolutionary gaming experience that combines the fun of UNO with the power of blockchain technology
            </motion.p>

            {/* <motion.div
              variants={fadeIn('up', 'tween', 0.5, 1)}
              className="grid grid-cols-2 gap-6"
            >
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="border border-[#FDB813]/20 rounded-lg p-6 backdrop-blur-sm bg-white/5 hover:bg-white/10 transition-colors duration-300"
                >
                  <h3 className="text-4xl font-bold text-white mb-2">{stat.number}</h3>
                  <p className="text-gray-400">{stat.label}</p>
                </div>
              ))}
            </motion.div>*/}
          </motion.div> 
        </div>
      </div>
    </section>
  );
};

export default About;
