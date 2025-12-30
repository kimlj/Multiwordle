import React, { useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../lib/store';

export default function HomeScreen() {
  const [view, setView] = useState('home'); // home, create, join
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [settings, setSettings] = useState({
    rounds: 3,
    roundTimeSeconds: 180
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { createRoom, joinRoom } = useSocket();
  const { connected } = useGameStore();

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await createRoom(playerName.trim(), settings);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await joinRoom(roomCode.trim().toUpperCase(), playerName.trim());
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (view === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <button
            onClick={() => setView('home')}
            className="mb-8 text-white/60 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          
          <div className="glass rounded-2xl p-8">
            <h2 className="font-display text-3xl font-bold mb-6">Create Game</h2>
            
            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="block text-sm text-white/60 mb-2">Your Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="input-dark"
                  maxLength={20}
                />
              </div>
              
              <div>
                <label className="block text-sm text-white/60 mb-2">Number of Rounds</label>
                <div className="flex gap-2">
                  {[1, 3, 5, 7].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSettings({ ...settings, rounds: n })}
                      className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                        settings.rounds === n
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
                    { label: '1 min', value: 60 },
                    { label: '2 min', value: 120 },
                    { label: '3 min', value: 180 },
                    { label: '5 min', value: 300 }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSettings({ ...settings, roundTimeSeconds: opt.value })}
                      className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                        settings.roundTimeSeconds === opt.value
                          ? 'bg-wordle-green text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {error && (
                <div className="text-red-400 text-sm text-center">{error}</div>
              )}
              
              <button
                type="submit"
                disabled={loading || !connected}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <button
            onClick={() => setView('home')}
            className="mb-8 text-white/60 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          
          <div className="glass rounded-2xl p-8">
            <h2 className="font-display text-3xl font-bold mb-6">Join Game</h2>
            
            <form onSubmit={handleJoin} className="space-y-6">
              <div>
                <label className="block text-sm text-white/60 mb-2">Your Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="input-dark"
                  maxLength={20}
                />
              </div>
              
              <div>
                <label className="block text-sm text-white/60 mb-2">Room Code</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-letter code"
                  className="input-dark text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                />
              </div>
              
              {error && (
                <div className="text-red-400 text-sm text-center">{error}</div>
              )}
              
              <button
                type="submit"
                disabled={loading || !connected}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Joining...' : 'Join Room'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="font-display text-6xl md:text-8xl font-bold mb-4 bg-gradient-to-r from-wordle-green via-wordle-yellow to-wordle-green bg-clip-text text-transparent">
          WORDLE
        </h1>
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-white/80">
          ROYALE
        </h2>
        <p className="text-white/40 mt-4 font-mono">Multiplayer Word Battle</p>
      </div>
      
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => setView('create')}
          disabled={!connected}
          className="btn-primary w-full text-lg disabled:opacity-50"
        >
          Create Game
        </button>
        
        <button
          onClick={() => setView('join')}
          disabled={!connected}
          className="btn-secondary w-full text-lg disabled:opacity-50"
        >
          Join Game
        </button>
      </div>
      
      <div className="mt-8 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-wordle-green' : 'bg-red-500'}`} />
        <span className="text-white/40 text-sm">
          {connected ? 'Connected' : 'Connecting...'}
        </span>
      </div>
      
      <div className="mt-12 grid md:grid-cols-2 gap-4 max-w-3xl w-full">
        {/* How to Play */}
        <div className="glass rounded-xl p-6">
          <h3 className="font-bold text-lg mb-3 text-wordle-green">How to Play</h3>
          <div className="text-white/60 text-sm space-y-2">
            <p>🎯 Guess the 5-letter word in 6 tries</p>
            <p>⚡ Race against other players and the clock</p>
            <p>🏆 Score points based on speed and fewer guesses</p>
            <p>🟩 Green = correct letter, correct spot</p>
            <p>🟨 Yellow = correct letter, wrong spot</p>
            <p>⬛ Gray = letter not in word</p>
          </div>
        </div>

        {/* Scoring System */}
        <div className="glass rounded-xl p-6">
          <h3 className="font-bold text-lg mb-3 text-wordle-yellow">Scoring System</h3>
          <div className="text-sm space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-white/60">Base Score (solving)</span>
              <span className="font-bold text-wordle-green">+1000</span>
            </div>
            <div className="border-t border-white/10 pt-2">
              <div className="text-white/60 mb-1">Guess Bonus:</div>
              <div className="text-xs text-white/40 space-y-1">
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
            <div className="border-t border-white/10 pt-2">
              <div className="text-white/60 mb-1">Time Bonus:</div>
              <div className="text-xs text-white/40 space-y-1">
                <p className="text-white/60">= seconds left × pts/sec</p>
                <div className="flex justify-between">
                  <span>1 min round</span>
                  <span className="text-blue-400">8.3 pts/sec</span>
                </div>
                <div className="flex justify-between">
                  <span>2 min round</span>
                  <span className="text-blue-400">4.2 pts/sec</span>
                </div>
                <div className="flex justify-between">
                  <span>3 min round</span>
                  <span className="text-blue-400">2.8 pts/sec</span>
                </div>
                <div className="flex justify-between">
                  <span>5 min round</span>
                  <span className="text-blue-400">1.7 pts/sec</span>
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 pt-2 text-xs">
              <div className="text-white/40">Example: 3 min round, solve in 3 guesses with 90s left</div>
              <div className="text-white/60">= 1000 + 600 + (90 × 2.8) = <span className="text-wordle-yellow font-bold">1852 pts</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
