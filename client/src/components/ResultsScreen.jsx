import React, { useEffect, useState } from 'react';
import { useGameStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';

export default function ResultsScreen() {
  const { gameState, playerId, isHost } = useGameStore();
  const { playAgain, leaveRoom } = useSocket();
  const [showConfetti, setShowConfetti] = useState(true);

  if (!gameState) return null;

  const players = Object.values(gameState.players)
    .sort((a, b) => b.totalScore - a.totalScore);
  
  const winner = players[0];
  const isWinner = winner?.id === playerId;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Confetti effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-sm"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                backgroundColor: ['#6aaa64', '#c9b458', '#ffffff', '#ef4444', '#3b82f6'][Math.floor(Math.random() * 5)],
                animation: `fall ${2 + Math.random() * 2}s linear ${Math.random() * 2}s infinite`,
                transform: `rotate(${Math.random() * 360}deg)`
              }}
            />
          ))}
        </div>
      )}
      
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>

      <div className="max-w-2xl w-full">
        <div className="glass rounded-3xl p-8 animate-bounce-in">
          {/* Winner announcement */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-2">
              {isWinner ? 'You Win!' : `${winner?.name} Wins!`}
            </h1>
            <p className="text-white/60">
              with <span className="text-wordle-green font-bold text-2xl">{winner?.totalScore}</span> points
            </p>
          </div>

          {/* Final Leaderboard */}
          <div className="space-y-3 mb-8">
            {players.map((player, idx) => (
              <div
                key={player.id}
                className={`leaderboard-item flex items-center justify-between p-4 rounded-xl ${
                  player.id === playerId ? 'player-you' : 'bg-white/5'
                } ${idx === 0 ? 'border-2 border-wordle-green glow-green' : ''}`}
                style={{ animationDelay: `${idx * 0.15}s` }}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                    ${idx === 0 ? 'bg-yellow-400 text-black' : 
                      idx === 1 ? 'bg-gray-300 text-black' : 
                      idx === 2 ? 'bg-amber-600 text-white' : 
                      'bg-white/10 text-white/60'}
                  `}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-bold text-lg">
                      {player.name}
                      {player.id === playerId && <span className="text-wordle-green"> (You)</span>}
                    </div>
                    <div className="text-sm text-white/40">
                      {idx === 0 && '👑 Champion'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-2xl ${idx === 0 ? 'text-wordle-green' : ''}`}>
                    {player.totalScore}
                  </div>
                  <div className="text-xs text-white/40">points</div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <div className="text-3xl mb-1">🎯</div>
              <div className="text-2xl font-bold">{gameState.totalRounds}</div>
              <div className="text-xs text-white/40">Rounds Played</div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <div className="text-3xl mb-1">👥</div>
              <div className="text-2xl font-bold">{players.length}</div>
              <div className="text-xs text-white/40">Players</div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <div className="text-3xl mb-1">⚡</div>
              <div className="text-2xl font-bold">
                {players.reduce((sum, p) => sum + p.totalScore, 0)}
              </div>
              <div className="text-xs text-white/40">Total Points</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-4">
            <button
              onClick={playAgain}
              className="btn-primary px-8"
            >
              Back to Lobby
            </button>
            <button
              onClick={leaveRoom}
              className="btn-secondary px-8"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
