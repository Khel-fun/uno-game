/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cardMappings from "../cardMappings.js";
import type * as cleanup from "../cleanup.js";
import type * as gameActions from "../gameActions.js";
import type * as gamePlayers from "../gamePlayers.js";
import type * as games from "../games.js";
import type * as hands from "../hands.js";
import type * as migrations_removeGameNumericId from "../migrations/removeGameNumericId.js";
import type * as moves from "../moves.js";
import type * as players from "../players.js";
import type * as states from "../states.js";
import type * as utils_cardDeck from "../utils/cardDeck.js";
import type * as utils_gameHelpers from "../utils/gameHelpers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cardMappings: typeof cardMappings;
  cleanup: typeof cleanup;
  gameActions: typeof gameActions;
  gamePlayers: typeof gamePlayers;
  games: typeof games;
  hands: typeof hands;
  "migrations/removeGameNumericId": typeof migrations_removeGameNumericId;
  moves: typeof moves;
  players: typeof players;
  states: typeof states;
  "utils/cardDeck": typeof utils_cardDeck;
  "utils/gameHelpers": typeof utils_gameHelpers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
