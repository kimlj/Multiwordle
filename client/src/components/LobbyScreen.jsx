import React, { useState } from 'react';
import { useGameStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';

export default function LobbyScreen() {
  const { gameState, playerId, roomCode, isHost, showToast } = useGameStore();
  const { toggleReady, updateSettings, startGame, updateName } = useSocket();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [customWords, setCustomWords] = useState([]);
  const [showCustomWord, setShowCustomWord] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordError, setWordError] = useState('');

  if (!gameState) return null;

  const currentPlayer = gameState.players[playerId];
  const players = Object.values(gameState.players);
  const allReady = players.every(p => p.ready) && players.length >= 1;
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

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">Game Lobby</h1>
          <div className="flex items-center justify-center gap-2">
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
                  
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                    player.ready 
                      ? 'bg-wordle-green/20 text-wordle-green' 
                      : 'bg-white/10 text-white/40'
                  }`}>
                    {player.ready ? '✓ Ready' : 'Waiting'}
                  </div>
                </div>
              ))}
            </div>
            
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
          </div>

          {/* Settings */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4">Game Settings</h2>

            {isHost ? (
              /* Editable settings for host */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Number of Rounds</label>
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
                </div>
              </div>
            ) : (
              /* Read-only settings for non-host */
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="text-white/60">Rounds</span>
                  <span className="font-bold">{gameState.settings.rounds}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="text-white/60">Round Time</span>
                  <span className="font-bold">{formatTime(gameState.settings.roundTimeSeconds)}</span>
                </div>
              </div>
            )}

            {isHost && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="font-bold mb-3">Host Controls</h3>
                
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
                  {allReady ? 'Start Game!' : 'Waiting for players...'}
                </button>
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
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="text-3xl mb-2">🎯</div>
              <div className="font-bold text-wordle-green">1000 pts</div>
              <div className="text-white/40 text-sm">Base for solving</div>
            </div>
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="text-3xl mb-2">⚡</div>
              <div className="font-bold text-wordle-yellow">+150 pts</div>
              <div className="text-white/40 text-sm">Per guess saved</div>
            </div>
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="text-3xl mb-2">⏱️</div>
              <div className="font-bold text-blue-400">+Time Bonus</div>
              <div className="text-white/40 text-sm">Faster = more points</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
