import React, { useState } from 'react';
import { useGameStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';

export default function LobbyScreen({ waitingForOthers = false }) {
  const { gameState, playerId, roomCode, showToast } = useGameStore();

  // Derive isHost from gameState to prevent sync issues
  const isHost = gameState?.hostId === playerId;
  const { toggleReady, updateSettings, startGame, updateName, kickPlayer, leaveRoom } = useSocket();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [customWords, setCustomWords] = useState([]);
  const [showCustomWord, setShowCustomWord] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [wordError, setWordError] = useState('');

  if (!gameState) return null;

  const currentPlayer = gameState.players[playerId];
  const players = Object.values(gameState.players);

  // When waiting for others, only check readiness of returned players
  const returnedPlayers = waitingForOthers
    ? players.filter(p => p.returnedToLobby)
    : players;
  const allReady = returnedPlayers.every(p => p.ready) && returnedPlayers.length >= 1;
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
    try {
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
    }
  };

  const handleStartGame = async () => {
    try {
      await startGame();
    } catch (err) {
      showToast(err.message);
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

        {/* Leave Room Button */}
        <button
          onClick={() => leaveRoom()}
          className="text-white/60 hover:text-white flex items-center gap-2 transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Leave Room
        </button>

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
                    } ${player.ready ? 'border border-wordle-green/50' : 'border border-transparent'}`}
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
                        <span className="text-sm truncate">
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
                      <span className={`text-xs font-bold ${player.ready ? 'text-wordle-green' : 'text-white/30'}`}>
                        {player.ready ? '✓' : '○'}
                      </span>
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
                      className="w-full py-1.5 bg-wordle-yellow text-black rounded-lg font-bold text-sm"
                    >
                      {hasAnyCustomWord ? 'Start Custom' : 'Start'}
                    </button>
                  </div>
                )}

                <button
                  onClick={handleStartGame}
                  disabled={!allReady}
                  className="w-full py-3 bg-wordle-green text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {!allReady
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
                  <div className="flex gap-1.5">
                    {[1, 3, 5, 7].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => updateSettings({ rounds: n })}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${
                          gameState.settings.rounds === n
                            ? 'bg-wordle-green text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={![1, 3, 5, 7].includes(gameState.settings.rounds) ? gameState.settings.rounds : ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        updateSettings({ rounds: Math.min(99, Math.max(1, val)) });
                      }}
                      placeholder="#"
                      className={`w-12 py-1.5 rounded-lg text-sm font-bold text-center transition-all ${
                        ![1, 3, 5, 7].includes(gameState.settings.rounds)
                          ? 'bg-wordle-green text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    />
                  </div>
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
                  <span className="font-bold">{gameState.settings.rounds}</span>
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
            <div className="glass rounded-2xl p-4">
              <h2 className="font-bold text-sm mb-2 flex items-center gap-2">
                <span>Players</span>
                <span className="text-white/40 text-xs">({players.length})</span>
              </h2>

              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all ${
                      player.id === playerId ? 'bg-wordle-green/10' : 'bg-white/5'
                    } ${player.ready ? 'border border-wordle-green/50' : 'border border-transparent'}`}
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
                        <span className="text-sm truncate">
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

                    <span className={`text-xs font-bold ${player.ready ? 'text-wordle-green' : 'text-white/30'}`}>
                      {player.ready ? '✓' : '○'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Ready Button */}
              <button
                onClick={toggleReady}
                className={`w-full mt-4 py-3 rounded-xl font-bold transition-all ${
                  currentPlayer?.ready
                    ? 'bg-white/10 text-white/60 hover:bg-white/20'
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
        )}

        {/* Scoring Info */}
        <div className="mt-8 glass rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 text-center">Scoring System</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left column - Base & Guess Bonus */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-white/60">Base Score (solving)</span>
                <span className="font-bold text-wordle-green">+1000</span>
              </div>
              <div className="border-t border-white/10 pt-3">
                <div className="text-white/60 mb-2">Guess Bonus:</div>
                <div className="text-sm text-white/40 space-y-1">
                  <div className="flex justify-between">
                    <span>1 guess (genius!)</span>
                    <span className="text-wordle-green">+900</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2 guesses</span>
                    <span className="text-wordle-green">+750</span>
                  </div>
                  <div className="flex justify-between">
                    <span>3 guesses</span>
                    <span className="text-wordle-green">+600</span>
                  </div>
                  <div className="flex justify-between">
                    <span>4 guesses</span>
                    <span className="text-wordle-green">+450</span>
                  </div>
                  <div className="flex justify-between">
                    <span>5 guesses</span>
                    <span className="text-wordle-green">+300</span>
                  </div>
                  <div className="flex justify-between">
                    <span>6 guesses</span>
                    <span className="text-wordle-green">+150</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column - Time Bonus */}
            <div className="space-y-4">
              <div className="text-white/60">Time Bonus (up to 500 pts):</div>
              <div className="text-sm text-white/40 space-y-1">
                <p className="text-white/60">= seconds left × (500 ÷ round time)</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between">
                    <span>60s round</span>
                    <span className="text-blue-400">8.3/sec</span>
                  </div>
                  <div className="flex justify-between">
                    <span>120s round</span>
                    <span className="text-blue-400">4.2/sec</span>
                  </div>
                  <div className="flex justify-between">
                    <span>180s round</span>
                    <span className="text-blue-400">2.8/sec</span>
                  </div>
                  <div className="flex justify-between">
                    <span>300s round</span>
                    <span className="text-blue-400">1.7/sec</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 pt-3 text-sm">
                <div className="text-white/40">Example: 180s round, 3 guesses, 90s left</div>
                <div className="text-white/60">= 1000 + 600 + (90 × 2.8) = <span className="text-wordle-yellow font-bold">1852 pts</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
