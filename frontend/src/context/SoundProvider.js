import React from "react";
import useSound from "use-sound";
import unoSound from "../assets/sounds/uno-sound.mp3";
import shufflingSound from "../assets/sounds/shuffling-cards-1.mp3";
import skipCardSound from "../assets/sounds/skip-sound.mp3";
import draw2CardSound from "../assets/sounds/draw2-sound.mp3";
import wildCardSound from "../assets/sounds/wild-sound.mp3";
import draw4CardSound from "../assets/sounds/draw4-sound.mp3";
import gameOverSound from "../assets/sounds/game-over-sound.mp3";
import cardPlayedSound from "../assets/sounds/card-played-sound.mp3";

const SoundProviderContext = React.createContext();
SoundProviderContext.displayName = "SoundProviderContext";

//const {isSoundMuted, toggle,playUnoSound,playShufflingSound,etc} = useSoundProvider();
function SoundProvider({children, initiallyMuted = false}) {
  const [isSoundMuted, setSoundMuted] = React.useState(initiallyMuted);

  //wrap this in useCallback so that it doesn't re-render on every render
  const toggleMute = React.useCallback(() => setSoundMuted((isSoundMuted) => !isSoundMuted), []);
  const volume = isSoundMuted ? 0 : 1;

  const [playUnoSound] = useSound(unoSound, {volume});
  const [playCardPlayedSound] = useSound(cardPlayedSound, {volume});
  const [playShufflingSound] = useSound(shufflingSound, {volume});
  const [playSkipCardSound] = useSound(skipCardSound, {volume});
  const [playDraw2CardSound] = useSound(draw2CardSound, {volume});
  const [playWildCardSound] = useSound(wildCardSound, {volume});
  const [playDraw4CardSound] = useSound(draw4CardSound, {volume});
  const [playGameOverSound] = useSound(gameOverSound, {volume});

  //we have memoized all the values so that it doesn't re-render on every render
  const value = React.useMemo(
    () => ({
      isSoundMuted,
      toggleMute,
      playUnoSound,
      playShufflingSound,
      playSkipCardSound,
      playDraw2CardSound,
      playWildCardSound,
      playDraw4CardSound,
      playGameOverSound,
      playCardPlayedSound,
    }),
    [
      isSoundMuted,
      toggleMute,
      playUnoSound,
      playShufflingSound,
      playSkipCardSound,
      playDraw2CardSound,
      playWildCardSound,
      playDraw4CardSound,
      playGameOverSound,
      playCardPlayedSound,
    ]
  );

  return <SoundProviderContext.Provider value={value}>{children}</SoundProviderContext.Provider>;
}

function useSoundProvider() {
  const context = React.useContext(SoundProviderContext);
  if (context === undefined) {
    throw new Error(`useSoundProvider must be used within a SoundProvider`);
  }
  return context;
}

export {SoundProvider, useSoundProvider};
