import React from 'react';

export default function Toast({ message }) {
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="toast glass px-6 py-3 rounded-xl font-bold text-center">
        {message}
      </div>
    </div>
  );
}
