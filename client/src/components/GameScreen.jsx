import React, { useEffect, useCallback, useState } from 'react';
import { useGameStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';
import WordleGrid from './WordleGrid';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
];

export default function GameScreen({ showResults = false }) {
  const {
    gameState,
    playerState,
    playerId,
    currentInput,
    roundTimeRemaining,
    addLetter,
    removeLetter,
    showToast,
    roundEndData,
    nextRoundCountdown,
    keyboardStatus
  } = useGameStore();

  // Derive isHost from gameState to prevent sync issues
  const isHost = gameState?.hostId === playerId;

  const { submitGuess, forceEndRound, endGame } = useSocket();
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showOtherPlayers, setShowOtherPlayers] = useState(false);

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

  // Physical keyboard handler for desktop
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

  // Handle tappable keyboard
  const handleKeyPress = useCallback((key) => {
    if (playerState?.solved || playerState?.guesses?.length >= 6) return;

    if (key === 'ENTER') {
      handleSubmit();
    } else if (key === 'DEL') {
      removeLetter();
    } else {
      addLetter(key);
    }
  }, [handleSubmit, removeLetter, addLetter, playerState]);

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
  const isCriticalRound = roundTimeSeconds < 30;
  const canType = !showResults && !playerState?.solved && playerState?.guesses?.length < 6;

  return (
    <div className="h-screen flex flex-col p-2 sm:p-4 overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="glass rounded-lg px-2 py-1">
            <div className="text-[10px] text-white/40">Round</div>
            <div className="font-bold text-sm">{gameState.currentRound}/{gameState.totalRounds}</div>
          </div>

          {/* Host Controls */}
          {isHost && gameState.state === 'playing' && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHostMenu(!showHostMenu);
                }}
                className="glass rounded-lg px-2 py-1 hover:bg-white/10"
              >
                <div className="text-[10px] text-wordle-yellow">HOST</div>
                <div className="font-bold text-xs flex items-center gap-1">
                  Menu ▼
                </div>
              </button>

              {showHostMenu && (
                <div className="absolute top-full left-0 mt-1 glass rounded-lg p-1.5 min-w-[120px] z-50">
                  <button
                    onClick={() => { forceEndRound(); setShowHostMenu(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-white/10 rounded text-xs"
                  >
                    End Round
                  </button>
                  <button
                    onClick={() => { endGame(); setShowHostMenu(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-white/10 rounded text-xs text-red-400"
                  >
                    End Game
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Toggle other players */}
          {otherPlayers.length > 0 && (
            <button
              onClick={() => setShowOtherPlayers(!showOtherPlayers)}
              className={`glass rounded-lg px-2 py-1 text-xs ${showOtherPlayers ? 'bg-white/20' : ''}`}
            >
              <div className="text-[10px] text-white/40">Players</div>
              <div className="font-bold">{showOtherPlayers ? 'Hide' : 'Show'} ({otherPlayers.length})</div>
            </button>
          )}
        </div>

        {/* Timer */}
        <div className={`glass rounded-lg px-2 py-1 ${isCriticalRound ? 'border border-red-500' : ''}`}>
          <div className="text-[10px] text-white/40">Time</div>
          <div className={`font-mono font-bold text-sm ${isCriticalRound ? 'timer-critical' : ''}`}>
            {formatTime(roundTimeRemaining)}
          </div>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 overflow-auto flex flex-col items-center justify-center">
        {/* Solo view - Large grid centered */}
        {!showOtherPlayers && (
          <div className="flex items-center justify-center">
            <WordleGrid
              guesses={playerState?.guesses || []}
              results={playerState?.results || []}
              currentInput={currentInput}
              isCurrentPlayer={true}
              playerName={currentPlayer?.name || 'You'}
              solved={playerState?.solved || false}
              score={playerState?.roundScore || 0}
              large={true}
            />
          </div>
        )}

        {/* Multi-player view - Compact grids */}
        {showOtherPlayers && (
          <div className="w-full">
            {/* Your grid first */}
            <div className="flex justify-center mb-3">
              <WordleGrid
                guesses={playerState?.guesses || []}
                results={playerState?.results || []}
                currentInput={currentInput}
                isCurrentPlayer={true}
                playerName={currentPlayer?.name || 'You'}
                solved={playerState?.solved || false}
                score={playerState?.roundScore || 0}
              />
            </div>
            {/* Other players */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md mx-auto">
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
                    guessResults={player.guessResults || []}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tappable Keyboard */}
      {canType && (
        <div className="mt-auto pt-2">
          <div className="flex flex-col gap-1 items-center">
            {KEYBOARD_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-1 justify-center">
                {row.map((key) => {
                  const status = keyboardStatus[key];
                  const isWide = key === 'ENTER' || key === 'DEL';
                  return (
                    <button
                      key={key}
                      onClick={() => handleKeyPress(key)}
                      className={`
                        ${isWide ? 'px-2 sm:px-3 text-[10px] sm:text-xs' : 'w-7 sm:w-9 text-xs sm:text-sm'}
                        h-10 sm:h-12 rounded font-bold
                        transition-all active:scale-95
                        ${status === 'correct' ? 'bg-wordle-green text-white' : ''}
                        ${status === 'present' ? 'bg-wordle-yellow text-white' : ''}
                        ${status === 'absent' ? 'bg-white/10 text-white/30' : ''}
                        ${!status ? 'bg-white/20 text-white hover:bg-white/30' : ''}
                      `}
                    >
                      {key === 'DEL' ? '⌫' : key}
                    </button>
                  );
                })}
              </div>
            ))}
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
