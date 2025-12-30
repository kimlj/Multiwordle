import React from 'react';

export default function WordleGrid({
  guesses = [],
  results = [],
  currentInput = '',
  maxGuesses = 6,
  isCurrentPlayer = false,
  playerName = '',
  solved = false,
  score = 0,
  guessResults = [], // Array of status arrays for other players' colored grids
  compact = false // Compact mode for grid layout
}) {
  const rows = [];

  for (let i = 0; i < maxGuesses; i++) {
    const guess = guesses[i];
    const result = results[i];
    const otherResult = guessResults[i]; // Status array for other players
    const isCurrentRow = i === guesses.length && isCurrentPlayer && !solved;

    const cells = [];
    for (let j = 0; j < 5; j++) {
      let letter = '';
      let status = '';
      let animate = false;

      if (guess && result) {
        // Current player with full guess data
        letter = guess[j];
        status = result[j]?.status || '';
        animate = true;
      } else if (otherResult && otherResult[j]) {
        // Other player - show colored cell without letter
        status = otherResult[j];
        animate = true;
      } else if (isCurrentRow && currentInput[j]) {
        letter = currentInput[j];
      }

      // Cell sizes based on compact mode
      const cellSize = compact
        ? 'w-7 h-7 sm:w-8 sm:h-8 text-sm sm:text-base'
        : 'w-8 h-8 sm:w-10 sm:h-10 text-base sm:text-lg';

      cells.push(
        <div
          key={j}
          className={`
            ${cellSize}
            flex items-center justify-center
            font-bold uppercase
            border transition-all duration-200
            ${letter && !status ? 'border-white/50 tile-pop' : 'border-white/20'}
            ${status === 'correct' ? 'status-correct' : ''}
            ${status === 'present' ? 'status-present' : ''}
            ${status === 'absent' ? 'status-absent' : ''}
            ${animate ? 'tile-flip' : ''}
          `}
          style={{
            animationDelay: animate ? `${j * 0.1}s` : '0s',
            backgroundColor: !status ? 'transparent' : undefined
          }}
        >
          {letter}
        </div>
      );
    }

    rows.push(
      <div key={i} className="flex gap-0.5 justify-center">
        {cells}
      </div>
    );
  }

  return (
    <div className={`
      p-2 sm:p-3 rounded-xl transition-all
      ${isCurrentPlayer ? 'glass player-you ring-2 ring-wordle-green/50' : 'bg-white/5'}
      ${solved ? 'player-solved' : ''}
    `}>
      {/* Player header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs sm:text-sm font-bold truncate max-w-[80px] sm:max-w-[120px] ${isCurrentPlayer ? 'text-wordle-green' : 'text-white/80'}`}>
            {playerName}
            {isCurrentPlayer && ' (You)'}
          </span>
          {solved && (
            <span className="text-[10px] px-1.5 py-0.5 bg-wordle-green/30 text-wordle-green rounded-full whitespace-nowrap">
              Solved
            </span>
          )}
        </div>
        {score > 0 && (
          <span className="text-wordle-green font-bold text-xs sm:text-sm">+{score}</span>
        )}
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-0.5">
        {rows}
      </div>
    </div>
  );
}
