import { getRandomWord, isValidWord } from './words.js';

// Scoring System:
// Base points for solving: 1000
// Guess bonus: (7 - guessNumber) * 150 (fewer guesses = more points)
// Time bonus: remainingSeconds * 3 (faster = more points)
// Example: Solved in 3 guesses with 45 seconds remaining
// = 1000 + (7-3)*150 + 45*3 = 1000 + 600 + 135 = 1735 points

export function calculateScore(guessNumber, remainingTimeMs, totalTimeMs) {
  if (guessNumber === 0 || guessNumber > 6) return 0;
  
  const remainingSeconds = Math.floor(remainingTimeMs / 1000);
  const totalSeconds = Math.floor(totalTimeMs / 1000);
  
  // Base score for solving
  const baseScore = 1000;
  
  // Guess bonus (fewer guesses = higher bonus)
  const guessBonus = (7 - guessNumber) * 150;
  
  // Time bonus (percentage of time remaining * multiplier)
  const timePercentage = remainingTimeMs / totalTimeMs;
  const timeBonus = Math.floor(timePercentage * 500);
  
  return baseScore + guessBonus + timeBonus;
}

export function evaluateGuess(guess, targetWord) {
  const result = [];
  const target = targetWord.toUpperCase().split('');
  const guessArr = guess.toUpperCase().split('');
  const targetCounts = {};
  
  // Count letters in target
  for (const letter of target) {
    targetCounts[letter] = (targetCounts[letter] || 0) + 1;
  }
  
  // First pass: mark correct positions (green)
  for (let i = 0; i < 5; i++) {
    if (guessArr[i] === target[i]) {
      result[i] = { letter: guessArr[i], status: 'correct' };
      targetCounts[guessArr[i]]--;
    } else {
      result[i] = { letter: guessArr[i], status: 'absent' };
    }
  }
  
  // Second pass: mark present letters (yellow)
  for (let i = 0; i < 5; i++) {
    if (result[i].status !== 'correct') {
      if (targetCounts[guessArr[i]] > 0) {
        result[i].status = 'present';
        targetCounts[guessArr[i]]--;
      }
    }
  }
  
  return result;
}

export function countColors(result) {
  let green = 0;
  let yellow = 0;
  for (const cell of result) {
    if (cell.status === 'correct') green++;
    else if (cell.status === 'present') yellow++;
  }
  return { green, yellow };
}

export class GameRoom {
  constructor(roomCode, hostId, hostName, settings = {}) {
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.players = new Map();
    this.observers = [];
    this.settings = {
      rounds: settings.rounds || 3,
      roundTimeSeconds: settings.roundTimeSeconds || 300, // 5 minutes
      guessTimeSeconds: settings.guessTimeSeconds || 60, // 60 seconds per guess
      customWord: settings.customWord || null,
      gameMode: settings.gameMode || 'classic', // 'classic' or 'battleRoyale'
      mirrorMatch: settings.mirrorMatch || false, // Everyone starts with same opener
      hardcoreMode: settings.hardcoreMode || false, // No keyboard color hints
      ...settings
    };
    this.mirrorOpener = null; // The shared opener word for mirror match
    this.state = 'lobby'; // lobby, countdown, playing, roundEnd, gameEnd
    this.currentRound = 0;
    this.targetWord = null;
    this.roundStartTime = null;
    this.guessDeadline = null;
    this.roundScores = [];
    this.eliminatedThisRound = []; // Track who was eliminated this round (array for ties)

    // Add host as first player
    this.addPlayer(hostId, hostName);
  }
  
  addPlayer(playerId, playerName) {
    if (this.state !== 'lobby') return false;

    // Host is automatically ready
    const isHost = playerId === this.hostId;

    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      ready: isHost, // Host is auto-ready
      guesses: [],
      results: [],
      solved: false,
      solvedAt: null,
      solvedInGuesses: 0,
      currentGuess: '',
      totalScore: 0,
      roundScore: 0,
      connected: true,
      // Battle Royale fields
      eliminated: false,
      eliminatedRound: null,
      placement: null
    });
    return true;
  }

  // Get active (non-eliminated) players
  getActivePlayers() {
    return Array.from(this.players.values()).filter(p => !p.eliminated);
  }

  kickPlayer(playerId) {
    if (playerId === this.hostId) return false; // Can't kick host
    this.players.delete(playerId);
    return true;
  }
  
  removePlayer(playerId) {
    this.players.delete(playerId);
    // If host leaves, assign new host
    if (playerId === this.hostId && this.players.size > 0) {
      this.hostId = this.players.keys().next().value;
    }
    return this.players.size;
  }
  
  setPlayerReady(playerId, ready) {
    const player = this.players.get(playerId);
    if (player) {
      player.ready = ready;
    }
  }
  
  updatePlayerName(playerId, newName) {
    const player = this.players.get(playerId);
    if (player) {
      player.name = newName;
    }
  }
  
  allPlayersReady() {
    if (this.players.size < 1) return false;
    for (const player of this.players.values()) {
      if (!player.ready) return false;
    }
    return true;
  }
  
  startCountdown() {
    this.state = 'countdown';
  }
  
  startRound(customWord = null) {
    this.currentRound++;
    this.state = 'playing';
    this.targetWord = customWord || getRandomWord();
    this.roundStartTime = Date.now();
    this.guessDeadline = Date.now() + (this.settings.guessTimeSeconds * 1000);
    this.eliminatedThisRound = [];

    // Reset player states for new round (only non-eliminated players)
    for (const player of this.players.values()) {
      if (!player.eliminated) {
        player.guesses = [];
        player.results = [];
        player.solved = false;
        player.solvedAt = null;
        player.solvedInGuesses = 0;
        player.currentGuess = '';
        player.roundScore = 0;
        player.ready = false;
      }
    }

    // Reset mirror opener
    this.mirrorOpener = null;
  }

  // Apply mirror match opener to all active players
  applyMirrorOpener(openerWord) {
    this.mirrorOpener = openerWord.toUpperCase();
    const results = [];

    for (const player of this.players.values()) {
      if (!player.eliminated) {
        const result = evaluateGuess(this.mirrorOpener, this.targetWord);
        player.guesses.push(this.mirrorOpener);
        player.results.push(result);

        // Check if opener solved it (unlikely but possible)
        const colors = countColors(result);
        if (colors.green === 5) {
          player.solved = true;
          player.solvedAt = Date.now();
          player.solvedInGuesses = 1;

          const remainingTime = (this.settings.roundTimeSeconds * 1000) - (player.solvedAt - this.roundStartTime);
          player.roundScore = calculateScore(1, remainingTime, this.settings.roundTimeSeconds * 1000);
          player.totalScore += player.roundScore;
        }

        results.push({
          playerId: player.id,
          result,
          colors
        });
      }
    }

    return {
      opener: this.mirrorOpener,
      results
    };
  }
  
  submitGuess(playerId, guess) {
    const player = this.players.get(playerId);
    if (!player || player.eliminated || player.solved || player.guesses.length >= 6) {
      return { success: false, error: 'Cannot submit guess' };
    }
    
    const upperGuess = guess.toUpperCase();
    
    if (upperGuess.length !== 5) {
      return { success: false, error: 'Guess must be 5 letters' };
    }
    
    if (!isValidWord(upperGuess)) {
      return { success: false, error: 'Not a valid word' };
    }
    
    const result = evaluateGuess(upperGuess, this.targetWord);
    const colors = countColors(result);
    
    player.guesses.push(upperGuess);
    player.results.push(result);
    
    // Check if solved
    if (colors.green === 5) {
      player.solved = true;
      player.solvedAt = Date.now();
      player.solvedInGuesses = player.guesses.length;
      
      const remainingTime = (this.settings.roundTimeSeconds * 1000) - (player.solvedAt - this.roundStartTime);
      player.roundScore = calculateScore(
        player.solvedInGuesses,
        remainingTime,
        this.settings.roundTimeSeconds * 1000
      );
      player.totalScore += player.roundScore;
    }
    
    // Reset guess deadline for next guess
    this.guessDeadline = Date.now() + (this.settings.guessTimeSeconds * 1000);
    
    return {
      success: true,
      result,
      colors,
      guessNumber: player.guesses.length,
      solved: player.solved,
      score: player.roundScore
    };
  }
  
  getRoundTimeRemaining() {
    if (!this.roundStartTime) return 0;
    const elapsed = Date.now() - this.roundStartTime;
    const remaining = (this.settings.roundTimeSeconds * 1000) - elapsed;
    return Math.max(0, remaining);
  }
  
  getGuessTimeRemaining() {
    if (!this.guessDeadline) return 0;
    const remaining = this.guessDeadline - Date.now();
    return Math.max(0, remaining);
  }
  
  isRoundOver() {
    // Round ends if time is up
    if (this.getRoundTimeRemaining() <= 0) return true;

    // Round ends if all active (non-eliminated) players solved or used all guesses
    const activePlayers = this.getActivePlayers();
    for (const player of activePlayers) {
      if (!player.solved && player.guesses.length < 6) {
        return false;
      }
    }
    return true;
  }
  
  endRound() {
    this.state = 'roundEnd';
    this.eliminatedThisRound = [];

    // Calculate scores for players who didn't solve
    for (const player of this.players.values()) {
      if (!player.eliminated && !player.solved) {
        player.roundScore = 0;
      }
    }

    // Store round scores
    const roundResult = {
      round: this.currentRound,
      word: this.targetWord,
      scores: {},
      eliminated: null
    };

    for (const [id, player] of this.players) {
      roundResult.scores[id] = {
        name: player.name,
        solved: player.solved,
        guesses: player.guesses.length,
        score: player.roundScore,
        eliminated: player.eliminated
      };
    }

    // Battle Royale elimination logic
    if (this.settings.gameMode === 'battleRoyale') {
      const activePlayers = this.getActivePlayers();

      // Only eliminate if more than 1 active player would remain after elimination
      if (activePlayers.length > 1) {
        // Find lowest scorer(s) among active players
        const lowestScore = Math.min(...activePlayers.map(p => p.roundScore));
        const lowestScorers = activePlayers.filter(p => p.roundScore === lowestScore);

        // Eliminate all tied lowest scorers (but keep at least 1 player alive)
        const canEliminate = Math.min(lowestScorers.length, activePlayers.length - 1);
        const toEliminate = lowestScorers.slice(0, canEliminate);

        this.eliminatedThisRound = [];

        for (let i = 0; i < toEliminate.length; i++) {
          const eliminated = toEliminate[i];
          eliminated.eliminated = true;
          eliminated.eliminatedRound = this.currentRound;
          // Placement: if 5 active and 2 eliminated, they get 5th and 4th place
          eliminated.placement = activePlayers.length - i;

          this.eliminatedThisRound.push({
            id: eliminated.id,
            name: eliminated.name,
            score: eliminated.roundScore,
            placement: eliminated.placement
          });
        }

        roundResult.eliminated = this.eliminatedThisRound;
      }
    }

    this.roundScores.push(roundResult);

    return roundResult;
  }
  
  isGameOver() {
    if (this.settings.gameMode === 'battleRoyale') {
      // Battle Royale ends when only 1 player remains
      const activePlayers = this.getActivePlayers();
      return activePlayers.length <= 1;
    }
    // Classic mode ends after configured rounds
    return this.currentRound >= this.settings.rounds;
  }
  
  endGame() {
    this.state = 'gameEnd';

    // In Battle Royale, set winner's placement
    if (this.settings.gameMode === 'battleRoyale') {
      const activePlayers = this.getActivePlayers();
      if (activePlayers.length === 1) {
        activePlayers[0].placement = 1; // Winner!
      }
    }

    // Get final standings
    const standings = Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        totalScore: p.totalScore,
        eliminated: p.eliminated,
        eliminatedRound: p.eliminatedRound,
        placement: p.placement
      }))
      .sort((a, b) => {
        // In Battle Royale, sort by placement (1st, 2nd, etc.)
        if (this.settings.gameMode === 'battleRoyale') {
          if (a.placement && b.placement) return a.placement - b.placement;
          if (a.placement) return -1; // Winner first
          if (b.placement) return 1;
        }
        // Fallback to score
        return b.totalScore - a.totalScore;
      });

    return {
      standings,
      roundScores: this.roundScores,
      gameMode: this.settings.gameMode,
      winner: this.settings.gameMode === 'battleRoyale' ? this.getActivePlayers()[0] : null
    };
  }
  
  getPublicState() {
    const players = {};
    for (const [id, player] of this.players) {
      players[id] = {
        id: player.id,
        name: player.name,
        ready: player.ready,
        guessCount: player.guesses.length,
        solved: player.solved,
        solvedInGuesses: player.solvedInGuesses,
        totalScore: player.totalScore,
        roundScore: player.roundScore,
        returnedToLobby: player.returnedToLobby || false,
        // Battle Royale fields
        eliminated: player.eliminated || false,
        eliminatedRound: player.eliminatedRound,
        placement: player.placement,
        // Send all guess results (colors only, no letters) for other players to see progress
        guessResults: player.results.map(result =>
          result.map(cell => cell.status)
        ),
        // Only show results (colors), not the actual letters guessed
        lastGuessColors: player.results.length > 0
          ? countColors(player.results[player.results.length - 1])
          : null
      };
    }

    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      state: this.state,
      currentRound: this.currentRound,
      totalRounds: this.settings.rounds,
      settings: this.settings,
      players,
      roundTimeRemaining: this.getRoundTimeRemaining(),
      guessTimeRemaining: this.getGuessTimeRemaining(),
      // Battle Royale info
      gameMode: this.settings.gameMode,
      activePlayers: this.getActivePlayers().length,
      eliminatedThisRound: this.eliminatedThisRound
    };
  }

  // Get spectator view with all players' full board state (for eliminated players)
  getSpectatorState() {
    const players = {};
    for (const [id, player] of this.players) {
      players[id] = {
        id: player.id,
        name: player.name,
        eliminated: player.eliminated || false,
        eliminatedRound: player.eliminatedRound,
        placement: player.placement,
        solved: player.solved,
        solvedInGuesses: player.solvedInGuesses,
        totalScore: player.totalScore,
        roundScore: player.roundScore,
        // Full board visibility for spectators
        guesses: player.guesses,
        results: player.results
      };
    }

    return {
      roomCode: this.roomCode,
      state: this.state,
      currentRound: this.currentRound,
      targetWord: this.state === 'roundEnd' || this.state === 'gameEnd' ? this.targetWord : null,
      gameMode: this.settings.gameMode,
      activePlayers: this.getActivePlayers().length,
      players
    };
  }
  
  getPlayerState(playerId) {
    const player = this.players.get(playerId);
    if (!player) return null;
    
    return {
      ...player,
      targetWord: this.state === 'roundEnd' || this.state === 'gameEnd' ? this.targetWord : null
    };
  }
}

// Room management
export class GameManager {
  constructor() {
    this.rooms = new Map();
  }
  
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }
  
  createRoom(hostId, hostName, settings) {
    const roomCode = this.generateRoomCode();
    const room = new GameRoom(roomCode, hostId, hostName, settings);
    this.rooms.set(roomCode, room);
    return room;
  }
  
  getRoom(roomCode) {
    return this.rooms.get(roomCode.toUpperCase());
  }
  
  deleteRoom(roomCode) {
    this.rooms.delete(roomCode);
  }
  
  cleanupEmptyRooms() {
    for (const [code, room] of this.rooms) {
      if (room.players.size === 0) {
        this.rooms.delete(code);
      }
    }
  }
}
