const logger = require('../logger');
const { clearRemoval } = require('./timers');
const { initializeZKGame, getPlayProofData, getDrawProofData, getZKGameState } = require('../zk');

module.exports = function gameHandler(io, socket, { gameStateManager, userManager }) {
  // Join a specific game room (socket.io room)
  socket.on('joinRoom', (roomId) => {
    const user = userManager.getUser(socket.id);
    if (user) clearRemoval(user.id);
    socket.join(roomId);
    io.to(roomId).emit('userJoined', socket.id);
  });

  // Create a new game room (broadcast)
  socket.on('createGameRoom', () => {
    io.emit('gameRoomCreated');
  });

  /**
   * Convert cardHashMap entry to card string format
   * cardHashMap format: { color: 'yellow', value: '1' }
   * returns format like: '1Y', 'D2R', 'skipG', '_B', 'W', 'D4W'
   */
  function hashMapEntryToCardString(entry) {
    if (!entry) return null;
    
    const colorMap = { 'red': 'R', 'green': 'G', 'blue': 'B', 'yellow': 'Y', 'wild': 'W' };
    const colorChar = colorMap[entry.color] || '';
    const value = entry.value;
    
    // Wild cards
    if (entry.color === 'wild') {
      if (value === 'wild') return 'W';
      if (value === 'wild_draw4') return 'D4W';
      return 'W';
    }
    
    // Action cards
    if (value === 'skip') return `skip${colorChar}`;
    if (value === 'reverse') return `_${colorChar}`;
    if (value === 'draw2') return `D2${colorChar}`;
    
    // Number cards (0-9)
    if (/^\d$/.test(value)) {
      return `${value}${colorChar}`;
    }
    
    return null;
  }

  // Helper to normalize game ID (handle both "25" and "game-25" formats)
  function normalizeGameId(gameId) {
    if (!gameId) return null;
    // Extract numeric part if prefixed with "game-"
    const str = String(gameId);
    if (str.startsWith('game-')) {
      return str.substring(5);
    }
    return str;
  }

  // Game started: save state and broadcast WITH ZK initialization
  socket.on('gameStarted', async ({ roomId, newState, cardHashMap }) => {
    try {
      // Normalize game ID for consistent storage/retrieval
      const rawGameId = newState?.id || newState?.gameId || roomId;
      const gameId = normalizeGameId(rawGameId);
      let zkData = null;
      
      logger.info('[ZK] gameStarted: roomId=%s, rawGameId=%s, normalizedGameId=%s, cardHashMap keys=%d', 
        roomId, rawGameId, gameId, cardHashMap ? Object.keys(cardHashMap).length : 0);
      
      // Convert card hashes to card strings using cardHashMap
      // The game may use card hashes in playerHands and other places
      if (cardHashMap && Object.keys(cardHashMap).length > 0) {
        try {
          // Build deck from cardHashMap - this contains all cards in the game
          const cardStrings = [];
          for (const [hash, cardInfo] of Object.entries(cardHashMap)) {
            const cardStr = hashMapEntryToCardString(cardInfo);
            if (cardStr) {
              cardStrings.push(cardStr);
            }
          }
          
          logger.info('[ZK] Converted %d card hashes to card strings: %s', cardStrings.length, cardStrings.slice(0, 5).join(', ') + '...');
          
          if (cardStrings.length > 0) {
            zkData = initializeZKGame(gameId, cardStrings);
            logger.info('[ZK] State initialized for game %s with %d cards, merkleRoot=%s', gameId, cardStrings.length, zkData?.merkleRoot?.slice(0, 20) + '...');
          }
        } catch (zkErr) {
          logger.error('[ZK] Initialization failed: %s', zkErr.message);
        }
      } else {
        logger.warn('[ZK] No cardHashMap provided for game %s - ZK initialization skipped', gameId);
      }
      
      await gameStateManager.saveGameState(roomId, newState);
      if (cardHashMap) {
        await gameStateManager.saveCardHashMap(roomId, cardHashMap);
      }
      
      logger.info('Game started: %s', roomId);
      io.to(roomId).emit(`gameStarted-${roomId}`, { 
        newState, 
        cardHashMap,
        zkData: zkData ? {
          merkleRoot: zkData.merkleRoot,
          cardCount: zkData.cardCount,
        } : null,
      });
    } catch (err) {
      logger.error('Error handling gameStarted: %s', err.message);
    }
  });

  // Card play / draw update
  socket.on('playCard', async ({ roomId, action, newState }) => {
    try {
      await gameStateManager.saveGameState(roomId, newState);
      io.to(roomId).emit(`cardPlayed-${roomId}`, { action, newState });
    } catch (err) {
      logger.error('Error handling playCard: %s', err.message);
    }
  });

  // Generic state update with timestamp
  socket.on('updateGameState', async (gameState) => {
    const roomId = gameState?.roomId;
    if (!roomId) return;
    const stateWithTs = { ...gameState, _serverTimestamp: Date.now() };
    await gameStateManager.saveGameState(roomId, stateWithTs);
    io.to(roomId).emit('updateGameState', stateWithTs);
  });

  // Request server-side init (optional deck shuffle)
  socket.on('requestGameInit', (payload = {}) => {
    // For now just echo; deck generation could go here
    io.to(payload.roomId || socket.id).emit('initGameState', payload);
  });

  // Leave a game room
  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
    io.to(roomId).emit('userLeft', socket.id);
  });

  // Request game state sync (reconnection)
  socket.on('requestGameStateSync', async ({ roomId, gameId }) => {
    let saved = null;
    if (roomId) {
      saved = await gameStateManager.getGameState(roomId);
    }
    if (!saved && gameId) {
      saved = await gameStateManager.getByGameId(gameId);
      if (saved?.roomId) {
        roomId = saved.roomId;
      }
    }
    const cardHashMap = await gameStateManager.getCardHashMap(roomId);
    if (!saved) {
      socket.emit(`gameStateSync-${roomId}`, { error: 'Game state not found' });
      return;
    }
    socket.emit(`gameStateSync-${roomId}`, {
      newState: saved.state || saved,
      cardHashMap,
      restored: true,
    });
  });

  // Init game state (bidirectional support)
  socket.on('initGameState', (gameState) => {
    const roomId = gameState?.roomId;
    if (!roomId) return;
    io.to(roomId).emit('initGameState', gameState);
  });
  
  // ========== ZK PROOF DATA REQUESTS ==========
  
  // Request ZK proof data for a play action
  socket.on('requestPlayProofData', async ({ gameId, playedCard, topCard, playerHand, playerId, cardHashMap: clientCardHashMap }) => {
    try {
      const normalizedId = normalizeGameId(gameId);
      
      // Try to get cardHashMap from storage if not provided
      let hashMap = clientCardHashMap;
      if (!hashMap) {
        const roomId = `game-${normalizedId}`;
        hashMap = await gameStateManager.getCardHashMap(roomId);
      }
      
      // Convert card hash to card string if needed
      let cardStr = playedCard;
      if (hashMap && playedCard && playedCard.startsWith('0x')) {
        const cardInfo = hashMap[playedCard];
        if (cardInfo) {
          cardStr = hashMapEntryToCardString(cardInfo);
        }
      }
      
      let topCardStr = topCard;
      if (hashMap && topCard && topCard.startsWith('0x')) {
        const cardInfo = hashMap[topCard];
        if (cardInfo) {
          topCardStr = hashMapEntryToCardString(cardInfo);
        }
      }
      
      const proofData = getPlayProofData(normalizedId, cardStr, topCardStr, playerHand, playerId);
      socket.emit('playProofData', proofData);
    } catch (err) {
      logger.error('Error getting play proof data: %s', err.message);
      socket.emit('playProofData', { error: err.message });
    }
  });
  
  // Request ZK proof data for a draw action
  socket.on('requestDrawProofData', async ({ gameId, drawnCard, deckPosition, cardHashMap: clientCardHashMap }) => {
    try {
      const normalizedId = normalizeGameId(gameId);
      
      // Try to get cardHashMap from storage if not provided
      let hashMap = clientCardHashMap;
      if (!hashMap) {
        const roomId = `game-${normalizedId}`;
        hashMap = await gameStateManager.getCardHashMap(roomId);
      }
      
      // Convert card hash to card string if needed
      let cardStr = drawnCard;
      if (hashMap && drawnCard && drawnCard.startsWith('0x')) {
        const cardInfo = hashMap[drawnCard];
        if (cardInfo) {
          cardStr = hashMapEntryToCardString(cardInfo);
        }
      }
      
      const proofData = getDrawProofData(normalizedId, cardStr, deckPosition);
      socket.emit('drawProofData', proofData);
    } catch (err) {
      logger.error('Error getting draw proof data: %s', err.message);
      socket.emit('drawProofData', { error: err.message });
    }
  });
  
  // Get current ZK state for a game
  socket.on('requestZKState', ({ gameId }) => {
    try {
      const normalizedId = normalizeGameId(gameId);
      const zkState = getZKGameState(normalizedId);
      socket.emit('zkState', {
        gameId: normalizedId,
        merkleRoot: zkState.getMerkleRoot(),
        consumedState: zkState.getConsumedState(),
      });
    } catch (err) {
      logger.error('Error getting ZK state: %s', err.message);
      socket.emit('zkState', { error: err.message });
    }
  });
};
