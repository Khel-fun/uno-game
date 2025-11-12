"use client";

import {SoundProvider} from "@/context/SoundProvider";
import Room from "@/components/gameroom/Room"

const GameWithSoundProvider = () => {
  return (
    <SoundProvider>
      <Room />
    </SoundProvider>
  );
};

export default GameWithSoundProvider;