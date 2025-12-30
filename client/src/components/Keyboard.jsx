import React from 'react';
import { useGameStore } from '../lib/store';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
];

export default function Keyboard({ onKey, onEnter, onBackspace, disabled = false }) {
  const { keyboardStatus } = useGameStore();

  const handleClick = (key) => {
    if (disabled) return;
    
    if (key === 'ENTER') {
      onEnter?.();
    } else if (key === '⌫') {
      onBackspace?.();
    } else {
      onKey?.(key);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-lg mx-auto">
      {KEYBOARD_ROWS.map((row, i) => (
        <div key={i} className="flex gap-1.5 justify-center">
          {row.map((key) => {
            const status = keyboardStatus[key];
            const isWide = key === 'ENTER' || key === '⌫';
            
            return (
              <button
                key={key}
                onClick={() => handleClick(key)}
                disabled={disabled}
                className={`
                  key
                  ${isWide ? 'min-w-[65px] text-xs' : 'min-w-[35px] md:min-w-[43px]'}
                  ${status === 'correct' ? 'correct' : ''}
                  ${status === 'present' ? 'present' : ''}
                  ${status === 'absent' ? 'absent' : ''}
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
