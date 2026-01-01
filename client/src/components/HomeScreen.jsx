import React, { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../lib/store';
import InfoModal from './InfoModal';

export default function HomeScreen() {
  const [view, setView] = useState('home'); // home, create, join
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomFromLink, setRoomFromLink] = useState(false); // Track if room code came from URL
  const [hostName, setHostName] = useState(''); // Host name for shared links
  const [settings, setSettings] = useState({
    rounds: 3,
    roundTimeSeconds: 180
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [infoTab, setInfoTab] = useState('howto');

  const { createRoom, joinRoom, socket } = useSocket();
  const { connected } = useGameStore();

  const openInfo = (tab = 'howto') => {
    setInfoTab(tab);
    setShowInfo(true);
  };

  // Check URL for room code on load - try multiple methods
  useEffect(() => {
    const fullUrl = window.location.href;
    console.log('Full URL:', fullUrl);
    console.log('Search:', window.location.search);
    console.log('Hash:', window.location.hash);

    let roomFromUrl = null;

    // Method 1: Standard query param
    const params = new URLSearchParams(window.location.search);
    roomFromUrl = params.get('room');
    console.log('Method 1 (URLSearchParams):', roomFromUrl);

    // Method 2: Regex on full URL (handles weird encoding)
    if (!roomFromUrl) {
      const urlMatch = fullUrl.match(/[?&]room=([A-Za-z0-9]+)/i);
      if (urlMatch) {
        roomFromUrl = urlMatch[1];
        console.log('Method 2 (regex on URL):', roomFromUrl);
      }
    }

    // Method 3: Check hash
    if (!roomFromUrl && window.location.hash) {
      const hashMatch = window.location.hash.match(/room=([A-Za-z0-9]+)/i);
      if (hashMatch) {
        roomFromUrl = hashMatch[1];
        console.log('Method 3 (hash):', roomFromUrl);
      }
    }

    // Method 4: Check pathname (in case it's /room/ABC123 format)
    if (!roomFromUrl) {
      const pathMatch = window.location.pathname.match(/\/room\/([A-Za-z0-9]+)/i);
      if (pathMatch) {
        roomFromUrl = pathMatch[1];
        console.log('Method 4 (pathname):', roomFromUrl);
      }
    }

    if (roomFromUrl) {
      const code = roomFromUrl.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
      console.log('Final room code:', code, 'length:', code.length);
      if (code.length === 6) {
        setRoomCode(code);
        setRoomFromLink(true);
        setView('join');
      }
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Fetch room info when we have a room code from link
  useEffect(() => {
    if (roomFromLink && roomCode && roomCode.length === 6 && socket && connected) {
      socket.emit('getRoomInfo', { roomCode }, (response) => {
        console.log('getRoomInfo response:', response);
        if (response.success) {
          setHostName(response.hostName);
          setError('');
        } else {
          setError(response.error || 'Room not found');
        }
      });
    }
  }, [roomFromLink, roomCode, socket, connected]);

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
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={![1, 3, 5, 7].includes(settings.rounds) ? settings.rounds : ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setSettings({ ...settings, rounds: Math.min(99, Math.max(1, val)) });
                    }}
                    placeholder="#"
                    className={`w-16 py-3 rounded-lg font-bold text-center transition-all ${
                      ![1, 3, 5, 7].includes(settings.rounds)
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
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-white/40 text-sm">Custom:</span>
                  <input
                    type="number"
                    min="10"
                    max="3600"
                    value={![60, 120, 180, 300].includes(settings.roundTimeSeconds) ? settings.roundTimeSeconds : ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) {
                        setSettings({ ...settings, roundTimeSeconds: val });
                      }
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value) || 60;
                      setSettings({ ...settings, roundTimeSeconds: Math.min(3600, Math.max(10, val)) });
                    }}
                    placeholder="seconds"
                    className={`w-24 py-2 rounded-lg font-bold text-center text-sm transition-all ${
                      ![60, 120, 180, 300].includes(settings.roundTimeSeconds)
                        ? 'bg-wordle-green text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  />
                  <span className="text-white/40 text-sm">sec</span>
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
            onClick={() => {
              setView('home');
              setRoomFromLink(false);
              setHostName('');
              setError('');
            }}
            className="mb-8 text-white/60 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="glass rounded-2xl p-8">
            <h2 className="font-display text-3xl font-bold mb-2">Join Game</h2>

            {/* Show host info if from shared link */}
            {roomFromLink && hostName && (
              <p className="text-white/60 mb-6">
                Joining <span className="text-wordle-green font-bold">{hostName}</span>'s game
              </p>
            )}

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
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Room Code</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => !roomFromLink && setRoomCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  className={`input-dark text-center text-2xl tracking-widest font-mono placeholder:text-base placeholder:tracking-normal ${roomFromLink ? 'bg-white/5 cursor-not-allowed' : ''}`}
                  maxLength={6}
                  readOnly={roomFromLink}
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      {/* Menu Button */}
      <button
        onClick={() => setShowInfo(true)}
        className="absolute top-4 right-4 w-10 h-10 flex flex-col items-center justify-center gap-1.5 group"
        title="Game Info"
      >
        <span className="w-5 h-0.5 bg-white/40 rounded-full transition-all group-hover:bg-white/70"></span>
        <span className="w-5 h-0.5 bg-white/40 rounded-full transition-all group-hover:bg-white/70"></span>
        <span className="w-5 h-0.5 bg-white/40 rounded-full transition-all group-hover:bg-white/70"></span>
      </button>

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

      {/* Quick Info Cards */}
      <div className="mt-10 flex flex-wrap justify-center gap-3 max-w-md">
        <button
          onClick={() => openInfo('howto')}
          className="glass rounded-xl px-4 py-3 hover:bg-white/10 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <span className="text-white/80 font-medium">How to Play</span>
          </div>
        </button>
        <button
          onClick={() => openInfo('items')}
          className="glass rounded-xl px-4 py-3 hover:bg-white/10 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <span className="text-white/80 font-medium">Items & Powers</span>
          </div>
        </button>
        <button
          onClick={() => openInfo('modes')}
          className="glass rounded-xl px-4 py-3 hover:bg-white/10 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">⚔️</span>
            <span className="text-white/80 font-medium">Game Modes</span>
          </div>
        </button>
      </div>

      {/* Info Modal */}
      <InfoModal
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        initialTab={infoTab}
      />
    </div>
  );
}
