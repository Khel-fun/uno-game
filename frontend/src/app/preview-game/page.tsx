"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PACK_OF_CARDS } from "@/utils/packOfCards";

const PreviewGame = () => {
  const [playerCount, setPlayerCount] = useState(3);
  const [currentTurn, setCurrentTurn] = useState("Player 1");
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(7);
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const router = useRouter();

  // Generate random cards for players
  const getRandomCards = (count: number) => {
    const shuffled = [...PACK_OF_CARDS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  const [playerDecks, setPlayerDecks] = useState<{[key: string]: string[]}>({});
  const [playedCard, setPlayedCard] = useState("5R");

  // Initialize player decks
  useEffect(() => {
    const decks: {[key: string]: string[]} = {};
    for (let i = 1; i <= playerCount; i++) {
      decks[`Player ${i}`] = getRandomCards(i === 1 ? 7 : 5);
    }
    setPlayerDecks(decks);
  }, [playerCount]);

  // Pulse animation on turn change
  useEffect(() => {
    setPulseAnimation(true);
    const timer = setTimeout(() => setPulseAnimation(false), 500);
    return () => clearTimeout(timer);
  }, [currentTurn]);

  // Generate mock players
  const players = [];
  for (let i = 1; i <= playerCount; i++) {
    const playerName = `Player ${i}`;
    players.push({
      name: playerName,
      displayName: i === 1 ? "You" : playerName,
      deck: playerDecks[playerName] || [],
      isCurrentUser: i === 1
    });
  }

  const currentPlayer = players[0];
  const opponents = players.slice(1);

  // Determine current color from played card
  const currentColor = playedCard.slice(-1); // Get last character (R, G, B, Y)
  const colorMap: {[key: string]: string} = {
    'R': 'red',
    'G': 'green',
    'B': 'blue',
    'Y': 'yellow'
  };
  const colorName = colorMap[currentColor] || 'blue';
  const turnType = currentTurn === "Player 1" ? "current" : "opponent";

  return (
    <div
      className="game-container"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Multi-layered Background - matching GameBackground component */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        zIndex: 0
      }}>
        {/* Layer 1 - Base background */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: "url('/bg_primary.webp')",
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            zIndex: 1
          }} 
        />

        {/* Layer 2 - Color highlight */}
        <div 
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
        
        {/* Layer 3 - Table image */}
        <div 
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
        
        {/* Layer 4 - Color-based layer */}
        <div 
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
        
        {/* Layer 5 - Turn-based layer */}
        <div 
          style={{
            position: 'absolute',
            top: "-3vw",
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: `url('/assets/play_bg/${turnType}.svg')`,
            backgroundSize: '142%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            zIndex: 5,
            transition: 'opacity 0.5s ease-in-out',
            opacity: 0.9
          }} 
        />
      </div>
      {/* Controls Bar */}
      <div style={{
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "1rem",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: "0.75rem 1.5rem",
        borderRadius: "1rem",
        zIndex: 1000,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
      }}>
        <button
          onClick={() => router.push('/play')}
          style={{
            backgroundColor: "#C89A4A",
            color: "white",
            fontSize: "0.75rem",
            fontWeight: "bold",
            padding: "0.4rem 0.8rem",
            borderRadius: "0.5rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <label style={{ color: "white", fontWeight: "bold", fontSize: "0.875rem" }}>
          Players:
        </label>
        {[2, 3, 4, 5, 6].map(count => (
          <button
            key={count}
            onClick={() => {
              setPlayerCount(count);
              setCurrentTurn("Player 1");
            }}
            style={{
              backgroundColor: playerCount === count ? "#C89A4A" : "#555",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: "bold",
              padding: "0.4rem 0.8rem",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            {count}
          </button>
        ))}
        <label style={{ color: "white", fontWeight: "bold", fontSize: "0.875rem", marginLeft: "0.5rem" }}>
          Turn:
        </label>
        {players.map((p) => (
          <button
            key={p.name}
            onClick={() => setCurrentTurn(p.name)}
            style={{
              backgroundColor: currentTurn === p.name ? "#0451D6" : "#555",
              color: "white",
              fontSize: "0.75rem",
              fontWeight: "bold",
              padding: "0.4rem 0.6rem",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            P{p.name.split(' ')[1]}
          </button>
        ))}
      </div>

      {/* Game Header - Back Button */}
      <div
        className="game-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          marginTop: "1rem",
          marginLeft: "1rem",
          position: "absolute",
          zIndex: 50
        }}
      >
        <button
          className="glossy-button glossy-button-blue"
          style={{
            minWidth: "56px",
            height: "28px",
            fontSize: "0.9rem",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            padding: "0 12px",
            borderRadius: "18px",
            boxShadow: "0 8px 16px rgba(0, 105, 227, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255, 255, 255, 0.3)",
            transition: "all 0.2s ease",
          }}
          onClick={() => router.push("/play")}
        >
          <svg width="24" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M24 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Opponent View - Multiple Players */}
      <div
        className="opponent-section"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: "2rem",
          height: "auto",
          paddingTop: "174px"
        }}
      >
        {opponents.map((opponent, index) => {
          // Position opponents around the table based on index
          let positionStyle = {};
          if (index === 0) {
            // Left side, middle
            positionStyle = { position: "absolute", top: "42%", left: "0%" };
          } else if (index === 1) {
            // Right side, middle
            positionStyle = { position: "absolute", top: "42%", right: "0px" };
          } else if (index === 2) {
            // Top left
            positionStyle = { position: "absolute", top: "20%", left: "0px" };
          } else if (index === 3) {
            // Top right
            positionStyle = { position: "absolute", top: "20%", right: "0px" };
          } else {
            // Additional players just use absolute positioning
            positionStyle = { position: "absolute" };
          }

          return (
            <div
              key={opponent.name}
              className="opponent-info"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                ...positionStyle,
              }}
            >
            <div
              style={{
                color: "#94a3b8",
                fontSize: "0.75rem",
                marginBottom: "0.5rem",
                visibility: currentTurn === opponent.name ? "visible" : "hidden",
              }}
            >
              {`Thinking... (${turnTimeRemaining}s)`}
            </div>
            <div
              className="avatar-container"
              style={{
                width: "2.5rem",
                height: "2.5rem",
                position: "relative",
                marginBottom: "0.5rem",
              }}
            >
              {currentTurn === opponent.name && (
                <svg 
                  width="2.5rem" 
                  height="2.5rem" 
                  viewBox="0 0 100 100"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transform: "rotate(-90deg)",
                    zIndex: 1
                  }}
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="48"
                    fill="none"
                    stroke="rgba(4, 81, 214, 0.8)"
                    strokeWidth="8"
                    strokeDasharray={`${(turnTimeRemaining/10) * 301.6} 301.6`}
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <div
                className="avatar"
                style={{
                  width: "2.5rem",
                  height: "2.5rem",
                  borderRadius: "50%",
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: currentTurn === opponent.name ? "0 0 15px 5px rgba(14, 165, 233, 0.7)" : "none",
                  transform: currentTurn === opponent.name && pulseAnimation ? "scale(1.1)" : "scale(1)",
                  transition: "all 0.3s ease",
                  zIndex: 2
                }}
              >
                <img
                  src={`https://api.dicebear.com/9.x/micah/svg?seed=${opponent.name}`}
                  alt={`${opponent.displayName} Avatar`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>
            {/* Opponent's cards - matching PlayerViewofOpponent */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "0.5rem",
              width: "100%",
              maxWidth: "400px",
              flexDirection: index != 4 ? "column" : "row"
            }}>
              {opponent.deck.map((item, i) => (
                <div 
                  key={item + i}
                  style={{
                    position: "relative",
                    margin: "0 -10px",
                    transform: index != 4 ? `rotate(${i % 2 === 0 ? '-2' : '2'}deg) translateY(${-54 * i}px)` : `rotate(${i % 2 === 0 ? '-5' : '5'}deg)`,
                    zIndex: i
                  }}
                >
                  <img
                    style={{ 
                      pointerEvents: "none",
                      width: "2.5rem",
                      height: "4rem",
                      borderRadius: "0.5rem",
                    }}
                    alt={`opponent-cards-back`}
                    className={currentTurn === opponent.name ? "glow" : ""}
                    src={`../assets/card-back.png`}
                  />
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </div>

      {/* Game Board */}
      <div
        className="game-board"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          className="card-circles"
          style={{
            position: "relative",
            width: "100%",
            height: "12rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "20px"
          }}
        >
          {/* CommonView - Draw pile, played card, UNO button */}
          <div style={{ position: "relative", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "100vh" }}>
              {/* Draw Pile */}
              <button
                className="draw-deck"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  pointerEvents: currentTurn !== "Player 1" ? "none" : "auto",
                  filter: currentTurn !== "Player 1" ? "grayscale(1)" : "none",
                  width: "5rem",
                  marginTop: "10rem",
                  position: "absolute",
                  left: "50%",
                  transform: "translate(-50%,56px)",
                  zIndex: 10,
                  background: "none",
                  border: "none",
                  cursor: "pointer"
                }}
                role="button"
                disabled={currentTurn !== "Player 1"}
              >
                <img src="/images/draw.png" alt="draw" />
              </button>

              {/* Played Card */}
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
                  alt={`cards-front ${playedCard}`}
                  src={`../assets/cards-front/${playedCard}.webp`}
                />
              </div>

              {/* UNO Button */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  position: "absolute",
                  bottom: "-33px",
                  left: "50%",
                  transform: "translateX(-50%)"
                }}
              >
                <button
                  disabled={currentTurn !== "Player 1"}
                  style={{
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "1rem",
                    width: "10rem",
                    filter: currentTurn !== "Player 1" ? "grayscale(1)" : "none",
                    marginTop: "10rem",
                    background: "none",
                    border: "none",
                    cursor: currentTurn === "Player 1" ? "pointer" : "not-allowed"
                  }}
                >
                  <img src="/images/zunno-button.png" alt="uno" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Player View */}
      <div
        className="player-section"
        style={{
          marginTop: "1rem",
          paddingBottom: "86px"
        }}
      >
        <div
          className="player-info"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "absolute",
            bottom: "38px",
            left: "50%",
            transform: "translateX(-50%)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div
                style={{
                  backgroundColor: "rgba(76, 29, 29, 0.95)",
                  borderRadius: "1.5rem",
                  padding: "0.5rem 1rem",
                  color: "white",
                  fontSize: "0.75rem",
                  fontWeight: "lighter",
                  letterSpacing: "0.1em",
                  fontFamily: "monospace",
                  textAlign: "center",
                  minWidth: "80px",
                  visibility: currentTurn === "Player 1" ? "visible" : "hidden",
                }}
              >
                {Math.floor(turnTimeRemaining / 60).toString().padStart(2, '0')}:{(turnTimeRemaining % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* MainPlayerView - Player's hand with fan effect */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          padding: "0.5rem",
          minHeight: "7rem",
          position: "relative"
        }}>
          {currentPlayer.deck.map((item, i) => {
            // Calculate position for fan effect
            const totalCards = currentPlayer.deck.length;
            const fanAngle = Math.min(40, totalCards * 5); // Max 40 degrees total fan
            const cardAngle = (fanAngle / (totalCards - 1)) * (i - (totalCards - 1) / 2);
            const isPlayable = currentTurn === "Player 1";
            
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
                  zoom: currentTurn !== "Player 1" ? "0.85" : "1.04",
                  filter: currentTurn !== "Player 1" ? "brightness(0.75)" : ""
                }}
                onMouseEnter={(e) => {
                  if (isPlayable) {
                    e.currentTarget.style.transform = `rotate(${cardAngle}deg) translateY(-10px)`;
                    e.currentTarget.style.zIndex = "100";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = `rotate(${cardAngle}deg)`;
                  e.currentTarget.style.zIndex = String(i);
                }}
              >
                <img
                  style={{
                    pointerEvents: currentTurn !== "Player 1" ? "none" : "auto",
                    width: "3.5rem",
                    height: "5.5rem",
                    borderRadius: "0.5rem",
                    cursor: currentTurn === "Player 1" ? "pointer" : "default",
                    border: currentTurn === "Player 1" ? "2px solid rgba(14, 165, 233, 0.3)" : "none"
                  }}
                  alt={`cards-front ${item}`}
                  className={currentTurn === "Player 1" ? "glow" : ""}
                  src={`../assets/cards-front/${item}.webp`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PreviewGame;
