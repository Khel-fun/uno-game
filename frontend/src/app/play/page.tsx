"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useUserAccount } from "@/userstate/useUserAccount";
import { WalletConnection } from "@/components/WalletConnection";
import { useConnect, useWalletClient } from "wagmi";
import Link from "next/link";
import { useWalletAddress } from "@/utils/onchainWalletUtils";
import { useChains } from 'wagmi'
import { client } from "@/utils/thirdWebClient";
import { baseSepolia } from "@/lib/chains";
import { unoGameABI } from "@/constants/unogameabi";
import { useReadContract, useSendTransaction } from "thirdweb/react";
import { waitForReceipt, getContract, prepareContractCall } from "thirdweb";
import ProfileDropdown from "@/components/profileDropdown"
import { useBalanceCheck } from "@/hooks/useBalanceCheck";
import { LowBalanceDrawer } from "@/components/LowBalanceDrawer";
import socket, { socketManager } from "@/services/socket";

// DIAM wallet integration removed

export default function PlayGame() {
  const [open, setOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [computerCreateLoading, setComputerCreateLoading] = useState(false);
  const [joiningGameId, setJoiningGameId] = useState<BigInt | null>(null);
  const [gameId, setGameId] = useState<BigInt | null>(null);
  const [showLowBalanceDrawer, setShowLowBalanceDrawer] = useState(false);
  const { checkBalance } = useBalanceCheck();
  const router = useRouter();
  const chains = useChains();
  
  // Use Wagmi hooks for wallet functionality
  const { address, isConnected } = useWalletAddress();
  const { data: walletClient } = useWalletClient();
  const { account: recoilAccount } = useUserAccount();
  const { mutate: sendTransaction } = useSendTransaction();

  const { toast } = useToast();

  // Using Wagmi hooks for wallet connection
  const { connect, connectors } = useConnect();

  const contract = getContract({
    client,
    chain:  baseSepolia,
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
    abi: unoGameABI,
  });

  const { data: activeGames, refetch: refetchGames } = useReadContract({
    contract,
    method: "getNotStartedGames",
  });

  // Auto-refetch active games every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchGames();
    }, 2000);

    return () => clearInterval(interval);
  }, [refetchGames]);

  // Setup socket event listeners using global socket manager
  useEffect(() => {
    // Add listener for gameRoomCreated event
    const handleGameRoomCreated = () => {
      refetchGames();
    };
    
    socketManager.on("gameRoomCreated", handleGameRoomCreated);

    // Cleanup function
    return () => {
      socketManager.off("gameRoomCreated", handleGameRoomCreated);
    };
  }, [refetchGames]);

  const openHandler = () => {
    setOpen(false);
  };

  const createGame = async () => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create a game.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    // Check balance before proceeding
    const hasSufficientBalance = await checkBalance();
    if (!hasSufficientBalance) {
      setShowLowBalanceDrawer(true);
      return;
    }

    try {
      setCreateLoading(true);

      const transaction = prepareContractCall({
        contract: {
          address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
          abi: unoGameABI,
          chain: baseSepolia,
          client,
        },
        method: "createGame",
        params: [address as `0x${string}`, false],
      });

      sendTransaction(transaction, {
        onSuccess: async(result) => {
          toast({
            title: "Game created successfully!",
            description: "Game created successfully!",
            duration: 5000,
            variant: "success",
          });

          const receipt = await waitForReceipt({
              client,
              chain: baseSepolia,
              transactionHash: result.transactionHash,
            });

          const gameCreatedId = receipt.logs.find((log) => log.topics.length == 2 && log.topics[1])?.topics[1]

          if (gameCreatedId) {
              const gameId = BigInt(gameCreatedId); // Convert hex to decimal
              setGameId(gameId);
    
              router.push(`/game/${gameId}`);
          }

          refetchGames();
          setCreateLoading(false);
        },
        onError: (error) => {
          console.error("Transaction failed:", error);
          toast({
            title: "Error",
            description: "Failed to create game. Please try again.",
            variant: "destructive",
            duration: 5000,
          });
          setCreateLoading(false);
        }
      });
    } catch (error) {
      console.error("Failed to create game:", error);
      toast({
        title: "Error",
        description: "Failed to create game. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
      setCreateLoading(false);
    }
  };

  const startComputerGame = async () => {
    setComputerCreateLoading(true);
    if (contract && address) {
      // Check balance before proceeding
      const hasSufficientBalance = await checkBalance();
      if (!hasSufficientBalance) {
        setShowLowBalanceDrawer(true);
        setComputerCreateLoading(false);
        return;
      }

      try {

        const transaction = prepareContractCall({
          contract: {
            address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
            abi: unoGameABI,
            chain: baseSepolia,
            client,
          },
          method: "createGame",
          params: [address as `0x${string}`, true],
        });
  
        sendTransaction(transaction, {
          onSuccess: async (result) => {
            toast({
              title: "Game created successfully!",
              description: "Game created successfully!",
              duration: 5000,
              variant: "success",
            });

            const receipt = await waitForReceipt({
              client,
              chain: baseSepolia,
              transactionHash: result.transactionHash,
            });

            const gameCreatedId = receipt.logs.find((log) => log.topics.length == 2 && log.topics[1])?.topics[1]

            if (gameCreatedId) {
              const gameId = BigInt(gameCreatedId); // Convert hex to decimal
              setGameId(gameId);
    
              // Emit socket event to create computer game room using global socket manager
              socketManager.emit("createComputerGame", {
                gameId: gameId.toString(),
                playerAddress: address
              });
    
              // Navigate to game room with computer mode flag
              router.push(`/game/${gameId}?mode=computer`);
            }

            refetchGames();
            setComputerCreateLoading(false);
          },
          onError: (error) => {
            console.error("Transaction failed:", error);
            toast({
              title: "Error",
              description: "Failed to create game. Please try again.",
              variant: "destructive",
              duration: 5000,
            });
            setComputerCreateLoading(false);
          }
        });

        // toast({
        //   title: "Computer Game Started",
        //   description: "Starting game against computer opponent!",
        //   duration: 3000,
        // });
      } catch (error) {
        console.error("Failed to create computer game:", error);
        toast({
          title: "Error",
          description: "Failed to start computer game. Please try again.",
          variant: "destructive",
          duration: 5000,
        });
        setComputerCreateLoading(false);
      }
    } else {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to play against computer.",
        variant: "destructive",
        duration: 5000,
      });
      setComputerCreateLoading(false);
    }
  };

  const joinGame = async (gameId: BigInt) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to join a game.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    // Check balance before proceeding
    const hasSufficientBalance = await checkBalance();
    if (!hasSufficientBalance) {
      setShowLowBalanceDrawer(true);
      return;
    }

    try {
      setJoiningGameId(gameId);

      const transaction = prepareContractCall({
        contract: {
          address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
          abi: unoGameABI,
          chain: baseSepolia,
          client,
        },
        method: "joinGame",
        params: [BigInt(gameId.toString()), address as `0x${string}`],
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          toast({
            title: "Game joined successfully!",
            description: "Game joined successfully!",
            duration: 5000,
            variant: "success",
          });
          router.push(`/game/${gameId}`);
        },
        onError: (error) => {
          console.error("Transaction failed:", error);
          toast({
            title: "Error",
            description: "Failed to join game. Please try again.",
            variant: "destructive",
            duration: 5000,
          });
        }
      });

    } catch (error) {
      console.error("Failed to join game:", error);
      setJoiningGameId(null);
      toast({
        title: "Error",
        description: "Failed to join game. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  // Handle transaction confirmation
  // useEffect(() => {
  //   if (isConfirmed && hash) {
  //     // console.log("Transaction confirmed with hash:", hash);
      
  //     // Check if this was a create game transaction
  //     if (createLoading) {
  //       // console.log("Game created successfully");
        
  //       if (socket && socket.current) {
  //         socket.current.emit("createGameRoom");
  //       }
        
  //       refetchGames();
  //       setCreateLoading(false);
        
  //       toast({
  //         title: "Success",
  //         description: "Game created successfully!",
  //         duration: 3000,
  //       });
  //     }
      
  //     // Check if this was a join game transaction
  //     if (joiningGameId !== null) {
  //       // console.log(`Joined game ${joiningGameId.toString()} successfully`);
        
  //       const gameIdToJoin = joiningGameId;
  //       setJoiningGameId(null);
        
  //       toast({
  //         title: "Success", 
  //         description: "Joined game successfully!",
  //         duration: 3000,
  //       });
        
  //       // Navigate to the game room
  //       router.push(`/game/${gameIdToJoin.toString()}`);
  //     }
  //   }
  // }, [createLoading, joiningGameId]);

  // Handle transaction error
  // useEffect(() => {
  //   if (error) {
  //     console.error("Transaction error:", error);
  //     setCreateLoading(false);
  //     setJoiningGameId(null);
      
  //     toast({
  //       title: "Transaction Failed",
  //       description: error.message || "Transaction failed. Please try again.",
  //       variant: "destructive",
  //       duration: 5000,
  //     });
  //   }
  // }, [error]);

  return (
    <div
      className="min-h-screen text-white relative overflow-hidden bg-[url('/images/bg_effect.png')]"
      style={{
        background:
          'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%), url("/images/bg_effect.png")',
        backgroundBlendMode: "overlay",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 pt-12">
        <div className="flex items-center space-x-3">
          <div className="w-16 h-12 rounded-full flex items-center justify-center overflow-hidden">
            <Link href="/">
              <img src="/images/logo.png" alt="" />
            </Link>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {process.env.NEXT_PUBLIC_ENVIRONMENT === "development" && (
            <Link href="/preview-game">
              <button className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-purple-500/30">
                🎮 Preview Game
              </button>
            </Link>
          )}
          {isConnected && address && (
            <ProfileDropdown address={address} />
          )}
        </div>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <div className="text-center mb-2">
            <h1 className="text-4xl font-bold mb-2">Welcome Back!</h1>
            <p className="text-gray-300 text-lg">Ready to challenge?</p>
          </div>
          <WalletConnection />
        </div>
      ) : (
        <div className="px-6">
          {/* Main Action Cards */}
          <div className="space-y-4 mb-8">
            {/* Create a Room Card */}
            <div
              className="h-28 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
              style={{
                background: 'radial-gradient(73.45% 290.46% at 73.45% 17.68%, #9E2B31 0%, #D4D42E 100%)'
              }}
              onClick={createGame}
            >
              <div className="absolute left-0 top-0 opacity-100">
                <div className="w-24 h-28 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <img 
                    src="/images/hand_uno.png" 
                    className="w-full h-full object-cover" 
                    style={{maskImage: 'linear-gradient(to left, transparent 0%, black 50%)'}}
                  />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="text-white text-xl font-bold mb-2 text-end">
                  Create a Room
                </h3>
                <p className="text-white/80 text-sm text-end">
                  bring along the fun with your folks
                </p>
              </div>
              {createLoading && (
                <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                  <div className="text-white font-medium">Creating...</div>
                </div>
              )}
            </div>

            {/* Quick Game Card */}
            <div
              className="h-28 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
              style={{
                background: 'radial-gradient(39.28% 143.53% at 36% -12.35%, #2E94D4 0%, #410B4A 100%)'
              }}
              onClick={startComputerGame}
            >
              <div className="absolute right-0 top-0 opacity-100">
                <div className="w-24 h-28 rounded-lg flex items-center justify-center">
                  <img 
                  src="/images/bot_uno.png"
                  className="w-full h-full object-cover" 
                  style={{maskImage: 'linear-gradient(to right, transparent 0%, black 50%)'}}
                  />
                </div>
              </div>
              <div className="relative z-10 ">
                <h3 className="text-white text-xl font-bold mb-2">
                  Quick Game
                </h3>
                <p className="text-white/80 text-sm">
                  beat the bot and bake a win !
                </p>
              </div>
              {computerCreateLoading && (
                <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                  <div className="text-white font-medium">Creating...</div>
                </div>
              )}
            </div>
          </div>

          {/* Tabs Section */}
          <div className="mb-6">
            <div className="flex space-x-8">
              <button className="text-white font-semibold text-lg border-b-2 border-white pb-2">
                ROOMS
              </button>
            </div>
          </div>

          {/* Room Cards Grid */}
          <div className="grid grid-cols-2 gap-4 mb-24 h-[calc(100vh-500px)] overflow-y-auto grid-rows-[7rem]">
            {activeGames && activeGames?.length > 0 ? (
              activeGames.toReversed().map((game, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br h-28 from-purple-600/20 to-purple-800/20 backdrop-blur-sm rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border border-purple-500/30"
                  onClick={() => joinGame(game)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-bold text-lg">
                      #{game.toString()}
                    </h3>
                    {/* <span className="text-gray-300 text-sm">{Math.floor(Math.random() * 20) + 1}m</span> */}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">👤</span>
                    </div>
                    <div className="text-white">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M9 18L15 12L9 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                  {joiningGameId !== null &&
                    joiningGameId === game && (
                      <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                        <div className="text-white font-medium">Joining...</div>
                      </div>
                    )}
                </div>
              ))
            ) : (
              // Placeholder rooms when no games available
              <>
                    <div className="flex items-center justify-between">
                      <div className="text-gray-400 text-sm">
                        No room available
                      </div>
                    </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* <BottomNavigation /> */}
      <Toaster />
      <LowBalanceDrawer 
        open={showLowBalanceDrawer} 
        onClose={() => setShowLowBalanceDrawer(false)} 
      />
    </div>
  );
}
