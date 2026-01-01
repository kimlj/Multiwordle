import { getRandomWord, isValidWord } from './words.js';

// ============================================
// POWER-UPS & SABOTAGES SYSTEM
// ============================================

// Item definitions
export const ITEMS = {
  // Power-ups (help yourself)
  LETTER_SNIPE: { id: 'letter_snipe', type: 'powerup', name: 'Letter Snipe', rarity: 'common', emoji: '🎯' },
  SHIELD: { id: 'shield', type: 'powerup', name: 'Shield', rarity: 'legendary', emoji: '🛡️' },
  MIRROR_SHIELD: { id: 'mirror_shield', type: 'powerup', name: 'Mirror Shield', rarity: 'rare', emoji: '🪞' },
  SECOND_CHANCE: { id: 'second_chance', type: 'powerup', name: 'Second Chance', rarity: 'rare', emoji: '🔁' },
  XRAY_VISION: { id: 'xray_vision', type: 'powerup', name: 'X-Ray Vision', rarity: 'legendary', emoji: '👁️' },

  // Sabotages (hurt opponents) - Duration: 35% of round time
  BLINDFOLD: { id: 'blindfold', type: 'sabotage', name: 'Blindfold', rarity: 'rare', emoji: '🙈' },
  FLIP_IT: { id: 'flip_it', type: 'sabotage', name: 'Flip It', rarity: 'common', emoji: '🙃' },
  KEYBOARD_SHUFFLE: { id: 'keyboard_shuffle', type: 'sabotage', name: 'Keyboard Shuffle', rarity: 'common', emoji: '🔀' },
  STICKY_KEYS: { id: 'sticky_keys', type: 'sabotage', name: 'Sticky Keys', rarity: 'common', emoji: '🍯' },
  INVISIBLE_INK: { id: 'invisible_ink', type: 'sabotage', name: 'Invisible Ink', rarity: 'rare', emoji: '👻' },
  IDENTITY_THEFT: { id: 'identity_theft', type: 'sabotage', name: 'Identity Theft', rarity: 'legendary', emoji: '🔄', instant: true }
};

// Rarity pools for drops (3 tiers: common, rare, legendary)
export const RARITY_POOLS = {
  common: ['letter_snipe', 'flip_it', 'keyboard_shuffle', 'sticky_keys'],
  rare: ['invisible_ink', 'blindfold', 'mirror_shield', 'second_chance'],
  legendary: ['identity_theft', 'xray_vision', 'shield']
};

// Item Round Challenge Types
export const CHALLENGES = {
  SPEED_SOLVE: { id: 'speed_solve', name: 'Speed Solve', description: 'Solve in under 30 seconds', emoji: '⚡', rewardTier: 'legendary' },
  RARE_LETTERS: { id: 'rare_letters', name: 'Rare Letters', description: 'Use Z, X, Q, or J in a guess', emoji: '💎', rewardTier: 'common_rare' },
  FIRST_BLOOD: { id: 'first_blood', name: 'First Blood', description: 'First player to solve the word', emoji: '🩸', rewardTier: 'legendary' },
  EFFICIENCY: { id: 'efficiency', name: 'Efficiency', description: 'Solve in 3 guesses or less', emoji: '🎯', rewardTier: 'legendary' }
};

// Rare letters for the challenge
export const RARE_LETTERS = ['Z', 'X', 'Q', 'J'];

// Drop chances per round based on position
export const DROP_CHANCES = {
  underdog: 50, // 50% chance to get item
  middle: 30,   // 30% chance
  leader: 15    // 15% chance
};

// Rarity chances based on position (3 tiers: common, rare, legendary)
export const RARITY_CHANCES = {
  underdog: { legendary: 20, rare: 40, common: 40 },
  middle: { legendary: 15, rare: 35, common: 50 },
  leader: { legendary: 10, rare: 30, common: 60 }
};

// Check if player gets a drop this round
export function shouldGetDrop(playerPosition, totalPlayers) {
  const isLeader = playerPosition <= 2;
  const isUnderdog = playerPosition >= totalPlayers - 1;

  let dropChance;
  if (isUnderdog) dropChance = DROP_CHANCES.underdog;
  else if (isLeader) dropChance = DROP_CHANCES.leader;
  else dropChance = DROP_CHANCES.middle;

  return Math.random() * 100 < dropChance;
}

// Get random item based on player position (Mario Kart style)
export function getRandomDrop(playerPosition, totalPlayers, isPowerUpOnly = false, isSabotageOnly = false) {
  const isLeader = playerPosition <= 2;
  const isUnderdog = playerPosition >= totalPlayers - 1;

  // Determine rarity based on weighted chance (3 tiers)
  const roll = Math.random() * 100;
  let rarity;
  let chances;

  if (isUnderdog) chances = RARITY_CHANCES.underdog;
  else if (isLeader) chances = RARITY_CHANCES.leader;
  else chances = RARITY_CHANCES.middle;

  if (roll < chances.legendary) rarity = 'legendary';
  else if (roll < chances.legendary + chances.rare) rarity = 'rare';
  else rarity = 'common';

  // Get items from the selected rarity pool
  let eligibleItems = [...RARITY_POOLS[rarity]];

  // Filter by type if requested
  if (isPowerUpOnly) {
    eligibleItems = eligibleItems.filter(id => ITEMS[id.toUpperCase()]?.type === 'powerup');
  } else if (isSabotageOnly) {
    eligibleItems = eligibleItems.filter(id => ITEMS[id.toUpperCase()]?.type === 'sabotage');
  }

  // If no items in selected rarity match criteria, try other rarities
  if (eligibleItems.length === 0) {
    const allRarities = ['common', 'rare', 'legendary'];
    for (const r of allRarities) {
      let pool = [...RARITY_POOLS[r]];
      if (isPowerUpOnly) {
        pool = pool.filter(id => ITEMS[id.toUpperCase()]?.type === 'powerup');
      } else if (isSabotageOnly) {
        pool = pool.filter(id => ITEMS[id.toUpperCase()]?.type === 'sabotage');
      }
      if (pool.length > 0) {
        eligibleItems = pool;
        break;
      }
    }
  }

  // Final fallback
  if (eligibleItems.length === 0) {
    eligibleItems = RARITY_POOLS.common;
  }

  const randomId = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
  return ITEMS[randomId.toUpperCase()];
}

// Get random drops for a round - each player has individual chance based on position
// Returns array of { playerId, item }
export function getRandomRoundDrops(players, playerCount) {
  const drops = [];

  // Sort players by score to determine position
  const sortedPlayers = [...players].sort((a, b) => b.totalScore - a.totalScore);

  for (let i = 0; i < sortedPlayers.length; i++) {
    const player = sortedPlayers[i];
    const position = i + 1; // 1-indexed position

    // Check if this player gets a drop based on their position
    if (shouldGetDrop(position, playerCount)) {
      drops.push({
        playerId: player.id,
        item: getRandomDrop(position, playerCount)
      });
    }
  }

  return drops;
}

// Calculate sabotage duration (35% of round time)
export function getSabotageDuration(roundTimeSeconds) {
  return Math.floor(roundTimeSeconds * 0.35 * 1000); // Return in milliseconds
}

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
      freshOpenersOnly: settings.freshOpenersOnly || false, // Can't reuse openers from previous rounds
      powerUpsEnabled: settings.powerUpsEnabled || false, // Enable power-ups and sabotages
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

    // Item Round system
    this.itemRounds = new Set(); // Which rounds are Item Rounds
    this.currentChallenge = null; // Current Item Round challenge
    this.itemRoundReward = null; // Pre-determined reward for this Item Round
    this.firstSolverPlayerId = null; // For First Blood challenge (first to solve)
    this.challengeCompletedBy = new Set(); // Players who completed the challenge this round

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
      placement: null,
      // Fresh Openers tracking
      usedOpeners: [],
      // Power-ups & Sabotages
      inventory: [],
      hasMirrorShield: false, // Mirror Shield - one-time reflect, then expires
      hasSecondChance: false, // Second Chance - allows 7th guess
      activeEffects: [], // Active effects: { type, expiresAt, data } - includes shield
      earnCooldown: false, // Skill-based earn cooldown
      failedRoundsStreak: 0, // For Mercy Drop
      lastRoundPosition: null // For Comeback Drop
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

  // Initialize Item Rounds BEFORE game starts (called when game starts)
  // Randomly selects which rounds will be Item Rounds for this game
  initializeItemRounds() {
    if (!this.settings.powerUpsEnabled) {
      this.itemRounds = new Set();
      return;
    }

    const totalRounds = this.settings.rounds;

    // Calculate how many item rounds (less than 50%, at least 1 if 3+ rounds)
    // 3 rounds: 1, 4 rounds: 1, 5 rounds: 2, 6 rounds: 2, 7 rounds: 3, etc.
    const numItemRounds = Math.max(1, Math.floor((totalRounds - 1) / 2));

    // Available rounds: all except the last round
    const availableRounds = [];
    for (let r = 1; r < totalRounds; r++) {
      availableRounds.push(r);
    }

    // Shuffle available rounds
    for (let i = availableRounds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableRounds[i], availableRounds[j]] = [availableRounds[j], availableRounds[i]];
    }

    // Pick the first numItemRounds and sort them
    const selectedRounds = availableRounds.slice(0, numItemRounds).sort((a, b) => a - b);
    this.itemRounds = new Set(selectedRounds);

    console.log(`Item Rounds for ${totalRounds}-round game: [${[...this.itemRounds].join(', ')}]`);
  }

  // Prepare the next round's Item Round challenge and reward (called during countdown)
  prepareNextItemRound() {
    const nextRound = this.currentRound + 1;

    // Set challenge and reward for next round if it's an Item Round
    if (this.settings.powerUpsEnabled && this.itemRounds.has(nextRound)) {
      const challenges = Object.values(CHALLENGES);
      this.currentChallenge = challenges[Math.floor(Math.random() * challenges.length)];

      // Select reward based on challenge's reward tier
      if (this.currentChallenge.rewardTier === 'legendary') {
        // Legendary challenges: random legendary item
        const legendaryItems = RARITY_POOLS.legendary;
        const randomId = legendaryItems[Math.floor(Math.random() * legendaryItems.length)];
        this.itemRoundReward = ITEMS[randomId.toUpperCase()];
      } else {
        // common_rare tier: random from common or rare pools
        const commonRareItems = [...RARITY_POOLS.common, ...RARITY_POOLS.rare];
        const randomId = commonRareItems[Math.floor(Math.random() * commonRareItems.length)];
        this.itemRoundReward = ITEMS[randomId.toUpperCase()];
      }
    } else {
      this.currentChallenge = null;
      this.itemRoundReward = null;
    }

    return {
      isItemRound: this.itemRounds.has(nextRound),
      challenge: this.currentChallenge,
      reward: this.itemRoundReward
    };
  }
  
  startRound(customWord = null) {
    this.currentRound++;
    this.state = 'playing';
    this.targetWord = customWord || getRandomWord();
    this.roundStartTime = Date.now();
    this.guessDeadline = Date.now() + (this.settings.guessTimeSeconds * 1000);
    this.eliminatedThisRound = [];

    // Reset Item Round tracking (challenge and reward were pre-set during countdown)
    this.firstSolverPlayerId = null;
    this.challengeCompletedBy = new Set();

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
        // Reset item effects for new round
        player.activeEffects = [];
        player.bonusTime = 0;
        player.hasMirrorShield = false;
        player.hasSecondChance = false;
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

        // Note: Mirror opener is NOT tracked for Fresh Openers mode
        // The player's "real" opener is their second guess when mirror match is on

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
    const maxGuesses = player?.hasSecondChance ? 7 : 6;
    if (!player || player.eliminated || player.solved || player.guesses.length >= maxGuesses) {
      return { success: false, error: 'Cannot submit guess' };
    }
    
    const upperGuess = guess.toUpperCase();
    
    if (upperGuess.length !== 5) {
      return { success: false, error: 'Guess must be 5 letters' };
    }
    
    if (!isValidWord(upperGuess)) {
      return { success: false, error: 'Not a valid word' };
    }

    // Fresh Openers Only: Block reused openers
    // If mirror match is on, the "opener" is the second guess (first is auto-filled)
    const openerGuessIndex = this.settings.mirrorMatch ? 1 : 0;
    const isOpenerGuess = player.guesses.length === openerGuessIndex;
    if (this.settings.freshOpenersOnly && isOpenerGuess && player.usedOpeners.includes(upperGuess)) {
      return { success: false, error: `Already used ${upperGuess} as opener!` };
    }

    const result = evaluateGuess(upperGuess, this.targetWord);
    const colors = countColors(result);

    // Track opener for Fresh Openers mode
    if (isOpenerGuess && !player.usedOpeners.includes(upperGuess)) {
      player.usedOpeners.push(upperGuess);
    }

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

  getPlayerTimeRemaining(playerId) {
    const player = this.players.get(playerId);
    if (!player) return 0;
    const baseRemaining = this.getRoundTimeRemaining();
    return baseRemaining + (player.bonusTime || 0);
  }

  addPlayerBonusTime(playerId, ms) {
    const player = this.players.get(playerId);
    if (player) {
      player.bonusTime = (player.bonusTime || 0) + ms;
    }
  }
  
  getGuessTimeRemaining() {
    if (!this.guessDeadline) return 0;
    const remaining = this.guessDeadline - Date.now();
    return Math.max(0, remaining);
  }
  
  isRoundOver() {
    const activePlayers = this.getActivePlayers();
    const baseTimeUp = this.getRoundTimeRemaining() <= 0;

    // Check each active player
    for (const player of activePlayers) {
      // Player still playing if they haven't solved and have guesses left
      if (!player.solved && player.guesses.length < 6) {
        // If base time is up, check if player has bonus time
        if (baseTimeUp) {
          const playerTimeRemaining = (player.bonusTime || 0);
          if (playerTimeRemaining > 0) {
            // Player still has bonus time, round continues for them
            return false;
          }
        } else {
          // Base time still running
          return false;
        }
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
          : null,
        // Power-ups & Sabotages
        inventoryCount: player.inventory.length,
        hasShield: this.hasActiveShield(id), // Duration-based shield check
        hasMirrorShield: player.hasMirrorShield, // One-time reflect
        activeEffects: player.activeEffects.map(e => ({
          type: e.type,
          expiresAt: e.expiresAt,
          permanent: e.permanent
        }))
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
      eliminatedThisRound: this.eliminatedThisRound,
      // Item Round info
      isItemRound: this.itemRounds.has(this.currentRound),
      currentChallenge: this.currentChallenge,
      itemRoundReward: this.itemRoundReward
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

  // ============================================
  // POWER-UPS & SABOTAGES METHODS
  // ============================================

  addItemToInventory(playerId, item) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };

    // No max limit - items accumulate
    player.inventory.push({
      id: item.id,
      type: item.type,
      name: item.name,
      rarity: item.rarity,
      emoji: item.emoji
    });

    return { success: true, item };
  }

  useItem(playerId, itemId, targetId = null) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };
    // Removed: usedItemThisRound limit - players can now use all their items
    if (player.eliminated) return { success: false, error: 'Eliminated players cannot use items' };

    const itemIndex = player.inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return { success: false, error: 'Item not in inventory' };

    const item = player.inventory[itemIndex];

    // Convert item id to ITEMS key format (e.g., 'mirror_shield' -> 'MIRROR_SHIELD')
    const itemKey = itemId.toUpperCase();
    const itemDef = ITEMS[itemKey];

    if (!itemDef) {
      console.error(`Unknown item: ${itemId} (key: ${itemKey})`);
      return { success: false, error: 'Unknown item type' };
    }

    // Validate target for sabotages
    if (item.type === 'sabotage' && !targetId) {
      return { success: false, error: 'Sabotage requires a target' };
    }

    let result = { success: true, item, targetId };

    // Handle sabotages targeting other players
    if (item.type === 'sabotage' && targetId) {
      const target = this.players.get(targetId);
      if (!target) return { success: false, error: 'Target not found' };
      if (target.eliminated) return { success: false, error: 'Cannot target eliminated players' };
      if (targetId === playerId) return { success: false, error: 'Cannot target yourself' };

      // Check if target has Mirror Shield in inventory (will prompt them)
      const hasMirrorShieldItem = target.inventory.some(i => i.id === 'mirror_shield');
      if (hasMirrorShieldItem) {
        // Remove attacker's item NOW (they used it, regardless of mirror shield response)
        player.inventory.splice(itemIndex, 1);
        // Don't apply sabotage yet - server will send prompt to target
        result.pendingMirrorShield = true;
        result.awaitingResponse = true;
        return result;
      }
      // Check for Shield - blocks all sabotages while active (duration-based)
      else if (this.hasActiveShield(targetId)) {
        result.blocked = true;
        result.blockedBy = target.name;
        // Shield stays active - doesn't expire on block
      } else {
        // Apply sabotage effect to target
        const duration = itemDef.permanent ? null : getSabotageDuration(this.settings.roundTimeSeconds);
        const expiresAt = duration ? Date.now() + duration : null;

        if (itemId === 'identity_theft') {
          // Swap progress between players
          result.swapData = this.swapPlayerProgress(playerId, targetId);
        } else {
          target.activeEffects.push({
            type: itemId,
            expiresAt,
            fromPlayer: player.name,
            permanent: itemDef.permanent || false
          });
        }

        result.duration = duration;
        result.targetName = target.name;
      }
    }

    // Handle power-ups
    if (item.type === 'powerup') {
      if (itemId === 'shield') {
        // Shield is duration-based - blocks ALL sabotages while active
        const duration = getSabotageDuration(this.settings.roundTimeSeconds);
        player.activeEffects.push({
          type: 'shield',
          expiresAt: Date.now() + duration,
          permanent: false
        });
        result.activated = true;
        result.duration = duration;
      } else if (itemId === 'mirror_shield') {
        // Mirror Shield is passive - activates via prompt when attacked
        // This shouldn't be called directly, but just in case
        result.activated = false;
        result.error = 'Mirror Shield activates automatically when attacked';
        return result;
      } else if (itemId === 'second_chance') {
        player.hasSecondChance = true;
        result.activated = true;
      } else if (itemId === 'xray_vision') {
        // X-Ray Vision - see all players' boards for 10 seconds
        const duration = 10000; // 10 seconds
        player.activeEffects.push({
          type: 'xray_vision',
          expiresAt: Date.now() + duration
        });
        result.xrayData = this.getAllPlayersBoards(playerId);
        result.xrayDuration = duration;
      }
      // letter_snipe is handled separately via letterSnipe method
    }

    // Remove item from inventory
    player.inventory.splice(itemIndex, 1);

    return result;
  }

  letterSnipe(playerId, letter) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };

    const upperLetter = letter.toUpperCase();
    const isInWord = this.targetWord.toUpperCase().includes(upperLetter);

    return {
      success: true,
      letter: upperLetter,
      isInWord
    };
  }

  revealRandomLetter(playerId) {
    const player = this.players.get(playerId);
    if (!player) return null;

    const target = this.targetWord.toUpperCase();

    // Find positions not yet revealed (green) by the player
    const revealedPositions = new Set();
    for (const result of player.results) {
      result.forEach((cell, idx) => {
        if (cell.status === 'correct') revealedPositions.add(idx);
      });
    }

    // Get unrevealed positions
    const unrevealedPositions = [];
    for (let i = 0; i < 5; i++) {
      if (!revealedPositions.has(i)) {
        unrevealedPositions.push(i);
      }
    }

    if (unrevealedPositions.length === 0) return null;

    const randomPos = unrevealedPositions[Math.floor(Math.random() * unrevealedPositions.length)];
    return {
      position: randomPos + 1, // 1-indexed for display
      letter: target[randomPos]
    };
  }

  swapPlayerProgress(player1Id, player2Id) {
    const p1 = this.players.get(player1Id);
    const p2 = this.players.get(player2Id);

    if (!p1 || !p2) return null;

    // Swap guesses and results
    const tempGuesses = [...p1.guesses];
    const tempResults = [...p1.results];
    const tempSolved = p1.solved;
    const tempSolvedAt = p1.solvedAt;
    const tempSolvedInGuesses = p1.solvedInGuesses;
    const tempRoundScore = p1.roundScore;

    p1.guesses = [...p2.guesses];
    p1.results = [...p2.results];
    p1.solved = p2.solved;
    p1.solvedAt = p2.solvedAt;
    p1.solvedInGuesses = p2.solvedInGuesses;
    p1.roundScore = p2.roundScore;

    p2.guesses = tempGuesses;
    p2.results = tempResults;
    p2.solved = tempSolved;
    p2.solvedAt = tempSolvedAt;
    p2.solvedInGuesses = tempSolvedInGuesses;
    p2.roundScore = tempRoundScore;

    return {
      player1: { id: player1Id, newGuessCount: p1.guesses.length },
      player2: { id: player2Id, newGuessCount: p2.guesses.length }
    };
  }

  // Clean up expired effects
  cleanupExpiredEffects() {
    const now = Date.now();
    for (const player of this.players.values()) {
      player.activeEffects = player.activeEffects.filter(effect => {
        if (effect.permanent) return true;
        return effect.expiresAt > now;
      });
    }
  }

  // Check if player has active shield (duration-based)
  hasActiveShield(playerId) {
    const player = this.players.get(playerId);
    if (!player) return false;
    const now = Date.now();
    return player.activeEffects.some(e => e.type === 'shield' && e.expiresAt > now);
  }

  // Apply a sabotage effect to a player (used after mirror shield decision)
  applySabotage(targetId, itemId, fromPlayerId) {
    const target = this.players.get(targetId);
    const fromPlayer = this.players.get(fromPlayerId);
    if (!target || !fromPlayer) return null;

    const itemKey = itemId.toUpperCase();
    const itemDef = ITEMS[itemKey];
    if (!itemDef) return null;

    const duration = itemDef.instant ? null : getSabotageDuration(this.settings.roundTimeSeconds);
    const expiresAt = duration ? Date.now() + duration : null;

    if (itemId === 'identity_theft') {
      return {
        type: 'identity_theft',
        swapData: this.swapPlayerProgress(fromPlayerId, targetId)
      };
    } else {
      target.activeEffects.push({
        type: itemId,
        expiresAt,
        fromPlayer: fromPlayer.name,
        permanent: itemDef.permanent || false
      });
      return { type: itemId, duration, expiresAt };
    }
  }

  // Use mirror shield - reflects sabotage back to attacker
  useMirrorShield(targetId, itemId, attackerId) {
    const target = this.players.get(targetId);
    if (!target) return { success: false, error: 'Player not found' };

    // Find and remove mirror shield from inventory
    const itemIndex = target.inventory.findIndex(i => i.id === 'mirror_shield');
    if (itemIndex === -1) return { success: false, error: 'No Mirror Shield in inventory' };

    target.inventory.splice(itemIndex, 1);

    // Identity Theft is special - reflecting it just BLOCKS the swap entirely
    // (swapping in reverse is the same as swapping, so we just cancel it)
    if (itemId === 'identity_theft') {
      return {
        success: true,
        reflected: true,
        blocked: true, // Identity theft blocked, not actually applied to attacker
        effect: { type: 'identity_theft', blocked: true }
      };
    }

    // Apply the sabotage to the attacker instead
    const effect = this.applySabotage(attackerId, itemId, targetId);

    return {
      success: true,
      reflected: true,
      effect
    };
  }

  // Get player's current position in standings
  getPlayerPosition(playerId) {
    const sorted = Array.from(this.players.values())
      .filter(p => !p.eliminated)
      .sort((a, b) => b.totalScore - a.totalScore);

    const idx = sorted.findIndex(p => p.id === playerId);
    return idx === -1 ? sorted.length : idx + 1;
  }

  // Get all players' boards for X-Ray Vision
  getAllPlayersBoards(excludePlayerId) {
    const boards = {};
    for (const [id, player] of this.players) {
      if (id !== excludePlayerId && !player.eliminated) {
        boards[id] = {
          name: player.name,
          guesses: player.guesses,
          results: player.results,
          solved: player.solved
        };
      }
    }
    return boards;
  }

  // Check if First Blood challenge completed (first to SOLVE the word)
  checkFirstBlood(playerId) {
    if (!this.currentChallenge || this.currentChallenge.id !== 'first_blood') return false;
    if (this.firstSolverPlayerId !== null) return false; // Already claimed
    if (this.challengeCompletedBy.has(playerId)) return false;

    const player = this.players.get(playerId);
    if (!player || !player.solved) return false; // Must have solved

    this.firstSolverPlayerId = playerId;
    this.challengeCompletedBy.add(playerId);
    return true;
  }

  // Check if Rare Letters challenge completed (guess contains Z, X, Q, or J)
  checkRareLetters(playerId, guess) {
    if (!this.currentChallenge || this.currentChallenge.id !== 'rare_letters') return false;
    if (this.challengeCompletedBy.has(playerId)) return false;

    const upperGuess = guess.toUpperCase();
    const hasRareLetter = RARE_LETTERS.some(letter => upperGuess.includes(letter));

    if (hasRareLetter) {
      this.challengeCompletedBy.add(playerId);
      return true;
    }
    return false;
  }

  // Check if Speed Solve challenge completed (solved in under 25 seconds)
  checkSpeedSolve(playerId) {
    if (!this.currentChallenge || this.currentChallenge.id !== 'speed_solve') return false;
    if (this.challengeCompletedBy.has(playerId)) return false;

    const player = this.players.get(playerId);
    if (!player || !player.solved || !player.solvedAt) return false;

    const solveTimeSeconds = (player.solvedAt - this.roundStartTime) / 1000;
    if (solveTimeSeconds < 30) {
      this.challengeCompletedBy.add(playerId);
      return true;
    }
    return false;
  }

  // Check if Efficiency challenge completed (solved in 3 guesses or less)
  checkEfficiency(playerId) {
    if (!this.currentChallenge || this.currentChallenge.id !== 'efficiency') return false;
    if (this.challengeCompletedBy.has(playerId)) return false;

    const player = this.players.get(playerId);
    if (!player || !player.solved) return false;

    if (player.solvedInGuesses <= 3) {
      this.challengeCompletedBy.add(playerId);
      return true;
    }
    return false;
  }

  // Award challenge completion item (uses pre-generated reward)
  awardChallengeItem(playerId) {
    // Use the pre-generated reward item for this Item Round
    const item = this.itemRoundReward;
    if (item) {
      this.addItemToInventory(playerId, item);
    }
    return item;
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
