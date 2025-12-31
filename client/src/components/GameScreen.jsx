import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useGameStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';
import WordleGrid from './WordleGrid';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
];

const LETTER_PICKER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Item definitions for UI
const ITEM_INFO = {
  letter_snipe: { name: 'Letter Snipe', emoji: '🎯', type: 'powerup', needsLetter: true, desc: 'Check if a letter is in the word' },
  shield: { name: 'Shield', emoji: '🛡️', type: 'powerup', passive: true, desc: 'Auto-blocks next sabotage' },
  letter_reveal: { name: 'Letter Reveal', emoji: '✨', type: 'powerup', desc: 'Shows one correct letter position' },
  time_warp: { name: 'Time Warp', emoji: '⏰', type: 'powerup', desc: '+30 seconds to your timer' },
  blindfold: { name: 'Blindfold', emoji: '🙈', type: 'sabotage', needsTarget: true, desc: 'Blanks their keyboard letters' },
  flip_it: { name: 'Flip It', emoji: '🙃', type: 'sabotage', needsTarget: true, desc: 'Flips screen upside down' },
  keyboard_shuffle: { name: 'Keyboard Shuffle', emoji: '🔀', type: 'sabotage', needsTarget: true, desc: 'Randomizes keyboard layout' },
  invisible_ink: { name: 'Invisible Ink', emoji: '👻', type: 'sabotage', needsTarget: true, desc: 'Hides their guesses & colors' },
  amnesia: { name: 'Amnesia', emoji: '🧠', type: 'sabotage', needsTarget: true, desc: 'Wipes keyboard colors permanently' },
  identity_theft: { name: 'Identity Theft', emoji: '🔄', type: 'sabotage', needsTarget: true, legendary: true, desc: 'Swap all progress with target' }
};

export default function GameScreen({ showResults = false }) {
  const {
    gameState,
    playerState,
    spectatorState,
    playerId,
    currentInput,
    roundTimeRemaining,
    addLetter,
    removeLetter,
    showToast,
    roundEndData,
    nextRoundCountdown,
    keyboardStatus,
    inventory,
    activeEffects,
    itemNotification,
    revealedLetters,
    letterSnipeResult,
    isBonusTime
  } = useGameStore();

  // Derive isHost from gameState to prevent sync issues
  const isHost = gameState?.hostId === playerId;

  const { submitGuess, forceEndRound, endGame, useItem, letterSnipe, debugGiveAllItems } = useSocket();
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showOtherPlayers, setShowOtherPlayers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showLetterPicker, setShowLetterPicker] = useState(false);

  // Close host menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowHostMenu(false);
    if (showHostMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showHostMenu]);

  const handleSubmit = useCallback(async () => {
    // Prevent double-submissions
    if (isSubmitting) {
      return;
    }

    if (currentInput.length !== 5) {
      showToast('Word must be 5 letters');
      return;
    }

    if (playerState?.solved || playerState?.guesses?.length >= 6) {
      return;
    }

    setIsSubmitting(true);
    try {
      await submitGuess(currentInput);
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentInput, submitGuess, showToast, playerState, isSubmitting]);

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

  // Item usage handlers
  const handleItemClick = useCallback((item) => {
    const info = ITEM_INFO[item.id];
    if (!info) return;

    if (info.passive) {
      showToast('Shield blocks sabotages automatically!');
      return;
    }

    if (info.needsTarget) {
      setSelectedItem(item);
      setShowTargetPicker(true);
    } else if (info.needsLetter) {
      setSelectedItem(item);
      setShowLetterPicker(true);
    } else {
      // Direct use items (letter_reveal, time_warp)
      useItem(item.id).catch(err => showToast(err.message));
    }
  }, [useItem, showToast]);

  const handleTargetSelect = useCallback(async (targetId) => {
    if (!selectedItem) return;
    try {
      await useItem(selectedItem.id, targetId);
    } catch (err) {
      showToast(err.message);
    }
    setSelectedItem(null);
    setShowTargetPicker(false);
  }, [selectedItem, useItem, showToast]);

  const handleLetterSelect = useCallback(async (letter) => {
    try {
      await letterSnipe(letter);
    } catch (err) {
      showToast(err.message);
    }
    setSelectedItem(null);
    setShowLetterPicker(false);
  }, [letterSnipe, showToast]);

  if (!gameState) return null;

  const players = Object.values(gameState.players);
  const currentPlayer = gameState.players[playerId];
  const otherPlayers = players.filter(p => p.id !== playerId);
  const isBattleRoyale = gameState.settings?.gameMode === 'battleRoyale';
  const isHardcore = gameState.settings?.hardcoreMode || false;
  const isEliminated = currentPlayer?.eliminated || false;
  const activePlayers = players.filter(p => !p.eliminated);
  const eliminatedThisRound = gameState.eliminatedThisRound;
  const powerUpsEnabled = gameState.settings?.powerUpsEnabled || false;

  // Check for active visual effects
  const hasBlindfold = activeEffects.some(e => e.effect === 'blindfold' && e.expiresAt > Date.now());
  const hasFlip = activeEffects.some(e => e.effect === 'flip_it' && e.expiresAt > Date.now());
  const hasInvisibleInk = activeEffects.some(e => e.effect === 'invisible_ink' && e.expiresAt > Date.now());
  const hasAmnesia = activeEffects.some(e => e.effect === 'amnesia');
  const keyboardShuffleEffect = activeEffects.find(e => e.effect === 'keyboard_shuffle' && e.expiresAt > Date.now());

  // Generate shuffled keyboard if needed
  const shuffledKeyboard = useMemo(() => {
    const shuffledKeys = keyboardShuffleEffect?.data?.shuffledKeys;
    if (!shuffledKeys || shuffledKeys.length !== 26) return null;
    return [
      shuffledKeys.slice(0, 10),
      shuffledKeys.slice(10, 19),
      ['ENTER', ...shuffledKeys.slice(19), 'DEL']
    ];
  }, [keyboardShuffleEffect]);

  // Use shuffled keyboard if active, otherwise normal
  const displayKeyboard = shuffledKeyboard || KEYBOARD_ROWS;

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const roundTimeSeconds = Math.floor(roundTimeRemaining / 1000);
  const isCriticalRound = roundTimeSeconds < 30;
  const canType = !showResults && !isEliminated && !playerState?.solved && playerState?.guesses?.length < 6;

  return (
    <div className="h-[100dvh] flex flex-col p-2 sm:p-4 overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="glass rounded-lg px-2 py-1">
            <div className="text-[10px] text-white/40">Round</div>
            <div className="font-bold text-sm">
              {isBattleRoyale
                ? `${gameState.currentRound}`
                : `${gameState.currentRound}/${gameState.totalRounds}`}
            </div>
          </div>

          {/* Battle Royale: Show active players count */}
          {isBattleRoyale && (
            <div className="glass rounded-lg px-2 py-1 border border-red-500/50">
              <div className="text-[10px] text-red-400">Alive</div>
              <div className="font-bold text-sm text-red-400">{activePlayers.length}/{players.length}</div>
            </div>
          )}

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
                  {powerUpsEnabled && (
                    <button
                      onClick={() => { debugGiveAllItems().then(() => showToast('All items given!')).catch(e => showToast(e.message)); setShowHostMenu(false); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-white/10 rounded text-xs text-purple-400"
                    >
                      🧪 Give All Items
                    </button>
                  )}
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
        <div className={`glass rounded-lg px-2 py-1 ${isBonusTime ? 'border border-purple-500 bg-purple-500/20' : isCriticalRound ? 'border border-red-500' : ''}`}>
          <div className="text-[10px] text-white/40">{isBonusTime ? '⏰ Bonus' : 'Time'}</div>
          <div className={`font-mono font-bold text-sm ${isBonusTime ? 'text-purple-400' : isCriticalRound ? 'timer-critical' : ''}`}>
            {formatTime(roundTimeRemaining)}
          </div>
        </div>
      </div>

      {/* Eliminated Banner */}
      {isEliminated && !showResults && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-2 text-center">
          <div className="text-red-400 font-bold text-lg">ELIMINATED</div>
          <div className="text-white/60 text-sm">
            You placed #{currentPlayer?.placement || '?'} • Watch the remaining players below
          </div>
        </div>
      )}

      {/* Main Grid Area */}
      <div className="flex-1 overflow-auto flex flex-col items-center justify-center">
        {/* Eliminated players see spectator view */}
        {isEliminated && !showResults && spectatorState && (
          <div className="w-full">
            <div className="text-center text-white/60 text-sm mb-3">Spectating...</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
              {Object.values(spectatorState.players || {})
                .filter(p => !p.eliminated)
                .map((player) => (
                  <div key={player.id} className="glass rounded-lg p-2">
                    <div className="text-center text-sm font-bold mb-2 truncate">
                      {player.name}
                      {player.solved && <span className="text-wordle-green ml-1">✓</span>}
                    </div>
                    <WordleGrid
                      guesses={player.guesses || []}
                      results={player.results || []}
                      currentInput=""
                      isCurrentPlayer={false}
                      playerName={player.name}
                      solved={player.solved}
                      score={player.roundScore}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Solo view - Large grid centered (only for non-eliminated players) */}
        {!isEliminated && !showOtherPlayers && (
          <div className={`flex items-center justify-center ${hasFlip ? 'rotate-180' : ''}`}>
            <WordleGrid
              guesses={playerState?.guesses || []}
              results={hasInvisibleInk ? [] : (playerState?.results || [])}
              currentInput={hasInvisibleInk ? '•'.repeat(currentInput.length) : currentInput}
              isCurrentPlayer={true}
              playerName={currentPlayer?.name || 'You'}
              solved={playerState?.solved || false}
              score={playerState?.roundScore || 0}
              large={true}
              revealedLetters={revealedLetters}
              hideColors={hasInvisibleInk}
            />
          </div>
        )}

        {/* Multi-player view - Compact grids (only for non-eliminated players) */}
        {!isEliminated && showOtherPlayers && (
          <div className={`w-full ${hasFlip ? 'rotate-180' : ''}`}>
            {/* Your grid first */}
            <div className="flex justify-center mb-3">
              <WordleGrid
                guesses={playerState?.guesses || []}
                results={hasInvisibleInk ? [] : (playerState?.results || [])}
                currentInput={hasInvisibleInk ? '•'.repeat(currentInput.length) : currentInput}
                isCurrentPlayer={true}
                playerName={currentPlayer?.name || 'You'}
                solved={playerState?.solved || false}
                score={playerState?.roundScore || 0}
                revealedLetters={revealedLetters}
                hideColors={hasInvisibleInk}
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
        <div className={`mt-auto pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 px-2 sm:px-4 ${hasFlip ? 'rotate-180' : ''}`}>
          <div className="flex flex-col gap-1.5 items-center max-w-lg mx-auto">
            {displayKeyboard.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-1.5 justify-center">
                {row.map((key) => {
                  // In hardcore mode or amnesia effect, never show keyboard colors
                  const status = (isHardcore || hasAmnesia) ? null : keyboardStatus[key];
                  const isWide = key === 'ENTER' || key === 'DEL';
                  return (
                    <button
                      key={key}
                      onClick={() => handleKeyPress(key)}
                      className={`
                        ${isWide ? 'px-3 sm:px-4 text-xs sm:text-sm' : 'w-9 sm:w-11 text-sm sm:text-base'}
                        h-12 sm:h-14 rounded-lg font-bold
                        transition-all active:scale-95
                        ${hasBlindfold ? 'bg-white/10 text-transparent' :
                          status === 'correct' ? 'bg-wordle-green text-white' :
                          status === 'present' ? 'bg-wordle-yellow text-white' :
                          status === 'absent' ? 'bg-white/10 text-white/30' :
                          'bg-white/20 text-white hover:bg-white/30'}
                      `}
                    >
                      {hasBlindfold ? (isWide ? '' : '') : (key === 'DEL' ? '⌫' : key)}
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

              {/* Battle Royale: Elimination announcement */}
              {isBattleRoyale && eliminatedThisRound?.length > 0 && (
                <div className="bg-red-500/20 border border-red-500 rounded-xl p-3 sm:p-4 mb-4">
                  <div className="text-center">
                    <span className="text-2xl">💀</span>
                    <span className="text-red-400 font-bold text-lg sm:text-xl ml-2">
                      {eliminatedThisRound.length > 1 ? `${eliminatedThisRound.length} ELIMINATED` : 'ELIMINATED'}
                    </span>
                  </div>
                  {eliminatedThisRound.map((eliminated, idx) => (
                    <div key={eliminated.id} className="text-center mt-2">
                      <span className="font-bold text-lg text-red-300">{eliminated.name}</span>
                      <span className="text-white/60 ml-2">
                        scored {eliminated.score} pts • #{eliminated.placement} place
                      </span>
                    </div>
                  ))}
                  {eliminatedThisRound.some(e => e.id === playerId) && (
                    <div className="text-center text-red-300 text-sm mt-2">
                      You've been eliminated! You can spectate the remaining rounds.
                    </div>
                  )}
                </div>
              )}

              {/* Next round countdown */}
              {nextRoundCountdown !== null && (isBattleRoyale ? activePlayers.length > 1 : gameState.currentRound < gameState.totalRounds) && (
                <div className="text-center mb-3">
                  <span className="text-white/60">Next round in </span>
                  <span className="text-wordle-yellow font-bold text-xl">{nextRoundCountdown}</span>
                </div>
              )}

              {/* Current Standings */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-white/60 mb-2 text-center">
                  {isBattleRoyale ? `Players (${activePlayers.length} remaining)` : 'Current Standings'}
                </h3>
                <div className="space-y-1.5 max-h-[35vh] overflow-y-auto">
                  {sortedByTotal.map((player, idx) => {
                    const stats = roundEndData?.playerStats?.[player.id];
                    const isMe = player.id === playerId;
                    const playerEliminated = player.eliminated;
                    const justEliminated = eliminatedThisRound?.some?.(e => e.id === player.id);
                    return (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between p-2 sm:p-3 rounded-lg ${
                          justEliminated ? 'bg-red-500/20 border border-red-500' :
                          playerEliminated ? 'bg-white/5 opacity-50' :
                          isMe ? 'bg-wordle-green/20 border border-wordle-green/50' : 'bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-center font-bold text-white/40">
                            {playerEliminated ? '💀' : idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                          </span>
                          <span className={`font-medium text-sm ${
                            justEliminated ? 'text-red-400 line-through' :
                            playerEliminated ? 'text-white/40 line-through' :
                            isMe ? 'text-wordle-green' : ''
                          }`}>
                            {player.name}{isMe ? ' (You)' : ''}
                            {playerEliminated && player.placement && ` #${player.placement}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs ${
                            playerEliminated ? 'text-white/30' :
                            player.roundScore > 0 ? 'text-wordle-green' : 'text-white/30'
                          }`}>
                            {playerEliminated ? 'OUT' : player.roundScore > 0 ? `+${player.roundScore}` : (stats?.solved === false ? 'Failed' : '+0')}
                          </span>
                          <span className={`font-bold text-sm sm:text-base ${playerEliminated ? 'text-white/40' : ''}`}>
                            {player.totalScore}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Game over - show transition message */}
              {/* Classic mode: ends after set rounds. Battle Royale: ends when 1 player left */}
              {(isBattleRoyale ? activePlayers.length <= 1 : gameState.currentRound >= gameState.totalRounds) && (
                <div className="text-center mb-4 pt-2 border-t border-white/10">
                  <div className="text-lg sm:text-xl font-bold text-wordle-yellow mb-2">
                    {isBattleRoyale ? '👑 VICTORY ROYALE!' : '🎉 Game Over!'}
                  </div>
                  <div className="text-white/60">
                    {isBattleRoyale ? (
                      <>Champion: <span className="text-wordle-green font-bold">{activePlayers[0]?.name}</span> is the last one standing!</>
                    ) : (
                      <>Winner: <span className="text-wordle-green font-bold">{sortedByTotal[0]?.name}</span> with {sortedByTotal[0]?.totalScore} points!</>
                    )}
                  </div>
                  <div className="text-white/40 text-sm mt-2">Final results coming...</div>
                </div>
              )}

              {/* Host controls to end early */}
              {isHost && !(isBattleRoyale ? activePlayers.length <= 1 : gameState.currentRound >= gameState.totalRounds) && (
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

      {/* Floating Inventory Panel - starts from top, grows downward */}
      {powerUpsEnabled && !showResults && !isEliminated && gameState.state === 'playing' && inventory.length > 0 && (
        <div className="fixed right-[0.4rem] top-[6rem] flex flex-col gap-1 z-40 max-h-[70vh] overflow-y-auto">
          {inventory.map((item, idx) => {
            const info = ITEM_INFO[item.id];
            const isPassive = info?.passive;
            return (
              <button
                key={idx}
                onClick={() => handleItemClick(item)}
                disabled={currentPlayer?.usedItemThisRound && !isPassive}
                title={`${info?.name || item.id}${isPassive ? ' (Passive)' : ''}`}
                className={`
                  w-[2.6rem] h-[2.6rem] rounded-lg text-lg
                  flex items-center justify-center
                  transition-all transform hover:scale-105 active:scale-95
                  ${isPassive ? 'bg-blue-500/20' :
                    info?.type === 'sabotage' ? 'bg-red-500/20 hover:bg-red-500/40' :
                    'bg-green-500/20 hover:bg-green-500/40'}
                  ${currentPlayer?.usedItemThisRound && !isPassive ? 'opacity-40 cursor-not-allowed' : ''}
                  ${info?.legendary ? 'animate-pulse' : ''}
                `}
              >
                {info?.emoji || '?'}
              </button>
            );
          })}
        </div>
      )}


      {/* Target Picker Modal - Grid View */}
      {showTargetPicker && selectedItem && (
        <div className="fixed inset-0 bg-black/95 flex flex-col z-50 p-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs text-white/50">
                {ITEM_INFO[selectedItem.id]?.emoji} {ITEM_INFO[selectedItem.id]?.name} · tap a player
              </span>
              <div className="text-[10px] text-white/30">{ITEM_INFO[selectedItem.id]?.desc}</div>
            </div>
            <button
              onClick={() => { setShowTargetPicker(false); setSelectedItem(null); }}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/50 flex items-center justify-center"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-3xl">
              {otherPlayers.filter(p => !p.eliminated && !p.solved).map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleTargetSelect(player.id)}
                  className="flex flex-col items-center hover:bg-red-500/10 rounded-lg p-2 transition-all group"
                >
                  <div className="text-xs font-medium mb-1 truncate w-full text-center group-hover:text-red-400">
                    {player.name}
                  </div>
                  <div className="transform scale-[0.85] origin-top">
                    <WordleGrid
                      guesses={[]}
                      results={[]}
                      currentInput=""
                      isCurrentPlayer={false}
                      playerName=""
                      solved={player.solved}
                      score={player.roundScore}
                      guessResults={player.guessResults || []}
                    />
                  </div>
                </button>
              ))}
            </div>
            {otherPlayers.filter(p => !p.eliminated && !p.solved).length === 0 && (
              <div className="text-center text-white/40">No valid targets</div>
            )}
          </div>
        </div>
      )}

      {/* Letter Picker Modal */}
      {showLetterPicker && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-4 sm:p-6 max-w-md w-full animate-bounce-in">
            <h3 className="text-xl font-bold mb-2 text-center">🎯 Letter Snipe</h3>
            <p className="text-white/60 text-center mb-4">Pick a letter to check:</p>
            <div className="grid grid-cols-7 sm:grid-cols-9 gap-2">
              {LETTER_PICKER.map((letter) => (
                <button
                  key={letter}
                  onClick={() => handleLetterSelect(letter)}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-white/20 hover:bg-white/30 font-bold transition-colors"
                >
                  {letter}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowLetterPicker(false); setSelectedItem(null); }}
              className="w-full mt-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Item Notification - Centered, subtle */}
      {itemNotification && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className={`animate-fade-in-out px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg
            ${itemNotification.type === 'sabotaged' ? 'bg-red-500/90' :
              itemNotification.type === 'blocked' ? 'bg-blue-500/90' :
              'bg-black/70 backdrop-blur-sm'}
          `}>
            <span className="text-2xl">{itemNotification.emoji}</span>
            <span className="text-sm text-white">{itemNotification.message}</span>
          </div>
        </div>
      )}

      {/* Letter Snipe Result */}
      {letterSnipeResult && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce-in
          px-6 py-4 rounded-xl shadow-lg text-center
          ${letterSnipeResult.isInWord ? 'bg-wordle-green/90' : 'bg-white/20'}
        `}>
          <div className="text-3xl font-bold mb-1">{letterSnipeResult.letter}</div>
          <div className={letterSnipeResult.isInWord ? 'text-white' : 'text-white/60'}>
            {letterSnipeResult.isInWord ? 'IS in the word!' : 'NOT in the word'}
          </div>
        </div>
      )}

    </div>
  );
}
