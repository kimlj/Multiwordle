import React from 'react';
import { useGameStore } from '../lib/store';

export default function CountdownOverlay() {
  const { countdownValue } = useGameStore();

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
      </div>
    </div>
  );
}
