import { create } from 'zustand';

export const useGameStore = create((set, get) => ({
  // Connection state
  socket: null,
  connected: false,
  playerId: null,
  
  // Room state
  roomCode: null,
  isHost: false,
  
  // Game state from server
  gameState: null,
  playerState: null,
  
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

  // Timers
  roundTimeRemaining: 0,
  guessTimeRemaining: 0,
  
  // Actions
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
  setPlayerId: (playerId) => set({ playerId }),
  
  setRoomCode: (roomCode) => set({ roomCode }),
  setIsHost: (isHost) => set({ isHost }),
  
  setGameState: (gameState) => set({ gameState }),
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

  setTimers: (roundTime, guessTime) => set({
    roundTimeRemaining: roundTime,
    guessTimeRemaining: guessTime
  }),
  
  // Reset for new round
  resetForNewRound: () => set({
    currentInput: '',
    keyboardStatus: {},
    roundEndData: null,
    nextRoundCountdown: null
  }),
  
  // Full reset
  resetGame: () => set({
    roomCode: null,
    isHost: false,
    gameState: null,
    playerState: null,
    currentInput: '',
    keyboardStatus: {},
    error: null,
    toast: null,
    showCountdown: false,
    countdownValue: 5,
    roundTimeRemaining: 0,
    guessTimeRemaining: 0
  })
}));
