import { useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useGameStore } from '../lib/store';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

let socket = null;

export function useSocket() {
  const {
    setSocket,
    setConnected,
    setPlayerId,
    setRoomCode,
    setIsHost,
    setGameState,
    setPlayerState,
    setShowCountdown,
    setCountdownValue,
    setTimers,
    showToast,
    resetForNewRound,
    resetGame,
    resetKeyboardStatus
  } = useGameStore();

  useEffect(() => {
    if (!socket) {
      socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling']
      });
      setSocket(socket);

      socket.on('connect', () => {
        console.log('Connected to server');
        setConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from server');
        setConnected(false);
      });

      socket.on('gameStateUpdate', (gameState) => {
        setGameState(gameState);
      });

      socket.on('playerState', (playerState) => {
        setPlayerState(playerState);
      });

      socket.on('countdown', ({ seconds }) => {
        setShowCountdown(true);
        setCountdownValue(seconds);
      });

      socket.on('roundStart', (data) => {
        setShowCountdown(false);
        resetForNewRound();
        resetKeyboardStatus();
        showToast(`Round ${data.round} - GO!`, 1500);
      });

      socket.on('timerUpdate', ({ roundTimeRemaining, guessTimeRemaining }) => {
        setTimers(roundTimeRemaining, guessTimeRemaining);
      });

      socket.on('guessSubmitted', ({ playerId, guessNumber, colors, solved, gameState }) => {
        setGameState(gameState);
        const player = gameState.players[playerId];
        if (player && solved) {
          showToast(`${player.name} solved it in ${guessNumber} guesses!`, 2000);
        }
      });

      socket.on('roundEnd', ({ word, playerStats, gameState }) => {
        setGameState(gameState);
        useGameStore.getState().setRoundEndData({ word, playerStats });
      });

      socket.on('nextRoundCountdown', ({ seconds }) => {
        useGameStore.getState().setNextRoundCountdown(seconds);
      });

      socket.on('gameEnd', (results) => {
        // Results are handled in the component
      });

      socket.on('gameReset', (gameState) => {
        setGameState(gameState);
        resetForNewRound();
        resetKeyboardStatus();
        showToast('Game reset! Ready for a new game.', 2000);
      });

      socket.on('playerJoined', ({ playerName, gameState }) => {
        setGameState(gameState);
        showToast(`${playerName} joined the game!`, 2000);
      });

      socket.on('playerLeft', ({ gameState, newHostId }) => {
        setGameState(gameState);
        if (socket.id === newHostId) {
          setIsHost(true);
          showToast('You are now the host!', 2000);
        }
      });
    }

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);

  const createRoom = useCallback((playerName, settings) => {
    return new Promise((resolve, reject) => {
      socket.emit('createRoom', { playerName, settings }, (response) => {
        if (response.success) {
          setPlayerId(response.playerId);
          setRoomCode(response.roomCode);
          setIsHost(true);
          setGameState(response.gameState);
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }, []);

  const joinRoom = useCallback((roomCode, playerName) => {
    return new Promise((resolve, reject) => {
      socket.emit('joinRoom', { roomCode, playerName }, (response) => {
        if (response.success) {
          setPlayerId(response.playerId);
          setRoomCode(response.roomCode);
          setIsHost(false);
          setGameState(response.gameState);
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }, []);

  const updateName = useCallback((newName) => {
    socket.emit('updateName', { newName });
  }, []);

  const toggleReady = useCallback(() => {
    return new Promise((resolve) => {
      socket.emit('toggleReady', (response) => {
        resolve(response);
      });
    });
  }, []);

  const updateSettings = useCallback((settings) => {
    socket.emit('updateSettings', { settings });
  }, []);

  const startGame = useCallback((customWord = null, customWords = null) => {
    return new Promise((resolve, reject) => {
      socket.emit('startGame', { customWord, customWords }, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to start game'));
        }
      });
    });
  }, []);

  const submitGuess = useCallback((guess) => {
    return new Promise((resolve, reject) => {
      socket.emit('submitGuess', { guess }, (response) => {
        if (response.success) {
          useGameStore.getState().clearInput();
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }, []);

  const nextRound = useCallback((customWord = null) => {
    socket.emit('nextRound', { customWord });
  }, []);

  const playAgain = useCallback(() => {
    socket.emit('playAgain');
  }, []);

  const forceEndRound = useCallback(() => {
    socket.emit('forceEndRound');
  }, []);

  const endGame = useCallback(() => {
    socket.emit('endGame');
  }, []);

  return {
    socket,
    createRoom,
    joinRoom,
    updateName,
    toggleReady,
    updateSettings,
    startGame,
    submitGuess,
    nextRound,
    playAgain,
    forceEndRound,
    endGame
  };
}
