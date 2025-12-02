import React from 'react';
import { MAX_PLAYERS } from '@/constants/gameConstants';

const GameBackground = ({ turn, currentColor, currentUser, totalPlayers }) => {
  // Determine if it's current user's turn or opponent's turn
  const turnType = turn === currentUser ? "current" : "opponent";

  // Calculate player index: "current" if it's current user's turn, otherwise opponent index (0, 1, 2...)
  let playerIndex = "current";
  if (turn !== currentUser && turn && currentUser) {
    const turnPlayerNum = parseInt(turn.split(' ')[1]);
    const currentPlayerNum = parseInt(currentUser.split(' ')[1]);
    // Calculate relative opponent index (starts from 0)
    let relativeIndex = turnPlayerNum - currentPlayerNum;
    if (relativeIndex < 0) relativeIndex += MAX_PLAYERS; // Wrap around for max players
    playerIndex = relativeIndex - 1; // Adjust to start from 0
  }
  
  // Map color codes to color names
  const colorMap = {
    'R': 'red',
    'G': 'green',
    'B': 'blue',
    'Y': 'yellow'
  };
  
  const colorName = colorMap[currentColor] || 'blue';
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100svh',
      overflow: 'hidden'
    }}>
      {/* Layer 1 - Base background (always visible) */}
      <div 
        className="bg-layer-1"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100svh',
          backgroundImage: "url('/bg_primary.webp')",
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          zIndex: 1
        }} 
      />

      {/* Layer 2 - Secondary static layer (always visible) */}
      <div 
        className="bg-layer-2"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `url('/highlight_${colorName}.svg')`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          zIndex: 2,
          opacity: 0.5
        }} 
      />
      
      {/* Layer 2 - Secondary static layer (always visible) */}
      <div 
        className="bg-layer-3"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: "url('/bg_secondary.webp')",
          backgroundSize: '130%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          zIndex: 3,
          opacity: 0.8
        }} 
      />
      
      {/* Layer 3 - Color-based layer (changes with currentColor) */}
      <div 
        className="bg-layer-4"
        style={{
          position: 'absolute',
          top: "-17vw",
          left: "0",
          width: '100%',
          height: '100%',
          backgroundImage: `url('/assets/play_bg/${colorName}_layer.svg')`,
          backgroundSize: '116%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          zIndex: 4,
          transition: 'opacity 0.5s ease-in-out',
          opacity: 0.6
        }} 
      />
      
      {/* Layer 4 - Turn-based layer (changes with turn and color) */}
      <div 
        className="bg-layer-5"
        style={{
          position: 'absolute',
          top: "-3vw",
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: playerIndex === "current" 
            ? `url('/assets/play_bg/current.svg')` 
            : `url('/assets/play_bg/opponent.svg')`,
          backgroundSize: '142%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          zIndex: 5,
          transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out',
          opacity: 0.9,
          transform: playerIndex === "current" 
            ? 'rotate(0deg)' 
            : totalPlayers === 2 && (playerIndex === 0 || playerIndex === 1)
              ? 'rotate(0deg)'
              : playerIndex === 0 
                ? 'rotate(300deg)' 
                : playerIndex === 1 
                  ? 'rotate(60deg)' 
                  : 'rotate(0deg)'
        }} 
      />
    </div>
  );
};

export default GameBackground;
