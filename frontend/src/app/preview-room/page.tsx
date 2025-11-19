"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const PreviewRoom = () => {
  const [playerCount, setPlayerCount] = useState(3);
  const router = useRouter();

  // Mock users based on player count
  const generateMockUsers = (count: number) => {
    const mockUsers = [];
    for (let i = 0; i < count; i++) {
      mockUsers.push({
        id: `player${i + 1}`,
        name: i === 0 ? "You" : `Player ${i + 1}`,
        room: "preview",
        address: `0x${Math.random().toString(16).substr(2, 40)}`
      });
    }
    return mockUsers;
  };

  const users = generateMockUsers(playerCount);
  const currentUser = "You";

  return (
    <div
      className="Game"
      style={{
        height: "100svh",
        width: "100vw",
        backgroundImage: "url('/bg_primary.webp')",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Player Count Selector */}
      <div style={{
        position: "absolute",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "1rem",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        padding: "1rem 2rem",
        borderRadius: "1rem",
        zIndex: 1000
      }}>
        <button
          onClick={() => router.push('/play')}
          style={{
            backgroundColor: "#C89A4A",
            color: "white",
            fontSize: "0.875rem",
            fontWeight: "bold",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "none",
            cursor: "pointer",
            marginRight: "1rem"
          }}
        >
          ← Back to Play
        </button>
        <label style={{ color: "white", fontWeight: "bold" }}>
          Preview Players:
        </label>
        {[2, 3, 4].map(count => (
          <button
            key={count}
            onClick={() => setPlayerCount(count)}
            style={{
              backgroundColor: playerCount === count ? "#C89A4A" : "#666",
              color: "white",
              fontSize: "1rem",
              fontWeight: "bold",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            {count}
          </button>
        ))}
      </div>

      {/* Game Room Preview */}
      <div style={{ 
        position: "absolute", 
        top: "50%", 
        left: "50%", 
        transform: "translate(-50%, -50%)", 
        width: "90%",
        maxWidth: "440px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        height: "85vh"
      }}>
        {/* Card Container */}
        <div style={{
          position: "relative",
          width: "100%",
          background: "linear-gradient(180deg, rgba(133, 115, 62, 0.95) 0%, rgba(115, 92, 45, 0.95) 50%, rgba(139, 99, 48, 0.95) 100%)",
          borderRadius: "2rem",
          border: "3px solid #9CA34C",
          padding: "2rem 1.5rem",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
          minHeight: "600px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100%"
        }}>
          {/* Room Number Badge */}
          <div style={{
            position: "absolute",
            top: "-25px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#9CA34C",
            border: "3px solid #9CA34C",
            borderRadius: "50%",
            width: "60px",
            height: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.25rem",
            fontWeight: "bold",
            color: "white",
            fontFamily: "monospace",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
          }}>
            #PREVIEW
          </div>

          {/* Content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", marginTop: "2rem" }}>
            {/* Title */}
            <h2 style={{
              color: "white",
              fontSize: "2rem",
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: "2rem",
              fontStyle: "italic",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              PLAYERS
            </h2>

            {/* Players List */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              marginBottom: "2rem",
              maxHeight: "400px",
              overflowY: "auto"
            }}>
              {users.map((user, index) => (
                <div key={user.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  color: "white",
                  fontSize: "1rem",
                  fontFamily: "monospace"
                }}>
                  <span style={{ fontSize: "1.25rem" }}>{'>'}</span>
                  <span style={{ fontWeight: "bold" }}>{String(index + 1).padStart(2, '0')}.</span>
                  <span style={{ 
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                    {user.name === currentUser ? `${user.address.slice(0, 20)}...` : `${user.address.slice(0, 20)}...`}
                  </span>
                  {user.name === currentUser && (
                    <span style={{ 
                      fontSize: "0.875rem",
                      opacity: 0.8,
                      fontStyle: "italic"
                    }}>
                      (you)
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Waiting Message */}
            <div style={{
              textAlign: "center",
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "0.875rem",
              marginTop: "auto",
              marginBottom: "2rem",
              fontStyle: "italic"
            }}>
              waiting for other players to join ({users.length}/4)<br />minimum 2 players required to start
            </div>
          </div>

          {/* Start Game Button */}
          <button 
            onClick={() => alert('This is a preview only! Go back to Play to start a real game.')}
            style={{
              backgroundColor: "#C89A4A",
              color: "white",
              fontSize: "1.125rem",
              fontWeight: "bold",
              padding: "1rem 3rem",
              borderRadius: "2rem",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              transition: "all 0.2s ease",
              textTransform: "lowercase",
              alignSelf: "center"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
            }}
          >
            start game (preview)
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewRoom;
