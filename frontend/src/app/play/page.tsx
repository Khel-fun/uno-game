"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useUserAccount } from "@/userstate/useUserAccount";
import { WalletConnection } from "@/components/WalletConnection";
import {
  useConnect,
  useWalletClient,
  useAccount,
  useSendTransaction as useWagmiSendTransaction,
  usePublicClient,
} from "wagmi";
import Link from "next/link";
import { client } from "@/utils/thirdWebClient";
import { unoGameABI } from "@/constants/unogameabi";
import { getNetworkForChain } from "@/utils/networkUtils";
import { useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import ProfileDropdown from "@/components/profileDropdown";
import { socketManager } from "@/services/socket";
import { AddToFarcaster } from "@/components/AddToFarcaster";
import NetworkDropdown from "@/components/NetworkDropdown";
import {
  getContractAddress,
  isSupportedChain,
  getSupportedChainIds,
} from "@/config/networks";
import {
  isMiniPay,
  supportsFeeAbstraction,
  getFeeCurrency,
  sendMiniPayTransaction,
  checkCUSDBalance,
  getMiniPayAddress,
} from "@/utils/miniPayUtils";
import { encodeFunctionData, decodeEventLog, keccak256, toBytes } from "viem";
import { useNetworkSelection } from "@/hooks/useNetworkSelection";

// GameCreated event signature hash - GameCreated(uint256 indexed gameId, address indexed creator)
const GAME_CREATED_EVENT_SIGNATURE = keccak256(toBytes("GameCreated(uint256,address)"));

/**
 * Extract gameId from transaction receipt logs
 * The GameCreated event has signature: GameCreated(uint256 indexed gameId, address indexed creator)
 * This creates 3 topics: [eventSignature, gameId, creator]
 */
function extractGameIdFromLogs(logs: any[], contractAddress?: string): bigint | null {
  // Find the GameCreated event log
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    
    // Check if this log matches our event signature
    if (log.topics && log.topics.length >= 2) {
      const eventSig = log.topics[0]?.toLowerCase();
      const expectedSig = GAME_CREATED_EVENT_SIGNATURE.toLowerCase();
      
      if (eventSig === expectedSig) {
        // If contract address provided, verify it matches
        if (contractAddress && log.address?.toLowerCase() !== contractAddress.toLowerCase()) {
          continue;
        }
        
        // Second topic is the gameId (indexed)
        const gameIdHex = log.topics[1];
        if (gameIdHex) {
          const gameId = BigInt(gameIdHex);
          return gameId;
        }
      }
    }
  }
  
  console.error("Could not find GameCreated event in logs");
  return null;
}

// DIAM wallet integration removed
export default function PlayGame() {
  const [open, setOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [computerCreateLoading, setComputerCreateLoading] = useState(false);
  const [joiningGameId, setJoiningGameId] = useState<BigInt | null>(null);
  const [gameId, setGameId] = useState<BigInt | null>(null);
  const [isMiniPayWallet, setIsMiniPayWallet] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const [cusdBalance, setCusdBalance] = useState<string>("");
  const [miniPayAddress, setMiniPayAddress] = useState<string | null>(null);
  const router = useRouter();

  // Get the network selected from dropdown
  const { selectedNetwork, isInitialized } = useNetworkSelection();
  
  // Use wagmi's useAccount directly for MiniPay compatibility
  const { address: wagmiAddress, isConnected, chain: walletChain } = useAccount();
  
  // Use wallet's actual chain for transactions, fallback to selected network for display
  const chainId = walletChain?.id || selectedNetwork.id;

  // Use MiniPay address if available, otherwise use wagmi address
  const address =
    isMiniPayWallet && miniPayAddress ? miniPayAddress : wagmiAddress;
  const { data: walletClient } = useWalletClient();
  const { account: recoilAccount } = useUserAccount();

  // Wagmi transaction hooks for wallet transactions
  const { sendTransactionAsync: sendWagmiTransaction } =
    useWagmiSendTransaction();
  // Use public client for the wallet's current chain
  const publicClient = usePublicClient({ chainId });

  const { toast } = useToast();

  // Using Wagmi hooks for wallet connection
  const { connect, connectors } = useConnect();

  // Detect MiniPay on mount and fetch address directly
  useEffect(() => {
    const initMiniPay = async () => {
      if (typeof window !== "undefined" && isMiniPay()) {
        setIsMiniPayWallet(true);

        // Fetch address directly from MiniPay
        const mpAddress = await getMiniPayAddress();
        setMiniPayAddress(mpAddress);
      }
    };

    initMiniPay();
  }, []);

  // Check cUSD balance for MiniPay users
  useEffect(() => {
    const loadBalance = async () => {
      if (isMiniPayWallet && address && chainId === 11142220) {
        const balance = await checkCUSDBalance(address, chainId);
        setCusdBalance(balance);
      }
    };
    loadBalance();
  }, [isMiniPayWallet, address, chainId]);

  // Use the selected network's chain for contract interactions
  const selectedChain = getNetworkForChain(chainId);
  const contractAddress = getContractAddress(chainId) as `0x${string}`;

  const contract = getContract({
    client,
    chain: selectedChain,
    address: contractAddress,
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
    // Clear previous errors and status
    setTransactionStatus("");

    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create a game.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    try {
      setCreateLoading(true);

      // Use MiniPay native transaction method for fee abstraction
      if (isMiniPayWallet && address) {
        setTransactionStatus("✓ Preparing transaction...");

        // Validate we're on a supported network
        if (!isSupportedChain(chainId)) {
          throw new Error(
            `Unsupported network! Please switch to a supported network. Current chain: ${chainId}, Supported: ${getSupportedChainIds().join(", ")}`,
          );
        }

        const contractAddress = getContractAddress(chainId) as `0x${string}`;

        if (!contractAddress) {
          throw new Error("Contract address not configured");
        }

        const data = encodeFunctionData({
          abi: unoGameABI,
          functionName: "createGame",
          args: [address as `0x${string}`, false],
        });

        setTransactionStatus(
          "⏳ Requesting transaction from MiniPay wallet...",
        );

        // MiniPay will handle balance checks and show appropriate errors
        // Use direct eth_sendTransaction for MiniPay
        const hash = await sendMiniPayTransaction(
          contractAddress,
          data,
          address as string,
          chainId,
        );

        setTransactionStatus(
          `✓ Transaction sent: ${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`,
        );

        toast({
          title: "Transaction Sent!",
          description: "Waiting for confirmation...",
          duration: 5000,
          variant: "default",
        });

        // Wait for transaction receipt using public client
        if (publicClient) {
          setTransactionStatus("⏳ Waiting for blockchain confirmation...");
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: hash as `0x${string}`,
          });
          setTransactionStatus("✓ Transaction confirmed!");

          toast({
            title: "Game created successfully!",
            description: "Redirecting to game...",
            duration: 5000,
            variant: "success",
          });

          const gameId = extractGameIdFromLogs(receipt.logs, contractAddress);

          if (gameId) {
            setGameId(gameId);
            router.push(`/game/${gameId}`);
          } else {
            console.error("Failed to extract gameId from transaction logs");
            toast({
              title: "Warning",
              description: "Game created but could not get game ID. Please check your games.",
              variant: "default",
              duration: 5000,
            });
          }

          refetchGames();
        }
        setCreateLoading(false);
      } else if (!isMiniPayWallet && isConnected && address) {
        // Use wagmi's sendTransaction for browser wallets
        const contractAddr = getContractAddress(chainId) as `0x${string}`;
        
        const data = encodeFunctionData({
          abi: unoGameABI,
          functionName: "createGame",
          args: [address as `0x${string}`, false],
        });

        try {
          const hash = await sendWagmiTransaction({
            to: contractAddr,
            data,
          });

          toast({
            title: "Transaction Sent!",
            description: "Waiting for confirmation...",
            duration: 5000,
            variant: "default",
          });

          if (publicClient) {
            const receipt = await publicClient.waitForTransactionReceipt({
              hash,
            });

            const gameId = extractGameIdFromLogs(receipt.logs, contractAddr);

            if (gameId) {
              setGameId(gameId);
              
              toast({
                title: "Game created successfully!",
                description: "Redirecting to game...",
                duration: 5000,
                variant: "success",
              });
              
              router.push(`/game/${gameId}`);
            } else {
              console.error("Failed to extract gameId from transaction logs");
              toast({
                title: "Warning",
                description: "Game created but could not get game ID. Please check your games.",
                variant: "default",
                duration: 5000,
              });
            }

            refetchGames();
          }
          setCreateLoading(false);
        } catch (txError) {
          console.error("Transaction failed:", txError);
          toast({
            title: "Error",
            description: "Failed to create game. Please try again.",
            variant: "destructive",
            duration: 5000,
          });
          setCreateLoading(false);
        }
      } else {
        throw new Error("Wallet not connected");
      }
    } catch (error: any) {
      console.error("Failed to create game:", error);
      setTransactionStatus(`❌ Error: ${error?.message || error?.toString()}`);

      toast({
        title: "❌ Failed to Create Game",
        description: error?.message || "Please try again",
        variant: "destructive",
        duration: 5000,
      });
      setCreateLoading(false);
    }
  };

  const startComputerGame = async () => {
    setComputerCreateLoading(true);
    if (contract && address) {
      try {
        // Use MiniPay native transaction method for fee abstraction
        if (isMiniPayWallet && address) {
          const contractAddr = getContractAddress(chainId) as `0x${string}`;
          const data = encodeFunctionData({
            abi: unoGameABI,
            functionName: "createGame",
            args: [address as `0x${string}`, true],
          });

          const hash = await sendMiniPayTransaction(
            contractAddr,
            data,
            address as string,
            chainId,
          );

          toast({
            title: "Transaction Sent!",
            description: "Waiting for confirmation...",
            duration: 5000,
            variant: "default",
          });

          if (publicClient) {
            const receipt = await publicClient.waitForTransactionReceipt({
              hash: hash as `0x${string}`,
            });

            toast({
              title: "Game created successfully!",
              description: "Starting computer game...",
              duration: 5000,
              variant: "success",
            });

            const gameId = extractGameIdFromLogs(receipt.logs, contractAddr);

            if (gameId) {
              setGameId(gameId);

              socketManager.emit("createComputerGame", {
                gameId: gameId.toString(),
                playerAddress: address,
              });

              router.push(`/game/${gameId}?mode=computer`);
            } else {
              console.error("Failed to extract gameId from transaction logs");
              toast({
                title: "Warning",
                description: "Game created but could not get game ID. Please check your games.",
                variant: "default",
                duration: 5000,
              });
            }

            refetchGames();
          }
          setComputerCreateLoading(false);
        } else if (isConnected && address) {
          // Use wagmi's sendTransaction for browser wallets
          const contractAddr = getContractAddress(chainId) as `0x${string}`;
          const data = encodeFunctionData({
            abi: unoGameABI,
            functionName: "createGame",
            args: [address as `0x${string}`, true],
          });

          try {
            const hash = await sendWagmiTransaction({
              to: contractAddr,
              data,
            });

            toast({
              title: "Transaction Sent!",
              description: "Waiting for confirmation...",
              duration: 5000,
              variant: "default",
            });

            if (publicClient) {
              const receipt = await publicClient.waitForTransactionReceipt({
                hash,
              });

              const gameId = extractGameIdFromLogs(receipt.logs, contractAddr);

              if (gameId) {
                setGameId(gameId);

                toast({
                  title: "Game created successfully!",
                  description: "Starting computer game...",
                  duration: 5000,
                  variant: "success",
                });

                socketManager.emit("createComputerGame", {
                  gameId: gameId.toString(),
                  playerAddress: address,
                });

                router.push(`/game/${gameId}?mode=computer`);
              } else {
                console.error("Failed to extract gameId from transaction logs");
                toast({
                  title: "Warning",
                  description: "Game created but could not get game ID. Please check your games.",
                  variant: "default",
                  duration: 5000,
                });
              }

              refetchGames();
            }
            setComputerCreateLoading(false);
          } catch (txError) {
            console.error("Transaction failed:", txError);
            toast({
              title: "Error",
              description: "Failed to create game. Please try again.",
              variant: "destructive",
              duration: 5000,
            });
            setComputerCreateLoading(false);
          }
        } else {
          throw new Error("Wallet not connected");
        }
      } catch (error: any) {
        console.error("Failed to create computer game:", error);
        console.error("Error details:", {
          message: error?.message,
          code: error?.code,
          data: error?.data,
        });

        const errorMessage =
          error?.message || error?.toString() || "Unknown error";
        const diagnostics = isMiniPayWallet
          ? `\n\nDiagnostics:\nChain: ${chainId}\nFee Currency: ${getFeeCurrency(chainId)}\nContract: ${getContractAddress(chainId)}\nWallet Client: ${walletClient ? "OK" : "Missing"}\nPublic Client: ${publicClient ? "OK" : "Missing"}\nError: ${errorMessage.substring(0, 150)}`
          : "";

        toast({
          title: "Failed to Start Computer Game",
          description: isMiniPayWallet
            ? diagnostics
            : `Failed to start computer game. ${errorMessage.substring(0, 100)}`,
          variant: "destructive",
          duration: 15000,
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

    try {
      setJoiningGameId(gameId);

      // Use MiniPay native transaction method for fee abstraction
      if (isMiniPayWallet && address) {
        const contractAddr = getContractAddress(chainId) as `0x${string}`;
        const data = encodeFunctionData({
          abi: unoGameABI,
          functionName: "joinGame",
          args: [BigInt(gameId.toString()), address as `0x${string}`],
        });

        const hash = await sendMiniPayTransaction(
          contractAddr,
          data,
          address as string,
          chainId,
        );

        toast({
          title: "Transaction Sent!",
          description: "Waiting for confirmation...",
          duration: 5000,
          variant: "default",
        });

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash: hash as `0x${string}`,
          });

          toast({
            title: "Game joined successfully!",
            description: "Redirecting to game...",
            duration: 5000,
            variant: "success",
          });
        }

        setJoiningGameId(null);
        router.push(`/game/${gameId}`);
      } else if (isConnected && address) {
        // Use wagmi's sendTransaction for browser wallets (works without thirdweb active account)
        const contractAddr = getContractAddress(chainId) as `0x${string}`;
        const data = encodeFunctionData({
          abi: unoGameABI,
          functionName: "joinGame",
          args: [BigInt(gameId.toString()), address as `0x${string}`],
        });

        try {
          const hash = await sendWagmiTransaction({
            to: contractAddr,
            data,
          });

          toast({
            title: "Transaction Sent!",
            description: "Waiting for confirmation...",
            duration: 5000,
            variant: "default",
          });

          if (publicClient) {
            await publicClient.waitForTransactionReceipt({
              hash,
            });
          }

          toast({
            title: "Game joined successfully!",
            description: "Redirecting to game...",
            duration: 5000,
            variant: "success",
          });

          setJoiningGameId(null);
          router.push(`/game/${gameId}`);
        } catch (txError: any) {
          console.error("Transaction failed:", txError);
          
          // Check if user is already joined (AlreadyJoined error)
          const errorMessage = txError?.message || txError?.toString() || "";
          if (errorMessage.includes("AlreadyJoined") || errorMessage.includes("already joined")) {
            toast({
              title: "Already in this game!",
              description: "Redirecting to game room...",
              duration: 3000,
              variant: "default",
            });
            setJoiningGameId(null);
            router.push(`/game/${gameId}`);
            return;
          }
          
          setJoiningGameId(null);
          toast({
            title: "Error",
            description: "Failed to join game. Please try again.",
            variant: "destructive",
            duration: 5000,
          });
        }
      } else {
        throw new Error("Wallet not connected");
      }
    } catch (error: any) {
      console.error("Failed to join game:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        data: error?.data,
      });

      // Check if user is already joined (AlreadyJoined error)
      const errorMessage = error?.message || error?.toString() || "";
      if (errorMessage.includes("AlreadyJoined") || errorMessage.includes("already joined")) {
        toast({
          title: "Already in this game!",
          description: "Redirecting to game room...",
          duration: 3000,
          variant: "default",
        });
        setJoiningGameId(null);
        router.push(`/game/${gameId}`);
        return;
      }

      setJoiningGameId(null);

      const errMsg =
        error?.message || error?.toString() || "Unknown error";
      const diagnostics = isMiniPayWallet
        ? `\n\nDiagnostics:\nChain: ${chainId}\nFee Currency: ${getFeeCurrency(chainId)}\nContract: ${getContractAddress(chainId)}\nWallet Client: ${walletClient ? "OK" : "Missing"}\nPublic Client: ${publicClient ? "OK" : "Missing"}\nError: ${errMsg.substring(0, 150)}`
        : "";

      toast({
        title: "Failed to Join Game",
        description: isMiniPayWallet
          ? diagnostics
          : `Failed to join game. ${errMsg.substring(0, 100)}`,
        variant: "destructive",
        duration: 15000,
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
          <AddToFarcaster variant="compact" />
          {process.env.NEXT_PUBLIC_ENVIRONMENT === "development" && (
            <Link href="/preview-game">
              <button className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-purple-500/30">
                🎮 Preview Game
              </button>
            </Link>
          )}
          <NetworkDropdown />
          {isConnected && address && <ProfileDropdown address={address} />}
        </div>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <div className="text-center mb-2">
            <h1 className="text-4xl font-bold mb-2">Welcome Back!</h1>
            <p className="text-gray-300 text-lg">Ready to challenge?</p>
          </div>
          {isMiniPayWallet && (
            <div className="mb-4 text-green-400 text-sm animate-pulse">
              Connecting to MiniPay...
            </div>
          )}
          <WalletConnection />
        </div>
      ) : !isInitialized ? (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold mb-2">Loading Network...</h1>
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-4"></div>
          </div>
        </div>
      ) : (
        <>
          {/* MiniPay Status Badge */}
          {isMiniPayWallet && (
            <div className="px-6 pb-2">
              <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-400 font-medium">
                    Connected via MiniPay
                  </span>
                  {supportsFeeAbstraction(chainId) && (
                    <span className="text-xs text-blue-300 ml-auto">
                      ⚡ Gas fees in cUSD
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="px-6">
            {/* Main Action Cards */}
            <div className="space-y-4 mb-8">
              {/* Create a Room Card */}
              <div
                className="h-28 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
                style={{
                  background:
                    "radial-gradient(73.45% 290.46% at 73.45% 17.68%, #9E2B31 0%, #D4D42E 100%)",
                }}
                onClick={createGame}
              >
                <div className="absolute left-0 top-0 opacity-100">
                  <div className="w-24 h-28 rounded-lg flex items-center justify-center relative overflow-hidden">
                    <img
                      src="/images/hand_uno.png"
                      className="w-full h-full object-cover"
                      style={{
                        maskImage:
                          "linear-gradient(to left, transparent 0%, black 50%)",
                      }}
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
                  background:
                    "radial-gradient(39.28% 143.53% at 36% -12.35%, #2E94D4 0%, #410B4A 100%)",
                }}
                onClick={startComputerGame}
              >
                <div className="absolute right-0 top-0 opacity-100">
                  <div className="w-24 h-28 rounded-lg flex items-center justify-center">
                    <img
                      src="/images/bot_uno.png"
                      className="w-full h-full object-cover"
                      style={{
                        maskImage:
                          "linear-gradient(to right, transparent 0%, black 50%)",
                      }}
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
                    {joiningGameId !== null && joiningGameId === game && (
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
        </>
      )}
      {/* <BottomNavigation /> */}
      <Toaster />
    </div>
  );
}
