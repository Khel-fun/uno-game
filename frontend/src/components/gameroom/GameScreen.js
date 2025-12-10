import React, { useEffect, useState, useRef } from "react";
import PlayerViewofOpponent from "./PlayerViewofOpponent";
import CommonView from "./CommonView";
import MainPlayerView from "./MainPlayerView";
import bgMusic from "../../assets/sounds/game-bg-music.mp3";
import useSound from "use-sound";
import { useSoundProvider } from "../../context/SoundProvider";
import StyledButton from "../styled-button";
import { useRouter } from "next/navigation";

const GameScreen = ({
  currentUser,
  turn,
  player1Deck,
  player2Deck,
  player3Deck = [],
  player4Deck = [],
  player5Deck = [],
  player6Deck = [],
  playerCount = 2,
  onUnoClicked,
  playedCardsPile,
  onCardPlayedHandler,
  onCardDrawnHandler,
  drawButtonPressed,
  onSkipButtonHandler,
  isComputerMode = false,
  isExtraTurn = false,
}) => {
  // Get all player decks in an object
  const allPlayerDecks = {
    "Player 1": player1Deck,
    "Player 2": player2Deck,
    "Player 3": player3Deck,
    "Player 4": player4Deck,
    "Player 5": player5Deck,
    "Player 6": player6Deck,
  };

  // Get current player's deck
  const playerDeck = allPlayerDecks[currentUser] || [];

  console.log(currentUser, "currentUser")
  
  // Get opponent decks (all other players with cards)
  const opponentDecks = [];
  for (let i = 1; i <= playerCount; i++) {
    const playerName = `Player ${i}`;
    if (playerName !== currentUser && allPlayerDecks[playerName]?.length > 0) {
      opponentDecks.push({
        name: playerName,
        deck: allPlayerDecks[playerName],
        displayName: isComputerMode && playerName === "Player 2" ? "Computer" : playerName
      });
    }
  }
  
  // For backward compatibility, keep opponentDeck as the first opponent
  const opponentDeck = opponentDecks[0]?.deck || [];
  const { isSoundMuted, toggleMute } = useSoundProvider();
  const [isMusicMuted, setMusicMuted] = useState(true);
  const [playBBgMusic, { pause }] = useSound(bgMusic, { loop: true });
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [skipTimer, setSkipTimer] = useState(null);
  const [skipTimeRemaining, setSkipTimeRemaining] = useState(10);
  const skipTimerRef = useRef(null);
  
  // Turn timer state
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(10);
  const turnTimerRef = useRef(null);
  const [unoClicked, setUnoClicked] = useState(false);
  const router = useRouter();

  // Calculate opponent name and avatar (for first opponent)
  const opponentName = opponentDecks[0]?.name || "Player 2";
  const opponentDisplayName = opponentDecks[0]?.displayName || "Opponent";
      
  // Effect for turn animation
  useEffect(() => {
    setPulseAnimation(true);
    const timer = setTimeout(() => setPulseAnimation(false), 500);
    return () => clearTimeout(timer);
  }, [turn]);
  
  // Effect for turn timer
  useEffect(() => {
    // Reset timer when turn changes
    setTurnTimeRemaining(10);
    setUnoClicked(false); // Reset uno clicked state when turn changes
    
    // Clear any existing timer
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    
    // Start new timer
    turnTimerRef.current = setInterval(() => {
      setTurnTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - auto change turn
          clearInterval(turnTimerRef.current);
          turnTimerRef.current = null;
          
          // Only execute timeout actions if Uno button wasn't clicked
          if (!unoClicked) {
            // If it's the current user's turn and they've drawn a card, skip
            if (turn === currentUser && drawButtonPressed) {
              onSkipButtonHandler();
            } 
            // If it's an extra turn from special card, just skip (lose the extra turn)
            else if (turn === currentUser && isExtraTurn) {
              onSkipButtonHandler();
            }
            // Otherwise, draw a card and potentially skip
            else if (turn === currentUser) {
              onCardDrawnHandler();
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Cleanup function
    return () => {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
      }
    };
  // Only reset timer when turn or game state changes, not when Uno button is clicked
  }, [turn, currentUser, drawButtonPressed, unoClicked, isExtraTurn]);  // Added unoClicked and isExtraTurn to dependencies

  // Effect for skip timer
  useEffect(() => {
    // Start timer when draw button is pressed and it's the current user's turn
    if (turn === currentUser && drawButtonPressed) {
      setSkipTimer(true);
      setSkipTimeRemaining(10);
      
      // Clear any existing timer
      if (skipTimerRef.current) clearInterval(skipTimerRef.current);
      
      // Start countdown
      skipTimerRef.current = setInterval(() => {
        setSkipTimeRemaining(prev => {
          if (prev <= 1) {
            // Time's up - auto skip
            clearInterval(skipTimerRef.current);
            onSkipButtonHandler();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Clear timer when it's not the user's turn or draw button is not pressed
      setSkipTimer(false);
      if (skipTimerRef.current) {
        clearInterval(skipTimerRef.current);
        skipTimerRef.current = null;
      }
    }
    
    // Cleanup function
    return () => {
      if (skipTimerRef.current) {
        clearInterval(skipTimerRef.current);
        skipTimerRef.current = null;
      }
    };
  }, [turn, currentUser, drawButtonPressed, onSkipButtonHandler]);

  return (
    <div className="game-container" style={{
      minHeight: "100svh",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Game Header */}
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
          zIndex: "50"
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
          {/* Back */}
        </button>

        {/* <span>
          <StyledButton className="bg-green-500 mr-2" onClick={toggleMute}>
            <span className="material-icons">
              {isSoundMuted ? "volume_off" : "volume_up"}
            </span>
          </StyledButton>
          <StyledButton
            className="bg-green-500"
            onClick={() => {
              if (isMusicMuted) playBBgMusic();
              else pause();
              setMusicMuted(!isMusicMuted);
            }}
          >
            <span className="material-icons">
              {isMusicMuted ? "music_off" : "music_note"}
            </span>
          </StyledButton>
        </span> */}
      </div>

      {/* Opponent View - Multiple Players */}
      <div
        className="opponent-section"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "end",
          justifyContent: "center",
          gap: "2rem",
          height: "auto",
          paddingTop: "180px"
        }}
      >
        {opponentDecks.map((opponent, index) => {
          // Position opponents around the table based on index
          let positionStyle = {};
          const totalPlayers = opponentDecks.length + 1; // +1 for current player
          
          if (isComputerMode || totalPlayers === 2) {
            // In computer mode or 2-player game, use simple absolute positioning for all opponents
            positionStyle = { position: "absolute", top: "1px" };
          } else if (totalPlayers === 3) {
            // In multiplayer mode with more than 2 players, position opponents around the table
            if (index === 0) {
              // Left side, middle
              positionStyle = { position: "absolute", top: "26%", left: "5%" };
            } else if (index === 1) {
              // Right side, middle
              positionStyle = { position: "absolute", top: "26%", right: "5%" };
            } else {
              // Additional players just use absolute positioning
              positionStyle = { position: "absolute", top: "1px" };
            }
          } else {
            if (index === 0) {
              // Left side, middle
              positionStyle = { position: "absolute", top: "26%", left: "5%" };
            } else if (index === 1) {
              // Right side, middle
              positionStyle = { position: "absolute", top: "1px" };
            } else {
              // Additional players just use absolute positioning
              positionStyle = { position: "absolute", top: "26%", right: "5%" };
            }
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
                  visibility: turn === opponent.name ? "visible" : "hidden",
                }}
              >
                {isComputerMode && opponent.name === "Player 2"
                  ? `Computing... (${turnTimeRemaining}s)`
                  : `Thinking... (${turnTimeRemaining}s)`}
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
                {turn === opponent.name && (
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
                    boxShadow: turn === opponent.name ? "0 0 15px 5px rgba(14, 165, 233, 0.7)" : "none",
                    transform: turn === opponent.name && pulseAnimation ? "scale(1.1)" : "scale(1)",
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
              <PlayerViewofOpponent
                turn={turn}
                opponent={opponent.name}
                opponentDeck={opponent.deck}
                index={index}
                playerCount={playerCount}
              />
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
            marginBottom: "70px"
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
            <CommonView
              isDrawDisabled={turn !== currentUser}
              playedCardsPile={playedCardsPile}
              onCardDrawnHandler={onCardDrawnHandler}
              isUnoDisabled={turn !== currentUser || playerDeck.length !== 2}
              onUnoClicked={() => {
                setUnoClicked(true);
                // Clear the turn timer when Uno is clicked
                if (turnTimerRef.current) {
                  clearInterval(turnTimerRef.current);
                  turnTimerRef.current = null;
                }
                onUnoClicked();
              }}
            />
          </div>
      </div>

      {/* Player View */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* <button
            className="skip-button"
            disabled={turn !== currentUser || !drawButtonPressed}
            onClick={onSkipButtonHandler}
            style={{
              margin: "auto",
              cursor: "pointer",
              transition: "all 0.2s ease",
              opacity: turn !== currentUser || !drawButtonPressed ? "0.6" : "1",
              pointerEvents:
                turn !== currentUser || !drawButtonPressed ? "none" : "auto",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <img src="/images/skip.png" className="w-20" alt="Skip" />
          </button> */}
          
          {skipTimer && (
            <div 
              // className="skip-timer"
              // style={{
              //   marginTop: "8px",
              //   fontSize: "1rem",
              //   fontWeight: "bold",
              //   color: skipTimeRemaining <= 5 ? "#ef4444" : "#10b981",
              //   animation: skipTimeRemaining <= 5 ? "pulse 1s infinite" : "none",
              // }}
            >
              {/* Auto-skip in {skipTimeRemaining}s
              <style jsx>{`
                @keyframes pulse {
                  0% { opacity: 0.7; }
                  50% { opacity: 1; }
                  100% { opacity: 0.7; }
                }
              `}</style> */}
            </div>
          )}
      </div>
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
              {/* <div
                className="avatar-container"
                style={{
                  width: "3rem",
                  height: "3rem",
                  position: "relative",
                  marginRight: "1rem",
                }}
              >
                {turn === currentUser && (
                  <svg 
                    width="3rem" 
                    height="3rem" 
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
                      strokeDasharray={`${(turnTimeRemaining/10) * 301.6} 301.6`} // 301.6 is approx 2*PI*48 (circumference)
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                <div
                  className="avatar"
                  style={{
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "50%",
                    overflow: "hidden",
                    position: "relative",
                    boxShadow: turn === currentUser ? "0 0 20px 8px rgba(14, 165, 233, 0.8)" : "none",
                    transform: turn === currentUser && pulseAnimation ? "scale(1.1)" : "scale(1)",
                    transition: "all 0.3s ease",
                    zIndex: 2
                  }}
                >
                <img
                  src="https://api.dicebear.com/9.x/micah/svg?seed=gameboyy"
                  alt="Player Avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                </div>
              </div> */}
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
                    visibility: turn === currentUser ? "visible" : "hidden",
                  }}
                >
                  {Math.floor(turnTimeRemaining / 60).toString().padStart(2, '0')}:{(turnTimeRemaining % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          </div>
          <MainPlayerView
            turn={turn}
            mainPlayer={currentUser}
            playerDeck={playerDeck}
            onCardPlayedHandler={onCardPlayedHandler}
            isSkipButtonDisabled={turn !== currentUser || !drawButtonPressed}
            onSkipButtonHandler={onSkipButtonHandler}
          />
        </div>
    </div>
  );
};

export default GameScreen;
