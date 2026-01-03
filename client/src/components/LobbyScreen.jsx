import React, { useState } from 'react';
import { useGameStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';
import InfoModal from './InfoModal';
import DevFooter from './DevFooter';
import LobbyChat from './LobbyChat';

export default function LobbyScreen({ waitingForOthers = false }) {
  const { gameState, playerId, roomCode, showToast, nudgeNotification } = useGameStore();

  // Derive isHost from gameState to prevent sync issues
  const isHost = gameState?.hostId === playerId;
  const { toggleReady, updateSettings, startGame, updateName, kickPlayer, leaveRoom, socket, nudgePlayer } = useSocket();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [customWords, setCustomWords] = useState([]);
  const [showCustomWord, setShowCustomWord] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [wordError, setWordError] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [recentlyNudged, setRecentlyNudged] = useState({}); // { playerId: timestamp } - prevent spam
  const [customRoundsInput, setCustomRoundsInput] = useState(''); // For typing custom round numbers
  const [isTypingRounds, setIsTypingRounds] = useState(false);
  const [isStarting, setIsStarting] = useState(false); // Show loading state on start button

  const handleNudgePlayer = async (targetPlayerId) => {
    // Check cooldown (3 seconds per player)
    const lastNudge = recentlyNudged[targetPlayerId];
    if (lastNudge && Date.now() - lastNudge < 3000) {
      return; // Still on cooldown
    }

    try {
      await nudgePlayer(targetPlayerId);
      setRecentlyNudged(prev => ({ ...prev, [targetPlayerId]: Date.now() }));
      showToast('Nudge sent!', 1500);
    } catch (err) {
      showToast(err.message, 2000);
    }
  };

  if (!gameState) return null;

  const currentPlayer = gameState.players[playerId];
  const players = Object.values(gameState.players);

  // When waiting for others, only check readiness of returned players
  // Host doesn't need to ready - only other players do
  const returnedPlayers = waitingForOthers
    ? players.filter(p => p.returnedToLobby)
    : players;
  const nonHostPlayers = returnedPlayers.filter(p => p.id !== gameState.hostId);
  const allReady = nonHostPlayers.every(p => p.ready) && returnedPlayers.length >= 1;
  const numRounds = gameState.settings.rounds;

  // Initialize custom words array when rounds change
  React.useEffect(() => {
    setCustomWords(prev => {
      const newWords = [...prev];
      while (newWords.length < numRounds) newWords.push('');
      return newWords.slice(0, numRounds);
    });
  }, [numRounds]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
    const shareUrl = `${window.location.origin}/?room=${roomCode}`;

    // Try native share API first (better on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Wordle game!',
          text: `Join my Wordle Royale game! Room code: ${roomCode}`,
          url: shareUrl
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch (err) {
        // User cancelled or share failed, fall back to clipboard
        if (err.name !== 'AbortError') {
          console.log('Share failed, using clipboard:', err);
        }
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copied! Share it with friends');
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch (err) {
      // Clipboard failed, show manual copy
      showToast(`Share this link: ${shareUrl}`);
    }
  };

  const handleNameEdit = () => {
    if (newName.trim()) {
      updateName(newName.trim());
    }
    setEditingName(false);
  };

  const handleCustomWordChange = (index, value) => {
    const newWords = [...customWords];
    newWords[index] = value.toUpperCase().replace(/[^A-Z]/g, '');
    setCustomWords(newWords);
    setWordError('');
  };

  const handleStartWithWords = async () => {
    if (isStarting) return;
    try {
      setIsStarting(true);
      setWordError('');
      // Filter out empty words, keep only valid 5-letter words
      const validWords = customWords.filter(w => w.length === 5);
      if (validWords.length > 0) {
        await startGame(null, validWords);
      } else {
        await startGame();
      }
    } catch (err) {
      setWordError(err.message);
      showToast(err.message);
      setIsStarting(false);
    }
  };

  const handleStartGame = async () => {
    if (isStarting) return;
    try {
      setIsStarting(true);
      await startGame();
    } catch (err) {
      showToast(err.message);
      setIsStarting(false);
    }
  };

  const hasAnyCustomWord = customWords.some(w => w.length === 5);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins} min` : `${secs}s`;
  };

  // Count players who have returned to lobby vs still viewing results
  const playersReturned = players.filter(p => p.returnedToLobby).length;
  const playersStillViewing = players.filter(p => !p.returnedToLobby);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Floating notification for waiting players */}
        {waitingForOthers && playersStillViewing.length > 0 && (
          <div className="fixed top-4 right-4 z-50 max-w-xs p-3 bg-wordle-yellow/20 backdrop-blur-sm border border-wordle-yellow/40 rounded-lg shadow-lg text-sm">
            <div className="text-wordle-yellow font-medium">
              {playersReturned}/{players.length} returned
            </div>
            <div className="text-white/60 text-xs mt-1">
              Waiting: {playersStillViewing.map(p => p.name).join(', ')}
            </div>
            {isHost && (
              <div className="text-white/50 text-xs mt-1">
                Start to play without them
              </div>
            )}
          </div>
        )}

        {/* Top Nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => leaveRoom()}
            className="text-white/60 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Leave
          </button>
          <button
            onClick={() => setShowInfo(true)}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            title="Game Info"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* Game Lobby Title + Room Code */}
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl font-bold">Game Lobby</h1>
          <div className="flex items-center justify-center gap-3 mt-2 text-sm">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 hover:opacity-80 transition-colors"
            >
              <span className={`font-mono tracking-wider ${copied ? 'text-wordle-green' : 'text-white/50'}`}>{roomCode}</span>
              <svg className={`w-3.5 h-3.5 ${copied ? 'text-wordle-green' : 'text-white/50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <span className="text-white/30">•</span>
            <button
              onClick={handleShareLink}
              className={`flex items-center gap-1 transition-colors ${shared ? 'text-wordle-green' : 'text-white/50 hover:text-white/70'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>
        </div>

        {isHost ? (
          /* HOST LAYOUT: Two columns - Players on left, Settings on right */
          <div className="grid md:grid-cols-2 gap-6">
            {/* Players List */}
            <div className="glass rounded-2xl p-4">
              <h2 className="font-bold text-sm mb-2 flex items-center gap-2">
                <span>Players</span>
                <span className="text-white/40 text-xs">({players.length})</span>
              </h2>

              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all ${
                      player.id === playerId ? 'bg-wordle-green/10' : 'bg-white/5'
                    } ${player.id !== gameState.hostId && player.ready ? 'border border-wordle-green/50' : 'border border-transparent'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {player.id === gameState.hostId && (
                        <span className="text-wordle-yellow text-[10px] font-bold px-1.5 py-0.5 bg-wordle-yellow/20 rounded shrink-0">
                          HOST
                        </span>
                      )}
                      {player.id === playerId && editingName ? (
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onBlur={handleNameEdit}
                          onKeyDown={(e) => e.key === 'Enter' && handleNameEdit()}
                          className="bg-transparent border-b border-white/30 outline-none px-1 text-sm w-24"
                          autoFocus
                          maxLength={20}
                        />
                      ) : (
                        <span className="text-sm truncate text-white/70">
                          {player.name}
                          {player.id === playerId && <span className="text-white/40 text-xs"> (You)</span>}
                        </span>
                      )}
                      {player.id === playerId && !editingName && (
                        <button
                          onClick={() => { setNewName(player.name); setEditingName(true); }}
                          className="text-white/40 hover:text-white shrink-0"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Host doesn't participate in ready system */}
                      {player.id !== gameState.hostId && (
                        player.ready ? (
                          <span className="text-xs font-bold text-wordle-green">✓</span>
                        ) : (
                          <button
                            onClick={() => handleNudgePlayer(player.id)}
                            className="p-1 text-wordle-yellow/70 hover:text-wordle-yellow hover:bg-wordle-yellow/10 rounded transition-all group"
                            title="Nudge to get ready"
                          >
                            <svg className="w-4 h-4 group-hover:animate-wiggle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                          </button>
                        )
                      )}
                      {player.id !== playerId && (
                        <button
                          onClick={() => kickPlayer(player.id).catch(err => showToast(err.message))}
                          className="p-0.5 text-red-400/60 hover:text-red-400 rounded transition-colors"
                          title="Kick"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Host Start Game Controls */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={() => setShowCustomWord(!showCustomWord)}
                  className="w-full py-2 px-3 bg-white/5 rounded-lg text-left hover:bg-white/10 transition-colors mb-2 text-sm"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-white/70">Custom Words</span>
                    <span className="text-white/40 text-xs">{showCustomWord ? '▲' : '▼'}</span>
                  </div>
                </button>

                {showCustomWord && (
                  <div className="mb-3 p-3 bg-white/5 rounded-lg">
                    <div className="space-y-1.5 mb-2 max-h-[120px] overflow-y-auto">
                      {customWords.map((word, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-white/40 text-xs w-12">R{idx + 1}:</span>
                          <input
                            type="text"
                            value={word}
                            onChange={(e) => handleCustomWordChange(idx, e.target.value)}
                            placeholder="WORD"
                            className={`input-dark flex-1 text-center tracking-widest font-mono text-xs py-1.5 ${
                              word.length > 0 && word.length < 5 ? 'border-orange-500' : ''
                            } ${word.length === 5 ? 'border-wordle-green' : ''}`}
                            maxLength={5}
                          />
                          {word.length === 5 && <span className="text-wordle-green text-xs">✓</span>}
                        </div>
                      ))}
                    </div>
                    {wordError && <p className="text-red-400 text-xs mb-2 text-center">{wordError}</p>}
                    <button
                      onClick={handleStartWithWords}
                      disabled={isStarting}
                      className={`w-full py-1.5 rounded-lg font-bold text-sm transition-all ${
                        isStarting
                          ? 'bg-wordle-yellow/50 text-black/50 cursor-wait'
                          : 'bg-wordle-yellow text-black'
                      }`}
                    >
                      {isStarting ? 'Starting...' : (hasAnyCustomWord ? 'Start Custom' : 'Start')}
                    </button>
                  </div>
                )}

                <button
                  onClick={handleStartGame}
                  disabled={!allReady || isStarting}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${
                    isStarting
                      ? 'bg-wordle-green/70 text-white/70 cursor-wait animate-pulse'
                      : 'bg-wordle-green text-white disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {isStarting
                    ? 'Starting...'
                    : !allReady
                      ? 'Waiting for players...'
                      : waitingForOthers && playersStillViewing.length > 0
                        ? `Start (${returnedPlayers.length} ready)`
                        : 'Start Game!'}
                </button>
              </div>
            </div>

            {/* Settings for Host */}
            <div className="glass rounded-2xl p-4">
              <h2 className="font-bold text-base mb-3">Game Settings</h2>
              <div className="space-y-3">
                {/* Game Mode Selection */}
                <div>
                  <label className="block text-xs text-white/60 mb-1.5">Game Mode</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateSettings({ gameMode: 'classic' })}
                      className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                        gameState.settings.gameMode !== 'battleRoyale'
                          ? 'bg-wordle-green text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      <div className="text-xs">Classic</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSettings({ gameMode: 'battleRoyale' })}
                      className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                        gameState.settings.gameMode === 'battleRoyale'
                          ? 'bg-red-500 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      <div className="text-xs">Elimination</div>
                    </button>
                  </div>
                </div>

                {/* Rounds */}
                <div>
                  <label className="block text-xs text-white/60 mb-1.5">Rounds</label>
                  {gameState.settings.gameMode === 'battleRoyale' ? (
                    /* Elimination mode: auto-calculated rounds based on player count */
                    <div className="flex items-center gap-2">
                      <div className="flex-1 py-2 rounded-lg text-sm font-bold text-center bg-red-500/20 border border-red-500/50 text-red-400">
                        {Math.max(1, players.length - 1)} rounds
                      </div>
                      <div className="text-xs text-white/40">
                        = {players.length} players - 1
                      </div>
                    </div>
                  ) : (
                    /* Classic mode: manual round selection */
                    <div className="flex gap-1.5">
                      {[1, 3, 5, 7].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            updateSettings({ rounds: n });
                            setCustomRoundsInput('');
                            setIsTypingRounds(false);
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${
                            gameState.settings.rounds === n && !isTypingRounds
                              ? 'bg-wordle-green text-white'
                              : 'bg-white/10 text-white/60 hover:bg-white/20'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        value={isTypingRounds ? customRoundsInput : (![1, 3, 5, 7].includes(gameState.settings.rounds) ? gameState.settings.rounds : '')}
                        onFocus={() => {
                          setIsTypingRounds(true);
                          if (![1, 3, 5, 7].includes(gameState.settings.rounds)) {
                            setCustomRoundsInput(String(gameState.settings.rounds));
                          } else {
                            setCustomRoundsInput('');
                          }
                        }}
                        onChange={(e) => {
                          const rawVal = e.target.value.replace(/[^0-9]/g, '');
                          setCustomRoundsInput(rawVal);
                          if (rawVal !== '') {
                            const val = Math.min(99, Math.max(1, parseInt(rawVal) || 1));
                            updateSettings({ rounds: val });
                          }
                        }}
                        onBlur={() => {
                          setIsTypingRounds(false);
                          if (customRoundsInput === '' || [1, 3, 5, 7].includes(parseInt(customRoundsInput))) {
                            setCustomRoundsInput('');
                          }
                        }}
                        placeholder="#"
                        className={`w-12 py-1.5 rounded-lg text-sm font-bold text-center transition-all ${
                          (isTypingRounds && customRoundsInput !== '') || ![1, 3, 5, 7].includes(gameState.settings.rounds)
                            ? 'bg-wordle-green text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Time Per Round */}
                <div>
                  <label className="block text-xs text-white/60 mb-1.5">Time Per Round</label>
                  <div className="flex gap-1.5">
                    {[
                      { label: '1m', value: 60 },
                      { label: '2m', value: 120 },
                      { label: '3m', value: 180 },
                      { label: '5m', value: 300 }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateSettings({ roundTimeSeconds: opt.value })}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${
                          gameState.settings.roundTimeSeconds === opt.value
                            ? 'bg-wordle-green text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="10"
                      max="3600"
                      value={![60, 120, 180, 300].includes(gameState.settings.roundTimeSeconds) ? gameState.settings.roundTimeSeconds : ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) updateSettings({ roundTimeSeconds: val });
                      }}
                      placeholder="sec"
                      className={`w-14 py-1.5 rounded-lg text-sm font-bold text-center transition-all ${
                        ![60, 120, 180, 300].includes(gameState.settings.roundTimeSeconds)
                          ? 'bg-wordle-green text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    />
                  </div>
                </div>

                {/* 2x2 Grid for Modifiers */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Mirror Match */}
                  <button
                    type="button"
                    onClick={() => updateSettings({ mirrorMatch: !gameState.settings.mirrorMatch })}
                    className={`p-2.5 rounded-lg font-bold transition-all text-left ${
                      gameState.settings.mirrorMatch
                        ? 'bg-wordle-yellow/20 border border-wordle-yellow'
                        : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>🪞</span>
                      <span className={`text-xs ${gameState.settings.mirrorMatch ? 'text-wordle-yellow' : 'text-white/70'}`}>Mirror</span>
                    </div>
                    <p className="text-[10px] text-white/40 mt-0.5">Same opener for all</p>
                  </button>

                  {/* Hardcore Mode */}
                  <button
                    type="button"
                    onClick={() => updateSettings({ hardcoreMode: !gameState.settings.hardcoreMode })}
                    className={`p-2.5 rounded-lg font-bold transition-all text-left ${
                      gameState.settings.hardcoreMode
                        ? 'bg-red-500/20 border border-red-500'
                        : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>💀</span>
                      <span className={`text-xs ${gameState.settings.hardcoreMode ? 'text-red-400' : 'text-white/70'}`}>Hardcore</span>
                    </div>
                    <p className="text-[10px] text-white/40 mt-0.5">No keyboard colors</p>
                  </button>

                  {/* Fresh Openers */}
                  <button
                    type="button"
                    onClick={() => updateSettings({ freshOpenersOnly: !gameState.settings.freshOpenersOnly })}
                    className={`p-2.5 rounded-lg font-bold transition-all text-left ${
                      gameState.settings.freshOpenersOnly
                        ? 'bg-blue-500/20 border border-blue-500'
                        : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>🆕</span>
                      <span className={`text-xs ${gameState.settings.freshOpenersOnly ? 'text-blue-400' : 'text-white/70'}`}>Fresh</span>
                    </div>
                    <p className="text-[10px] text-white/40 mt-0.5">New opener/round</p>
                  </button>

                  {/* Power-ups */}
                  <button
                    type="button"
                    onClick={() => updateSettings({ powerUpsEnabled: !gameState.settings.powerUpsEnabled })}
                    className={`p-2.5 rounded-lg font-bold transition-all text-left ${
                      gameState.settings.powerUpsEnabled
                        ? 'bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500'
                        : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>⚡</span>
                      <span className={`text-xs ${gameState.settings.powerUpsEnabled ? 'text-orange-400' : 'text-white/70'}`}>Items</span>
                    </div>
                    <p className="text-[10px] text-white/40 mt-0.5">Power & sabotage</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* NON-HOST LAYOUT: Single column - Settings bar, Players, Ready, Scoring */
          <div className="max-w-lg mx-auto space-y-4">
            {/* Compact Settings Bar */}
            <div className="glass rounded-xl p-4 space-y-3">
              {/* Modes row */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  gameState.settings.gameMode === 'battleRoyale'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-wordle-green/20 text-wordle-green'
                }`}>
                  {gameState.settings.gameMode === 'battleRoyale' ? 'Elimination' : 'Classic'}
                </span>
                {gameState.settings.mirrorMatch && (
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-wordle-yellow/20 text-wordle-yellow">
                    Mirror
                  </span>
                )}
                {gameState.settings.hardcoreMode && (
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-purple-500/20 text-purple-400">
                    Hardcore
                  </span>
                )}
                {gameState.settings.freshOpenersOnly && (
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-500/20 text-blue-400">
                    Fresh
                  </span>
                )}
                {gameState.settings.powerUpsEnabled && (
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-orange-500/20 to-pink-500/20 text-orange-400">
                    ⚡ Items
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-center gap-6 text-sm">
                <div>
                  <span className="text-white/40">Rounds: </span>
                  <span className={`font-bold ${gameState.settings.gameMode === 'battleRoyale' ? 'text-red-400' : ''}`}>
                    {gameState.settings.gameMode === 'battleRoyale'
                      ? Math.max(1, players.length - 1)
                      : gameState.settings.rounds}
                  </span>
                  {gameState.settings.gameMode === 'battleRoyale' && (
                    <span className="text-white/30 text-xs ml-1">(auto)</span>
                  )}
                </div>
                <div>
                  <span className="text-white/40">Time: </span>
                  <span className="font-bold">{formatTime(gameState.settings.roundTimeSeconds)}</span>
                </div>
              </div>

              {/* Summary */}
              {(gameState.settings.gameMode === 'battleRoyale' || gameState.settings.mirrorMatch || gameState.settings.hardcoreMode || gameState.settings.freshOpenersOnly || gameState.settings.powerUpsEnabled) && (
                <p className="text-xs text-white/50 text-center">
                  {[
                    gameState.settings.gameMode === 'battleRoyale' && 'Lowest scorer eliminated',
                    gameState.settings.mirrorMatch && 'Same opener for all',
                    gameState.settings.hardcoreMode && 'No keyboard colors',
                    gameState.settings.freshOpenersOnly && 'New opener each round',
                    gameState.settings.powerUpsEnabled && 'Power-ups & sabotages'
                  ].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>

            {/* Players List */}
            <div className="glass rounded-2xl p-4 h-[60vh] flex flex-col">
              <h2 className="font-bold text-sm mb-2 flex items-center gap-2 shrink-0">
                <span>Players</span>
                <span className="text-white/40 text-xs">({players.length})</span>
              </h2>

              <div className="space-y-1.5 flex-1 overflow-y-auto">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all ${
                      player.id === playerId ? 'bg-wordle-green/10' : 'bg-white/5'
                    } ${player.id !== gameState.hostId && player.ready ? 'border border-wordle-green/50' : 'border border-transparent'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {player.id === gameState.hostId && (
                        <span className="text-wordle-yellow text-[10px] font-bold px-1.5 py-0.5 bg-wordle-yellow/20 rounded shrink-0">
                          HOST
                        </span>
                      )}
                      {player.id === playerId && editingName ? (
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onBlur={handleNameEdit}
                          onKeyDown={(e) => e.key === 'Enter' && handleNameEdit()}
                          className="bg-transparent border-b border-white/30 outline-none px-1 text-sm w-24"
                          autoFocus
                          maxLength={20}
                        />
                      ) : (
                        <span className="text-sm truncate text-white/70">
                          {player.name}
                          {player.id === playerId && <span className="text-white/40 text-xs"> (You)</span>}
                        </span>
                      )}
                      {player.id === playerId && !editingName && (
                        <button
                          onClick={() => { setNewName(player.name); setEditingName(true); }}
                          className="text-white/40 hover:text-white shrink-0"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Host doesn't participate in ready system */}
                    {player.id !== gameState.hostId && (
                      <span className={`text-xs font-bold ${player.ready ? 'text-wordle-green' : 'text-white/30'}`}>
                        {player.ready ? '✓' : '○'}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Ready Button - pinned at bottom */}
              <div className="shrink-0 pt-4 mt-auto border-t border-white/10">
                {/* Nudge notification banner */}
                {nudgeNotification && !currentPlayer?.ready && (
                  <div className="mb-3 p-3 bg-wordle-yellow/20 border border-wordle-yellow/50 rounded-xl animate-nudge-pulse">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 text-wordle-yellow animate-wiggle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <span className="text-wordle-yellow font-bold text-sm">Host is waiting for you!</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={toggleReady}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${
                    currentPlayer?.ready
                      ? 'bg-white/10 text-white/60 hover:bg-white/20'
                      : nudgeNotification
                        ? 'bg-wordle-yellow text-black hover:bg-wordle-yellow/90 animate-nudge-pulse'
                        : 'bg-wordle-green text-white hover:bg-wordle-green/90'
                  }`}
                >
                  {currentPlayer?.ready ? 'Cancel Ready' : "I'm Ready!"}
                </button>

                {allReady && (
                  <div className="mt-3 text-center text-white/50 text-xs">
                    Waiting for host to start...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Dev Footer */}
      <div className="mt-4 flex justify-center">
        <DevFooter compact />
      </div>

      {/* Info Modal */}
      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />

      {/* Lobby Chat */}
      <LobbyChat socket={socket} />
    </div>
  );
}
