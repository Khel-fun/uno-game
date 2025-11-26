// Seed demo data into Convex (CommonJS for Node compatibility)
// Run: node scripts/seed.js

const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api.js");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

const argUrl = process.argv.find(a => a.startsWith("--url="))?.split("=")[1];
const url = argUrl || process.env.CONVEX_URL_OVERRIDE || process.env.CONVEX_URL;
if (!url) {
  console.error("CONVEX_URL not provided. Pass --url=... or set CONVEX_URL[_OVERRIDE] in .env.local");
  process.exit(1);
}

const DEMO_WALLET = process.env.DEMO_WALLET || "0x1234567890abcdef1234567890abcdef12345678";
const DEMO_GAME_ID = process.env.DEMO_GAME_ID || "123";
const DEMO_ROOM_ID = process.env.DEMO_ROOM_ID || "game-123";

const client = new ConvexHttpClient(url);

async function ensurePlayer(wallet) {
  const now = Date.now();
  try {
    const id = await client.mutation(api.players.upsert, {
      walletAddress: wallet,
      displayName: "Demo Player",
      currentGameId: undefined,
      seatIndex: 0,
      connected: true,
      lastSeen: now,
    });
    console.log("players.upsert:", id);
    return id;
  } catch (e) {
    console.error("players.upsert failed:", e.message);
    throw e;
  }
}

async function ensureGame(numericId, players) {
  try {
    const existing = await client.query(api.games.byNumericId, { gameNumericId: numericId });
    if (existing?._id) {
      console.log("games.byNumericId found:", existing._id);
      return existing;
    }
    const _id = await client.mutation(api.games.create, {
      roomId: DEMO_ROOM_ID,
      gameNumericId: numericId,
      players,
    });
    console.log("games.create:", _id);
    return await client.query(api.games.byNumericId, { gameNumericId: numericId });
  } catch (e) {
    console.error("ensureGame failed:", e.message);
    throw e;
  }
}

async function recordMoves(gameId, wallet) {
  const now = Date.now();
  try {
    await client.mutation(api.moves.record, {
      gameId,
      playerAddress: wallet,
      actionType: "startGame",
      createdAt: now,
    });
    await client.mutation(api.moves.record, {
      gameId,
      playerAddress: wallet,
      actionType: "playCard",
      cardHash: "cardHashValue",
      resultingStateHash: "stateHashDemo",
      createdAt: now + 1000,
    });
    console.log("moves.record: ok");
  } catch (e) {
    console.error("moves.record failed:", e.message);
    throw e;
  }
}

async function writeLatestState(gameId) {
  const now = Date.now();
  try {
    const id = await client.mutation(api.states.insert, {
      gameId,
      stateHash: "stateHashDemo",
      currentPlayerIndex: 0,
      turnCount: 1,
      directionClockwise: true,
      deckHash: "deckHashValue",
      discardPileHash: "discardPileHashValue",
      currentColor: "red",
      currentValue: "5",
      lastPlayedCardHash: "cardHashValue",
      createdAt: now,
    });
    console.log("states.insert:", id);
  } catch (e) {
    console.error("writeLatestState failed:", e.message);
  }
}

async function setHand(gameId, wallet) {
  const now = Date.now();
  try {
    const id = await client.mutation(api.hands.set, {
      gameId,
      playerAddress: wallet,
      cardHashes: ["hash1", "hash2", "hash3"],
      updatedAt: now,
    });
    console.log("hands.set:", id);
  } catch (e) {
    console.error("setHand failed:", e.message);
  }
}

async function main() {
  const playerId = await ensurePlayer(DEMO_WALLET);
  const game = await ensureGame(DEMO_GAME_ID, [DEMO_WALLET]);
  await recordMoves(game._id, DEMO_WALLET);
  await writeLatestState(game._id);
  await setHand(game._id, DEMO_WALLET);
  console.log("Seed complete. Game:", game._id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
