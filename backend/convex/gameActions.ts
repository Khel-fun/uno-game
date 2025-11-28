// Game actions - Core game logic (replaces gameStateManager)
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { createDeck } from "./utils/cardDeck";
import { generateGameHash, getNextPlayerIndex, canPlayCard } from "./utils/gameHelpers";

// Initialize a new game
export const initializeGame = mutation({
  args: {
    gameId: v.id("games"),
    playerAddresses: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return { success: false, error: "Game not found" };

    // Create and shuffle deck
    const { mappings, deckHashes } = createDeck(args.gameId);

    // Store card mappings
    await Promise.all(
      mappings.map((m) =>
        ctx.db.insert("cardMappings", {
          gameId: args.gameId,
          cardHash: m.cardHash,
          color: m.color,
          value: m.value,
        })
      )
    );

    // Deal hands (7 cards each)
    const cardsPerPlayer = 7;
    let deckIndex = 0;

    for (const playerAddress of args.playerAddresses) {
      const playerHand = deckHashes.slice(deckIndex, deckIndex + cardsPerPlayer);

      await ctx.db.insert("hands", {
        gameId: args.gameId,
        playerAddress,
        cardHashes: playerHand,
        updatedAt: Date.now(),
      });

      deckIndex += cardsPerPlayer;
    }

    // First card on discard pile
    const firstCard = deckHashes[deckIndex];
    const firstCardData = mappings[deckIndex];
    deckIndex++;

    // Remaining deck
    const remainingDeck = deckHashes.slice(deckIndex);

    // Update game state
    await ctx.db.patch(args.gameId, {
      status: "Started",
      startedAt: Date.now(),
      currentColor: firstCardData.color,
      currentValue: firstCardData.value,
      lastPlayedCardHash: firstCard,
      deckHash: generateGameHash(remainingDeck),
    });

    // Log initial state
    const stateHash = generateGameHash({
      turn: 0,
      gameId: args.gameId,
      timestamp: Date.now()
    });

    await ctx.db.insert("gameStates", {
      gameId: args.gameId,
      turnNumber: 0,
      stateHash,
      currentPlayerIndex: 0,
      directionClockwise: true,
      currentColor: firstCardData.color,
      currentValue: firstCardData.value,
      lastPlayedCardHash: firstCard,
      deckHash: generateGameHash(remainingDeck),
      createdAt: Date.now(),
    });

    return { success: true, firstCard: firstCardData };
  },
});

// Play a card
export const playCard = mutation({
  args: {
    gameId: v.id("games"),
    playerAddress: v.string(),
    cardHash: v.string(),
    chosenColor: v.optional(v.string()), // For wild cards
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "Started") {
      return { success: false, error: "Game not active" };
    }

    // Verify it's player's turn
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer !== args.playerAddress) {
      return { success: false, error: "Not your turn" };
    }

    // Get player's hand
    const hand = await ctx.db
      .query("hands")
      .withIndex("by_game_player", (q) =>
        q.eq("gameId", args.gameId).eq("playerAddress", args.playerAddress)
      )
      .first();

    if (!hand || !hand.cardHashes.includes(args.cardHash)) {
      return { success: false, error: "Card not in hand" };
    }

    // Get card details
    const card = await ctx.db
      .query("cardMappings")
      .withIndex("by_game_hash", (q) =>
        q.eq("gameId", args.gameId).eq("cardHash", args.cardHash)
      )
      .first();

    if (!card) {
      return { success: false, error: "Invalid card" };
    }

    // Validate play
    if (!canPlayCard(card.color, card.value, game.currentColor, game.currentValue)) {
      return { success: false, error: "Cannot play this card" };
    }

    // Remove card from hand
    await ctx.db.patch(hand._id, {
      cardHashes: hand.cardHashes.filter((h) => h !== args.cardHash),
      updatedAt: Date.now(),
    });

    // Determine next player
    let nextPlayerIndex = getNextPlayerIndex(
      game.currentPlayerIndex,
      game.players.length,
      game.directionClockwise
    );
    let newDirection = game.directionClockwise;

    // Handle special cards
    if (card.value === "reverse") {
      newDirection = !game.directionClockwise;
      // In 2-player game, reverse acts like skip
      if (game.players.length === 2) {
        nextPlayerIndex = game.currentPlayerIndex;
      }
    } else if (card.value === "skip") {
      nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex, game.players.length, newDirection);
    } else if (card.value === "draw2" || card.value === "draw4") {
      // Next player draws cards (handled separately)
      // For now, just advance turn
    }

    // Determine final color
    const finalColor = card.color === "wild" ? args.chosenColor : card.color;

    // Update game state
    const newTurnCount = game.turnCount + 1;
    await ctx.db.patch(args.gameId, {
      currentPlayerIndex: nextPlayerIndex,
      turnCount: newTurnCount,
      directionClockwise: newDirection,
      currentColor: finalColor,
      currentValue: card.value,
      lastPlayedCardHash: args.cardHash,
      lastActionTimestamp: Date.now(),
    });

    // Log move
    await ctx.db.insert("moves", {
      gameId: args.gameId,
      turnNumber: newTurnCount,
      playerAddress: args.playerAddress,
      actionType: "playCard",
      cardHash: args.cardHash,
      timestamp: Date.now(),
    });

    // Save state snapshot
    const stateHash = generateGameHash({
      turn: newTurnCount,
      gameId: args.gameId,
      timestamp: Date.now()
    });

    await ctx.db.insert("gameStates", {
      gameId: args.gameId,
      turnNumber: newTurnCount,
      stateHash,
      currentPlayerIndex: nextPlayerIndex,
      directionClockwise: newDirection,
      currentColor: finalColor,
      currentValue: card.value,
      lastPlayedCardHash: args.cardHash,
      createdAt: Date.now(),
    });

    // Check for winner
    if (hand.cardHashes.length === 1) {
      // Player won!
      await ctx.db.patch(args.gameId, {
        status: "Ended",
        endedAt: Date.now(),
      });

      return { success: true, winner: args.playerAddress, card };
    }

    return { success: true, card, nextPlayer: game.players[nextPlayerIndex] };
  },
});

// Draw a card
export const drawCard = mutation({
  args: {
    gameId: v.id("games"),
    playerAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "Started") {
      return { success: false, error: "Game not active" };
    }

    // Verify it's player's turn
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer !== args.playerAddress) {
      return { success: false, error: "Not your turn" };
    }

    // Get player's hand
    const hand = await ctx.db
      .query("hands")
      .withIndex("by_game_player", (q) =>
        q.eq("gameId", args.gameId).eq("playerAddress", args.playerAddress)
      )
      .first();

    if (!hand) {
      return { success: false, error: "Hand not found" };
    }

    // TODO: Implement deck management (draw from deck)
    // For now, just pass turn
    const nextPlayerIndex = getNextPlayerIndex(
      game.currentPlayerIndex,
      game.players.length,
      game.directionClockwise
    );

    await ctx.db.patch(args.gameId, {
      currentPlayerIndex: nextPlayerIndex,
      turnCount: game.turnCount + 1,
      lastActionTimestamp: Date.now(),
    });

    return { success: true, nextPlayer: game.players[nextPlayerIndex] };
  },
});
