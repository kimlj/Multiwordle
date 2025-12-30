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
  guessResults = []
}) {
  const rows = [];

  for (let i = 0; i < maxGuesses; i++) {
    const guess = guesses[i];
    const result = results[i];
    const otherResult = guessResults[i];
    const isCurrentRow = i === guesses.length && isCurrentPlayer && !solved;

    const cells = [];
    for (let j = 0; j < 5; j++) {
      let letter = '';
      let status = '';
      let animate = false;

      if (guess && result) {
        letter = guess[j];
        status = result[j]?.status || '';
        animate = true;
      } else if (otherResult && otherResult[j]) {
        status = otherResult[j];
        animate = true;
      } else if (isCurrentRow && currentInput[j]) {
        letter = currentInput[j];
      }

      cells.push(
        <div
          key={j}
          className={`
            w-6 h-6 sm:w-7 sm:h-7
            flex items-center justify-center
            text-xs sm:text-sm font-bold uppercase
            border border-white/20
            ${letter && !status ? 'border-white/50' : ''}
            ${status === 'correct' ? 'status-correct' : ''}
            ${status === 'present' ? 'status-present' : ''}
            ${status === 'absent' ? 'status-absent' : ''}
            ${animate ? 'tile-flip' : ''}
          `}
          style={{
            animationDelay: animate ? `${j * 0.05}s` : '0s'
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
    <div className="flex flex-col items-center">
      {/* Player name */}
      <div className={`text-[10px] sm:text-xs font-bold mb-0.5 truncate max-w-full flex items-center gap-1 ${isCurrentPlayer ? 'text-wordle-green' : 'text-white/70'}`}>
        <span className="truncate max-w-[60px] sm:max-w-[80px]">{playerName}</span>
        {isCurrentPlayer && <span className="text-[8px]">(You)</span>}
        {solved && <span className="text-wordle-green">✓</span>}
        {score > 0 && <span className="text-wordle-green text-[8px]">+{score}</span>}
      </div>

      {/* Grid - no container */}
      <div className={`flex flex-col gap-0.5 ${isCurrentPlayer ? 'ring-1 ring-wordle-green/50 rounded p-0.5' : ''}`}>
        {rows}
      </div>
    </div>
  );
}
