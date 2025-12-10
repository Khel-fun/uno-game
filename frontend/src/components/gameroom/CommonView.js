import React, { useState } from "react";
import StyledButton from "../styled-button";

const CommonView = ({
  playedCardsPile,
  onCardDrawnHandler,
  isDrawDisabled,
  onUnoClicked,
  isUnoDisabled,
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  
  const handleDrawCard = () => {
    if (isDrawing) return; // Prevent multiple clicks
    
    setIsDrawing(true);
    onCardDrawnHandler();
    
    // Re-enable the button after a short delay
    setTimeout(() => {
      setIsDrawing(false);
    }, 500);
  };
  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Hide the buttons as they're now handled in the parent component */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "100vh" }}>
        {/* <StyledButton
          className='bg-green-500'
          disabled={isDrawDisabled}
          onClick={onCardDrawnHandler}
          style={isDrawDisabled ? {pointerEvents: "none"} : null}
        > */}
        <button
          className="draw-deck"
          style={{
            left: "1rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            pointerEvents: (isDrawDisabled || isDrawing) ? "none" : "auto",
            filter: (isDrawDisabled || isDrawing) ? "grayscale(1)" : "none",
            width: "5rem",
            marginTop: "10rem",
            position: "absolute",
            left: "50%",
            transform: "translate(-50%,56px)",
            zIndex: "10"
          }}
          role="button"
          disabled={isDrawDisabled || isDrawing}
          onClick={handleDrawCard}
        >
          <img src="/images/draw.png" alt="draw" />
        </button>
      {playedCardsPile && playedCardsPile.length > 0 && (
        <div style={{
          position: "absolute",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "fit-content",
          margin: "0 auto",
          left: "50%",
          transform: "translateX(-50%)"
        }}>
          <img
            style={{
              pointerEvents: "none",
              width: "5.5rem",
              height: "8rem",
              borderRadius: "0.5rem",
              boxShadow: "0 0 15px rgba(14, 165, 233, 0.5)"
            }}
            alt={`cards-front ${playedCardsPile[playedCardsPile.length - 1]}`}
            src={`/assets/cards-front/${playedCardsPile[playedCardsPile.length - 1]}.webp`}
          />
        </div>
      )}
        {/* DRAW CARD */}
        {/* </StyledButton> */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            position: "absolute",
            bottom: "-56px",
            left: "50%",
            transform: "translateX(-50%)"
          }}
        >
          <button
            onClick={onUnoClicked}
            disabled={isUnoDisabled}
            style={{
              color: "white",
              fontWeight: "bold",
              fontSize: "1rem",
              width: "10rem",
              filter: isUnoDisabled ? "grayscale(1)" : "none",
              marginTop: "10rem"
            }}
          >
            <img src="/images/zunno-button.png" alt="uno" />
          </button>
        </div>
      </div>

      {/* Current card display with glow effect */}
    </div>
  );
};

export default CommonView;
