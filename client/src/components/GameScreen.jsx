import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useGameStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';
import WordleGrid from './WordleGrid';

export default function GameScreen({ showResults = false }) {
  const {
    gameState,
    playerState,
    playerId,
    currentInput,
    roundTimeRemaining,
    guessTimeRemaining,
    addLetter,
    removeLetter,
    showToast,
    isHost,
    roundEndData,
    nextRoundCountdown
  } = useGameStore();

  const { submitGuess, forceEndRound, endGame } = useSocket();
  const [showHostMenu, setShowHostMenu] = useState(false);
  const inputRef = useRef(null);

  // Close host menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowHostMenu(false);
    if (showHostMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showHostMenu]);

  const handleSubmit = useCallback(async () => {
    if (currentInput.length !== 5) {
      showToast('Word must be 5 letters');
      return;
    }

    if (playerState?.solved || playerState?.guesses?.length >= 6) {
      return;
    }

    try {
      await submitGuess(currentInput);
    } catch (err) {
      showToast(err.message);
    }
  }, [currentInput, submitGuess, showToast, playerState]);

  // Handle input from hidden text field (for mobile)
  const handleInputChange = useCallback((e) => {
    const value = e.target.value.toUpperCase();
    const lastChar = value.slice(-1);

    if (/^[A-Z]$/.test(lastChar) && currentInput.length < 5) {
      addLetter(lastChar);
    }
    // Clear the input field
    e.target.value = '';
  }, [addLetter, currentInput.length]);

  // Keyboard handler for desktop
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showResults || !gameState || gameState.state !== 'playing') return;
      if (playerState?.solved || playerState?.guesses?.length >= 6) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        removeLetter();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        addLetter(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, removeLetter, addLetter, showResults, gameState, playerState]);

  // Focus input on tap for mobile
  const handleGridTap = useCallback(() => {
    if (inputRef.current && !playerState?.solved && playerState?.guesses?.length < 6) {
      inputRef.current.focus();
    }
  }, [playerState]);

  // Auto-focus input when round starts (opens native keyboard on mobile)
  useEffect(() => {
    if (gameState?.state === 'playing' && inputRef.current && !playerState?.solved) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [gameState?.state, playerState?.solved]);

  if (!gameState) return null;

  const players = Object.values(gameState.players);
  const currentPlayer = gameState.players[playerId];
  const otherPlayers = players.filter(p => p.id !== playerId);

  // All players for grid display (current player first)
  const allPlayers = [currentPlayer, ...otherPlayers].filter(Boolean);
  const totalPlayers = allPlayers.length;

  // Determine grid columns based on player count
  // 6 players = 3 cols x 2 rows, 7+ scrolls below
  const getGridCols = () => {
    if (totalPlayers === 1) return 'grid-cols-1';
    if (totalPlayers === 2) return 'grid-cols-2';
    return 'grid-cols-3'; // 3+ players always 3 columns
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const roundTimeSeconds = Math.floor(roundTimeRemaining / 1000);
  const isCriticalRound = roundTimeSeconds < 30;

  const canType = !showResults && !playerState?.solved && playerState?.guesses?.length < 6;

  return (
    <div className="h-screen flex flex-col p-2 sm:p-4 overflow-hidden">
      {/* Hidden input for mobile keyboard */}
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck="false"
        className="absolute opacity-0 pointer-events-none"
        style={{ position: 'fixed', top: '-100px' }}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          // Prevent default but don't call handlers - window listener handles both
          // to prevent double actions
          if (e.key === 'Backspace' || e.key === 'Enter') {
            e.preventDefault();
          }
        }}
      />

      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="glass rounded-lg px-2 py-1 sm:px-3 sm:py-1.5">
            <div className="text-[10px] sm:text-xs text-white/40">Round</div>
            <div className="font-bold text-sm sm:text-base">{gameState.currentRound}/{gameState.totalRounds}</div>
          </div>

          {/* Host Controls */}
          {isHost && gameState.state === 'playing' && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHostMenu(!showHostMenu);
                }}
                className="glass rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 hover:bg-white/10 transition-colors"
              >
                <div className="text-[10px] sm:text-xs text-wordle-yellow">HOST</div>
                <div className="font-bold text-xs sm:text-sm flex items-center gap-1">
                  Menu
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {showHostMenu && (
                <div className="absolute top-full left-0 mt-1 glass rounded-lg p-1.5 min-w-[140px] z-50">
                  <button
                    onClick={() => {
                      forceEndRound();
                      setShowHostMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-white/10 rounded text-xs sm:text-sm"
                  >
                    End Round
                  </button>
                  <button
                    onClick={() => {
                      endGame();
                      setShowHostMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-white/10 rounded text-xs sm:text-sm text-red-400"
                  >
                    End Game
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timer */}
        <div className={`glass rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 ${isCriticalRound ? 'border border-red-500' : ''}`}>
          <div className="text-[10px] sm:text-xs text-white/40">Time</div>
          <div className={`font-mono font-bold text-sm sm:text-lg ${isCriticalRound ? 'timer-critical' : ''}`}>
            {formatTime(roundTimeRemaining)}
          </div>
        </div>
      </div>

      {/* Player Grids - Compact grid, 6 fit in viewport */}
      <div
        className="flex-1 overflow-auto flex items-start justify-center"
        onClick={handleGridTap}
      >
        <div className={`grid ${getGridCols()} gap-3 sm:gap-4 max-w-[95%]`}>
          {allPlayers.map((player) => {
            const isMe = player.id === playerId;
            return (
              <WordleGrid
                key={player.id}
                guesses={isMe ? (playerState?.guesses || []) : []}
                results={isMe ? (playerState?.results || []) : []}
                currentInput={isMe ? currentInput : ''}
                isCurrentPlayer={isMe}
                playerName={player.name}
                solved={isMe ? playerState?.solved : player.solved}
                score={isMe ? playerState?.roundScore : player.roundScore}
                guessResults={isMe ? [] : (player.guessResults || [])}
              />
            );
          })}
        </div>
      </div>

      {/* Input indicator for current player */}
      {canType && (
        <div className="mt-2 text-center">
          <div className="inline-flex items-center gap-1 glass rounded-lg px-3 py-1.5">
            <span className="text-sm font-mono tracking-widest min-w-[80px]">
              {currentInput.padEnd(5, '_')}
            </span>
            <button
              onClick={removeLetter}
              className="ml-2 px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-xs"
            >
              Del
            </button>
            <button
              onClick={handleSubmit}
              disabled={currentInput.length !== 5}
              className="px-2 py-0.5 bg-wordle-green/80 hover:bg-wordle-green rounded text-xs disabled:opacity-50"
            >
              Enter
            </button>
          </div>
        </div>
      )}

      {/* Round End Modal */}
      {showResults && gameState.state === 'roundEnd' && (() => {
        const sortedByRound = [...players].sort((a, b) => b.roundScore - a.roundScore);
        const sortedByTotal = [...players].sort((a, b) => b.totalScore - a.totalScore);
        const roundWinner = sortedByRound[0];
        const winnerStats = roundEndData?.playerStats?.[roundWinner?.id];

        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="glass rounded-2xl p-4 sm:p-6 max-w-2xl w-full animate-bounce-in my-4">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-1">Round {gameState.currentRound} Complete!</h2>
              <p className="text-center text-white/60 mb-4">
                The word was: <span className="text-wordle-green font-bold text-xl sm:text-2xl">{roundEndData?.word || playerState?.targetWord}</span>
              </p>

              {/* Round Winner */}
              {roundWinner && roundWinner.roundScore > 0 && (
                <div className="bg-wordle-yellow/20 border border-wordle-yellow/50 rounded-xl p-3 sm:p-4 mb-4">
                  <div className="text-center mb-2">
                    <span className="text-2xl">🏆</span>
                    <span className="text-wordle-yellow font-bold text-lg sm:text-xl ml-2">Round Winner</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">{roundWinner.name}</span>
                    <span className="text-wordle-green font-bold text-xl">+{roundWinner.roundScore}</span>
                  </div>
                  {winnerStats?.solved && (
                    <div className="text-xs sm:text-sm text-white/60 mt-1">
                      Solved in {winnerStats.guesses} guess{winnerStats.guesses !== 1 ? 'es' : ''} •
                      {Math.floor(winnerStats.timeSeconds / 60)}:{(winnerStats.timeSeconds % 60).toString().padStart(2, '0')} •
                      <span className="text-wordle-yellow"> +{winnerStats.baseScore}</span> base
                      <span className="text-wordle-green"> +{winnerStats.guessBonus}</span> guess
                      <span className="text-blue-400"> +{winnerStats.timeBonus}</span> time
                    </div>
                  )}
                </div>
              )}

              {/* Next round countdown */}
              {nextRoundCountdown !== null && gameState.currentRound < gameState.totalRounds && (
                <div className="text-center mb-3">
                  <span className="text-white/60">Next round in </span>
                  <span className="text-wordle-yellow font-bold text-xl">{nextRoundCountdown}</span>
                </div>
              )}

              {/* Current Standings */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-white/60 mb-2 text-center">Current Standings</h3>
                <div className="space-y-1.5 max-h-[35vh] overflow-y-auto">
                  {sortedByTotal.map((player, idx) => {
                    const stats = roundEndData?.playerStats?.[player.id];
                    const isMe = player.id === playerId;
                    return (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between p-2 sm:p-3 rounded-lg ${
                          isMe ? 'bg-wordle-green/20 border border-wordle-green/50' : 'bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-center font-bold text-white/40">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                          </span>
                          <span className={`font-medium text-sm ${isMe ? 'text-wordle-green' : ''}`}>
                            {player.name}{isMe ? ' (You)' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs ${player.roundScore > 0 ? 'text-wordle-green' : 'text-white/30'}`}>
                            {player.roundScore > 0 ? `+${player.roundScore}` : (stats?.solved === false ? 'Failed' : '+0')}
                          </span>
                          <span className="font-bold text-sm sm:text-base">{player.totalScore}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Game over - show final results */}
              {gameState.currentRound >= gameState.totalRounds && (
                <div className="text-center mb-4 pt-2 border-t border-white/10">
                  <div className="text-lg sm:text-xl font-bold text-wordle-yellow mb-2">🎉 Game Over!</div>
                  <div className="text-white/60 mb-3">
                    Winner: <span className="text-wordle-green font-bold">{sortedByTotal[0]?.name}</span> with {sortedByTotal[0]?.totalScore} points!
                  </div>
                  <button
                    onClick={() => endGame()}
                    className="btn-primary"
                  >
                    Back to Lobby
                  </button>
                </div>
              )}

              {/* Host controls to end early */}
              {isHost && gameState.currentRound < gameState.totalRounds && (
                <div className="text-center">
                  <button
                    onClick={() => endGame()}
                    className="text-xs sm:text-sm text-white/40 hover:text-white/60 underline"
                  >
                    End Game Early
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
