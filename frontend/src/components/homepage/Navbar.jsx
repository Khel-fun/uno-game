'use client';

import { motion } from 'framer-motion';

import styles from '../styles';
import { navVariants } from '@/utils/motion';
import StyledButton from "../styled-button";
import { useRouter } from 'next/navigation';

const Navbar = () => {

  const router = useRouter()

  return (
    <motion.nav
      // variants={navVariants}
      // initial="hidden"
      // whileInView="show"
      className={`${styles.xPaddings} py-8 fixed top-0 left-0 right-0 z-50 w-full bg-primary-black backdrop-blur-sm`}
      data-testid="navbar"
    >
      <div className="absolute w-[100%] inset-0" />
      <div
        className={`w-full 2xl:max-w-[1280px] mx-auto flex justify-between items-center gap-8`}
      >
        <h2 className="font-extrabold text-[24px] leading-[30.24px] text-white">
           Zunno
        </h2>
        <div className="flex gap-4">
          {/* <StyledButton onClick={() => router.push("/profile")} roundedStyle='rounded-full' className='bg-[#8a2be2] text-md lg:text-2xl'>Profile</StyledButton> */}
          <StyledButton onClick={() => router.push("/play")} roundedStyle='rounded-full' className='bg-[#ff9000] text-md lg:text-2xl hidden sm:block'>Start Game</StyledButton>
        </div>
      </div>
    </motion.nav>
  )
};

export default Navbar;
