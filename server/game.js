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
      ...settings
    };
    this.state = 'lobby'; // lobby, countdown, playing, roundEnd, gameEnd
    this.currentRound = 0;
    this.targetWord = null;
    this.roundStartTime = null;
    this.guessDeadline = null;
    this.roundScores = [];
    
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
      connected: true
    });
    return true;
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
    
    // Reset player states for new round
    for (const player of this.players.values()) {
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
  
  submitGuess(playerId, guess) {
    const player = this.players.get(playerId);
    if (!player || player.solved || player.guesses.length >= 6) {
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
    
    // Round ends if all players solved or used all guesses
    for (const player of this.players.values()) {
      if (!player.solved && player.guesses.length < 6) {
        return false;
      }
    }
    return true;
  }
  
  endRound() {
    this.state = 'roundEnd';
    
    // Calculate scores for players who didn't solve
    for (const player of this.players.values()) {
      if (!player.solved) {
        player.roundScore = 0;
      }
    }
    
    // Store round scores
    const roundResult = {
      round: this.currentRound,
      word: this.targetWord,
      scores: {}
    };
    
    for (const [id, player] of this.players) {
      roundResult.scores[id] = {
        name: player.name,
        solved: player.solved,
        guesses: player.guesses.length,
        score: player.roundScore
      };
    }
    
    this.roundScores.push(roundResult);
    
    return roundResult;
  }
  
  isGameOver() {
    return this.currentRound >= this.settings.rounds;
  }
  
  endGame() {
    this.state = 'gameEnd';
    
    // Get final standings
    const standings = Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        totalScore: p.totalScore
      }))
      .sort((a, b) => b.totalScore - a.totalScore);
    
    return {
      standings,
      roundScores: this.roundScores
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
      guessTimeRemaining: this.getGuessTimeRemaining()
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
