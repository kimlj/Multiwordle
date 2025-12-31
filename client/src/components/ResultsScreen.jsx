import React, { useEffect, useState } from 'react';
import { useGameStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';

export default function ResultsScreen() {
  const { gameState, playerId, isHost } = useGameStore();
  const { playAgain, leaveRoom } = useSocket();
  const [showConfetti, setShowConfetti] = useState(true);

  if (!gameState) return null;

  const isBattleRoyale = gameState.settings?.gameMode === 'battleRoyale';

  // Sort players - Battle Royale by placement, Classic by score
  const players = Object.values(gameState.players)
    .sort((a, b) => {
      if (isBattleRoyale) {
        // Winner (placement 1) first, then by elimination order (earlier elimination = worse)
        if (a.placement === 1) return -1;
        if (b.placement === 1) return 1;
        if (a.placement && b.placement) return a.placement - b.placement;
        if (a.placement) return -1;
        if (b.placement) return 1;
      }
      return b.totalScore - a.totalScore;
    });

  const winner = players[0];
  const isWinner = winner?.id === playerId;

  return (
    <div className="min-h-screen flex items-center justify-center p-2 sm:p-4 relative overflow-hidden">
      {/* Confetti effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm"
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

      <div className="max-w-md w-full">
        <div className="glass rounded-2xl p-4 sm:p-6 animate-bounce-in">
          {/* Winner announcement - compact */}
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">{isBattleRoyale ? '👑' : '🏆'}</div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">
              {isBattleRoyale
                ? (isWinner ? 'Victory Royale!' : `${winner?.name} is Champion!`)
                : (isWinner ? 'You Win!' : `${winner?.name} Wins!`)}
            </h1>
            <p className="text-white/60 text-sm">
              {isBattleRoyale ? (
                <>Last one standing after <span className="text-wordle-yellow font-bold">{gameState.currentRound}</span> rounds</>
              ) : (
                <><span className="text-wordle-green font-bold text-lg">{winner?.totalScore}</span> pts</>
              )}
            </p>
          </div>

          {/* Final Leaderboard - compact */}
          <div className="space-y-1.5 mb-4 max-h-[45vh] overflow-y-auto">
            {players.map((player, idx) => (
              <div
                key={player.id}
                className={`leaderboard-item flex items-center justify-between py-2 px-3 rounded-lg ${
                  player.id === playerId ? 'player-you' : 'bg-white/5'
                } ${idx === 0 ? 'border border-wordle-green' : ''}`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="flex items-center gap-2">
                  <div className={`
                    w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs
                    ${idx === 0 ? 'bg-yellow-400 text-black' :
                      idx === 1 ? 'bg-gray-300 text-black' :
                      idx === 2 ? 'bg-amber-600 text-white' :
                      'bg-white/10 text-white/60'}
                  `}>
                    {isBattleRoyale ? (idx === 0 ? '👑' : `#${player.placement || idx + 1}`) : idx + 1}
                  </div>
                  <span className="font-medium text-sm truncate max-w-[120px]">
                    {player.name}
                    {player.id === playerId && <span className="text-wordle-green"> (You)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isBattleRoyale && player.eliminatedRound && (
                    <span className="text-xs text-white/40">
                      R{player.eliminatedRound}
                    </span>
                  )}
                  <div className={`font-bold text-sm ${idx === 0 ? 'text-wordle-green' : ''}`}>
                    {player.totalScore}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats - inline compact */}
          <div className="flex justify-center gap-6 mb-4 text-center text-xs text-white/50">
            <div>
              <span className="font-bold text-white text-sm">{gameState.totalRounds}</span> rounds
            </div>
            <div>
              <span className="font-bold text-white text-sm">{players.length}</span> players
            </div>
            <div>
              <span className="font-bold text-white text-sm">{players.reduce((sum, p) => sum + p.totalScore, 0)}</span> total pts
            </div>
          </div>

          {/* Actions - compact */}
          <div className="flex justify-center gap-3">
            <button
              onClick={playAgain}
              className="btn-primary px-6 py-2 text-sm"
            >
              Back to Lobby
            </button>
            <button
              onClick={leaveRoom}
              className="btn-secondary px-6 py-2 text-sm"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
