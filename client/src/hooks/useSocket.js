import { useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useGameStore } from '../lib/store';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
const SESSION_KEY = 'wordle_session';
const PLAYER_ID_KEY = 'wordle_player_id';

let socket = null;
let heartbeatInterval = null;

// Generate or get persistent player ID
function getOrCreatePersistentId() {
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = 'p_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch (e) {
    // Fallback for private browsing
    return 'p_' + Math.random().toString(36).substr(2, 9);
  }
}

// Save session to localStorage
function saveSession(roomCode, playerName) {
  try {
    const persistentId = getOrCreatePersistentId();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerName, persistentId, timestamp: Date.now() }));
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
    setSpectatorState,
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
            playerName: session.playerName,
            persistentId: session.persistentId || getOrCreatePersistentId()
          }, (response) => {
            setIsReconnecting(false);
            if (response.success) {
              setPlayerId(response.playerId);
              setRoomCode(response.roomCode);
              setGameState(response.gameState);
              // Update isHost based on server's hostId
              setIsHost(response.gameState?.hostId === response.playerId);
              if (response.playerState) {
                setPlayerState(response.playerState);
              }
              // Reset client-side state to match server state
              // This ensures no stale keyboard colors or input from previous round
              useGameStore.getState().resetKeyboardStatus();
              useGameStore.getState().clearInput();
              useGameStore.setState({
                revealedLetters: {},
                activeEffects: [],
                letterSnipeResult: null,
                xrayBoards: null
              });
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

      socket.on('spectatorState', (spectatorState) => {
        setSpectatorState(spectatorState);
      });

      socket.on('countdown', ({ seconds, itemRound }) => {
        setShowCountdown(true);
        setCountdownValue(seconds);
        // Store Item Round preview info for display during countdown
        if (itemRound) {
          useGameStore.getState().setCountdownItemRound(itemRound);
        }
      });

      socket.on('roundStart', (data) => {
        setShowCountdown(false);
        resetForNewRound();
        resetKeyboardStatus();
        showToast(`Round ${data.round} - GO!`, 1500);
      });

      socket.on('timerUpdate', ({ roundTimeRemaining, guessTimeRemaining, isBonusTime }) => {
        setTimers(roundTimeRemaining, guessTimeRemaining, isBonusTime);
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

      socket.on('nextRoundCountdown', ({ seconds, itemRound }) => {
        useGameStore.getState().setNextRoundCountdown(seconds);
        // Store Item Round preview info for display during countdown
        if (itemRound) {
          useGameStore.getState().setCountdownItemRound(itemRound);
        } else if (seconds === 5) {
          // Clear at start of countdown if not an item round
          useGameStore.getState().setCountdownItemRound(null);
        }
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
        useGameStore.getState().setInventory([]); // Clear inventory for new game
        showToast('Game reset! Ready for a new game.', 2000);
      });

      // Power-ups & Sabotages
      socket.on('itemReceived', ({ item, trigger }) => {
        const store = useGameStore.getState();
        store.setItemNotification({
          type: 'received',
          message: `Got ${item.name}!`,
          emoji: item.emoji,
          trigger
        });
      });

      // When you use an item (only sent to you)
      socket.on('itemUsed', ({ item }) => {
        useGameStore.getState().setItemNotification({
          type: 'used',
          message: `${item.name} used!`,
          emoji: item.emoji
        });
      });

      // When you get sabotaged (only sent to target)
      socket.on('sabotaged', ({ item, fromPlayer }) => {
        useGameStore.getState().setItemNotification({
          type: 'sabotaged',
          message: `${item.name} from ${fromPlayer}!`,
          emoji: item.emoji
        });
      });

      socket.on('letterSnipeResult', ({ letter, isInWord }) => {
        useGameStore.getState().setLetterSnipeResult({ letter, isInWord });
      });

      socket.on('letterRevealed', ({ letter, position }) => {
        useGameStore.getState().addRevealedLetter({ letter, position });
        useGameStore.getState().showToast(`Position ${position}: ${letter}`, 2000);
      });

      socket.on('xrayVisionStart', ({ boards, duration }) => {
        useGameStore.getState().setXrayBoards(boards);
        // Auto-clear after duration
        setTimeout(() => {
          useGameStore.getState().setXrayBoards(null);
        }, duration);
      });

      socket.on('activeEffect', ({ effect, duration, data }) => {
        useGameStore.getState().addActiveEffect({ effect, duration, data });
      });

      socket.on('effectExpired', ({ effect }) => {
        useGameStore.getState().removeActiveEffect(effect);
      });

      socket.on('amnesiaClearKeyboard', () => {
        // Permanently clear keyboard colors
        useGameStore.getState().resetKeyboardStatus();
      });

      socket.on('identityTheftSwap', () => {
        // Clear keyboard colors after identity theft swap
        // since the old colors no longer apply to the new progress
        useGameStore.getState().resetKeyboardStatus();
        // Also clear current input since we have new board state
        useGameStore.getState().clearInput();
        // Clear revealed letters (they don't apply to new progress)
        // but keep activeEffects - the server handles effect expiration
        useGameStore.setState({ revealedLetters: {} });
      });

      socket.on('shieldBlocked', ({ targetPlayer, item }) => {
        const store = useGameStore.getState();
        // Only show if this socket is the attacker (should always be true, but safeguard)
        if (socket.id === store.playerId || !store.playerId) {
          const targetName = store.gameState?.players[targetPlayer]?.name || 'Someone';
          store.setItemNotification({
            type: 'blocked',
            message: `${targetName}'s shield blocked!`,
            emoji: '🛡️'
          });
        }
      });

      socket.on('shieldProtected', ({ attacker, item }) => {
        // This event only comes to the target, show notification
        useGameStore.getState().setItemNotification({
          type: 'received',
          message: `Shield blocked ${attacker}'s ${item.name}!`,
          emoji: '🛡️'
        });
      });

      // Mirror Shield reflection events
      socket.on('mirrorReflected', ({ reflectedBy, item, blocked }) => {
        // Attacker's sabotage was reflected/blocked
        useGameStore.getState().setItemNotification({
          type: 'sabotaged',
          message: blocked
            ? `${reflectedBy} blocked your ${item.name}!`
            : `${reflectedBy} reflected your ${item.name}!`,
          emoji: '🪞'
        });
      });

      socket.on('mirrorProtected', ({ attacker, item, blocked }) => {
        // Target's mirror shield protected them
        useGameStore.getState().setItemNotification({
          type: 'received',
          message: blocked
            ? `Mirror Shield blocked ${attacker}'s ${item.name}!`
            : `Mirror Shield reflected ${attacker}'s ${item.name}!`,
          emoji: '🪞'
        });
      });

      socket.on('inventoryUpdate', ({ inventory }) => {
        useGameStore.getState().setInventory(inventory);
      });

      // Second Chance prompt - show when player has 6 guesses and Second Chance in inventory
      socket.on('secondChancePrompt', () => {
        useGameStore.getState().setShowSecondChancePrompt(true);
      });

      // Second Chance activated
      socket.on('secondChanceActivated', ({ message }) => {
        useGameStore.getState().setShowSecondChancePrompt(false);
        useGameStore.getState().showToast(message, 2000);
      });

      // Shield activated with duration
      socket.on('shieldActivated', ({ duration }) => {
        const seconds = Math.round(duration / 1000);
        useGameStore.getState().showToast(`Shield active for ${seconds}s!`, 2000);
      });

      // Mirror Shield prompt - show when sabotaged and have mirror shield
      socket.on('mirrorShieldPrompt', ({ attacker, item, isCounterReflect }) => {
        useGameStore.getState().setMirrorShieldPrompt({ attacker, item, isCounterReflect });
      });

      // Broadcast when any player earns an item (visible to all)
      socket.on('itemEarned', ({ playerId, playerName, items }) => {
        const store = useGameStore.getState();
        // Only show notification for OTHER players' earnings
        if (playerId !== store.playerId) {
          for (const earning of items) {
            store.addItemEarningNotification({
              playerName,
              item: earning.item,
              trigger: earning.trigger,
              challenge: earning.challenge
            });
          }
        }
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

      socket.on('leftBehind', ({ message }) => {
        // Game started without this player - just clear session but stay on current screen
        // They'll see an error when they try to go back to lobby
        clearSession();
        showToast(message, 3000);
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
              const currentRound = useGameStore.getState().gameState?.currentRound;

              socket.emit('syncState', { roomCode: session.roomCode }, (response) => {
                if (response && response.success) {
                  const newRound = response.gameState?.currentRound;

                  // If round changed while user was away, reset client-side state
                  if (currentRound !== undefined && newRound !== undefined && currentRound !== newRound) {
                    console.log(`Round changed from ${currentRound} to ${newRound}, resetting client state`);
                    useGameStore.getState().resetKeyboardStatus();
                    useGameStore.getState().clearInput();
                    useGameStore.setState({
                      revealedLetters: {},
                      activeEffects: [],
                      letterSnipeResult: null,
                      xrayBoards: null
                    });
                  }

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
      const persistentId = getOrCreatePersistentId();
      socket.emit('createRoom', { playerName, settings, persistentId }, (response) => {
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
      const persistentId = getOrCreatePersistentId();
      socket.emit('joinRoom', { roomCode, playerName, persistentId }, (response) => {
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
    // Update session with new name so reconnection works
    const session = getSession();
    if (session) {
      saveSession(session.roomCode, newName);
    }
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
          // Clear input for "already used as opener" error
          if (response.error && response.error.includes('as opener')) {
            useGameStore.getState().clearInput();
          }
          reject(new Error(response.error));
        }
      });
    });
  }, []);

  const nextRound = useCallback((customWord = null) => {
    socket.emit('nextRound', { customWord });
  }, []);

  const playAgain = useCallback(() => {
    socket.emit('playAgain', (response) => {
      if (response && !response.success) {
        showToast(response.error || 'Could not return to lobby', 3000);
        // Clear session and go home since we're no longer in the game
        clearSession();
        useGameStore.getState().resetGame();
      }
    });
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

  const useItem = useCallback((itemId, targetId = null) => {
    return new Promise((resolve, reject) => {
      socket.emit('useItem', { itemId, targetId }, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to use item'));
        }
      });
    });
  }, []);

  const letterSnipe = useCallback((letter) => {
    return new Promise((resolve, reject) => {
      socket.emit('letterSnipe', { letter }, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to use Letter Snipe'));
        }
      });
    });
  }, []);

  const debugGiveAllItems = useCallback(() => {
    return new Promise((resolve, reject) => {
      socket.emit('debugGiveAllItems', (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to give items'));
        }
      });
    });
  }, []);

  const activateSecondChance = useCallback(() => {
    return new Promise((resolve, reject) => {
      socket.emit('activateSecondChance', (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to activate Second Chance'));
        }
      });
    });
  }, []);

  const respondMirrorShield = useCallback((useMirror) => {
    return new Promise((resolve, reject) => {
      socket.emit('respondMirrorShield', { useMirror }, (response) => {
        useGameStore.getState().setMirrorShieldPrompt(null);
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to respond'));
        }
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
    leaveRoom,
    useItem,
    letterSnipe,
    debugGiveAllItems,
    activateSecondChance,
    respondMirrorShield
  };
}
