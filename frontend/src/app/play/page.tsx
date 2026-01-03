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
  useChainId,
  useAccount,
  useSendTransaction as useWagmiSendTransaction,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import Link from "next/link";
import { useChains } from "wagmi";
import { client } from "@/utils/thirdWebClient";
import { celoSepolia } from "@/lib/chains";
import { unoGameABI } from "@/constants/unogameabi";
import { getSelectedNetwork } from "@/utils/networkUtils";
import { useReadContract, useSendTransaction } from "thirdweb/react";
import { waitForReceipt, getContract, prepareContractCall } from "thirdweb";
import ProfileDropdown from "@/components/profileDropdown";
import { useBalanceCheck } from "@/hooks/useBalanceCheck";
import { LowBalanceDrawer } from "@/components/LowBalanceDrawer";
import socket, { socketManager } from "@/services/socket";
import { AddToFarcaster } from "@/components/AddToFarcaster";
import NetworkDropdown from "@/components/NetworkDropdown";
import {
  isMiniPay,
  supportsFeeAbstraction,
  getFeeCurrency,
  sendMiniPayTransaction,
  verifyContractExists,
  checkCUSDBalance,
  getMiniPayAddress,
} from "@/utils/miniPayUtils";
import { encodeFunctionData } from "viem";

// DIAM wallet integration removed

export default function PlayGame() {
  const [open, setOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [computerCreateLoading, setComputerCreateLoading] = useState(false);
  const [joiningGameId, setJoiningGameId] = useState<BigInt | null>(null);
  const [gameId, setGameId] = useState<BigInt | null>(null);
  const [showLowBalanceDrawer, setShowLowBalanceDrawer] = useState(false);
  const [isMiniPayWallet, setIsMiniPayWallet] = useState(false);
  const [debugError, setDebugError] = useState<any>(null);
  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const [cusdBalance, setCusdBalance] = useState<string>("");
  const [miniPayAddress, setMiniPayAddress] = useState<string | null>(null);
  const { checkBalance } = useBalanceCheck();
  const router = useRouter();
  const chains = useChains();
  const chainId = useChainId();

  // Use wagmi's useAccount directly for MiniPay compatibility
  const { address: wagmiAddress, isConnected } = useAccount();

  // Use MiniPay address if available, otherwise use wagmi address
  const address =
    isMiniPayWallet && miniPayAddress ? miniPayAddress : wagmiAddress;
  const { data: walletClient } = useWalletClient();
  const { account: recoilAccount } = useUserAccount();
  const { mutate: sendTransaction } = useSendTransaction();

  // Wagmi transaction hooks for MiniPay (legacy transactions with feeCurrency)
  const { sendTransaction: sendWagmiTransaction, data: wagmiTxHash } =
    useWagmiSendTransaction();
  const publicClient = usePublicClient();

  const { toast } = useToast();

  // Using Wagmi hooks for wallet connection
  const { connect, connectors } = useConnect();

  // Detect MiniPay on mount and fetch address directly
  useEffect(() => {
    const initMiniPay = async () => {
      if (typeof window !== "undefined" && isMiniPay()) {
        console.log("[MiniPay] Detected on play page");
        setIsMiniPayWallet(true);

        // Fetch address directly from MiniPay
        const mpAddress = await getMiniPayAddress();
        console.log("[MiniPay] Address fetched:", mpAddress);
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

  const contract = getContract({
    client,
    chain: getSelectedNetwork(),
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
    // Clear previous errors and status
    setDebugError(null);
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

    // Skip balance check for MiniPay (uses cUSD fee abstraction)
    if (!isMiniPayWallet) {
      const hasSufficientBalance = await checkBalance();
      if (!hasSufficientBalance) {
        setShowLowBalanceDrawer(true);
        return;
      }
    }

    try {
      setCreateLoading(true);
      setDebugError(null); // Clear previous errors

      // Use MiniPay native transaction method for fee abstraction
      if (isMiniPayWallet && address) {
        setTransactionStatus("✓ Preparing transaction...");
        console.log("[MiniPay] Creating game transaction...");
        console.log("[MiniPay] Chain ID:", chainId);
        console.log("[MiniPay] Fee Currency:", getFeeCurrency(chainId));
        console.log("[MiniPay] Address:", address);

        // Validate we're on Celo Sepolia
        if (chainId !== 11142220) {
          throw new Error(
            `Wrong network! Please switch to Celo Sepolia (chain ID: 11142220). Current chain: ${chainId}`,
          );
        }

        const contractAddress = process.env
          .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

        if (!contractAddress) {
          throw new Error("Contract address not configured");
        }

        const data = encodeFunctionData({
          abi: unoGameABI,
          functionName: "createGame",
          args: [address as `0x${string}`, false],
        });

        console.log("[MiniPay] Contract Address:", contractAddress);
        console.log("[MiniPay] Transaction Data:", data);

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

        console.log("[MiniPay] Transaction sent! Hash:", hash);
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
          console.log("[MiniPay] Waiting for receipt...");
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: hash as `0x${string}`,
          });
          console.log("[MiniPay] Receipt received:", receipt);
          setTransactionStatus("✓ Transaction confirmed!");

          toast({
            title: "Game created successfully!",
            description: "Redirecting to game...",
            duration: 5000,
            variant: "success",
          });

          const gameCreatedId = receipt.logs.find(
            (log) => log.topics.length == 2 && log.topics[1],
          )?.topics[1];

          if (gameCreatedId) {
            const gameId = BigInt(gameCreatedId);
            setGameId(gameId);
            router.push(`/game/${gameId}`);
          }

          refetchGames();
        }
        setCreateLoading(false);
      } else if (!isMiniPayWallet) {
        // Use ThirdWeb for browser/Farcaster
        const transaction = prepareContractCall({
          contract: {
            address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
            abi: unoGameABI,
            chain: getSelectedNetwork(),
            client,
          },
          method: "createGame",
          params: [address as `0x${string}`, false],
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
              chain: getSelectedNetwork(),
              transactionHash: result.transactionHash,
            });

            const gameCreatedId = receipt.logs.find(
              (log) => log.topics.length == 2 && log.topics[1],
            )?.topics[1];

            if (gameCreatedId) {
              const gameId = BigInt(gameCreatedId);
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
          },
        });
      }
    } catch (error: any) {
      console.error("[MiniPay] Failed to create game:", error);
      setTransactionStatus(`❌ Error: ${error?.message || error?.toString()}`);

      // Store error details for display - THIS WILL SHOW ON THE PAGE
      const errorDetails = {
        action: "Create Game",
        timestamp: new Date().toISOString(),
        chainId,
        feeCurrency: getFeeCurrency(chainId),
        contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
        walletClient: walletClient ? "Connected" : "Missing",
        publicClient: publicClient ? "Connected" : "Missing",
        address: address,
        isMiniPayWallet,
        errorMessage: error?.message || error?.toString() || "Unknown error",
        errorCode: error?.code,
        errorData: JSON.stringify(error?.data),
        errorStack: error?.stack?.substring(0, 500),
      };

      console.log("[MiniPay] Full error details:", errorDetails);
      setDebugError(errorDetails);

      toast({
        title: "❌ Failed to Create Game",
        description: "Check error details on the page below",
        variant: "destructive",
        duration: 5000,
      });
      setCreateLoading(false);
    }
  };

  const startComputerGame = async () => {
    setComputerCreateLoading(true);
    if (contract && address) {
      // Skip balance check for MiniPay (uses cUSD fee abstraction)
      if (!isMiniPayWallet) {
        const hasSufficientBalance = await checkBalance();
        if (!hasSufficientBalance) {
          setShowLowBalanceDrawer(true);
          setComputerCreateLoading(false);
          return;
        }
      }

      try {
        // Use MiniPay native transaction method for fee abstraction
        if (isMiniPayWallet && address) {
          const contractAddress = process.env
            .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
          const data = encodeFunctionData({
            abi: unoGameABI,
            functionName: "createGame",
            args: [address as `0x${string}`, true],
          });

          console.log("[MiniPay] Creating computer game...");
          const hash = await sendMiniPayTransaction(
            contractAddress,
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

            const gameCreatedId = receipt.logs.find(
              (log) => log.topics.length == 2 && log.topics[1],
            )?.topics[1];

            if (gameCreatedId) {
              const gameId = BigInt(gameCreatedId);
              setGameId(gameId);

              socketManager.emit("createComputerGame", {
                gameId: gameId.toString(),
                playerAddress: address,
              });

              router.push(`/game/${gameId}?mode=computer`);
            }

            refetchGames();
          }
          setComputerCreateLoading(false);
        } else {
          // Use ThirdWeb for browser/Farcaster
          const transaction = prepareContractCall({
            contract: {
              address: process.env
                .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
              abi: unoGameABI,
              chain: getSelectedNetwork(),
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
                chain: getSelectedNetwork(),
                transactionHash: result.transactionHash,
              });

              const gameCreatedId = receipt.logs.find(
                (log) => log.topics.length == 2 && log.topics[1],
              )?.topics[1];

              if (gameCreatedId) {
                const gameId = BigInt(gameCreatedId);
                setGameId(gameId);

                socketManager.emit("createComputerGame", {
                  gameId: gameId.toString(),
                  playerAddress: address,
                });

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
            },
          });
        }

        // toast({
        //   title: "Computer Game Started",
        //   description: "Starting game against computer opponent!",
        //   duration: 3000,
        // });
      } catch (error: any) {
        console.error("[MiniPay] Failed to create computer game:", error);
        console.error("[MiniPay] Error details:", {
          message: error?.message,
          code: error?.code,
          data: error?.data,
        });

        const errorMessage =
          error?.message || error?.toString() || "Unknown error";
        const diagnostics = isMiniPayWallet
          ? `\n\nDiagnostics:\nChain: ${chainId}\nFee Currency: ${getFeeCurrency(chainId)}\nContract: ${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}\nWallet Client: ${walletClient ? "OK" : "Missing"}\nPublic Client: ${publicClient ? "OK" : "Missing"}\nError: ${errorMessage.substring(0, 150)}`
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

    // Skip balance check for MiniPay (uses cUSD fee abstraction)
    if (!isMiniPayWallet) {
      const hasSufficientBalance = await checkBalance();
      if (!hasSufficientBalance) {
        setShowLowBalanceDrawer(true);
        return;
      }
    }

    try {
      setJoiningGameId(gameId);

      // Use MiniPay native transaction method for fee abstraction
      if (isMiniPayWallet && address) {
        const contractAddress = process.env
          .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
        const data = encodeFunctionData({
          abi: unoGameABI,
          functionName: "joinGame",
          args: [BigInt(gameId.toString()), address as `0x${string}`],
        });

        console.log("[MiniPay] Joining game:", gameId);
        const hash = await sendMiniPayTransaction(
          contractAddress,
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

        router.push(`/game/${gameId}`);
      } else {
        // Use ThirdWeb for browser/Farcaster
        const transaction = prepareContractCall({
          contract: {
            address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
            abi: unoGameABI,
            chain: getSelectedNetwork(),
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
          },
        });
      }
    } catch (error: any) {
      console.error("[MiniPay] Failed to join game:", error);
      console.error("[MiniPay] Error details:", {
        message: error?.message,
        code: error?.code,
        data: error?.data,
      });

      setJoiningGameId(null);

      const errorMessage =
        error?.message || error?.toString() || "Unknown error";
      const diagnostics = isMiniPayWallet
        ? `\n\nDiagnostics:\nChain: ${chainId}\nFee Currency: ${getFeeCurrency(chainId)}\nContract: ${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}\nWallet Client: ${walletClient ? "OK" : "Missing"}\nPublic Client: ${publicClient ? "OK" : "Missing"}\nError: ${errorMessage.substring(0, 150)}`
        : "";

      toast({
        title: "Failed to Join Game",
        description: isMiniPayWallet
          ? diagnostics
          : `Failed to join game. ${errorMessage.substring(0, 100)}`,
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

                {/* MiniPay Diagnostics */}
                <div className="mt-3 pt-3 border-t border-green-500/20 text-xs text-gray-300 space-y-1">
                  <div className="font-semibold text-green-300 mb-2">
                    Debug Info:
                  </div>
                  <div>
                    <strong>Chain ID:</strong> {chainId}{" "}
                    {chainId === 11142220 ? (
                      <span className="text-green-400">✓ Celo Sepolia</span>
                    ) : (
                      <span className="text-red-400">
                        ✗ Wrong network! Switch to Celo Sepolia
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>cUSD Balance:</strong>{" "}
                    {cusdBalance ? (
                      <span
                        className={
                          parseFloat(cusdBalance) >= 0.01
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {parseFloat(cusdBalance) >= 0.01 ? "✓" : "✗"}{" "}
                        {cusdBalance} cUSD
                      </span>
                    ) : (
                      <span className="text-gray-400">Loading...</span>
                    )}
                    {cusdBalance && parseFloat(cusdBalance) < 0.01 && (
                      <div className="text-xs text-red-300 mt-1">
                        ⚠ Need at least 0.01 cUSD for transactions
                      </div>
                    )}
                  </div>
                  <div>
                    <strong>Fee Currency:</strong>{" "}
                    {getFeeCurrency(chainId) ? (
                      <span className="text-green-400">
                        ✓ {getFeeCurrency(chainId)?.substring(0, 10)}...
                      </span>
                    ) : (
                      <span className="text-red-400">✗ Not Available</span>
                    )}
                  </div>
                  <div>
                    <strong>Contract:</strong>{" "}
                    {process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ? (
                      <span className="text-green-400">
                        ✓{" "}
                        {process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.substring(
                          0,
                          10,
                        )}
                        ...
                      </span>
                    ) : (
                      <span className="text-red-400">✗ Not configured</span>
                    )}
                  </div>
                  <div>
                    <strong>Wallet Client:</strong>{" "}
                    {walletClient ? (
                      <span className="text-green-400">✓ Connected</span>
                    ) : (
                      <span className="text-yellow-400">⚠ Missing</span>
                    )}
                  </div>
                  <div>
                    <strong>Public Client:</strong>{" "}
                    {publicClient ? (
                      <span className="text-green-400">✓ Connected</span>
                    ) : (
                      <span className="text-yellow-400">⚠ Missing</span>
                    )}
                  </div>
                  {transactionStatus && (
                    <div className="mt-2 pt-2 border-t border-green-500/20">
                      <strong>Status:</strong>{" "}
                      <span className="text-yellow-300">
                        {transactionStatus}
                      </span>
                    </div>
                  )}
                  {chainId !== 11142220 && (
                    <div className="mt-2 p-2 bg-red-900/30 border border-red-500/50 rounded">
                      <strong className="text-red-400">⚠ Warning:</strong>
                      <div className="text-xs mt-1">
                        MiniPay only works on Celo Sepolia. Please switch
                        networks in Settings.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MiniPay Debug Error Display */}
          {isMiniPayWallet && debugError && (
            <div className="px-6 pb-4">
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-red-400 font-bold text-lg">
                    ⚠️ Error Details - {debugError.action}
                  </h3>
                  <button
                    onClick={() => setDebugError(null)}
                    className="text-red-300 hover:text-red-100"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-sm text-gray-300 space-y-1">
                  <div>
                    <strong>Time:</strong>{" "}
                    {new Date(debugError.timestamp).toLocaleTimeString()}
                  </div>
                  <div>
                    <strong>Chain ID:</strong> {debugError.chainId}
                  </div>
                  <div>
                    <strong>Fee Currency:</strong>{" "}
                    {debugError.feeCurrency || "Not set"}
                  </div>
                  <div>
                    <strong>Contract:</strong> {debugError.contractAddress}
                  </div>
                  <div>
                    <strong>Wallet Client:</strong> {debugError.walletClient}
                  </div>
                  <div>
                    <strong>Public Client:</strong> {debugError.publicClient}
                  </div>
                  <div className="pt-2 border-t border-red-500/30 mt-2">
                    <strong>Error Message:</strong>
                    <div className="bg-black/30 p-2 rounded mt-1 text-red-200 break-words max-h-40 overflow-y-auto">
                      {debugError.errorMessage}
                    </div>
                  </div>
                  {debugError.errorCode && (
                    <div>
                      <strong>Error Code:</strong> {debugError.errorCode}
                    </div>
                  )}
                  {debugError.errorData && (
                    <div className="pt-2">
                      <strong>Error Data:</strong>
                      <div className="bg-black/30 p-2 rounded mt-1 text-xs text-gray-400 break-words max-h-32 overflow-y-auto">
                        {JSON.stringify(debugError.errorData, null, 2)}
                      </div>
                    </div>
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
      <LowBalanceDrawer
        open={showLowBalanceDrawer}
        onClose={() => setShowLowBalanceDrawer(false)}
      />
    </div>
  );
}
