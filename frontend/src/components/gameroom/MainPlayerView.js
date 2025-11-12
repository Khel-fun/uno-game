import React from "react";
import StyledButton from "../styled-button";

const MainPlayerView = ({
  turn,
  playerDeck,
  onCardPlayedHandler,
  mainPlayer,
  isSkipButtonDisabled,
  onSkipButtonHandler,
}) => {
  return (
    <>
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        padding: "0.5rem",
        minHeight: "7rem",
        position: "relative"
      }}>
        {playerDeck.map((item, i) => {
          // Calculate position for fan effect
          const totalCards = playerDeck.length;
          const fanAngle = Math.min(40, totalCards * 5); // Max 40 degrees total fan
          const cardAngle = (fanAngle / (totalCards - 1)) * (i - (totalCards - 1) / 2);
          const isPlayable = turn === mainPlayer;
          
          return (
            <div 
              key={item + i}
              style={{
                position: "relative",
                margin: "0 -15px",
                transform: `rotate(${cardAngle}deg)`,
                transformOrigin: "bottom center",
                transition: "transform 0.2s ease-in-out",
                zIndex: i,
                ':hover': {
                  transform: isPlayable ? `rotate(${cardAngle}deg) translateY(-10px)` : `rotate(${cardAngle}deg)`,
                  zIndex: 100 + i
                },
                zoom: turn != mainPlayer ? "0.85":"1.04",
                filter: turn != mainPlayer ? "brightness(0.75)": ""
              }}
            >
              <img
                style={{
                  pointerEvents: turn !== mainPlayer ? "none" : "auto",
                  width: "3.5rem",
                  height: "5.5rem",
                  borderRadius: "0.5rem",
                  // boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  cursor: turn === mainPlayer ? "pointer" : "default",
                  border: turn === mainPlayer ? "2px solid rgba(14, 165, 233, 0.3)" : "none"
                }}
                alt={`cards-front ${item}`}
                className={turn === mainPlayer ? "glow" : ""}
                onClick={() => turn === mainPlayer ? onCardPlayedHandler(item) : null}
                src={`../assets/cards-front/${item}.webp`}
              />
            </div>
          );
        })}
      </div>
      
      {/* Hide the skip button as it's now handled in the parent */}
    </>
  );
};

export default MainPlayerView;
