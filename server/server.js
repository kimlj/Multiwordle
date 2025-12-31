import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameManager } from './game.js';
import { isValidWord } from './words.js';

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
  
  const timer = setInterval(() => {
    io.to(roomCode).emit('countdown', { seconds: countdown });
    
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
  
  // Send round start to all players
  io.to(roomCode).emit('roundStart', {
    round: room.currentRound,
    totalRounds: room.settings.rounds,
    roundTimeSeconds: room.settings.roundTimeSeconds,
    guessTimeSeconds: room.settings.guessTimeSeconds
  });

  // Send initial playerState to each player
  for (const [playerId, player] of room.players) {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket) {
      playerSocket.emit('playerState', room.getPlayerState(playerId));
    }
  }

  // Also send initial game state
  io.to(roomCode).emit('gameStateUpdate', room.getPublicState());

  // Start round timer
  const roundTimer = setInterval(() => {
    const remaining = room.getRoundTimeRemaining();
    const guessRemaining = room.getGuessTimeRemaining();
    
    io.to(roomCode).emit('timerUpdate', {
      roundTimeRemaining: remaining,
      guessTimeRemaining: guessRemaining
    });
    
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

  clearRoomTimers(roomCode);
  const roundResult = room.endRound();

  // Calculate detailed stats for each player
  const playerStats = {};
  for (const [playerId, player] of room.players) {
    if (player.solved) {
      const solveTimeMs = player.solvedAt - room.roundStartTime;
      const solveTimeSec = Math.floor(solveTimeMs / 1000);
      playerStats[playerId] = {
        solved: true,
        guesses: player.solvedInGuesses,
        timeSeconds: solveTimeSec,
        baseScore: 1000,
        guessBonus: (7 - player.solvedInGuesses) * 150,
        timeBonus: Math.floor(((room.settings.roundTimeSeconds * 1000 - solveTimeMs) / (room.settings.roundTimeSeconds * 1000)) * 500),
        totalScore: player.roundScore
      };
    } else {
      playerStats[playerId] = {
        solved: false,
        guesses: player.guesses.length,
        totalScore: 0
      };
    }
  }

  // Send full results including the word and detailed stats
  io.to(roomCode).emit('roundEnd', {
    ...roundResult,
    word: room.targetWord,
    playerStats,
    gameState: room.getPublicState()
  });

  // Send individual player states with their guesses revealed
  for (const [playerId, player] of room.players) {
    const socket = io.sockets.sockets.get(playerId);
    if (socket) {
      socket.emit('playerState', room.getPlayerState(playerId));
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

  const timer = setInterval(() => {
    io.to(roomCode).emit('nextRoundCountdown', { seconds: countdown });

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
      
      // Broadcast update to all players (without revealing letters)
      io.to(roomCode).emit('guessSubmitted', {
        playerId: socket.id,
        guessNumber: result.guessNumber,
        colors: result.colors,
        solved: result.solved,
        score: result.score,
        gameState: room.getPublicState()
      });
      
      // Check if round is over
      if (room.isRoundOver()) {
        setTimeout(() => endRound(roomCode), 1000);
      }
    } else {
      callback(result);
    }
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
