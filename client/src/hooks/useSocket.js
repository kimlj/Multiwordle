import { useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useGameStore } from '../lib/store';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
const SESSION_KEY = 'wordle_session';

let socket = null;
let heartbeatInterval = null;

// Save session to localStorage
function saveSession(roomCode, playerName) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerName, timestamp: Date.now() }));
  } catch (e) {
    console.warn('Could not save session:', e);
  }
}

// Get session from localStorage
function getSession() {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (data) {
      const session = JSON.parse(data);
      // Session expires after 24 hours
      if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
        return session;
      }
    }
  } catch (e) {
    console.warn('Could not get session:', e);
  }
  return null;
}

// Clear session
function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.warn('Could not clear session:', e);
  }
}

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
    resetKeyboardStatus,
    setIsReconnecting
  } = useGameStore();

  useEffect(() => {
    if (!socket) {
      // Check if there's a session to reconnect to
      const existingSession = getSession();
      if (existingSession && existingSession.roomCode) {
        setIsReconnecting(true);
        // Timeout for reconnection - clear session if it takes too long
        setTimeout(() => {
          if (useGameStore.getState().isReconnecting) {
            console.log('Reconnection timed out, clearing session');
            clearSession();
            setIsReconnecting(false);
          }
        }, 10000); // 10 second timeout
      }

      socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });
      setSocket(socket);

      socket.on('connect', () => {
        console.log('Connected to server');
        setConnected(true);

        // Try to rejoin on reconnect
        const session = getSession();
        if (session && session.roomCode) {
          console.log('Attempting to rejoin room:', session.roomCode);
          socket.emit('rejoinRoom', {
            roomCode: session.roomCode,
            playerName: session.playerName
          }, (response) => {
            setIsReconnecting(false);
            if (response.success) {
              setPlayerId(response.playerId);
              setRoomCode(response.roomCode);
              setGameState(response.gameState);
              if (response.playerState) {
                setPlayerState(response.playerState);
              }
              showToast('Reconnected to game!', 2000);
            } else {
              // Room no longer exists or can't rejoin
              clearSession();
            }
          });
        } else {
          setIsReconnecting(false);
        }
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
        // Update game state to show results screen
        if (results.gameState) {
          setGameState(results.gameState);
        }
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

      socket.on('playerKicked', ({ playerId, gameState }) => {
        setGameState(gameState);
      });

      socket.on('kicked', ({ message }) => {
        showToast(message, 3000);
        clearSession();
        useGameStore.getState().resetGame();
      });

      socket.on('roomClosed', () => {
        showToast('Room was closed', 2000);
        clearSession();
        useGameStore.getState().resetGame();
      });

      // Start heartbeat to keep connection alive
      if (!heartbeatInterval) {
        heartbeatInterval = setInterval(() => {
          if (socket && socket.connected) {
            socket.emit('ping');
          }
        }, 25000); // Ping every 25 seconds
      }

      // Handle visibility changes (alt-tab, screen lock, app switch)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('Page became visible, checking connection...');

          // If socket is disconnected, let socket.io handle reconnection
          if (socket && !socket.connected) {
            console.log('Socket disconnected, attempting to reconnect...');
            socket.connect();
          } else if (socket && socket.connected) {
            // Request state sync from server
            const session = getSession();
            if (session && session.roomCode) {
              socket.emit('syncState', { roomCode: session.roomCode }, (response) => {
                if (response && response.success) {
                  useGameStore.getState().setGameState(response.gameState);
                  if (response.playerState) {
                    useGameStore.getState().setPlayerState(response.playerState);
                  }
                }
              });
            }
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Also handle page focus (some browsers don't fire visibilitychange)
      const handleFocus = () => {
        if (socket && !socket.connected) {
          console.log('Window focused, socket disconnected, reconnecting...');
          socket.connect();
        }
      };

      window.addEventListener('focus', handleFocus);
    }

    return () => {
      // Don't disconnect on unmount - keep connection alive
      // Clean up visibility listeners on unmount (though this rarely happens for App component)
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
          saveSession(response.roomCode, playerName);
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
          saveSession(response.roomCode, playerName);
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

  const kickPlayer = useCallback((targetPlayerId) => {
    return new Promise((resolve, reject) => {
      socket.emit('kickPlayer', { targetPlayerId }, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to kick player'));
        }
      });
    });
  }, []);

  const leaveRoom = useCallback(() => {
    return new Promise((resolve) => {
      socket.emit('leaveRoom', (response) => {
        clearSession();
        useGameStore.getState().resetGame();
        resolve(response);
      });
    });
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
    endGame,
    kickPlayer,
    leaveRoom
  };
}
