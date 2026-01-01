import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../lib/store';

export default function LobbyChat({ socket }) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { gameState, playerId } = useGameStore();
  const players = gameState ? Object.values(gameState.players) : [];

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (data) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        playerId: data.playerId,
        playerName: data.playerName,
        message: data.message,
        timestamp: data.timestamp
      }]);
      if (!isOpen) setUnreadCount(prev => prev + 1);
    };

    socket.on('chatMessage', handleChatMessage);
    return () => socket.off('chatMessage', handleChatMessage);
  }, [socket, isOpen]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;
    socket.emit('chatMessage', { message: message.trim() });
    setMessage('');
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {isOpen && (
        <div className="absolute bottom-14 right-0 w-64 bg-[#1a1a1b] border border-white/10 rounded-lg overflow-hidden animate-fade-in shadow-2xl">
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs text-white/50">{players.length} online</span>
            <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white/60">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="h-80 overflow-y-auto p-2 space-y-1.5">
            {messages.length === 0 ? (
              <div className="text-center text-white/20 text-xs py-12">No messages</div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={msg.playerId === playerId ? 'text-right' : ''}>
                  <div className={`inline-block max-w-[80%] px-2.5 py-1.5 rounded-lg text-xs ${
                    msg.playerId === playerId
                      ? 'bg-white/10 text-white/90'
                      : 'bg-white/5 text-white/70'
                  }`}>
                    {msg.playerId !== playerId && (
                      <span className="text-white/40 mr-1">{msg.playerName}:</span>
                    )}
                    {msg.message}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-2 border-t border-white/10">
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message..."
                className="flex-1 bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs outline-none focus:border-white/20 transition-colors placeholder:text-white/20"
                maxLength={200}
              />
              <button
                type="submit"
                disabled={!message.trim()}
                className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 rounded text-white/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-[3rem] h-[3rem] flex items-center justify-center transition-all relative group ${
          !isOpen ? 'animate-subtle-bounce' : ''
        }`}
      >
        <svg
          className="w-[2rem] h-[2rem] text-white/60 drop-shadow-[0_0_6px_rgba(255,255,255,0.3)] transition-all duration-300 group-hover:text-white/90 group-hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>

        {!isOpen && unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
