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
  guessCount = 0,
  lastGuessColors = null,
  showingOther = false
}) {
  const rows = [];
  
  for (let i = 0; i < maxGuesses; i++) {
    const guess = guesses[i];
    const result = results[i];
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
      } else if (isCurrentRow && currentInput[j]) {
        letter = currentInput[j];
      }
      
      cells.push(
        <div
          key={j}
          className={`
            w-12 h-12 md:w-14 md:h-14 
            flex items-center justify-center 
            text-xl md:text-2xl font-bold uppercase
            border-2 transition-all duration-200
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
      <div key={i} className="flex gap-1.5 justify-center">
        {cells}
      </div>
    );
  }

  return (
    <div className={`
      p-4 rounded-2xl transition-all
      ${isCurrentPlayer ? 'glass player-you' : 'bg-white/5'}
      ${solved ? 'player-solved' : ''}
    `}>
      {/* Player header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`font-bold ${isCurrentPlayer ? 'text-wordle-green' : 'text-white/80'}`}>
            {playerName}
            {isCurrentPlayer && ' (You)'}
          </span>
          {solved && (
            <span className="text-xs px-2 py-0.5 bg-wordle-green/30 text-wordle-green rounded-full">
              ✓ Solved
            </span>
          )}
        </div>
        {score > 0 && (
          <span className="text-wordle-green font-bold">+{score}</span>
        )}
      </div>
      
      {/* Grid */}
      <div className="flex flex-col gap-1.5">
        {rows}
      </div>
      
      {/* Other player's progress indicator */}
      {showingOther && !isCurrentPlayer && guessCount > 0 && !solved && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-white/60">
          <span>{guessCount} guess{guessCount !== 1 ? 'es' : ''}</span>
          {lastGuessColors && (
            <span className="flex gap-1">
              <span className="text-wordle-green">{lastGuessColors.green}🟩</span>
              <span className="text-wordle-yellow">{lastGuessColors.yellow}🟨</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
