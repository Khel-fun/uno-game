# How the Frontend Decides Which Card to Show at Center

## Overview

The center card is determined by the **last card** in the `playedCardsPile` array.

## Detailed Flow

### 1. State Management (`Game.js`)

The game state, including the pile of played cards, is managed in the `Game.js` component.

```javascript
// Game.js
const [state, dispatch] = useReducer(gameReducer, initialState);
// state.playedCardsPile contains all cards played in the game
```

### 2. Passing Props

The `playedCardsPile` is passed down through the component tree:

1. `Game.js` → passes to `GameScreen`
   ```jsx
   <GameScreen
     playedCardsPile={playedCardsPile}
     // ... other props
   />
   ```

2. `GameScreen` → passes to `CommonView`
   ```jsx
   <CommonView
     playedCardsPile={playedCardsPile}
     // ... other props
   />
   ```

### 3. Rendering (`CommonView.js`)

The `CommonView` component renders the card on top of the pile.

**File:** `frontend/src/components/gameroom/CommonView.js` (Lines 75-76)

```javascript
alt={`cards-front ${playedCardsPile[playedCardsPile.length - 1]}`}
src={`../assets/cards-front/${playedCardsPile[playedCardsPile.length - 1]}.webp`}
```

It selects `playedCardsPile[playedCardsPile.length - 1]`, which is the last element in the array.

## How the Pile Gets Updated

### Local Player Moves
When you play a card:
1. `onCardPlayedHandler` is called in `Game.js`
2. Card is added to `playedCardsPile`
3. State updates → Component re-renders → Center card updates

### Remote Player Moves
When an opponent plays a card:
1. Backend emits `updateGameState` event
2. Frontend receives event in `Game.js`
3. Local `playedCardsPile` is updated with server data
4. State updates → Component re-renders → Center card updates

## Summary

The frontend simply displays the **last card** that was added to the `playedCardsPile` array. This array is synchronized between all players via the backend.
