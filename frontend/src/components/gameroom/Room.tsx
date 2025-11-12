"use client";

import React, { useState, useEffect, useRef } from "react";
import Game from "./Game";
import { useParams, useSearchParams } from 'next/navigation'
import socket from "@/services/socket";
import Header from "./Header";
import CenterInfo from "./CenterInfo";
import { UnoGameContract, OffChainGameState, OnChainGameState, Card, Action, ActionType } from '../../lib/types'
import { useUserAccount } from '@/userstate/useUserAccount';
import { getContractNew } from '../../lib/web3'
import { applyActionToOffChainState, hashAction, startGame, storePlayerHand, getPlayerHand, createDeck, hashCard, initializeOffChainState } from '../../lib/gameLogic'
import { updateGlobalCardHashMap } from '../../lib/globalState';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import UnoGameABI from '@/constants/UnoGame.json';
import { unoGameABI } from "@/constants/unogameabi";
import { useReadContract, useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { baseSepolia } from "@/lib/chains";
import { client } from "@/utils/thirdWebClient";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useWalletAddress } from "@/utils/onchainWalletUtils";
import { useBalanceCheck } from "@/hooks/useBalanceCheck";
import { LowBalanceDrawer } from "@/components/LowBalanceDrawer";

type User = { 
  id: string;
  name: string;
  room: string;
};

const Room = () => {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const isComputerMode = searchParams.get('mode') === 'computer'
  
  //initialize socket state
  const [room] = useState(id);
  const [roomFull, setRoomFull] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User["name"]>("");
  const [gameStarted, setGameStarted] = useState(false);
  const { account, bytesAddress } = useUserAccount();
  const { address } = useWalletAddress();
  const [contract, setContract] = useState<UnoGameContract | null>(null)
  const [gameId, setGameId] = useState<bigint | null>(null)
  
  // Wagmi contract write hooks
  const { writeContract, data: hash, error: txError, isPending } = useWriteContract();

  const { toast } = useToast();

  const [offChainGameState, setOffChainGameState] = useState<OffChainGameState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playerToStart, setPlayerToStart] = useState<string | null>(null)
  const [playerHand, setPlayerHand] = useState<string[]>([])
  const [showLowBalanceDrawer, setShowLowBalanceDrawer] = useState(false);
  const { checkBalance } = useBalanceCheck();

  const { mutate: sendTransaction } = useSendTransaction();

  // Initialize computer game - simplified approach
  const initializeComputerGame = async () => {
    console.log('Initializing computer game...');
    console.log('Current gameStarted state:', gameStarted);
    console.log('Current contract:', contract);
    console.log('Current account:', account);
    console.log('Current offChainGameState:', offChainGameState);
    console.log('Current gameId:', gameId);
    
    // Verify all required data is available
    if (!contract) {
      console.error('Missing contract to start computer game');
      setError('Missing contract to start computer game');
      return;
    }
    
    if (!account) {
      console.error('Missing account to start computer game');
      setError('Missing account to start computer game');
      return;
    }
    
    if (!offChainGameState) {
      console.error('Missing game state to start computer game');
      setError('Missing game state to start computer game');
      return;
    }
    
    if (!gameId) {
      console.error('Missing game ID to start computer game');
      setError('Missing game ID to start computer game');
      return;
    }
    
    try {
      console.log('Initializing computer game directly without blockchain transaction...');
      
      // Skip the blockchain startGame transaction for computer mode
      // Just initialize the game state directly
      console.log('Computer game initialized - skipping blockchain transaction');
      
      toast({
        title: "Computer game initialized",
        description: "Starting game against computer opponent",
        duration: 5000,
        variant: "success",
      });
      
      // Initialize the game state after the transaction is confirmed
      const newState = startGame(offChainGameState, socket);
      console.log('New Computer Game State:', newState);
      
      const startingPlayer = newState.players[newState.currentPlayerIndex];
      setPlayerToStart(startingPlayer);
      
      // Create the action but don't commit it to the blockchain for computer mode
      const action: Action = { type: 'startGame', player: bytesAddress! };
      const actionHash = hashAction(action);
      console.log('Computer game action hash (not committed to blockchain):', actionHash);
      
      // Skip the blockchain commitMove transaction for computer mode
      console.log('Skipping blockchain commitMove transaction for computer mode');

      // Set the game as started and update the state
      setGameStarted(true);
      setOffChainGameState(newState);
      
    } catch (error) {
      console.error('Error initializing computer game:', error);
      setError('Failed to initialize computer game. Please try again.');
    }
  };

  useEffect(() => {
    if (isComputerMode) {
      // For computer mode, simulate having 2 players immediately
      setUsers([
        { id: "player1", name: "Player 1", room: room as string },
        { id: "computer", name: "Computer", room: room as string }
      ]);
      setCurrentUser("Player 1");
      
      // We'll initialize the computer game after contract setup
      console.log('Computer mode detected, will initialize after contract setup');
    } else {
      socket.emit("join", { room: room }, (error: any) => {
        if (error) setRoomFull(true);
      });
    }

    return function cleanup() {
      if (!isComputerMode) {
        socket.emit("quitRoom");
        socket.off();
      }
    };
  }, [room, isComputerMode]);

  useEffect(() => {
    const setup = async () => {
      if (account) {
        try {
          console.log('Setting up contract with account:', account);
          const contractResult = await getContractNew();
          console.log('Contract result:', contractResult);
          
          if (!contractResult.contract) {
            console.error('Failed to initialize contract');
            setError('Failed to initialize contract. Please try again.');
            return;
          }
          
          console.log('Contract initialized:', contractResult.contract);
          setContract(contractResult.contract);
          
          if (contractResult.contract && id) {
            const bigIntId = BigInt(id as string);
            console.log('Setting game ID:', bigIntId.toString());
            setGameId(bigIntId);
            
            console.log('Fetching game state...');
            const gameState = await fetchGameState(contractResult.contract, bigIntId, account);
            // Set the offChainGameState from the game state
            if (gameState) {
              console.log('Game state fetched successfully');
              setOffChainGameState(gameState);
              // Note: For computer mode, we'll initialize the game in a separate useEffect
              // after all state is properly set, without blockchain transactions
              // For non-computer mode, we'll wait for the gameStarted event from the server
            } else {
              console.error('Failed to fetch game state');
              setError('Failed to fetch game state. Please try again.');
            }
          }
        } catch (error) {
          console.error('Error in setup:', error);
          setError('Failed to set up the game. Please try again.');
        }
      }
    };
    setup();
  }, [id, account])
  
  // Separate useEffect to initialize computer game when all dependencies are available
  // For computer mode, we initialize the game without blockchain transactions
  useEffect(() => {
    console.log('Computer game initialization check:', {
      isComputerMode,
      hasContract: !!contract,
      hasOffChainGameState: !!offChainGameState,
      hasGameId: !!gameId,
      gameStarted
    });
    
    if (isComputerMode && contract && offChainGameState && gameId && !gameStarted) {
      console.log('All required data available, initializing computer game (without blockchain transactions)...');
      console.log('Contract details available (but not used for transactions):', contract);
      console.log('Game ID:', gameId.toString());
      console.log('Off-chain state:', offChainGameState);
      
      // Small delay to ensure state is fully updated
      setTimeout(() => {
        console.log('Executing initializeComputerGame after delay');
        initializeComputerGame();
      }, 2000);
    }
  }, [isComputerMode, contract, offChainGameState, gameId, gameStarted, initializeComputerGame])

  useEffect(() => {
    if (!socket || !id) return;

    const roomId = `game-${id}`;
    
    console.log(`Joining room: ${roomId}`);
    socket.emit("joinRoom", roomId);

    if (socket) {
      socket.on(`gameStarted-${roomId}`, (data: { newState: OffChainGameState; cardHashMap: any; }) => {
        console.log(`Game started event received for room ${roomId}:`, data);
        
        try {
          const { newState, cardHashMap } = data;
          
          console.log('Received newState:', newState);
          console.log('Received cardHashMap:', cardHashMap);
          console.log('Current account:', account);
          
          if (!newState) {
            console.error('Error: Received empty game state in gameStarted event');
            return;
          }

          if (cardHashMap) {
            console.log('Updating global card hash map');
            updateGlobalCardHashMap(cardHashMap);
          } else {
            console.warn('Warning: No cardHashMap received in gameStarted event');
          }

          console.log('Setting game as started');
          setGameStarted(true);

          console.log('Updating off-chain game state');
          setOffChainGameState(newState);

          if (account) {
            console.log('Updating player hand for account:', account);
            console.log('Player hands in newState:', newState.playerHands);
            
            const playerHandHashes = newState.playerHands[account];
            console.log('Player hand hashes:', playerHandHashes);
            
            if (playerHandHashes) {
              setPlayerHand(playerHandHashes);
              storePlayerHand(BigInt(id as string), account, playerHandHashes);
              console.log('Player hand updated and stored');
            } else {
              console.error(`Error: No hand found for player ${account} in the game state`);
            }
          } else {
            console.error('Error: No account available to update player hand');
          }

          if (newState.players && newState.currentPlayerIndex !== undefined) {
            const startingPlayer = newState.players[newState.currentPlayerIndex];
            console.log('Setting player to start:', startingPlayer);
            setPlayerToStart(startingPlayer);
          } else {
            console.error('Error: Cannot determine starting player from game state');
          }
        } catch (error) {
          console.error('Error handling gameStarted event:', error);
        }
      });

      // Listen for cardPlayed event
      socket.on(`cardPlayed-${roomId}`, (data: { action: any; newState: OffChainGameState; }) => {
        const { action, newState } = data;

        setOffChainGameState(newState);

        if (account && newState.playerHands[account]) {
          setPlayerHand(newState.playerHands[account]);
        }
      });
    }
  }, [id, socket]);

  useEffect(() => {
    socket.on("roomData", ({ users }: { users: User[] }) => {
      setUsers(users);
    });

    socket.on("currentUserData", ({ name }: { name: User["name"] }) => {
      setCurrentUser(name);
    });
  }, []);

  const fetchGameState = async (contract: UnoGameContract, gameId: bigint, account: string) => {
    try {
      console.log('Fetching game state for game ID:', gameId.toString());
      console.log('Using contract:', contract);
      
      if (!contract || !contract.getGame) {
        throw new Error('Invalid contract or missing getGame method');
      }
      
      // Call the getGame method on the ethers.js contract
      const gameData = await contract.getGame(gameId);
      console.log('Raw game data:', gameData);
      
      if (!gameData) {
        throw new Error('No game data returned from contract');
      }
      
      // Extract the data from the result
      const [id, players, status, startTime, endTime, gameHash, moves] = gameData;
      console.log('On chain game state: ', { id, players, status, startTime, endTime, gameHash, moves })

      const formattedGameData = {
        id,
        players,
        status,
        startTime,
        endTime,
        gameHash,
        moves
      };

      console.log('Formatted game data:', formattedGameData);

      let offChainGameState: OffChainGameState = {
        id: id, // Use the destructured variables directly
        players: Array.from(players), // Convert from Result object to array
        isActive: true, // Assume active if we can fetch it
        currentPlayerIndex: 0, // Will be set properly when game starts
        lastActionTimestamp: startTime,
        turnCount: BigInt(0), // Initialize to 0
        directionClockwise: true, // Default direction
        playerHandsHash: {},
        playerHands: {},
        deckHash: '',
        discardPileHash: '',
        currentColor: null,
        currentValue: null,
        lastPlayedCardHash: null,
        stateHash: gameHash || '',
        isStarted: status === 1 // 0=NotStarted, 1=Started, 2=Ended
      }

      if (offChainGameState.isStarted) {
        const allCards = createDeck()
        const tempCardHashMap: { [hash: string]: Card } = {}
        
        allCards.forEach((card: Card) => {
            const hash = hashCard(card);
            tempCardHashMap[hash] = card;
        });
        updateGlobalCardHashMap(tempCardHashMap);

        offChainGameState.playerHands = {};
        const playerHand = getPlayerHand(gameId, account);
        setPlayerHand(playerHand);
      }

      // Update the state with the new game state
      setOffChainGameState(offChainGameState)
      console.log('Off chain game state: ', offChainGameState)

      // Return the game state for further processing
      return offChainGameState;
    } catch (error) {
      console.error('Error fetching game state:', error)
      setError('Failed to fetch game state. Please try again.')
      return null;
    }
  }

  const handleStartGame = async () => {
    console.log('Starting game with:', { address, account, offChainGameState, gameId })
    if (!address || !account || !offChainGameState || !gameId) {
      console.error('Missing required data to start game')
      setError('Missing required data to start game')
      return
    }

    // Check balance before proceeding
    const hasSufficientBalance = await checkBalance();
    if (!hasSufficientBalance) {
      setShowLowBalanceDrawer(true);
      return;
    }

    try {
      console.log('Starting game on contract...')
      
      // Use writeContract to require user signature
      // writeContract({
      //   address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
      //   abi: UnoGameABI.abi,
      //   functionName: 'startGame',
      //   args: [gameId],
      // });

      const transaction = prepareContractCall({
          contract: {
            address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
            abi: unoGameABI,
            chain: baseSepolia,
            client,
          },
          method: "startGame",
          params: [gameId],
        });
        
        sendTransaction(transaction, {
          onSuccess: async (result) => {
            console.log("Transaction successful:", result);
            toast({
              title: "Game started successfully!",
              description: "Game started successfully!",
              duration: 5000,
              variant: "success",
            });
      
            initializeGameAfterStart();
          },
          onError: (error) => {
            console.error("Transaction failed:", error);
            setError('Failed to start game')
          }
        });

    } catch (error) {
      console.error('Failed to start game:', error)
      setError('Failed to start game')
    }
  }

  // Handle successful game start after transaction confirmation
  const initializeGameAfterStart = () => {
    if (!offChainGameState || !bytesAddress) return

    try {
      console.log('Initializing local game state...')
      const newState = startGame(offChainGameState, socket)
      console.log('New State:', newState)

      const startingPlayer = newState.players[newState.currentPlayerIndex]
      setPlayerToStart(startingPlayer)

      const action: Action = { type: 'startGame', player: bytesAddress! }
      const actionHash = hashAction(action)
      console.log('Action hash:', actionHash)

      console.log('Committing move to contract...')
      console.log('Move committed to contract')

      setGameStarted(true)

      const optimisticUpdate = applyActionToOffChainState(newState, action)
      setOffChainGameState(optimisticUpdate)
      console.log('Updated off-chain state:', optimisticUpdate)

    } catch (error) {
      console.error('Error starting game:', error)
      setError('Failed to start game. Please try again.')
    }
  }

  // Handle transaction confirmation
  // useEffect(() => {
  //   if (isConfirmed && hash) {
  //     console.log('Game start transaction confirmed with hash:', hash)
  //     initializeGameAfterStart()
  //   }
  // }, [isConfirmed, hash])

  // Handle transaction error
  useEffect(() => {
    if (txError) {
      console.error('Game start transaction error:', txError)
      setError('Failed to start game transaction. Please try again.')
    }
  }, [txError])

  return !roomFull ? (
    <div
      className={`Game`}
      style={{
        height: "100vh",
        width: "100vw",
        backgroundImage: "url('/bg_primary.webp')",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
    <Toaster />
      {isComputerMode ? (
        // Computer mode - skip waiting and go directly to game
        (() => {
          console.log('Rendering computer mode, gameStarted:', gameStarted, 'currentUser:', currentUser);
          return gameStarted ? (
            <Game room={room} currentUser={currentUser} isComputerMode={isComputerMode} playerCount={users.length} />
          ) : (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
              <h1 className='topInfoText text-white font-2xl font-bold'>Starting game against Computer 🤖</h1>
              <br />
              <div className="text-white">Preparing your opponent...</div>
            </div>
          );
        })()
      ) : (
        users.length < 2 ? (
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
                #{String(room)}
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
                  marginBottom: "2rem"
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
                        {user.name === currentUser ? `${address?.slice(0, 20)}...` : `${user.name}`}
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
                  {users.length === 1 && currentUser !== "Player 1"
                    ? "Player 1 has left the game." 
                    : `waiting for other players to join (${users.length}/6)`}
                </div>
              </div>
            </div>
          </div>
        ) : (
          !gameStarted
            ? (
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
                    #{String(room)}
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
                      marginBottom: "2rem"
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
                            {user.name === currentUser ? `${address?.slice(0, 20)}...` : `${user.name}`}
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
                      waiting for other players to join ({users.length}/6)<br />minimum 2 players required to start
                    </div>
                  </div>

                  {/* Start Game Button */}
                  <button 
                    onClick={() => handleStartGame()}
                    disabled={isPending}
                    style={{
                      backgroundColor: "#C89A4A",
                      color: "white",
                      fontSize: "1.125rem",
                      fontWeight: "bold",
                      padding: "1rem 3rem",
                      borderRadius: "2rem",
                      border: "none",
                      cursor: isPending ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                      transition: "all 0.2s ease",
                      textTransform: "lowercase",
                      opacity: isPending ? 0.7 : 1,
                      alignSelf: "center"
                    }}
                    onMouseEnter={(e) => {
                      if (!isPending) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.4)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
                    }}
                  >
                    {isPending ? "starting..." : "start game"}
                  </button>
                </div>
              </div>
            )
            : (
              <Game room={room} currentUser={currentUser} isComputerMode={false} playerCount={users.length} />
            )
        )
      )}
      <LowBalanceDrawer 
        open={showLowBalanceDrawer} 
        onClose={() => setShowLowBalanceDrawer(false)} 
      />
    </div>
  ) : (
    <>
      <CenterInfo msg='Room is full' />
      <Toaster />
      <LowBalanceDrawer 
        open={showLowBalanceDrawer} 
        onClose={() => setShowLowBalanceDrawer(false)} 
      />
    </>
  );
};

export default Room;
