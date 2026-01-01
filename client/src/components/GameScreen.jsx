import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useGameStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';
import WordleGrid from './WordleGrid';
import InfoModal from './InfoModal';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
];

const LETTER_PICKER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Item definitions for UI
const ITEM_INFO = {
  // Common
  letter_snipe: { name: 'Letter Snipe', emoji: '🎯', type: 'powerup', needsLetter: true, desc: 'Check if a letter is in the word' },
  flip_it: { name: 'Flip It', emoji: '🙃', type: 'sabotage', needsTarget: true, desc: 'Flips screen upside down' },
  keyboard_shuffle: { name: 'Keyboard Shuffle', emoji: '🔀', type: 'sabotage', needsTarget: true, desc: 'Randomizes keyboard layout' },
  sticky_keys: { name: 'Sticky Keys', emoji: '🍯', type: 'sabotage', needsTarget: true, desc: 'Every letter types twice' },
  // Rare
  blindfold: { name: 'Blindfold', emoji: '🙈', type: 'sabotage', needsTarget: true, rare: true, desc: 'Blanks their keyboard letters' },
  invisible_ink: { name: 'Invisible Ink', emoji: '👻', type: 'sabotage', needsTarget: true, rare: true, desc: 'Hides their guesses & colors' },
  mirror_shield: { name: 'Mirror Shield', emoji: '🪞', type: 'powerup', rare: true, passive: true, desc: 'Auto-reflects next sabotage' },
  second_chance: { name: 'Second Chance', emoji: '🔁', type: 'powerup', rare: true, passive: true, desc: 'Auto-prompts on 6th wrong guess' },
  // Legendary
  shield: { name: 'Shield', emoji: '🛡️', type: 'powerup', legendary: true, desc: 'Blocks ALL sabotages for duration' },
  xray_vision: { name: 'X-Ray Vision', emoji: '👁️', type: 'powerup', legendary: true, desc: 'See all players\' boards for 10s' },
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
    isBonusTime,
    itemEarningNotifications,
    xrayBoards,
    getFullWord,
    showSecondChancePrompt,
    setShowSecondChancePrompt,
    mirrorShieldPrompt,
    setMirrorShieldPrompt,
    setItemNotification
  } = useGameStore();

  // Derive isHost from gameState to prevent sync issues
  const isHost = gameState?.hostId === playerId;

  const { submitGuess, forceEndRound, endGame, useItem, letterSnipe, debugGiveAllItems, activateSecondChance, respondMirrorShield, leaveRoom } = useSocket();
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showOtherPlayers, setShowOtherPlayers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showLetterPicker, setShowLetterPicker] = useState(false);
  const [itemRoundExpanded, setItemRoundExpanded] = useState(false);
  const [showItemRoundPopup, setShowItemRoundPopup] = useState(false);
  const [lastItemRound, setLastItemRound] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Show centered popup when Item Round starts, auto-hide after 3s or tap/keypress to dismiss
  useEffect(() => {
    if (gameState?.isItemRound && gameState?.currentRound !== lastItemRound) {
      setLastItemRound(gameState.currentRound);
      setShowItemRoundPopup(true);
      const timer = setTimeout(() => {
        setShowItemRoundPopup(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.isItemRound, gameState?.currentRound, lastItemRound]);

  // Dismiss Item Round popup on any keypress
  useEffect(() => {
    if (!showItemRoundPopup) return;
    const handleKeyDown = () => setShowItemRoundPopup(false);
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showItemRoundPopup]);

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

    // Get full word including revealed letters
    const fullWord = getFullWord();
    if (fullWord.length !== 5) {
      showToast('Word must be 5 letters');
      return;
    }

    const maxGuessesAllowed = playerState?.hasSecondChance ? 7 : 6;
    if (playerState?.solved || playerState?.guesses?.length >= maxGuessesAllowed) {
      return;
    }

    setIsSubmitting(true);
    try {
      await submitGuess(fullWord);
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [getFullWord, submitGuess, showToast, playerState, isSubmitting]);

  // Physical keyboard handler for desktop
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showResults || !gameState || gameState.state !== 'playing') return;
      const maxGuessesAllowed = playerState?.hasSecondChance ? 7 : 6;
      if (playerState?.solved || playerState?.guesses?.length >= maxGuessesAllowed) return;

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
    const maxGuessesAllowed = playerState?.hasSecondChance ? 7 : 6;
    if (playerState?.solved || playerState?.guesses?.length >= maxGuessesAllowed) return;

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

    // Passive items can't be clicked
    if (info.passive) {
      showToast(`${info.emoji} ${info.name} activates automatically!`);
      return;
    }

    if (info.needsTarget) {
      setSelectedItem(item);
      setShowTargetPicker(true);
    } else if (info.needsLetter) {
      setSelectedItem(item);
      setShowLetterPicker(true);
    } else {
      // Direct use items (shield, xray_vision)
      useItem(item.id).catch(err => showToast(err.message));
    }
  }, [useItem, showToast]);

  // Clear item notification when typing
  useEffect(() => {
    if (currentInput.length > 0 && itemNotification) {
      setItemNotification(null);
    }
  }, [currentInput, itemNotification, setItemNotification]);

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
  const maxGuesses = playerState?.hasSecondChance ? 7 : 6;
  // Guard against undefined playerState - ensure we can type if playerState exists and hasn't solved
  const guessCount = playerState?.guesses?.length ?? 0;
  const canType = !showResults && !isEliminated && playerState && !playerState.solved && guessCount < maxGuesses;

  return (
    <div className="h-[100dvh] flex flex-col p-2 sm:p-3 overflow-hidden bg-[#0a0a12] relative">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2 relative z-20">
        <div className="flex items-center gap-2">
          {/* Round */}
          <div className="glass rounded-md px-2 py-1 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="font-bold text-sm">
              {isBattleRoyale
                ? `${gameState.currentRound}`
                : `${gameState.currentRound}/${gameState.totalRounds}`}
            </span>
          </div>

          {/* Battle Royale: Show active players count */}
          {isBattleRoyale && (
            <div className="glass rounded-md px-2 py-1 flex items-center gap-1.5 border border-red-500/50">
              <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
              <span className="font-bold text-sm text-red-400">{activePlayers.length}/{players.length}</span>
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
                className="glass rounded-md px-2 py-1 hover:bg-white/10 flex items-center gap-1"
              >
                <span className="text-sm text-wordle-yellow">⚙</span>
                <span className="text-xs text-white/50">▼</span>
              </button>

              {showHostMenu && (
                <div className="absolute top-full left-0 mt-1 glass rounded-lg p-1.5 min-w-[110px] z-50">
                  <button
                    onClick={() => { forceEndRound(); setShowHostMenu(false); }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-white/10 rounded text-xs"
                  >
                    End Round
                  </button>
                  <button
                    onClick={() => { endGame(); setShowHostMenu(false); }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-white/10 rounded text-xs text-red-400"
                  >
                    End Game
                  </button>
                  {powerUpsEnabled && (
                    <button
                      onClick={() => { debugGiveAllItems().then(() => showToast('All items given!')).catch(e => showToast(e.message)); setShowHostMenu(false); }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-white/10 rounded text-xs text-purple-400"
                    >
                      🧪 Items
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
              className={`glass rounded-md px-2 py-1 flex items-center gap-1.5 ${showOtherPlayers ? 'bg-white/20' : ''}`}
            >
              <svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="font-bold text-xs">{otherPlayers.length}</span>
            </button>
          )}

          {/* Item Round indicator */}
          {powerUpsEnabled && gameState.isItemRound && gameState.currentChallenge && gameState.state === 'playing' && !showResults && (
            <div className="relative">
              <button
                onClick={() => setItemRoundExpanded(!itemRoundExpanded)}
                className="glass rounded-md px-2 py-1 flex items-center gap-1.5 border border-purple-500/50 bg-purple-500/10"
              >
                <span className="text-sm">{gameState.currentChallenge.emoji}</span>
                <span className="text-xs text-white/40">{itemRoundExpanded ? '▲' : '▼'}</span>
              </button>
              {itemRoundExpanded && (
                <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] animate-fade-in">
                  <div className="rounded-lg px-3 py-2 border border-purple-500 bg-[#1a1a2e] shadow-lg text-left">
                    <div className="text-[10px] text-purple-300 font-medium mb-1">ITEM ROUND</div>
                    <div className="text-xs text-white/90 mb-1.5">
                      {gameState.currentChallenge.emoji} {gameState.currentChallenge.description}
                    </div>
                    <div className="text-[10px] text-white/50 border-t border-white/10 pt-1.5">
                      <span className="text-white/70">Reward:</span> {gameState.itemRoundReward?.emoji} {gameState.itemRoundReward?.name}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Timer */}
          <div className={`glass rounded-md px-2 py-1 flex items-center gap-1.5 transition-all duration-300 ${isBonusTime ? 'border border-purple-500 bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : isCriticalRound ? 'border border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse' : ''}`}>
            <svg className={`w-3.5 h-3.5 ${isBonusTime ? 'text-purple-400' : isCriticalRound ? 'text-red-400' : 'text-white/50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`font-mono font-bold text-sm ${isBonusTime ? 'text-purple-400' : isCriticalRound ? 'timer-critical' : ''}`}>
              {formatTime(roundTimeRemaining)}
            </span>
          </div>

          {/* Info Button */}
          <button
            onClick={() => setShowInfo(true)}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Game Info"
          >
            <svg className="w-4 h-4 text-white/40 hover:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Leave Button */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/20 transition-colors"
            title="Leave Game"
          >
            <svg className="w-4 h-4 text-white/40 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
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
      <div className="flex-1 overflow-auto flex flex-col items-center justify-center relative z-10">
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
            <div className="relative">
              <WordleGrid
                guesses={playerState?.guesses || []}
                results={hasInvisibleInk ? [] : (playerState?.results || [])}
                currentInput={hasInvisibleInk ? '•'.repeat(currentInput.length) : currentInput}
                maxGuesses={playerState?.hasSecondChance ? 7 : 6}
                isCurrentPlayer={true}
                playerName={currentPlayer?.name || 'You'}
                solved={playerState?.solved || false}
                score={playerState?.roundScore || 0}
                large={true}
                revealedLetters={revealedLetters}
                hideColors={hasInvisibleInk}
              />
            </div>
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
                maxGuesses={playerState?.hasSecondChance ? 7 : 6}
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
        <div className={`mt-auto pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-3 relative z-10 ${hasFlip ? 'rotate-180' : ''}`}>
          <div className="flex flex-col gap-[3px] sm:gap-1.5 w-[95%] sm:w-full max-w-lg mx-auto">
            {displayKeyboard.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-[3px] sm:gap-1.5 justify-center">
                {row.map((key) => {
                  // In hardcore mode or amnesia effect, never show keyboard colors
                  const status = (isHardcore || hasAmnesia) ? null : keyboardStatus[key];
                  const isWide = key === 'ENTER' || key === 'DEL';
                  return (
                    <button
                      key={key}
                      onClick={() => handleKeyPress(key)}
                      className={`
                        ${isWide ? 'flex-[1.5] text-[10px] sm:text-sm' : 'flex-1 text-sm sm:text-base'}
                        h-12 sm:h-14 rounded-md sm:rounded-lg font-bold
                        active:opacity-70
                        ${hasBlindfold ? 'bg-white/10 text-transparent' :
                          status === 'correct' ? 'bg-wordle-green text-white' :
                          status === 'present' ? 'bg-wordle-yellow text-white' :
                          status === 'absent' ? 'bg-white/5 text-white/30' :
                          'bg-white/15 text-white active:bg-white/25'}
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
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#121213] border border-white/10 rounded-2xl p-4 sm:p-6 max-w-2xl w-full animate-bounce-in my-4 shadow-2xl">
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
        <div className="fixed right-[0.4rem] top-[6rem] flex flex-col gap-1.5 z-40 max-h-[70vh] overflow-y-auto">
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
                  w-[2.6rem] h-[2.6rem] rounded-xl text-lg
                  flex items-center justify-center
                  transition-all transform hover:scale-110 active:scale-95
                  backdrop-blur-sm border
                  ${info?.legendary
                    ? 'bg-gradient-to-br from-yellow-500/30 to-amber-600/30 border-yellow-400/50 shadow-[0_0_20px_rgba(234,179,8,0.4)] animate-pulse'
                    : info?.rare
                      ? 'bg-gradient-to-br from-purple-500/20 to-violet-600/20 border-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : isPassive
                        ? 'bg-blue-500/20 border-blue-400/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                        : info?.type === 'sabotage'
                          ? 'bg-red-500/20 border-red-400/30 hover:bg-red-500/30 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                          : 'bg-green-500/20 border-green-400/30 hover:bg-green-500/30 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]'}
                  ${currentPlayer?.usedItemThisRound && !isPassive ? 'opacity-40 cursor-not-allowed' : ''}
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
        <div className="fixed inset-0 bg-black/95 flex flex-col z-50 p-2 pt-[env(safe-area-inset-top)]">
          <div className="mb-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">
                {ITEM_INFO[selectedItem.id]?.emoji} {ITEM_INFO[selectedItem.id]?.name} - tap a player
              </span>
              <button
                onClick={() => { setShowTargetPicker(false); setSelectedItem(null); }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/50 flex items-center justify-center"
              >
                ×
              </button>
            </div>
            <div className="text-[10px] text-white/30 text-center mt-1">{ITEM_INFO[selectedItem.id]?.desc}</div>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-3xl mx-auto px-1">
              {otherPlayers.filter(p => !p.eliminated && !p.solved).map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleTargetSelect(player.id)}
                  className="flex flex-col items-center hover:bg-red-500/10 rounded-lg p-1.5 transition-all group"
                >
                  <div className="text-xs font-medium mb-1 truncate w-full text-center group-hover:text-red-400">
                    {player.name}
                  </div>
                  <WordleGrid
                    guesses={[]}
                    results={[]}
                    currentInput=""
                    isCurrentPlayer={false}
                    playerName=""
                    solved={player.solved}
                    score={player.roundScore}
                    guessResults={player.guessResults || []}
                    medium={true}
                  />
                </button>
              ))}
            </div>
            {otherPlayers.filter(p => !p.eliminated && !p.solved).length === 0 && (
              <div className="text-center text-white/40 mt-8">No valid targets</div>
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

      {/* Item Round Start Popup - Centered, tap to dismiss */}
      {showItemRoundPopup && gameState?.isItemRound && gameState?.currentChallenge && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/50"
          onClick={() => setShowItemRoundPopup(false)}
        >
          <div className="animate-bounce-in bg-[#1a1a2e] border-2 border-purple-500 rounded-xl px-6 py-4 shadow-2xl text-center max-w-[280px]">
            <div className="text-purple-400 font-bold text-lg mb-2">ITEM ROUND</div>
            <div className="text-white text-base mb-3">
              <span className="text-xl mr-1">{gameState.currentChallenge.emoji}</span>
              {gameState.currentChallenge.description}
            </div>
            <div className="border-t border-white/20 pt-3">
              <div className="text-white/60 text-xs mb-1">Complete to earn:</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">{gameState.itemRoundReward?.emoji}</span>
                <div className="text-left">
                  <div className="text-white font-medium text-sm">{gameState.itemRoundReward?.name}</div>
                  <div className="text-white/60 text-xs">{ITEM_INFO[gameState.itemRoundReward?.id]?.desc || ''}</div>
                </div>
              </div>
            </div>
            <div className="text-white/40 text-[10px] mt-3">Tap to dismiss</div>
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

      {/* Item Earning Notifications - Shows when other players earn items */}
      {itemEarningNotifications.length > 0 && (
        <div className="fixed left-2 bottom-24 sm:bottom-20 flex flex-col gap-1 z-40 max-w-[200px]">
          {itemEarningNotifications.map((notif) => (
            <div
              key={notif.id}
              className="animate-slide-in bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1.5 text-xs flex items-center gap-1.5"
            >
              <span>{notif.item?.emoji || '📦'}</span>
              <span className="text-white/80 truncate">
                <span className="font-medium text-white">{notif.playerName}</span>
                {notif.trigger === 'challenge' ? (
                  <span className="text-purple-300"> completed {notif.challenge?.name}</span>
                ) : (
                  <span className="text-white/50"> got item</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* X-Ray Vision Overlay - See all players' boards */}
      {xrayBoards && Object.keys(xrayBoards).length > 0 && (
        <div className="fixed inset-0 bg-black/90 z-50 p-4 overflow-auto">
          <div className="flex items-center justify-between mb-3 max-w-3xl mx-auto">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">👁️</span>
              <span className="text-purple-300 text-sm font-medium">X-Ray</span>
            </div>
            <button
              onClick={() => useGameStore.getState().setXrayBoards(null)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/50 flex items-center justify-center text-lg"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {Object.entries(xrayBoards).map(([id, board]) => (
              <div key={id} className="glass rounded-lg p-2">
                <div className="text-center text-sm font-bold mb-2 truncate">
                  {board.name}
                  {board.solved && <span className="text-wordle-green ml-1">✓</span>}
                </div>
                <WordleGrid
                  guesses={board.guesses || []}
                  results={board.results || []}
                  currentInput=""
                  isCurrentPlayer={false}
                  playerName={board.name}
                  solved={board.solved}
                  score={0}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Second Chance Prompt Modal */}
      {showSecondChancePrompt && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 max-w-sm w-full animate-bounce-in text-center">
            <div className="text-4xl mb-3">🔁</div>
            <h3 className="text-xl font-bold mb-2">Second Chance!</h3>
            <p className="text-white/70 mb-4">
              You've used all 6 guesses. Use your Second Chance for one more try?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSecondChancePrompt(false);
                }}
                className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 font-medium transition-colors"
              >
                No Thanks
              </button>
              <button
                onClick={() => {
                  activateSecondChance().catch(err => showToast(err.message));
                }}
                className="flex-1 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors"
              >
                Use It!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mirror Shield Prompt Modal */}
      {mirrorShieldPrompt && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 max-w-sm w-full animate-bounce-in text-center">
            <div className="text-4xl mb-3">🪞</div>
            <h3 className="text-xl font-bold mb-2 text-red-400">
              {mirrorShieldPrompt.isCounterReflect ? 'Reflected Back!' : 'Incoming Attack!'}
            </h3>
            <p className="text-white/70 mb-4">
              <span className="font-bold text-white">{mirrorShieldPrompt.attacker}</span>{' '}
              {mirrorShieldPrompt.isCounterReflect ? 'reflected' : 'used'}{' '}
              <span className="font-bold text-red-400">{mirrorShieldPrompt.item?.emoji} {mirrorShieldPrompt.item?.name}</span>
              {mirrorShieldPrompt.isCounterReflect ? ' back at you!' : ' on you!'}
            </p>
            <p className="text-purple-300 mb-4">
              {mirrorShieldPrompt.isCounterReflect
                ? 'Counter-reflect it back? (Final bounce)'
                : 'Use Mirror Shield to reflect it back?'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  respondMirrorShield(false).catch(err => showToast(err.message));
                }}
                className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 font-medium transition-colors"
              >
                Take Hit
              </button>
              <button
                onClick={() => {
                  respondMirrorShield(true).catch(err => showToast(err.message));
                }}
                className="flex-1 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors"
              >
                {mirrorShieldPrompt.isCounterReflect ? '🪞 Counter!' : '🪞 Reflect!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 max-w-sm w-full animate-bounce-in text-center">
            <div className="text-4xl mb-3">🚪</div>
            <h3 className="text-xl font-bold mb-2">Leave Game?</h3>
            <p className="text-white/70 mb-4">
              Are you sure you want to leave? You'll lose your progress in this game.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 font-medium transition-colors"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  leaveRoom();
                  setShowLeaveConfirm(false);
                }}
                className="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
