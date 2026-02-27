"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  useReadContract,
} from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { unoGameABI } from "@/constants/unogameabi";
import ProfileDropdown from "@/components/profileDropdown";
import { socketManager } from "@/services/socket";
import { AddToFarcaster } from "@/components/AddToFarcaster";
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
import { encodeFunctionData, keccak256, toBytes, toHex, stringToHex } from "viem";

// GameCreated event signature - now includes isPrivate param
const GAME_CREATED_EVENT_SIGNATURE = keccak256(
  toBytes("GameCreated(uint256,address,bool)")
);

/**
 * Generate a random 8-character alphanumeric game code
 */
function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I/O/0/1 to avoid confusion
  let code = "";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

/**
 * Extract gameId from transaction receipt logs
 * GameCreated(uint256 indexed gameId, address indexed creator, bool isPrivate)
 * Topics: [eventSignature, gameId, creator]
 */
function extractGameIdFromLogs(
  logs: any[],
  contractAddress?: string
): bigint | null {
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (log.topics && log.topics.length >= 2) {
      const eventSig = log.topics[0]?.toLowerCase();
      const expectedSig = GAME_CREATED_EVENT_SIGNATURE.toLowerCase();

      if (eventSig === expectedSig) {
        if (
          contractAddress &&
          log.address?.toLowerCase() !== contractAddress.toLowerCase()
        ) {
          continue;
        }
        const gameIdHex = log.topics[1];
        if (gameIdHex) {
          return BigInt(gameIdHex);
        }
      }
    }
  }
  console.error("Could not find GameCreated event in logs");
  return null;
}

type LobbyTab = "public" | "my-games";

const GAMES_PER_PAGE = 10;

export default function PlayGame() {
  const [createLoading, setCreateLoading] = useState(false);
  const [computerCreateLoading, setComputerCreateLoading] = useState(false);
  const [joiningGameId, setJoiningGameId] = useState<BigInt | null>(null);
  const [deletingGameId, setDeletingGameId] = useState<BigInt | null>(null);
  const [gameId, setGameId] = useState<BigInt | null>(null);
  const [isMiniPayWallet, setIsMiniPayWallet] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const [cusdBalance, setCusdBalance] = useState<string>("");
  const [miniPayAddress, setMiniPayAddress] = useState<string | null>(null);

  // Lobby state
  const [activeTab, setActiveTab] = useState<LobbyTab>("public");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isPrivateGame, setIsPrivateGame] = useState(false);
  const [maxPlayersSelection, setMaxPlayersSelection] = useState(4);
  const [generatedCode, setGeneratedCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinCodeGameId, setJoinCodeGameId] = useState("");
  const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
  const [displayCount, setDisplayCount] = useState(GAMES_PER_PAGE);
  const scrollRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  const { address: wagmiAddress, isConnected: wagmiConnected, chain: walletChain } = useAccount();
  const { authenticated, ready: privyReady, connectWallet } = usePrivy();
  
  // User is "wallet ready" when authenticated via Privy AND wagmi has an address.
  // During network switches, wagmi may briefly disconnect — use `authenticated` as
  // the stable signal so the user isn't bounced back to the connect screen.
  const isWalletReady = authenticated && (wagmiConnected && !!wagmiAddress);
  
  // Auto-reconnect: If user is authenticated via Privy but wagmi lost connection
  // (e.g. after page reload or network switch), prompt Privy to reconnect the wallet.
  useEffect(() => {
    if (privyReady && authenticated && !wagmiConnected) {
      // Small delay to let Privy's wagmi adapter sync first
      const timer = setTimeout(() => {
        connectWallet();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [privyReady, authenticated, wagmiConnected, connectWallet]);
  
  const chainId = walletChain?.id || 84532; // Base Sepolia
  const address =
    isMiniPayWallet && miniPayAddress ? miniPayAddress : wagmiAddress;
  const { data: walletClient } = useWalletClient();
  const { account: recoilAccount } = useUserAccount();
  const { sendTransactionAsync: sendWagmiTransaction } =
    useWagmiSendTransaction();
  const publicClient = usePublicClient({ chainId });
  const { toast } = useToast();
  const { connect, connectors } = useConnect();

  // Detect MiniPay on mount
  useEffect(() => {
    const initMiniPay = async () => {
      if (typeof window !== "undefined" && isMiniPay()) {
        setIsMiniPayWallet(true);
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

  const contractAddress = getContractAddress(chainId) as `0x${string}`;

  // Fetch public not-started games for "Browse Public" tab
  const { data: publicGamesRaw, refetch: refetchPublicGames } = useReadContract({
    address: contractAddress,
    abi: unoGameABI,
    functionName: "getPublicNotStartedGames",
    chainId,
  });
  const publicGames = publicGamesRaw as readonly bigint[] | undefined;

  // Fetch games by creator for "My Games" tab
  const { data: myGamesRaw, refetch: refetchMyGames } = useReadContract({
    address: contractAddress,
    abi: unoGameABI,
    functionName: "getGamesByCreator",
    args: [(address || "0x0000000000000000000000000000000000000000") as `0x${string}`],
    query: { enabled: !!address },
    chainId,
  });
  const myGames = myGamesRaw as readonly bigint[] | undefined;

  const refetchGames = useCallback(() => {
    refetchPublicGames();
    if (address) refetchMyGames();
  }, [refetchPublicGames, refetchMyGames, address]);

  // Auto-refetch every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchGames();
    }, 3000);
    return () => clearInterval(interval);
  }, [refetchGames]);

  // Socket listener for game room created
  useEffect(() => {
    const handleGameRoomCreated = () => {
      refetchGames();
    };
    socketManager.on("gameRoomCreated", handleGameRoomCreated);
    return () => {
      socketManager.off("gameRoomCreated", handleGameRoomCreated);
    };
  }, [refetchGames]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      setDisplayCount((prev) => prev + GAMES_PER_PAGE);
    }
  }, []);

  // Reset display count when tab changes
  useEffect(() => {
    setDisplayCount(GAMES_PER_PAGE);
  }, [activeTab]);

  /**
   * Send a transaction via MiniPay or browser wallet
   */
  const sendTransaction = useCallback(
    async (data: `0x${string}`): Promise<`0x${string}`> => {
      const contractAddr = getContractAddress(chainId) as `0x${string}`;

      if (isMiniPayWallet && address) {
        const hash = await sendMiniPayTransaction(
          contractAddr,
          data,
          address as string,
          chainId
        );
        return hash as `0x${string}`;
      } else if (isWalletReady && address) {
        const hash = await sendWagmiTransaction({
          to: contractAddr,
          data,
        });
        return hash;
      }
      throw new Error("Wallet not connected");
    },
    [
      chainId,
      isMiniPayWallet,
      address,
      isWalletReady,
      sendMiniPayTransaction,
      sendWagmiTransaction,
    ]
  );

  /**
   * Wait for transaction confirmation
   */
  const waitForReceipt = useCallback(
    async (hash: `0x${string}`) => {
      if (publicClient) {
        return await publicClient.waitForTransactionReceipt({ hash });
      }
      return null;
    },
    [publicClient]
  );

  // ========================================
  // GAME ACTIONS
  // ========================================

  const openCreateModal = () => {
    setIsPrivateGame(false);
    setMaxPlayersSelection(4);
    setGeneratedCode("");
    setCodeCopied(false);
    setShowCreateModal(true);
  };

  const handleTogglePrivate = (isPrivate: boolean) => {
    setIsPrivateGame(isPrivate);
    if (isPrivate && !generatedCode) {
      setGeneratedCode(generateGameCode());
    }
    setCodeCopied(false);
  };

  const copyGameCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCodeCopied(true);
    toast({
      title: "Code Copied",
      description: "Game code copied to clipboard. Share it with friends!",
      duration: 3000,
    });
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const createGame = async () => {
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

      if (!isSupportedChain(chainId)) {
        throw new Error(
          `Unsupported network. Supported: ${getSupportedChainIds().join(", ")}`
        );
      }

      let data: `0x${string}`;
      if (isPrivateGame) {
        const codeHash = keccak256(toBytes(generatedCode));
        data = encodeFunctionData({
          abi: unoGameABI,
          functionName: "createGame",
          args: [address as `0x${string}`, false, true, codeHash, BigInt(maxPlayersSelection)],
        });
      } else {
        data = encodeFunctionData({
          abi: unoGameABI,
          functionName: "createGame",
          args: [address as `0x${string}`, false, false, "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`, BigInt(maxPlayersSelection)],
        });
      }

      setTransactionStatus("Sending transaction...");
      const hash = await sendTransaction(data);

      toast({
        title: "Transaction Sent!",
        description: "Waiting for confirmation...",
        duration: 5000,
      });

      const receipt = await waitForReceipt(hash);
      if (receipt) {
        if (receipt.status === "reverted") {
          throw new Error("Transaction reverted on-chain. Game was not created.");
        }
        const newGameId = extractGameIdFromLogs(
          receipt.logs,
          contractAddress
        );
        if (newGameId) {
          const gameIdStr = newGameId.toString();
          setGameId(newGameId);

          // Register game code with backend for private games
          socketManager.emit(
            "createGameRoom",
            { gameId: gameIdStr, isPrivate: isPrivateGame, gameCode: isPrivateGame ? generatedCode : undefined },
            (response: { gameCode?: string }) => {
              if (isPrivateGame && response?.gameCode) {
                console.log("Backend game code registered:", response.gameCode);
              }
            }
          );

          toast({
            title: "Game Created!",
            description: isPrivateGame
              ? `Private game created (Game #${gameIdStr}). Code: ${generatedCode}`
              : `Public game #${gameIdStr} created. Redirecting...`,
            duration: 5000,
            variant: "success",
          });
          setShowCreateModal(false);
          router.push(`/game/${gameIdStr}`);
        } else {
          toast({
            title: "Warning",
            description:
              "Game created but could not get game ID. Check your games.",
            variant: "default",
            duration: 5000,
          });
        }
        refetchGames();
      }
    } catch (error: any) {
      console.error("Failed to create game:", error);
      toast({
        title: "Failed to Create Game",
        description: error?.message || "Please try again",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setCreateLoading(false);
      setTransactionStatus("");
    }
  };

  const startComputerGame = async () => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to play against computer.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    try {
      setComputerCreateLoading(true);
      const data = encodeFunctionData({
        abi: unoGameABI,
        functionName: "createGame",
        args: [address as `0x${string}`, true],
      });

      const hash = await sendTransaction(data);
      toast({
        title: "Transaction Sent!",
        description: "Waiting for confirmation...",
        duration: 5000,
      });

      const receipt = await waitForReceipt(hash);
      if (receipt) {
        if (receipt.status === "reverted") {
          throw new Error("Transaction reverted on-chain. Game was not created.");
        }
        const newGameId = extractGameIdFromLogs(
          receipt.logs,
          contractAddress
        );
        if (newGameId) {
          const gameIdStr = newGameId.toString();
          setGameId(newGameId);
          socketManager.emit("createComputerGame", {
            gameId: gameIdStr,
            playerAddress: address,
          });
          router.push(`/game/${gameIdStr}?mode=computer`);
        }
        refetchGames();
      }
    } catch (error: any) {
      console.error("Failed to create computer game:", error);
      toast({
        title: "Failed to Start Computer Game",
        description: error?.message || "Please try again",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setComputerCreateLoading(false);
    }
  };

  /**
   * Join or enter a game. If the user is already in the game (e.g. creator),
   * skip the on-chain joinGame call and redirect directly.
   */
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

    const gameIdStr = gameId.toString();

    // Check if user is the creator / already in this game
    const isCreator = myGames && myGames.some(
      (g: bigint) => g.toString() === gameIdStr
    );
    if (isCreator) {
      // Owner already joined during createGame — skip on-chain call
      router.push(`/game/${gameIdStr}`);
      return;
    }

    try {
      setJoiningGameId(gameId);
      const data = encodeFunctionData({
        abi: unoGameABI,
        functionName: "joinGame",
        args: [BigInt(gameIdStr), address as `0x${string}`],
      });

      const hash = await sendTransaction(data);
      toast({
        title: "Transaction Sent!",
        description: "Waiting for confirmation...",
        duration: 5000,
      });

      const joinReceipt = await waitForReceipt(hash);
      if (joinReceipt?.status === "reverted") {
        // Check if it's because user is already in the game
        // (edge case: myGames wasn't refreshed yet)
        router.push(`/game/${gameIdStr}`);
        return;
      }
      toast({
        title: "Joined!",
        description: "Redirecting to game...",
        duration: 3000,
        variant: "success",
      });
      setJoiningGameId(null);
      router.push(`/game/${gameIdStr}`);
    } catch (error: any) {
      console.error("Failed to join game:", error);
      const errorMessage = error?.message || "";
      if (
        errorMessage.includes("AlreadyJoined") ||
        errorMessage.includes("already joined") ||
        errorMessage.includes("reverted")
      ) {
        toast({
          title: "Already in this game!",
          description: "Redirecting to game room...",
          duration: 3000,
        });
        setJoiningGameId(null);
        router.push(`/game/${gameIdStr}`);
        return;
      }
      setJoiningGameId(null);
      toast({
        title: "Failed to Join Game",
        description: error?.message || "Please try again",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const joinGameWithCode = async () => {
    if (!address || !joinCodeInput) {
      toast({
        title: "Missing Information",
        description: "Please enter the game code.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    try {
      let resolvedGameId = joinCodeGameId;

      // If no game ID provided, look it up from the backend via game code
      if (!resolvedGameId) {
        const lookupResult = await new Promise<{ gameId?: string; error?: string }>((resolve) => {
          let resolved = false;
          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve({ error: "Lookup timed out. Please enter the Game ID manually." });
            }
          }, 8000);

          socketManager.emit("validateGameCode", { gameCode: joinCodeInput }, (response: any) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              resolve(response || { error: "No response from server" });
            }
          });
        });

        if (lookupResult.error || !lookupResult.gameId) {
          toast({
            title: "Invalid Game Code",
            description: lookupResult.error || "Could not find a game with that code.",
            variant: "destructive",
            duration: 5000,
          });
          return;
        }
        resolvedGameId = lookupResult.gameId;
      }

      const gId = BigInt(resolvedGameId);
      setJoiningGameId(gId);
      const data = encodeFunctionData({
        abi: unoGameABI,
        functionName: "joinGameWithCode",
        args: [gId, address as `0x${string}`, joinCodeInput],
      });

      const hash = await sendTransaction(data);
      toast({
        title: "Transaction Sent!",
        description: "Verifying game code...",
        duration: 5000,
      });

      const joinCodeReceipt = await waitForReceipt(hash);
      if (joinCodeReceipt?.status === "reverted") {
        // May be AlreadyJoined — redirect anyway
        router.push(`/game/${gId.toString()}`);
        setShowJoinCodeModal(false);
        setJoinCodeInput("");
        setJoinCodeGameId("");
        setJoiningGameId(null);
        return;
      }
      toast({
        title: "Joined Private Game!",
        description: "Redirecting to game...",
        duration: 3000,
        variant: "success",
      });
      setShowJoinCodeModal(false);
      setJoinCodeInput("");
      setJoinCodeGameId("");
      setJoiningGameId(null);
      router.push(`/game/${gId.toString()}`);
    } catch (error: any) {
      console.error("Failed to join with code:", error);
      const errorMessage = error?.message || "";
      if (errorMessage.includes("InvalidGameCode")) {
        toast({
          title: "Invalid Game Code",
          description: "The game code you entered is incorrect.",
          variant: "destructive",
          duration: 5000,
        });
      } else if (
        errorMessage.includes("AlreadyJoined") ||
        errorMessage.includes("already joined")
      ) {
        toast({
          title: "Already in this game!",
          description: "Redirecting...",
          duration: 3000,
        });
        setShowJoinCodeModal(false);
        router.push(`/game/${joinCodeGameId}`);
      } else {
        toast({
          title: "Failed to Join",
          description: error?.message || "Please try again",
          variant: "destructive",
          duration: 5000,
        });
      }
      setJoiningGameId(null);
    }
  };

  const deleteGame = async (gameId: BigInt) => {
    if (!address) return;

    try {
      setDeletingGameId(gameId);
      const data = encodeFunctionData({
        abi: unoGameABI,
        functionName: "deleteGame",
        args: [BigInt(gameId.toString())],
      });

      const hash = await sendTransaction(data);
      toast({
        title: "Deleting Game...",
        description: "Waiting for confirmation...",
        duration: 5000,
      });

      const deleteReceipt = await waitForReceipt(hash);
      if (deleteReceipt?.status === "reverted") {
        throw new Error("Transaction reverted on-chain. Failed to delete game.");
      }

      // Clean up game code on backend
      socketManager.emit("deleteGameCode", { gameId: gameId.toString() });

      toast({
        title: "Game Deleted",
        description: `Game #${gameId.toString()} has been deleted.`,
        duration: 3000,
        variant: "success",
      });
      refetchGames();
    } catch (error: any) {
      console.error("Failed to delete game:", error);
      toast({
        title: "Failed to Delete",
        description: error?.message || "Please try again",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setDeletingGameId(null);
    }
  };

  // ========================================
  // RENDER
  // ========================================

  const currentGames =
    activeTab === "public" ? publicGames : myGames;
  const displayedGames = currentGames
    ? [...currentGames].reverse().slice(0, displayCount)
    : [];
  const hasMore = currentGames
    ? displayCount < currentGames.length
    : false;

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
                Preview Game
              </button>
            </Link>
          )}
          {isWalletReady && address && <ProfileDropdown address={address} />}
        </div>
      </div>

      {!privyReady ? (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : authenticated && !wagmiConnected ? (
        // User is authenticated via Privy but wagmi hasn't synced yet
        // (happens during network switch or page reload) — show loading, not connect screen
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold mb-2">Reconnecting Wallet...</h1>
            <p className="text-gray-400 text-sm">Please wait while we restore your session</p>
          </div>
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : !isWalletReady ? (
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
      ) : false ? (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold mb-2">Loading Network...</h1>
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-4"></div>
          </div>
        </div>
      ) : (
        <>
          {/* MiniPay Status */}
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
                      Gas fees in cUSD
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="px-6">
            {/* Main Action Cards */}
            <div className="space-y-4 mb-6">
              {/* Create a Room Card */}
              <div
                className="h-28 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
                style={{
                  background:
                    "radial-gradient(73.45% 290.46% at 73.45% 17.68%, #9E2B31 0%, #D4D42E 100%)",
                }}
                onClick={openCreateModal}
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
                    public or private - you choose
                  </p>
                </div>
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
                <div className="relative z-10">
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

            {/* Join by Code Button */}
            <div className="mb-4">
              <button
                onClick={() => setShowJoinCodeModal(true)}
                className="w-full py-3 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 border border-indigo-500/30 rounded-xl text-white font-medium transition-all duration-200"
              >
                Join Private Game with Code
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-4">
              <div className="flex space-x-1 bg-white/5 rounded-xl p-1">
                <button
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === "public"
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                  onClick={() => setActiveTab("public")}
                >
                  Browse Public
                </button>
                <button
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === "my-games"
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                  onClick={() => setActiveTab("my-games")}
                >
                  My Games
                </button>
              </div>
            </div>

            {/* Games Grid with Infinite Scroll */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="grid grid-cols-2 gap-4 mb-24 h-[calc(100vh-520px)] overflow-y-auto"
            >
              {displayedGames.length > 0 ? (
                <>
                  {displayedGames.map((game, index) => {
                    const isMyGame =
                      activeTab === "my-games" ||
                      (address &&
                        myGames &&
                        myGames.some(
                          (g: bigint) => g.toString() === game.toString()
                        ));

                    return (
                      <div
                        key={`${activeTab}-${game.toString()}`}
                        className="bg-gradient-to-br h-32 from-purple-600/20 to-purple-800/20 backdrop-blur-sm rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border border-purple-500/30 relative"
                        onClick={() => joinGame(game)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-white font-bold text-lg">
                            #{game.toString()}
                          </h3>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                              {activeTab === "public" ? "Public" : "Lobby"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-red-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">P</span>
                            </div>
                            <span className="text-xs text-gray-300">
                              Waiting...
                            </span>
                          </div>
                          {isMyGame && activeTab === "my-games" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteGame(game);
                              }}
                              className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded-lg transition-all"
                              disabled={
                                deletingGameId !== null &&
                                deletingGameId.toString() === game.toString()
                              }
                            >
                              {deletingGameId !== null &&
                              deletingGameId.toString() === game.toString()
                                ? "..."
                                : "Delete"}
                            </button>
                          )}
                          {!isMyGame && (
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
                          )}
                        </div>
                        {joiningGameId !== null &&
                          joiningGameId.toString() === game.toString() && (
                            <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                              <div className="text-white font-medium">
                                Joining...
                              </div>
                            </div>
                          )}
                      </div>
                    );
                  })}
                  {hasMore && (
                    <div className="col-span-2 flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </>
              ) : (
                <div className="col-span-2 flex flex-col items-center justify-center py-12 text-gray-400">
                  <p className="text-sm">
                    {activeTab === "public"
                      ? "No public games available"
                      : "You haven't created any games yet"}
                  </p>
                  <p className="text-xs mt-1 text-gray-500">
                    {activeTab === "public"
                      ? "Create one to get started!"
                      : "Create a game above"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Create Game Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gradient-to-b from-[#1a1a3e] to-[#0f0c29] border border-purple-500/30 rounded-2xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold text-white mb-4">
                  Create Game Room
                </h2>

                {/* Public/Private Toggle */}
                <div className="mb-4">
                  <label className="text-sm text-gray-300 mb-2 block">
                    Game Visibility
                  </label>
                  <div className="flex space-x-1 bg-white/5 rounded-xl p-1">
                    <button
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        !isPrivateGame
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "text-gray-400 hover:text-white"
                      }`}
                      onClick={() => handleTogglePrivate(false)}
                    >
                      Public
                    </button>
                    <button
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isPrivateGame
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "text-gray-400 hover:text-white"
                      }`}
                      onClick={() => handleTogglePrivate(true)}
                    >
                      Private
                    </button>
                  </div>
                </div>

                {/* Number of Players */}
                <div className="mb-6">
                  <label className="text-sm text-gray-300 mb-2 block">
                    Number of Players
                  </label>
                  <div className="flex space-x-1 bg-white/5 rounded-xl p-1">
                    {[2, 3, 4].map((num) => (
                      <button
                        key={num}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          maxPlayersSelection === num
                            ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                            : "text-gray-400 hover:text-white"
                        }`}
                        onClick={() => setMaxPlayersSelection(num)}
                      >
                        {num} Players
                      </button>
                    ))}
                  </div>
                </div>

                {/* Game Code Display for Private */}
                {isPrivateGame && generatedCode && (
                  <div className="mb-6 bg-white/5 rounded-xl p-4 border border-amber-500/20">
                    <label className="text-xs text-gray-400 mb-1 block">
                      Game Code (share with friends)
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="text-2xl font-mono font-bold text-amber-400 tracking-widest flex-1 text-center">
                        {generatedCode}
                      </code>
                      <button
                        onClick={copyGameCode}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          codeCopied
                            ? "bg-green-500/20 text-green-400"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        {codeCopied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Only players with this code can join your game
                    </p>
                  </div>
                )}

                {/* Description */}
                <p className="text-sm text-gray-400 mb-6">
                  {isPrivateGame
                    ? "A private game requires players to enter the game code to join. Share the code with your friends."
                    : "Anyone can browse and join a public game from the lobby."}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createGame}
                    disabled={createLoading}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-white font-medium transition-all disabled:opacity-50"
                  >
                    {createLoading
                      ? "Creating..."
                      : `Create ${isPrivateGame ? "Private" : "Public"} Game`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Join with Code Modal */}
          {showJoinCodeModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gradient-to-b from-[#1a1a3e] to-[#0f0c29] border border-purple-500/30 rounded-2xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold text-white mb-4">
                  Join Private Game
                </h2>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">
                      Game Code
                    </label>
                    <input
                      type="text"
                      value={joinCodeInput}
                      onChange={(e) =>
                        setJoinCodeInput(e.target.value.toUpperCase())
                      }
                      placeholder="Enter 8-character code"
                      maxLength={8}
                      className="w-full bg-white/5 border border-purple-500/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 font-mono text-lg tracking-widest text-center uppercase transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">
                      Game ID <span className="text-gray-500">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={joinCodeGameId}
                      onChange={(e) =>
                        setJoinCodeGameId(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="Auto-detected from code"
                      className="w-full bg-white/5 border border-purple-500/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowJoinCodeModal(false);
                      setJoinCodeInput("");
                      setJoinCodeGameId("");
                    }}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={joinGameWithCode}
                    disabled={
                      joinCodeInput.length !== 8 ||
                      joiningGameId !== null
                    }
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-white font-medium transition-all disabled:opacity-50"
                  >
                    {joiningGameId !== null ? "Joining..." : "Join Game"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <Toaster />
    </div>
  );
}
