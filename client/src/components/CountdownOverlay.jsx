import React from 'react';
import { useGameStore } from '../lib/store';

export default function CountdownOverlay() {
  const { countdownValue, countdownItemRound } = useGameStore();

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="text-center">
        <div
          className="countdown-number text-wordle-green"
          key={countdownValue}
        >
          {countdownValue > 0 ? countdownValue : 'GO!'}
        </div>
        <p className="text-white/60 text-xl mt-4">Get Ready!</p>

        {/* Item Round Preview (compact) */}
        {countdownItemRound && (
          <div className="mt-6 animate-bounce-in">
            <div className="bg-purple-500/20 border border-purple-500 rounded-lg px-4 py-2 max-w-xs mx-auto">
              <div className="flex items-center justify-center gap-2 text-sm">
                <span>{countdownItemRound.challenge?.emoji}</span>
                <span className="text-purple-300 font-bold">ITEM ROUND</span>
                <span className="text-white/40">·</span>
                <span className="text-white">{countdownItemRound.challenge?.name}</span>
              </div>
              {countdownItemRound.reward && (
                <div className="flex items-center justify-center gap-1 mt-1 text-xs text-white/70">
                  <span>{countdownItemRound.reward.emoji}</span>
                  <span>{countdownItemRound.reward.name}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
