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

  // Round end state
  roundEndData: null,
  nextRoundCountdown: null,

  // Power-ups & Sabotages
  itemNotification: null, // { type, message, emoji }
  revealedLetters: {}, // { position: letter } from Letter Reveal - persists for round
  letterSnipeResult: null, // { letter, isInWord }
  inventory: [], // Player's current items
  activeEffects: [], // { effect, expiresAt, data }

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
    const { currentInput } = get();
    if (currentInput.length < 5) {
      set({ currentInput: currentInput + letter.toUpperCase() });
    }
  },
  removeLetter: () => {
    const { currentInput } = get();
    set({ currentInput: currentInput.slice(0, -1) });
  },
  clearInput: () => set({ currentInput: '' }),
  
  resetKeyboardStatus: () => set({ keyboardStatus: {} }),
  
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  
  showToast: (message, duration = 2000) => {
    set({ toast: message });
    setTimeout(() => set({ toast: null }), duration);
  },
  
  setShowCountdown: (show) => set({ showCountdown: show }),
  setCountdownValue: (value) => set({ countdownValue: value }),

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
    activeEffects: []
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
    roundTimeRemaining: 0,
    guessTimeRemaining: 0,
    inventory: [],
    activeEffects: [],
    itemNotification: null,
    revealedLetters: {},
    letterSnipeResult: null
  })
}));
