import { create } from 'zustand';

export const useGameStore = create((set, get) => ({
  // Connection state
  socket: null,
  connected: false,
  playerId: null,
  isReconnecting: false,
  
  // Room state
  roomCode: null,
  isHost: false,
  
  // Game state from server
  gameState: null,
  playerState: null,
  spectatorState: null, // For eliminated players to see all boards
  
  // Local input state
  currentInput: '',
  keyboardStatus: {},
  
  // UI state
  error: null,
  toast: null,
  showCountdown: false,
  countdownValue: 5,
  countdownItemRound: null, // { challenge, reward } - shown during countdown for Item Rounds

  // Round end state
  roundEndData: null,
  nextRoundCountdown: null,

  // Power-ups & Sabotages
  itemNotification: null, // { type, message, emoji }
  revealedLetters: {}, // { position: letter } from Letter Reveal - persists for round
  letterSnipeResult: null, // { letter, isInWord }
  inventory: [], // Player's current items
  activeEffects: [], // { effect, expiresAt, data }
  itemEarningNotifications: [], // [{ playerName, item, trigger, challenge }] - shows when others earn items
  xrayBoards: null, // { playerId: { name, guesses, results, solved } } - X-Ray Vision data
  showSecondChancePrompt: false, // Show prompt to activate Second Chance after 6 guesses
  mirrorShieldPrompt: null, // { attacker, item, isCounterReflect } - Show prompt when sabotaged with mirror shield
  nudgeNotification: false, // Show nudge animation when host nudges you
  solveNotifications: [], // [{ id, playerName, guesses }] - slide-in notifications from right

  // Timers
  roundTimeRemaining: 0,
  guessTimeRemaining: 0,
  isBonusTime: false,
  
  // Actions
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
  setPlayerId: (playerId) => set({ playerId }),
  setIsReconnecting: (isReconnecting) => set({ isReconnecting }),
  
  setRoomCode: (roomCode) => set({ roomCode }),
  setIsHost: (isHost) => set({ isHost }),
  
  setGameState: (gameState) => set({ gameState }),
  setSpectatorState: (spectatorState) => set({ spectatorState }),
  setPlayerState: (playerState) => {
    const state = get();
    // Update keyboard status based on player's guesses
    if (playerState?.results) {
      const newKeyboardStatus = { ...state.keyboardStatus };
      playerState.results.forEach(result => {
        result.forEach(({ letter, status }) => {
          const current = newKeyboardStatus[letter];
          // Priority: correct > present > absent
          if (status === 'correct') {
            newKeyboardStatus[letter] = 'correct';
          } else if (status === 'present' && current !== 'correct') {
            newKeyboardStatus[letter] = 'present';
          } else if (status === 'absent' && !current) {
            newKeyboardStatus[letter] = 'absent';
          }
        });
      });
      set({ playerState, keyboardStatus: newKeyboardStatus });
    } else {
      set({ playerState });
    }
  },
  
  setCurrentInput: (input) => set({ currentInput: input.toUpperCase().slice(0, 5) }),
  addLetter: (letter) => {
    const { currentInput, revealedLetters, activeEffects } = get();
    // Only allow typing up to (5 - numRevealed) letters
    const numRevealed = Object.keys(revealedLetters).length;
    const maxTypable = 5 - numRevealed;

    // Check if sticky_keys effect is active
    const hasStickyKeys = activeEffects.some(e => e.effect === 'sticky_keys' && e.expiresAt > Date.now());

    if (currentInput.length < maxTypable) {
      const upperLetter = letter.toUpperCase();
      // Sticky keys: add letter twice (if there's room)
      if (hasStickyKeys && currentInput.length + 1 < maxTypable) {
        set({ currentInput: currentInput + upperLetter + upperLetter });
      } else {
        set({ currentInput: currentInput + upperLetter });
      }
    }
  },
  removeLetter: () => {
    const { currentInput } = get();
    set({ currentInput: currentInput.slice(0, -1) });
  },
  // Build full 5-letter word by merging revealed letters with typed input
  getFullWord: () => {
    const { currentInput, revealedLetters } = get();
    let result = '';
    let typedIndex = 0;
    for (let i = 0; i < 5; i++) {
      if (revealedLetters[i]) {
        result += revealedLetters[i];
      } else if (typedIndex < currentInput.length) {
        result += currentInput[typedIndex];
        typedIndex++;
      }
    }
    return result;
  },
  clearInput: () => set({ currentInput: '' }),
  
  resetKeyboardStatus: () => set({ keyboardStatus: {} }),
  
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  
  showToast: (message, duration = 2000) => {
    set({ toast: message });
    setTimeout(() => set({ toast: null }), duration);
  },

  addSolveNotification: (playerName, guesses) => {
    const id = Date.now();
    set((state) => ({
      solveNotifications: [...state.solveNotifications, { id, playerName, guesses }]
    }));
    setTimeout(() => {
      set((state) => ({
        solveNotifications: state.solveNotifications.filter(n => n.id !== id)
      }));
    }, 3000);
  },
  
  setShowCountdown: (show) => set({ showCountdown: show }),
  setCountdownValue: (value) => set({ countdownValue: value }),
  setCountdownItemRound: (itemRound) => set({ countdownItemRound: itemRound }),

  setRoundEndData: (data) => set({ roundEndData: data }),
  setNextRoundCountdown: (seconds) => set({ nextRoundCountdown: seconds }),

  // Power-ups & Sabotages
  setItemNotification: (notification) => {
    set({ itemNotification: notification });
    if (notification) {
      setTimeout(() => set({ itemNotification: null }), 3000);
    }
  },
  addRevealedLetter: (data) => {
    if (data && data.position !== undefined && data.letter) {
      set((state) => ({
        revealedLetters: { ...state.revealedLetters, [data.position - 1]: data.letter } // Convert 1-indexed to 0-indexed
      }));
    }
  },
  setLetterSnipeResult: (result) => {
    set({ letterSnipeResult: result });
    if (result) {
      setTimeout(() => set({ letterSnipeResult: null }), 3000);
    }
  },
  setInventory: (inventory) => set({ inventory }),
  setXrayBoards: (boards) => set({ xrayBoards: boards }),
  setShowSecondChancePrompt: (show) => set({ showSecondChancePrompt: show }),
  setMirrorShieldPrompt: (prompt) => set({ mirrorShieldPrompt: prompt }),
  setNudgeNotification: (show) => set({ nudgeNotification: show }),
  addActiveEffect: ({ effect, duration, data }) => {
    const expiresAt = Date.now() + duration;
    set((state) => ({
      activeEffects: [...state.activeEffects.filter(e => e.effect !== effect), { effect, expiresAt, data }]
    }));
  },
  removeActiveEffect: (effect) => {
    set((state) => ({
      activeEffects: state.activeEffects.filter(e => e.effect !== effect)
    }));
  },
  hasActiveEffect: (effect) => {
    const state = get();
    return state.activeEffects.some(e => e.effect === effect && e.expiresAt > Date.now());
  },
  addItemEarningNotification: (notification) => {
    const id = Date.now() + Math.random();
    set((state) => ({
      itemEarningNotifications: [...state.itemEarningNotifications.slice(-4), { ...notification, id }]
    }));
    // Auto-remove after 3 seconds
    setTimeout(() => {
      set((state) => ({
        itemEarningNotifications: state.itemEarningNotifications.filter(n => n.id !== id)
      }));
    }, 3000);
  },
  clearItemEarningNotifications: () => set({ itemEarningNotifications: [] }),

  setTimers: (roundTime, guessTime, isBonusTime = false) => set({
    roundTimeRemaining: roundTime,
    guessTimeRemaining: guessTime,
    isBonusTime
  }),
  
  // Reset for new round
  resetForNewRound: () => set({
    currentInput: '',
    keyboardStatus: {},
    roundEndData: null,
    nextRoundCountdown: null,
    revealedLetters: {},
    letterSnipeResult: null,
    itemNotification: null,
    activeEffects: [],
    itemEarningNotifications: [],
    xrayBoards: null,
    countdownItemRound: null,
    showSecondChancePrompt: false,
    mirrorShieldPrompt: null,
    nudgeNotification: false
  }),
  
  // Full reset
  resetGame: () => set({
    roomCode: null,
    isHost: false,
    gameState: null,
    playerState: null,
    spectatorState: null,
    currentInput: '',
    keyboardStatus: {},
    error: null,
    toast: null,
    showCountdown: false,
    countdownValue: 5,
    countdownItemRound: null,
    roundTimeRemaining: 0,
    guessTimeRemaining: 0,
    inventory: [],
    activeEffects: [],
    itemNotification: null,
    revealedLetters: {},
    letterSnipeResult: null,
    itemEarningNotifications: [],
    xrayBoards: null,
    showSecondChancePrompt: false,
    mirrorShieldPrompt: null,
    nudgeNotification: false
  })
}));
