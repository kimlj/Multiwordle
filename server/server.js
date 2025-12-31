import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameManager, ITEMS, CHALLENGES, RARE_LETTERS, getRandomDrop, getSabotageDuration } from './game.js';
import { isValidWord, getRandomWord } from './words.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? ALLOWED_ORIGINS : '*',
    methods: ["GET", "POST"]
  }
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ALLOWED_ORIGINS : '*'
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Only serve static files if they exist (for combined deployment)
app.use(express.static(path.join(__dirname, '../client/dist')));

const gameManager = new GameManager();
const playerRooms = new Map(); // playerId -> roomCode

// Timer management
const roomTimers = new Map();

// Track disconnected players for reconnection (playerName:roomCode -> { playerId, disconnectTime, playerData })
const disconnectedPlayers = new Map();
const RECONNECT_WINDOW_MS = 300000; // 5 minutes to reconnect

// Track rooms scheduled for deletion (roomCode -> timeoutId)
const roomDeletionTimers = new Map();

function clearRoomTimers(roomCode) {
  const timers = roomTimers.get(roomCode);
  if (timers) {
    if (timers.countdown) clearInterval(timers.countdown);
    if (timers.round) clearInterval(timers.round);
    if (timers.guess) clearInterval(timers.guess);
    if (timers.nextRound) clearInterval(timers.nextRound);
    roomTimers.delete(roomCode);
  }
}

function startCountdownTimer(roomCode) {
  let countdown = 5;
  const room = gameManager.getRoom(roomCode);
  if (!room) return;

  room.startCountdown();

  // Prepare Item Round info for next round (if power-ups enabled)
  const itemRoundInfo = room.prepareNextItemRound();

  const timer = setInterval(() => {
    io.to(roomCode).emit('countdown', {
      seconds: countdown,
      // Include Item Round preview info
      itemRound: itemRoundInfo.isItemRound ? {
        challenge: itemRoundInfo.challenge,
        reward: itemRoundInfo.reward
      } : null
    });

    if (countdown <= 0) {
      clearInterval(timer);
      startRound(roomCode);
    }
    countdown--;
  }, 1000);

  roomTimers.set(roomCode, { countdown: timer });
}

function startRound(roomCode, customWord = null) {
  const room = gameManager.getRoom(roomCode);
  if (!room) return;

  // Priority: direct customWord > customWords array for this round > random
  let wordToUse = customWord;

  if (!wordToUse && room.settings.customWords && room.settings.customWords.length > 0) {
    // Get word for current round (0-indexed, but currentRound will be incremented in startRound)
    const roundIndex = room.currentRound; // This is the upcoming round (0-indexed before increment)
    if (roundIndex < room.settings.customWords.length) {
      wordToUse = room.settings.customWords[roundIndex];
    }
  }

  // Fallback to single custom word
  if (!wordToUse) {
    wordToUse = room.settings.customWord || null;
    room.settings.customWord = null;
  }

  room.startRound(wordToUse);

  // Apply mirror match opener if enabled
  let mirrorOpenerData = null;
  if (room.settings.mirrorMatch) {
    // Collect all words to exclude (target word + all custom words)
    const excludedWords = new Set();
    excludedWords.add(room.targetWord.toUpperCase());
    if (room.settings.customWords) {
      for (const word of room.settings.customWords) {
        excludedWords.add(word.toUpperCase());
      }
    }

    // Pick a random opener word (not in excluded words)
    let openerWord;
    let attempts = 0;
    do {
      openerWord = getRandomWord();
      attempts++;
    } while (excludedWords.has(openerWord.toUpperCase()) && attempts < 100);

    mirrorOpenerData = room.applyMirrorOpener(openerWord);
  }

  // Send round start to all players
  io.to(roomCode).emit('roundStart', {
    round: room.currentRound,
    totalRounds: room.settings.rounds,
    roundTimeSeconds: room.settings.roundTimeSeconds,
    guessTimeSeconds: room.settings.guessTimeSeconds,
    mirrorOpener: mirrorOpenerData
  });

  // Send initial playerState to each player
  // Eliminated players get spectator state instead
  for (const [playerId, player] of room.players) {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket) {
      if (player.eliminated) {
        // Eliminated players spectate - they see all boards
        playerSocket.emit('spectatorState', room.getSpectatorState());
      } else {
        playerSocket.emit('playerState', room.getPlayerState(playerId));
      }
    }
  }

  // Also send initial game state
  io.to(roomCode).emit('gameStateUpdate', room.getPublicState());

  // Start round timer
  const roundTimer = setInterval(() => {
    const remaining = room.getRoundTimeRemaining();
    const guessRemaining = room.getGuessTimeRemaining();
    const baseTimeUp = remaining <= 0;

    // Clean up expired sabotage effects
    if (room.settings.powerUpsEnabled) {
      room.cleanupExpiredEffects();
    }

    // Send timer updates to all players
    for (const [playerId, player] of room.players) {
      const playerSocket = io.sockets.sockets.get(playerId);
      if (playerSocket) {
        // Calculate player's personal time (base time + any bonus time from Time Warp)
        const bonusTime = player.bonusTime || 0;
        let playerTimeRemaining = remaining + bonusTime;

        // When base time is up, start decrementing bonus time
        if (remaining <= 0 && bonusTime > 0) {
          player.bonusTime = Math.max(0, bonusTime - 1000);
        }

        playerSocket.emit('timerUpdate', {
          roundTimeRemaining: playerTimeRemaining,
          guessTimeRemaining: guessRemaining,
          isBonusTime: bonusTime > 0
        });
      }
    }

    // Check if round is over
    if (room.isRoundOver()) {
      clearInterval(roundTimer);
      endRound(roomCode);
    }
  }, 1000);
  
  const timers = roomTimers.get(roomCode) || {};
  timers.round = roundTimer;
  roomTimers.set(roomCode, timers);
}

function endRound(roomCode) {
  const room = gameManager.getRoom(roomCode);
  if (!room) return;

  // Guard against double calls - only process if still in playing state
  if (room.state !== 'playing') return;

  clearRoomTimers(roomCode);
  const roundResult = room.endRound();

  // Calculate detailed stats for each player
  const playerStats = {};
  for (const [playerId, player] of room.players) {
    if (player.eliminated && player.eliminatedRound !== room.currentRound) {
      // Already eliminated in previous round
      playerStats[playerId] = {
        eliminated: true,
        eliminatedRound: player.eliminatedRound,
        placement: player.placement
      };
    } else if (player.solved) {
      const solveTimeMs = player.solvedAt - room.roundStartTime;
      const solveTimeSec = Math.floor(solveTimeMs / 1000);
      playerStats[playerId] = {
        solved: true,
        guesses: player.solvedInGuesses,
        timeSeconds: solveTimeSec,
        baseScore: 1000,
        guessBonus: (7 - player.solvedInGuesses) * 150,
        timeBonus: Math.floor(((room.settings.roundTimeSeconds * 1000 - solveTimeMs) / (room.settings.roundTimeSeconds * 1000)) * 500),
        totalScore: player.roundScore,
        eliminated: player.eliminated,
        eliminatedRound: player.eliminatedRound,
        placement: player.placement
      };
    } else {
      playerStats[playerId] = {
        solved: false,
        guesses: player.guesses.length,
        totalScore: 0,
        eliminated: player.eliminated,
        eliminatedRound: player.eliminatedRound,
        placement: player.placement
      };
    }
  }

  // ============================================
  // END-ROUND ITEM DROPS
  // ============================================
  const drops = {}; // playerId -> { item, trigger }

  if (room.settings.powerUpsEnabled) {
    const activePlayers = room.getActivePlayers();
    const totalPlayers = activePlayers.length;

    // Sort players by round score to find top scorer and rankings
    const sortedByRoundScore = [...activePlayers].sort((a, b) => b.roundScore - a.roundScore);
    const topScorer = sortedByRoundScore[0];

    // Determine bottom rank threshold (bottom half, or bottom 2 for small games)
    const bottomThreshold = Math.max(2, Math.ceil(totalPlayers / 2));

    for (const player of activePlayers) {
      const position = room.getPlayerPosition(player.id);
      const prevPosition = player.lastRoundPosition || position;

      // Calculate solve time in seconds
      const solveTimeSeconds = player.solvedAt
        ? Math.floor((player.solvedAt - room.roundStartTime) / 1000)
        : null;

      // Find round rank (1-based position in this round's scores)
      const roundRank = sortedByRoundScore.findIndex(p => p.id === player.id) + 1;
      const isLowRank = roundRank > (totalPlayers - bottomThreshold);

      // Track position for next round's Comeback Drop
      player.lastRoundPosition = position;

      // Track failed rounds for Mercy Drop
      if (!player.solved) {
        player.failedRoundsStreak = (player.failedRoundsStreak || 0) + 1;
      } else {
        player.failedRoundsStreak = 0;
      }

      // Track low rank streak for underdog drops
      if (isLowRank) {
        player.lowRankStreak = (player.lowRankStreak || 0) + 1;
      } else {
        player.lowRankStreak = 0;
      }

      let earnedDrop = false;
      let trigger = null;

      // FIRST ROUND: Top scorer gets automatic drop
      if (room.currentRound === 1 && topScorer && topScorer.id === player.id && topScorer.roundScore > 0) {
        earnedDrop = true;
        trigger = 'top_scorer';
      }
      // SPEED DEMON: Solve in under 20 seconds (any round)
      else if (player.solved && solveTimeSeconds !== null && solveTimeSeconds < 20) {
        earnedDrop = true;
        trigger = 'speed_demon';
      }
      // MERCY DROP: Failed 2+ consecutive rounds
      else if (player.failedRoundsStreak >= 2) {
        earnedDrop = true;
        trigger = 'mercy';
      }
      // COMEBACK DROP: Jump 3+ positions (50% chance)
      else if (prevPosition - position >= 3 && Math.random() < 0.5) {
        earnedDrop = true;
        trigger = 'comeback';
      }
      // UNDERDOG DROP: Consistently low rank with increasing chance
      // 1 round low: 50%, 2 rounds: 75%, 3+ rounds: 95%
      else if (player.lowRankStreak >= 1) {
        let underdogChance = 0;
        if (player.lowRankStreak >= 3) {
          underdogChance = 0.95;
        } else if (player.lowRankStreak === 2) {
          underdogChance = 0.75;
        } else if (player.lowRankStreak === 1) {
          underdogChance = 0.50;
        }

        if (Math.random() < underdogChance) {
          earnedDrop = true;
          trigger = 'underdog';
        }
      }

      // Give the drop
      if (earnedDrop) {
        const item = getRandomDrop(position, totalPlayers);
        if (item) {
          room.addItemToInventory(player.id, item);
          drops[player.id] = { item, trigger };
        }
      }
    }
  }

  // Send item notifications to players who received end-round drops
  for (const [playerId, dropInfo] of Object.entries(drops)) {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket && dropInfo.item) {
      playerSocket.emit('itemReceived', { item: dropInfo.item, trigger: dropInfo.trigger });
      const player = room.players.get(playerId);
      if (player) {
        playerSocket.emit('inventoryUpdate', { inventory: player.inventory });
      }
      // Broadcast to all players
      const playerName = player?.name || 'Someone';
      io.to(roomCode).emit('itemEarned', {
        playerId,
        playerName,
        items: [{ item: dropInfo.item, trigger: dropInfo.trigger, challenge: null }]
      });
    }
  }

  // Send full results including the word and detailed stats
  io.to(roomCode).emit('roundEnd', {
    ...roundResult,
    word: room.targetWord,
    playerStats,
    drops, // Include drop info so clients can show animations
    gameState: room.getPublicState()
  });

  // Send individual player states with their guesses revealed
  // For eliminated players, also send spectator state
  for (const [playerId, player] of room.players) {
    const socket = io.sockets.sockets.get(playerId);
    if (socket) {
      socket.emit('playerState', room.getPlayerState(playerId));

      // Send spectator state to eliminated players (they can see all boards)
      if (player.eliminated) {
        socket.emit('spectatorState', room.getSpectatorState());
      }
    }
  }

  // Check if game is over
  if (room.isGameOver()) {
    setTimeout(() => endGame(roomCode), 5000);
  } else {
    // Auto-start next round after 5 seconds
    startNextRoundCountdown(roomCode);
  }
}

function startNextRoundCountdown(roomCode) {
  let countdown = 5;
  const room = gameManager.getRoom(roomCode);
  if (!room) return;

  // Prepare Item Round info for next round (random challenge & reward each time)
  const itemRoundInfo = room.prepareNextItemRound();

  const timer = setInterval(() => {
    io.to(roomCode).emit('nextRoundCountdown', {
      seconds: countdown,
      // Include Item Round preview info
      itemRound: itemRoundInfo.isItemRound ? {
        challenge: itemRoundInfo.challenge,
        reward: itemRoundInfo.reward
      } : null
    });

    if (countdown <= 0) {
      clearInterval(timer);
      startRound(roomCode);
    }
    countdown--;
  }, 1000);

  const timers = roomTimers.get(roomCode) || {};
  timers.nextRound = timer;
  roomTimers.set(roomCode, timers);
}

function endGame(roomCode) {
  const room = gameManager.getRoom(roomCode);
  if (!room) return;

  const finalResults = room.endGame();
  io.to(roomCode).emit('gameEnd', {
    ...finalResults,
    gameState: room.getPublicState()
  });
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Heartbeat ping to keep connection alive
  socket.on('ping', () => {
    // Just acknowledge - socket.io handles the actual ping/pong
  });

  // Sync state (for when page becomes visible again)
  socket.on('syncState', ({ roomCode }, callback) => {
    if (!roomCode) {
      if (callback) callback({ success: false, error: 'No room code' });
      return;
    }

    const room = gameManager.getRoom(roomCode);
    if (!room) {
      if (callback) callback({ success: false, error: 'Room not found' });
      return;
    }

    // Check if this socket is in the room
    if (!room.players.has(socket.id)) {
      if (callback) callback({ success: false, error: 'Not in room' });
      return;
    }

    if (callback) {
      callback({
        success: true,
        gameState: room.getPublicState(),
        playerState: room.getPlayerState(socket.id)
      });
    }
  });

  // Create a new room
  socket.on('createRoom', ({ playerName, settings, persistentId }, callback) => {
    const room = gameManager.createRoom(socket.id, playerName, settings);
    // Store persistentId on the player
    const player = room.players.get(socket.id);
    if (player) {
      player.persistentId = persistentId;
    }
    playerRooms.set(socket.id, room.roomCode);
    socket.join(room.roomCode);

    callback({
      success: true,
      roomCode: room.roomCode,
      gameState: room.getPublicState(),
      playerId: socket.id
    });

    console.log(`Room ${room.roomCode} created by ${playerName}`);
  });

  // Get room info (for share links)
  socket.on('getRoomInfo', ({ roomCode }, callback) => {
    const room = gameManager.getRoom(roomCode);

    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    const host = room.players.get(room.hostId);
    callback({
      success: true,
      hostName: host?.name || 'Unknown',
      playerCount: room.players.size,
      state: room.state
    });
  });

  // Join an existing room
  socket.on('joinRoom', ({ roomCode, playerName, persistentId }, callback) => {
    const room = gameManager.getRoom(roomCode);

    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    if (room.state !== 'lobby') {
      callback({ success: false, error: 'Game already in progress' });
      return;
    }

    if (!room.addPlayer(socket.id, playerName)) {
      callback({ success: false, error: 'Could not join room' });
      return;
    }

    // Store persistentId on the player
    const player = room.players.get(socket.id);
    if (player) {
      player.persistentId = persistentId;
    }

    // Cancel any pending room deletion
    const deletionTimer = roomDeletionTimers.get(roomCode);
    if (deletionTimer) {
      clearTimeout(deletionTimer);
      roomDeletionTimers.delete(roomCode);
      console.log(`Cancelled deletion for room ${roomCode} - player joined`);
    }

    playerRooms.set(socket.id, roomCode);
    socket.join(roomCode);

    callback({
      success: true,
      roomCode,
      gameState: room.getPublicState(),
      playerId: socket.id
    });
    
    // Notify other players
    socket.to(roomCode).emit('playerJoined', {
      playerId: socket.id,
      playerName,
      gameState: room.getPublicState()
    });
    
    console.log(`${playerName} joined room ${roomCode}`);
  });

  // Rejoin room (for reconnecting players)
  socket.on('rejoinRoom', ({ roomCode, playerName, persistentId }, callback) => {
    const room = gameManager.getRoom(roomCode);

    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    // Cancel any pending room deletion
    const deletionTimer = roomDeletionTimers.get(roomCode);
    if (deletionTimer) {
      clearTimeout(deletionTimer);
      roomDeletionTimers.delete(roomCode);
      console.log(`Cancelled deletion for room ${roomCode} - player rejoined`);
    }

    // Try to find by persistentId first, fall back to name
    const disconnectKey = persistentId
      ? `${persistentId}:${roomCode}`
      : `${playerName}:${roomCode}`;
    let disconnectedPlayer = disconnectedPlayers.get(disconnectKey);

    // Fallback: try name-based key if persistentId key not found
    if (!disconnectedPlayer && persistentId) {
      disconnectedPlayer = disconnectedPlayers.get(`${playerName}:${roomCode}`);
    }

    // Check if there's already a player with this persistentId in the room (stale socket from reload)
    // Fall back to name matching if no persistentId
    let existingPlayerEntry = null;
    for (const [id, player] of room.players) {
      if (id !== socket.id) {
        if (persistentId && player.persistentId === persistentId) {
          existingPlayerEntry = { id, player };
          break;
        } else if (!persistentId && player.name === playerName) {
          existingPlayerEntry = { id, player };
          break;
        }
      }
    }

    // Check if this player was recently disconnected OR has a stale socket in the room
    if (disconnectedPlayer && Date.now() - disconnectedPlayer.disconnectTime < RECONNECT_WINDOW_MS) {
      // Restore the player with their data
      const playerData = disconnectedPlayer.playerData;

      // Restore host status if they were the host
      if (disconnectedPlayer.wasHost) {
        room.hostId = socket.id;
      }

      // If room is in lobby state, reset game-specific data (scores, guesses)
      // to prevent old scores from carrying over to new games
      if (room.state === 'lobby') {
        playerData.totalScore = 0;
        playerData.roundScore = 0;
        playerData.guesses = [];
        playerData.results = [];
        playerData.solved = false;
        playerData.solvedAt = null;
        playerData.solvedInGuesses = 0;
        playerData.returnedToLobby = false;
        playerData.ready = false;
      }

      // Add player back to room with their existing data
      room.players.set(socket.id, {
        ...playerData,
        id: socket.id
      });

      playerRooms.set(socket.id, roomCode);
      socket.join(roomCode);
      disconnectedPlayers.delete(disconnectKey);

      // Notify others
      socket.to(roomCode).emit('playerJoined', {
        playerId: socket.id,
        playerName,
        gameState: room.getPublicState()
      });

      callback({
        success: true,
        roomCode,
        playerId: socket.id,
        gameState: room.getPublicState(),
        playerState: room.getPlayerState(socket.id)
      });

      console.log(`${playerName} reconnected to room ${roomCode}`);
      return;
    }

    // Handle stale socket (player reloaded page, old socket still in room)
    if (existingPlayerEntry) {
      const { id: oldSocketId, player: existingPlayer } = existingPlayerEntry;

      // Remove old socket from room
      room.players.delete(oldSocketId);
      playerRooms.delete(oldSocketId);

      // Try to disconnect old socket
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        oldSocket.leave(roomCode);
        oldSocket.disconnect(true);
      }

      // Restore host status if they were the host
      if (room.hostId === oldSocketId) {
        room.hostId = socket.id;
      }

      // Add player back with new socket id
      room.players.set(socket.id, {
        ...existingPlayer,
        id: socket.id
      });

      playerRooms.set(socket.id, roomCode);
      socket.join(roomCode);

      // Notify others
      socket.to(roomCode).emit('playerJoined', {
        playerId: socket.id,
        playerName,
        gameState: room.getPublicState()
      });

      callback({
        success: true,
        roomCode,
        playerId: socket.id,
        gameState: room.getPublicState(),
        playerState: room.getPlayerState(socket.id)
      });

      console.log(`${playerName} took over stale socket in room ${roomCode}`);
      return;
    }

    // If not a disconnected player, only allow rejoining in lobby state
    if (room.state !== 'lobby') {
      callback({ success: false, error: 'Game already in progress' });
      return;
    }

    // Add as new player (same as joinRoom)
    if (!room.addPlayer(socket.id, playerName)) {
      callback({ success: false, error: 'Could not join room' });
      return;
    }

    playerRooms.set(socket.id, roomCode);
    socket.join(roomCode);

    callback({
      success: true,
      roomCode,
      playerId: socket.id,
      gameState: room.getPublicState(),
      playerState: null
    });

    // Notify other players
    socket.to(roomCode).emit('playerJoined', {
      playerId: socket.id,
      playerName,
      gameState: room.getPublicState()
    });

    console.log(`${playerName} rejoined room ${roomCode} as new player`);
  });

  // Update player name
  socket.on('updateName', ({ newName }) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) return;
    
    const room = gameManager.getRoom(roomCode);
    if (!room) return;
    
    room.updatePlayerName(socket.id, newName);
    io.to(roomCode).emit('gameStateUpdate', room.getPublicState());
  });
  
  // Toggle ready status
  socket.on('toggleReady', (callback) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) return;

    const room = gameManager.getRoom(roomCode);
    if (!room) return;

    // Allow toggling ready in lobby OR gameEnd (for returned players)
    if (room.state !== 'lobby' && room.state !== 'gameEnd') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // In gameEnd state, only allow if player has returned to lobby
    if (room.state === 'gameEnd' && !player.returnedToLobby) return;

    room.setPlayerReady(socket.id, !player.ready);

    io.to(roomCode).emit('gameStateUpdate', room.getPublicState());

    callback({ ready: !player.ready });
  });
  
  // Update game settings (host only)
  socket.on('updateSettings', ({ settings }) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) return;
    
    const room = gameManager.getRoom(roomCode);
    if (!room || room.hostId !== socket.id || room.state !== 'lobby') return;
    
    room.settings = { ...room.settings, ...settings };
    io.to(roomCode).emit('gameStateUpdate', room.getPublicState());
  });
  
  // Start game (host only, or set custom words)
  socket.on('startGame', ({ customWord, customWords } = {}, callback) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = gameManager.getRoom(roomCode);
    if (!room || room.hostId !== socket.id) {
      if (callback) callback({ success: false, error: 'Not the host' });
      return;
    }

    // Allow starting from lobby OR from gameEnd (if host has returned)
    if (room.state === 'lobby' || room.state === 'gameEnd') {
      // If in gameEnd, remove players who haven't returned and reset state
      if (room.state === 'gameEnd') {
        const playersToRemove = [];
        for (const [playerId, player] of room.players) {
          if (!player.returnedToLobby) {
            playersToRemove.push(playerId);
          }
        }

        // Remove non-returned players silently (they stay on results screen)
        for (const playerId of playersToRemove) {
          const playerSocket = io.sockets.sockets.get(playerId);
          room.players.delete(playerId);
          playerRooms.delete(playerId);
          if (playerSocket) {
            // Don't kick to home - just notify them the game started without them
            // They'll see an error when they try to go back to lobby
            playerSocket.emit('leftBehind', { message: 'Game started without you' });
            playerSocket.leave(roomCode);
          }
        }

        // Reset game state for remaining players
        room.state = 'lobby';
        room.currentRound = 0;
        room.targetWord = null;
        room.roundScores = [];

        for (const p of room.players.values()) {
          p.ready = p.id === room.hostId;
          p.guesses = [];
          p.results = [];
          p.solved = false;
          p.solvedAt = null;
          p.solvedInGuesses = 0;
          p.totalScore = 0;
          p.roundScore = 0;
          p.returnedToLobby = false;
          // Reset battle royale elimination status
          p.eliminated = false;
          p.eliminatedRound = null;
          p.placement = null;
        }

        // Notify remaining players of the updated state
        io.to(roomCode).emit('gameStateUpdate', room.getPublicState());
      }

      // Validate and set array of custom words (one per round)
      if (customWords && Array.isArray(customWords)) {
        const validatedWords = [];
        for (const word of customWords) {
          if (word && word.length === 5) {
            const upperWord = word.toUpperCase();
            if (!isValidWord(upperWord)) {
              if (callback) callback({ success: false, error: `"${word}" is not a valid word` });
              return;
            }
            validatedWords.push(upperWord);
          }
        }
        room.settings.customWords = validatedWords;
      }

      // Single custom word (legacy support)
      if (customWord && customWord.length === 5) {
        const word = customWord.toUpperCase();
        if (!isValidWord(word)) {
          if (callback) callback({ success: false, error: 'Not a valid word' });
          return;
        }
        room.settings.customWord = word;
      }

      // Battle Royale: auto-adjust rounds
      if (room.settings.gameMode === 'battleRoyale') {
        const playerCount = room.players.size;
        const minRounds = playerCount - 1; // Need at least (players - 1) rounds

        // If custom words provided, match rounds to custom words count
        if (room.settings.customWords && room.settings.customWords.length > 0) {
          room.settings.rounds = room.settings.customWords.length;
        } else {
          // Random words: use player count - 1 as safe default
          room.settings.rounds = minRounds;
        }
      }

      // Initialize Item Rounds (randomly selected for this game)
      room.initializeItemRounds();

      startCountdownTimer(roomCode);
      if (callback) callback({ success: true });
    }
  });

  // Submit a guess
  socket.on('submitGuess', ({ guess }, callback) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = gameManager.getRoom(roomCode);
    if (!room || room.state !== 'playing') {
      callback({ success: false, error: 'Game not in progress' });
      return;
    }

    const result = room.submitGuess(socket.id, guess);

    if (result.success) {
      // Send result to the guessing player
      callback(result);

      // Send player's full state
      socket.emit('playerState', room.getPlayerState(socket.id));

      // ============================================
      // ITEM ROUND CHALLENGE CHECKS
      // ============================================
      const itemEarnings = []; // Track all items earned this guess for broadcast

      if (room.settings.powerUpsEnabled) {
        const player = room.players.get(socket.id);

        // Challenge checks (if this is an Item Round)
        if (room.currentChallenge) {
          let challengeCompleted = false;
          const challengeType = room.currentChallenge.id;

          // First Blood - first to submit any guess
          if (challengeType === 'first_blood') {
            challengeCompleted = room.checkFirstBlood(socket.id);
          }
          // Rare Letters - guess contains Z, X, Q, or J
          else if (challengeType === 'rare_letters') {
            challengeCompleted = room.checkRareLetters(socket.id, guess);
          }
          // Speed Solve - solved in under 25 seconds
          else if (challengeType === 'speed_solve' && result.solved) {
            challengeCompleted = room.checkSpeedSolve(socket.id);
          }
          // Efficiency - solved in 3 guesses or less
          else if (challengeType === 'efficiency' && result.solved) {
            challengeCompleted = room.checkEfficiency(socket.id);
          }

          if (challengeCompleted) {
            const challengeItem = room.awardChallengeItem(socket.id);
            if (challengeItem) {
              itemEarnings.push({
                item: challengeItem,
                trigger: 'challenge',
                challenge: room.currentChallenge
              });
            }
          }
        }

        // Send inventory update to the player
        if (itemEarnings.length > 0 && player) {
          socket.emit('inventoryUpdate', { inventory: player.inventory });

          // Notify the earning player
          for (const earning of itemEarnings) {
            socket.emit('itemReceived', { item: earning.item, trigger: earning.trigger });
          }

          // Broadcast item earnings to ALL players (so everyone sees who got what)
          const playerName = player.name;
          io.to(roomCode).emit('itemEarned', {
            playerId: socket.id,
            playerName,
            items: itemEarnings.map(e => ({
              item: e.item,
              trigger: e.trigger,
              challenge: e.challenge || null
            }))
          });
        }
      }

      // Broadcast update to all players (without revealing letters)
      io.to(roomCode).emit('guessSubmitted', {
        playerId: socket.id,
        guessNumber: result.guessNumber,
        colors: result.colors,
        solved: result.solved,
        score: result.score,
        gameState: room.getPublicState()
      });

      // Send updated spectator state to eliminated players (they see full boards)
      for (const [playerId, player] of room.players) {
        if (player.eliminated) {
          const playerSocket = io.sockets.sockets.get(playerId);
          if (playerSocket) {
            playerSocket.emit('spectatorState', room.getSpectatorState());
          }
        }
      }

      // Check if round is over
      if (room.isRoundOver()) {
        setTimeout(() => endRound(roomCode), 1000);
      }
    } else {
      callback(result);
    }
  });
  
  // ============================================
  // POWER-UPS & SABOTAGES HANDLERS
  // ============================================

  // Use an item (power-up or sabotage)
  socket.on('useItem', ({ itemId, targetId }, callback) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = gameManager.getRoom(roomCode);
    if (!room || room.state !== 'playing') {
      if (callback) callback({ success: false, error: 'Game not in progress' });
      return;
    }

    if (!room.settings.powerUpsEnabled) {
      if (callback) callback({ success: false, error: 'Power-ups not enabled' });
      return;
    }

    const result = room.useItem(socket.id, itemId, targetId);

    if (result.success) {
      // Handle Time Warp - extend player's personal timer
      if (result.timeBonus) {
        room.addPlayerBonusTime(socket.id, result.timeBonus);
      }

      // Send updated inventory to user
      const player = room.players.get(socket.id);
      if (player) {
        socket.emit('inventoryUpdate', { inventory: player.inventory });
      }

      // Notify only the user who used the item (not blocked)
      if (!result.blocked) {
        socket.emit('itemUsed', {
          fromPlayer: socket.id,
          item: result.item,
          targetPlayer: targetId
        });
      }

      // If sabotage, send active effect and notification to target
      if (result.item?.type === 'sabotage' && targetId && !result.blocked) {
        const targetSocket = io.sockets.sockets.get(targetId);
        if (targetSocket) {
          // Notify target they've been sabotaged
          targetSocket.emit('sabotaged', {
            item: result.item,
            fromPlayer: room.players.get(socket.id)?.name || 'Someone'
          });

          // For amnesia (permanent), send special event to clear keyboard
          if (itemId === 'amnesia') {
            targetSocket.emit('amnesiaClearKeyboard');
            targetSocket.emit('activeEffect', {
              effect: itemId,
              duration: 999999999, // Very long duration for permanent
              data: null
            });
          } else if (result.duration) {
            targetSocket.emit('activeEffect', {
              effect: itemId,
              duration: result.duration,
              data: result.shuffledKeys ? { shuffledKeys: result.shuffledKeys } : null
            });
          }
        }
      }

      // If shield blocked, notify both players
      if (result.blocked) {
        // Notify attacker their attack was blocked
        socket.emit('shieldBlocked', {
          targetPlayer: targetId,
          item: result.item
        });
        // Notify target their shield protected them
        const targetSocket = io.sockets.sockets.get(targetId);
        if (targetSocket) {
          const attackerName = room.players.get(socket.id)?.name || 'Someone';
          targetSocket.emit('shieldProtected', {
            attacker: attackerName,
            item: result.item
          });
          // Update target's inventory (shield was consumed)
          const targetPlayer = room.players.get(targetId);
          if (targetPlayer) {
            targetSocket.emit('inventoryUpdate', { inventory: targetPlayer.inventory });
          }
        }
      }

      // If letter revealed, send to user
      if (result.revealedLetter) {
        socket.emit('letterRevealed', result.revealedLetter);
      }

      // If X-Ray Vision used, send boards and start effect
      if (result.xrayData) {
        socket.emit('xrayVisionStart', {
          boards: result.xrayData,
          duration: result.xrayDuration
        });
        socket.emit('activeEffect', {
          effect: 'xray_vision',
          duration: result.xrayDuration,
          data: null
        });
      }

      // Send updated states
      io.to(roomCode).emit('gameStateUpdate', room.getPublicState());

      // Send updated player states (especially for identity theft swaps)
      for (const [playerId] of room.players) {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
          playerSocket.emit('playerState', room.getPlayerState(playerId));
        }
      }

      if (callback) callback({ success: true, ...result });
    } else {
      if (callback) callback(result);
    }
  });

  // Letter Snipe - check if a letter is in the word
  socket.on('letterSnipe', ({ letter }, callback) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = gameManager.getRoom(roomCode);
    if (!room || room.state !== 'playing') {
      if (callback) callback({ success: false, error: 'Game not in progress' });
      return;
    }

    const player = room.players.get(socket.id);
    if (!player) {
      if (callback) callback({ success: false, error: 'Player not found' });
      return;
    }

    // Check if player has Letter Snipe in inventory
    const itemIndex = player.inventory.findIndex(i => i.id === 'letter_snipe');
    if (itemIndex === -1) {
      if (callback) callback({ success: false, error: 'You do not have Letter Snipe' });
      return;
    }

    if (player.usedItemThisRound) {
      if (callback) callback({ success: false, error: 'Already used an item this round' });
      return;
    }

    // Use the item
    player.inventory.splice(itemIndex, 1);
    player.usedItemThisRound = true;

    const result = room.letterSnipe(socket.id, letter);

    // Send inventory update to user
    socket.emit('inventoryUpdate', { inventory: player.inventory });

    // Send result to user
    socket.emit('letterSnipeResult', {
      letter: result.letter,
      isInWord: result.isInWord
    });

    // Notify all players
    io.to(roomCode).emit('itemUsed', {
      fromPlayer: socket.id,
      item: { id: 'letter_snipe', name: 'Letter Snipe', emoji: '🎯', type: 'powerup' },
      targetPlayer: null
    });

    io.to(roomCode).emit('gameStateUpdate', room.getPublicState());

    if (callback) callback(result);
  });

  // DEBUG: Give all items to all players for testing
  socket.on('debugGiveAllItems', (callback) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = gameManager.getRoom(roomCode);
    if (!room) {
      if (callback) callback({ success: false, error: 'Room not found' });
      return;
    }

    // All item IDs
    const allItems = [
      { id: 'letter_snipe', type: 'powerup', name: 'Letter Snipe', emoji: '🎯' },
      { id: 'shield', type: 'powerup', name: 'Shield', emoji: '🛡️' },
      { id: 'letter_reveal', type: 'powerup', name: 'Letter Reveal', emoji: '✨' },
      { id: 'time_warp', type: 'powerup', name: 'Time Warp', emoji: '⏰' },
      { id: 'blindfold', type: 'sabotage', name: 'Blindfold', emoji: '🙈' },
      { id: 'flip_it', type: 'sabotage', name: 'Flip It', emoji: '🙃' },
      { id: 'keyboard_shuffle', type: 'sabotage', name: 'Keyboard Shuffle', emoji: '🔀' },
      { id: 'invisible_ink', type: 'sabotage', name: 'Invisible Ink', emoji: '👻' },
      { id: 'amnesia', type: 'sabotage', name: 'Amnesia', emoji: '🧠' },
      { id: 'identity_theft', type: 'sabotage', name: 'Identity Theft', emoji: '🔄' }
    ];

    // Give all items to all players (replace inventory)
    for (const [playerId, player] of room.players) {
      player.inventory = [...allItems];
      player.usedItemThisRound = false; // Allow using items
      const playerSocket = io.sockets.sockets.get(playerId);
      if (playerSocket) {
        playerSocket.emit('inventoryUpdate', { inventory: player.inventory });
      }
    }

    io.to(roomCode).emit('gameStateUpdate', room.getPublicState());
    if (callback) callback({ success: true, message: 'All items given to all players' });
  });

  // Start next round
  socket.on('nextRound', ({ customWord } = {}, callback) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) return;

    const room = gameManager.getRoom(roomCode);
    if (!room || room.state !== 'roundEnd') return;

    // Only host can start next round
    if (socket.id === room.hostId) {
      // Validate custom word against the word list
      if (customWord && customWord.length === 5) {
        const word = customWord.toUpperCase();
        if (!isValidWord(word)) {
          if (callback) callback({ success: false, error: 'Not a valid word' });
          return;
        }
        startRound(roomCode, word);
      } else {
        startRound(roomCode, null);
      }
      if (callback) callback({ success: true });
    }
  });

  // Force end current round (host only)
  socket.on('forceEndRound', () => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) return;

    const room = gameManager.getRoom(roomCode);
    if (!room || room.hostId !== socket.id || room.state !== 'playing') return;

    endRound(roomCode);
  });

  // End game early (host only) - for ending during play
  socket.on('endGame', () => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) return;

    const room = gameManager.getRoom(roomCode);
    if (!room) return;

    // Only host can end game - players should use playAgain to return to lobby
    if (room.hostId !== socket.id) return;

    // Only allow during playing state (not gameEnd - use playAgain for that)
    if (room.state !== 'playing') return;

    clearRoomTimers(roomCode);

    // Reset game state to lobby
    room.state = 'lobby';
    room.currentRound = 0;
    room.targetWord = null;
    room.roundScores = [];

    for (const player of room.players.values()) {
      // Host is always auto-ready
      player.ready = player.id === room.hostId;
      player.guesses = [];
      player.results = [];
      player.solved = false;
      player.solvedAt = null;
      player.solvedInGuesses = 0;
      player.totalScore = 0;
      player.roundScore = 0;
      // Reset battle royale elimination status
      player.eliminated = false;
      player.eliminatedRound = null;
      player.placement = null;
    }

    io.to(roomCode).emit('gameReset', room.getPublicState());
  });

  // Play again / Back to lobby (individual player action)
  socket.on('playAgain', (callback) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = gameManager.getRoom(roomCode);
    if (!room) {
      if (callback) callback({ success: false, error: 'Room no longer exists' });
      return;
    }

    // Only allow when game has ended
    if (room.state !== 'gameEnd' && room.state !== 'roundEnd') {
      if (callback) callback({ success: false, error: 'Game already in progress' });
      return;
    }

    // Mark this player as returned to lobby
    const player = room.players.get(socket.id);
    if (!player) {
      if (callback) callback({ success: false, error: 'You are no longer in this game' });
      return;
    }

    player.returnedToLobby = true;
    // Host is always auto-ready
    if (socket.id === room.hostId) {
      player.ready = true;
    }

    // Check if all players have returned to lobby
    const allReturned = [...room.players.values()].every(p => p.returnedToLobby);

    if (allReturned) {
      // Reset game state for everyone
      room.state = 'lobby';
      room.currentRound = 0;
      room.targetWord = null;
      room.roundScores = [];

      for (const p of room.players.values()) {
        // Host is always auto-ready
        p.ready = p.id === room.hostId;
        p.guesses = [];
        p.results = [];
        p.solved = false;
        p.solvedAt = null;
        p.solvedInGuesses = 0;
        p.totalScore = 0;
        p.roundScore = 0;
        p.returnedToLobby = false;
        // Reset battle royale elimination status
        p.eliminated = false;
        p.eliminatedRound = null;
        p.placement = null;
        // Reset power-ups state for new game
        p.inventory = [];
        p.hasShield = false;
        p.activeEffects = [];
        p.usedItemThisRound = false;
      }

      io.to(roomCode).emit('gameReset', room.getPublicState());
    } else {
      // Notify all players about who has returned
      io.to(roomCode).emit('gameStateUpdate', room.getPublicState());
    }

    if (callback) callback({ success: true });
  });

  // Kick player (host only)
  socket.on('kickPlayer', ({ targetPlayerId }, callback) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = gameManager.getRoom(roomCode);
    if (!room || room.hostId !== socket.id) {
      if (callback) callback({ success: false, error: 'Not the host' });
      return;
    }

    if (targetPlayerId === socket.id) {
      if (callback) callback({ success: false, error: 'Cannot kick yourself' });
      return;
    }

    const targetSocket = io.sockets.sockets.get(targetPlayerId);
    if (room.kickPlayer(targetPlayerId)) {
      playerRooms.delete(targetPlayerId);

      // Notify the kicked player
      if (targetSocket) {
        targetSocket.emit('kicked', { message: 'You have been kicked from the room' });
        targetSocket.leave(roomCode);
      }

      // Notify remaining players
      io.to(roomCode).emit('playerKicked', {
        playerId: targetPlayerId,
        gameState: room.getPublicState()
      });

      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: false, error: 'Could not kick player' });
    }
  });

  // Leave room
  socket.on('leaveRoom', (callback) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) {
      if (callback) callback({ success: false });
      return;
    }

    const room = gameManager.getRoom(roomCode);
    if (room) {
      const wasInGameEnd = room.state === 'gameEnd';
      const remaining = room.removePlayer(socket.id);
      socket.leave(roomCode);

      if (remaining === 0) {
        clearRoomTimers(roomCode);
        gameManager.deleteRoom(roomCode);
      } else {
        io.to(roomCode).emit('playerLeft', {
          playerId: socket.id,
          newHostId: room.hostId,
          gameState: room.getPublicState()
        });

        // If we're in gameEnd state and player left, check if all remaining players have returned
        if (wasInGameEnd) {
          const allReturned = [...room.players.values()].every(p => p.returnedToLobby);
          if (allReturned) {
            // Reset game state for everyone
            room.state = 'lobby';
            room.currentRound = 0;
            room.targetWord = null;
            room.roundScores = [];

            for (const p of room.players.values()) {
              // Preserve ready state, only ensure host is ready
              if (p.id === room.hostId) p.ready = true;
              p.guesses = [];
              p.results = [];
              p.solved = false;
              p.solvedAt = null;
              p.solvedInGuesses = 0;
              p.totalScore = 0;
              p.roundScore = 0;
              p.returnedToLobby = false;
              // Reset battle royale elimination status
              p.eliminated = false;
              p.eliminatedRound = null;
              p.placement = null;
            }

            io.to(roomCode).emit('gameReset', room.getPublicState());
          }
        }
      }
    }
    playerRooms.delete(socket.id);
    if (callback) callback({ success: true });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const roomCode = playerRooms.get(socket.id);
    if (roomCode) {
      const room = gameManager.getRoom(roomCode);
      if (room) {
        const player = room.players.get(socket.id);
        const wasInGameEnd = room.state === 'gameEnd';

        // Save player data for potential reconnection
        if (player) {
          // Use persistentId as primary key, with name as fallback
          const disconnectKey = player.persistentId
            ? `${player.persistentId}:${roomCode}`
            : `${player.name}:${roomCode}`;
          disconnectedPlayers.set(disconnectKey, {
            playerId: socket.id,
            disconnectTime: Date.now(),
            playerData: { ...player },
            wasHost: room.hostId === socket.id
          });

          // Clean up old disconnected players periodically
          setTimeout(() => {
            const stored = disconnectedPlayers.get(disconnectKey);
            if (stored && Date.now() - stored.disconnectTime >= RECONNECT_WINDOW_MS) {
              disconnectedPlayers.delete(disconnectKey);
            }
          }, RECONNECT_WINDOW_MS + 1000);
        }

        const remaining = room.removePlayer(socket.id);

        if (remaining === 0) {
          // Don't delete immediately - schedule deletion after timeout
          // This allows the host to reconnect after sharing link on mobile
          console.log(`Room ${roomCode} empty, scheduling deletion in ${RECONNECT_WINDOW_MS/1000}s`);

          const deletionTimer = setTimeout(() => {
            const roomStillExists = gameManager.getRoom(roomCode);
            if (roomStillExists && roomStillExists.players.size === 0) {
              clearRoomTimers(roomCode);
              gameManager.deleteRoom(roomCode);
              roomDeletionTimers.delete(roomCode);
              // Clean up disconnected players for this room
              for (const [key] of disconnectedPlayers) {
                if (key.endsWith(`:${roomCode}`)) {
                  disconnectedPlayers.delete(key);
                }
              }
              console.log(`Room ${roomCode} deleted (empty after timeout)`);
            }
          }, RECONNECT_WINDOW_MS);

          roomDeletionTimers.set(roomCode, deletionTimer);
        } else {
          io.to(roomCode).emit('playerLeft', {
            playerId: socket.id,
            newHostId: room.hostId,
            gameState: room.getPublicState()
          });

          // If we're in gameEnd state and player disconnected, check if all remaining players have returned
          if (wasInGameEnd) {
            const allReturned = [...room.players.values()].every(p => p.returnedToLobby);
            if (allReturned) {
              // Reset game state for everyone
              room.state = 'lobby';
              room.currentRound = 0;
              room.targetWord = null;
              room.roundScores = [];

              for (const p of room.players.values()) {
                // Preserve ready state, only ensure host is ready
                if (p.id === room.hostId) p.ready = true;
                p.guesses = [];
                p.results = [];
                p.solved = false;
                p.solvedAt = null;
                p.solvedInGuesses = 0;
                p.totalScore = 0;
                p.roundScore = 0;
                p.returnedToLobby = false;
                // Reset battle royale elimination status
                p.eliminated = false;
                p.eliminatedRound = null;
                p.placement = null;
              }

              io.to(roomCode).emit('gameReset', room.getPublicState());
            }
          }
        }
      }
      playerRooms.delete(socket.id);
    }
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎮 Wordle Multiplayer server running on port ${PORT}`);
});
