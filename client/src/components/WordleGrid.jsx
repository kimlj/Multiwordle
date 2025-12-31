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
  guessResults = [],
  large = false, // Large mode for solo view
  hideColors = false, // Hide colors for invisible ink effect
  revealedLetters = {} // { position: letter } - revealed letters to show in current row
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

      if (guess && result && !hideColors) {
        letter = guess[j];
        status = result[j]?.status || '';
        animate = true;
      } else if (guess && hideColors) {
        // Show dots instead of letters when hiding colors
        letter = '•';
      } else if (otherResult && otherResult[j] && !hideColors) {
        status = otherResult[j];
        animate = true;
      } else if (isCurrentRow) {
        // Check for revealed letter at this position first
        if (revealedLetters[j]) {
          letter = revealedLetters[j];
          status = 'correct'; // Show as green
        } else if (currentInput[j]) {
          letter = currentInput[j];
        }
      }

      // Cell size based on large prop
      const cellSize = large
        ? 'w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] text-3xl sm:text-4xl'
        : 'w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm';

      cells.push(
        <div
          key={j}
          className={`
            ${cellSize}
            flex items-center justify-center
            font-bold uppercase
            border-2 border-white/20
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
      <div key={i} className={`flex ${large ? 'gap-1.5' : 'gap-0.5'} justify-center`}>
        {cells}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Player name */}
      <div className={`${large ? 'text-sm sm:text-base mb-1' : 'text-[10px] sm:text-xs mb-0.5'} font-bold truncate max-w-full flex items-center gap-1 ${isCurrentPlayer ? 'text-wordle-green' : 'text-white/70'}`}>
        <span className={`truncate ${large ? 'max-w-[120px]' : 'max-w-[60px] sm:max-w-[80px]'}`}>{playerName}</span>
        {isCurrentPlayer && <span className={large ? 'text-xs' : 'text-[8px]'}>(You)</span>}
        {solved && <span className="text-wordle-green">✓</span>}
        {score > 0 && <span className={`text-wordle-green ${large ? 'text-xs' : 'text-[8px]'}`}>+{score}</span>}
      </div>

      {/* Grid - no container */}
      <div className={`flex flex-col ${large ? 'gap-1.5 p-1' : 'gap-0.5 p-0.5'} ${isCurrentPlayer ? 'ring-1 ring-wordle-green/50 rounded' : ''}`}>
        {rows}
      </div>
    </div>
  );
}
