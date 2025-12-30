import React, { useEffect, useCallback, useState } from 'react';
import { useGameStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';
import WordleGrid from './WordleGrid';
import Keyboard from './Keyboard';

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

  const { submitGuess, nextRound, forceEndRound, endGame } = useSocket();
  const [showHostMenu, setShowHostMenu] = useState(false);

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

  // Keyboard handler
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

  if (!gameState) return null;

  const players = Object.values(gameState.players);
  const currentPlayer = gameState.players[playerId];
  const otherPlayers = players.filter(p => p.id !== playerId);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const roundTimeSeconds = Math.floor(roundTimeRemaining / 1000);
  const guessTimeSeconds = Math.floor(guessTimeRemaining / 1000);
  const isCriticalRound = roundTimeSeconds < 30;
  const isCriticalGuess = guessTimeSeconds < 10 && gameState.settings.guessTimeSeconds < 9000;

  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Header with timers */}
      <div className="flex items-center justify-between mb-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <div className="glass rounded-xl px-4 py-2">
            <div className="text-xs text-white/40">Round</div>
            <div className="font-bold text-lg">{gameState.currentRound} / {gameState.totalRounds}</div>
          </div>

          {/* Host Controls */}
          {isHost && gameState.state === 'playing' && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHostMenu(!showHostMenu);
                }}
                className="glass rounded-xl px-4 py-2 hover:bg-white/10 transition-colors"
              >
                <div className="text-xs text-wordle-yellow">HOST</div>
                <div className="font-bold text-sm flex items-center gap-1">
                  Controls
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {showHostMenu && (
                <div className="absolute top-full left-0 mt-2 glass rounded-xl p-2 min-w-[160px] z-50">
                  <button
                    onClick={() => {
                      forceEndRound();
                      setShowHostMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-white/10 rounded-lg text-sm"
                  >
                    End Round
                  </button>
                  <button
                    onClick={() => {
                      endGame();
                      setShowHostMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-white/10 rounded-lg text-sm text-red-400"
                  >
                    End Game
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Round Timer */}
        <div className={`glass rounded-xl px-4 py-2 ${isCriticalRound ? 'border border-red-500' : ''}`}>
          <div className="text-xs text-white/40">Time Left</div>
          <div className={`font-mono font-bold text-xl ${isCriticalRound ? 'timer-critical' : ''}`}>
            {formatTime(roundTimeRemaining)}
          </div>
        </div>
      </div>

      {/* Main game area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 max-w-6xl mx-auto w-full">
        {/* Your grid - always first and larger */}
        <div className="lg:w-1/2 flex flex-col">
          <WordleGrid
            guesses={playerState?.guesses || []}
            results={playerState?.results || []}
            currentInput={currentInput}
            isCurrentPlayer={true}
            playerName={currentPlayer?.name || 'You'}
            solved={playerState?.solved || false}
            score={playerState?.roundScore || 0}
          />
          
          {/* Keyboard */}
          <div className="mt-4">
            <Keyboard
              onKey={addLetter}
              onEnter={handleSubmit}
              onBackspace={removeLetter}
              disabled={showResults || playerState?.solved || playerState?.guesses?.length >= 6}
            />
          </div>
        </div>

        {/* Other players' grids */}
        <div className="lg:w-1/2 overflow-auto max-h-[60vh] lg:max-h-none">
          <div className={`grid gap-3 ${
            otherPlayers.length === 1 ? 'grid-cols-1' :
            otherPlayers.length <= 4 ? 'grid-cols-2' :
            'grid-cols-2 lg:grid-cols-3'
          }`}>
            {otherPlayers.map((player) => (
              <div key={player.id} className="transform scale-90 origin-top">
                <WordleGrid
                  guesses={[]}
                  results={[]}
                  currentInput=""
                  isCurrentPlayer={false}
                  playerName={player.name}
                  solved={player.solved}
                  score={player.roundScore}
                  guessCount={player.guessCount}
                  lastGuessColors={player.lastGuessColors}
                  showingOther={true}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Round End Modal */}
      {showResults && gameState.state === 'roundEnd' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass rounded-2xl p-6 max-w-2xl w-full animate-bounce-in my-4">
            <h2 className="font-display text-3xl font-bold text-center mb-2">Round Complete!</h2>
            <p className="text-center text-white/60 mb-4">
              The word was: <span className="text-wordle-green font-bold text-2xl">{roundEndData?.word || playerState?.targetWord}</span>
            </p>

            {/* Next round countdown */}
            {nextRoundCountdown !== null && gameState.currentRound < gameState.totalRounds && (
              <div className="text-center mb-4">
                <span className="text-white/60">Next round in </span>
                <span className="text-wordle-yellow font-bold text-xl">{nextRoundCountdown}</span>
              </div>
            )}

            {/* Round Scores with breakdown */}
            <div className="space-y-3 mb-6">
              {players
                .sort((a, b) => b.roundScore - a.roundScore)
                .map((player, idx) => {
                  const stats = roundEndData?.playerStats?.[player.id];
                  return (
                    <div
                      key={player.id}
                      className={`p-4 rounded-lg ${
                        player.id === playerId ? 'bg-wordle-green/20 border border-wordle-green/50' : 'bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {idx === 0 && player.roundScore > 0 ? '🥇' : idx === 1 && player.roundScore > 0 ? '🥈' : idx === 2 && player.roundScore > 0 ? '🥉' : ''}
                          </span>
                          <div className="font-bold text-lg">{player.name}</div>
                        </div>
                        <div className={`text-2xl font-bold ${player.roundScore > 0 ? 'text-wordle-green' : 'text-white/40'}`}>
                          +{player.roundScore}
                        </div>
                      </div>

                      {stats?.solved ? (
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="bg-black/20 rounded p-2 text-center">
                            <div className="text-white/40 text-xs">Guesses</div>
                            <div className="font-bold">{stats.guesses}/6</div>
                            <div className="text-wordle-green text-xs">+{stats.guessBonus}</div>
                          </div>
                          <div className="bg-black/20 rounded p-2 text-center">
                            <div className="text-white/40 text-xs">Time</div>
                            <div className="font-bold">{Math.floor(stats.timeSeconds / 60)}:{(stats.timeSeconds % 60).toString().padStart(2, '0')}</div>
                            <div className="text-blue-400 text-xs">+{stats.timeBonus}</div>
                          </div>
                          <div className="bg-black/20 rounded p-2 text-center">
                            <div className="text-white/40 text-xs">Base</div>
                            <div className="font-bold">Solved</div>
                            <div className="text-wordle-yellow text-xs">+{stats.baseScore}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-white/40 text-sm">
                          Did not solve ({stats?.guesses || player.guessCount}/6 guesses used)
                        </div>
                      )}

                      <div className="text-right text-xs text-white/40 mt-2">
                        Total Score: {player.totalScore}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Game over - show final results */}
            {gameState.currentRound >= gameState.totalRounds && (
              <div className="text-center mb-4">
                <div className="text-xl font-bold text-wordle-yellow mb-2">Game Over!</div>
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
                  className="text-sm text-white/40 hover:text-white/60 underline"
                >
                  End Game Early
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
