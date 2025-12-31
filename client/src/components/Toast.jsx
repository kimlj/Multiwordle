import React from 'react';

export default function Toast({ message }) {
  return (
    <div className="fixed top-3 left-1/2 transform -translate-x-1/2 z-50">
      <div className="toast px-3 py-1.5 rounded-lg text-xs text-white/80 bg-black/60 backdrop-blur-sm">
        {message}
      </div>
    </div>
  );
}
