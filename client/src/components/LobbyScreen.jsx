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
          className="mb-4 text-white/60 hover:text-white flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Leave Room
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">Game Lobby</h1>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-white/60">Room Code:</span>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            >
              <span className="font-mono text-2xl tracking-widest text-wordle-green">{roomCode}</span>
              <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            {copied && <span className="text-wordle-green text-sm">Copied!</span>}
            <button
              onClick={handleShareLink}
              className="flex items-center gap-2 px-4 py-2 bg-wordle-green/20 text-wordle-green rounded-lg hover:bg-wordle-green/30 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Link
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Players List */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span>Players</span>
              <span className="text-white/40 text-sm">({players.length})</span>
            </h2>
            
            <div className="space-y-3">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    player.id === playerId ? 'player-you' : 'bg-white/5'
                  } ${player.ready ? 'border-2 border-wordle-green' : 'border-2 border-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    {player.id === gameState.hostId && (
                      <span className="text-wordle-yellow text-xs font-bold px-2 py-1 bg-wordle-yellow/20 rounded">
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
                        className="bg-transparent border-b border-white/30 outline-none px-1"
                        autoFocus
                        maxLength={20}
                      />
                    ) : (
                      <span className="font-medium">
                        {player.name}
                        {player.id === playerId && ' (You)'}
                      </span>
                    )}
                    {player.id === playerId && !editingName && (
                      <button
                        onClick={() => {
                          setNewName(player.name);
                          setEditingName(true);
                        }}
                        className="text-white/40 hover:text-white"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                      player.ready
                        ? 'bg-wordle-green/20 text-wordle-green'
                        : 'bg-white/10 text-white/40'
                    }`}>
                      {player.ready ? '✓ Ready' : 'Waiting'}
                    </div>
                    {isHost && player.id !== playerId && (
                      <button
                        onClick={() => {
                          kickPlayer(player.id).catch(err => showToast(err.message));
                        }}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                        title="Kick player"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Only show Ready button to non-host players - host is always ready */}
            {!isHost && (
              <button
                onClick={toggleReady}
                className={`w-full mt-6 py-4 rounded-xl font-bold text-lg transition-all ${
                  currentPlayer?.ready
                    ? 'bg-white/10 text-white/60 hover:bg-white/20'
                    : 'bg-wordle-green text-white hover:bg-wordle-green/90'
                }`}
              >
                {currentPlayer?.ready ? 'Cancel Ready' : "I'm Ready!"}
              </button>
            )}

            {/* Host Start Game Controls - placed after players list */}
            {isHost && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <button
                  onClick={() => setShowCustomWord(!showCustomWord)}
                  className="w-full py-3 px-4 bg-white/5 rounded-lg text-left hover:bg-white/10 transition-colors mb-3"
                >
                  <div className="flex justify-between items-center">
                    <span>Set Custom Word</span>
                    <span className="text-white/40">{showCustomWord ? '▲' : '▼'}</span>
                  </div>
                </button>

                {showCustomWord && (
                  <div className="mb-4 p-4 bg-white/5 rounded-lg">
                    <p className="text-sm text-white/60 mb-3 text-center">
                      Set custom words for each round (leave empty for random)
                    </p>
                    <div className="space-y-2 mb-3">
                      {customWords.map((word, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-white/40 text-sm w-20">Round {idx + 1}:</span>
                          <input
                            type="text"
                            value={word}
                            onChange={(e) => handleCustomWordChange(idx, e.target.value)}
                            placeholder="WORD"
                            className={`input-dark flex-1 text-center tracking-widest font-mono text-sm py-2 ${
                              word.length > 0 && word.length < 5 ? 'border-orange-500' : ''
                            } ${word.length === 5 ? 'border-wordle-green' : ''}`}
                            maxLength={5}
                          />
                          {word.length === 5 && <span className="text-wordle-green">✓</span>}
                        </div>
                      ))}
                    </div>
                    {wordError && (
                      <p className="text-red-400 text-sm mb-2 text-center">{wordError}</p>
                    )}
                    <button
                      onClick={handleStartWithWords}
                      className="w-full py-2 bg-wordle-yellow text-black rounded-lg font-bold"
                    >
                      {hasAnyCustomWord ? 'Start with Custom Words' : 'Start Game'}
                    </button>
                  </div>
                )}

                <button
                  onClick={handleStartGame}
                  disabled={!allReady}
                  className="w-full py-4 bg-wordle-green text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {!allReady
                    ? 'Waiting for players...'
                    : waitingForOthers && playersStillViewing.length > 0
                      ? `Start with ${returnedPlayers.length} player${returnedPlayers.length !== 1 ? 's' : ''}`
                      : 'Start Game!'}
                </button>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4">Game Settings</h2>

            {isHost ? (
              /* Editable settings for host */
              <div className="space-y-4">
                {/* Game Mode Selection */}
                <div>
                  <label className="block text-sm text-white/60 mb-2">Game Mode</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateSettings({ gameMode: 'classic' })}
                      className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                        gameState.settings.gameMode !== 'battleRoyale'
                          ? 'bg-wordle-green text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      <div className="text-sm">Classic</div>
                      <div className="text-xs opacity-60">Fixed rounds</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSettings({ gameMode: 'battleRoyale' })}
                      className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                        gameState.settings.gameMode === 'battleRoyale'
                          ? 'bg-red-500 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      <div className="text-sm">Elimination</div>
                      <div className="text-xs opacity-60">Last one standing</div>
                    </button>
                  </div>
                  {gameState.settings.gameMode === 'battleRoyale' && (
                    <p className="text-xs text-red-400/80 mt-2 text-center">
                      Lowest scorer eliminated each round. Last player wins!
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    {gameState.settings.gameMode === 'battleRoyale' ? 'Max Rounds (if no winner)' : 'Number of Rounds'}
                  </label>
                  <div className="flex gap-2">
                    {[1, 3, 5, 7].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => updateSettings({ rounds: n })}
                        className={`flex-1 py-2 rounded-lg font-bold transition-all ${
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
                      className={`w-14 py-2 rounded-lg font-bold text-center transition-all ${
                        ![1, 3, 5, 7].includes(gameState.settings.rounds)
                          ? 'bg-wordle-green text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">Time Per Round</label>
                  <div className="flex gap-2">
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
                        className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                          gameState.settings.roundTimeSeconds === opt.value
                            ? 'bg-wordle-green text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-white/40 text-sm">Custom:</span>
                    <input
                      type="number"
                      min="10"
                      max="3600"
                      value={![60, 120, 180, 300].includes(gameState.settings.roundTimeSeconds) ? gameState.settings.roundTimeSeconds : ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          updateSettings({ roundTimeSeconds: val });
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value) || 60;
                        updateSettings({ roundTimeSeconds: Math.min(3600, Math.max(10, val)) });
                      }}
                      placeholder="seconds"
                      className={`w-20 py-1 rounded-lg font-bold text-center text-sm transition-all ${
                        ![60, 120, 180, 300].includes(gameState.settings.roundTimeSeconds)
                          ? 'bg-wordle-green text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    />
                    <span className="text-white/40 text-sm">sec</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Read-only settings for non-host */
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="text-white/60">Game Mode</span>
                  <span className={`font-bold ${gameState.settings.gameMode === 'battleRoyale' ? 'text-red-400' : 'text-wordle-green'}`}>
                    {gameState.settings.gameMode === 'battleRoyale' ? 'Elimination' : 'Classic'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="text-white/60">Rounds</span>
                  <span className="font-bold">{gameState.settings.rounds}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="text-white/60">Round Time</span>
                  <span className="font-bold">{formatTime(gameState.settings.roundTimeSeconds)}</span>
                </div>
                {gameState.settings.gameMode === 'battleRoyale' && (
                  <p className="text-xs text-red-400/80 text-center mt-2">
                    Lowest scorer eliminated each round!
                  </p>
                )}
              </div>
            )}

            {!isHost && allReady && (
              <div className="mt-6 pt-6 border-t border-white/10 text-center text-white/60">
                <p>Waiting for host to start the game...</p>
              </div>
            )}
          </div>
        </div>

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
