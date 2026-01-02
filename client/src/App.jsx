import React, { useState, useEffect } from 'react';
import { useGameStore } from './lib/store';
import { useSocket } from './hooks/useSocket';
import { initAudio } from './lib/sounds';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';
import ResultsScreen from './components/ResultsScreen';
import CountdownOverlay from './components/CountdownOverlay';
import Toast from './components/Toast';
import AnalyticsPage from './components/AnalyticsPage';

// Check if we're on the /analytics route (checked before hooks)
function isAnalyticsPath() {
  const path = window.location.pathname;
  return path === '/analytics' || path === '/analytics/';
}

// Wrapper component that handles routing
function AppRouter() {
  const [isAnalyticsRoute, setIsAnalyticsRoute] = useState(isAnalyticsPath);

  useEffect(() => {
    const checkRoute = () => setIsAnalyticsRoute(isAnalyticsPath());
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  if (isAnalyticsRoute) {
    return <AnalyticsPage />;
  }

  return <GameApp />;
}

function GameApp() {
  const { gameState, showCountdown, toast, isReconnecting, connected, playerId } = useGameStore();
  useSocket(); // Initialize socket connection

  // Initialize audio on first user interaction (required for mobile)
  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      // Remove listeners after first interaction
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('click', handleInteraction);
    };

    document.addEventListener('touchstart', handleInteraction, { once: true });
    document.addEventListener('click', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('click', handleInteraction);
    };
  }, []);

  const renderScreen = () => {
    // Show loading screen while reconnecting to a previous session
    if (isReconnecting) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="glass rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4 animate-pulse">🔄</div>
            <h2 className="font-display text-xl font-bold mb-2">Reconnecting...</h2>
            <p className="text-white/60 text-sm">Getting back to your game</p>
          </div>
        </div>
      );
    }

    if (!gameState) {
      return <HomeScreen />;
    }

    // Check if current player has returned to lobby (while game is still ending)
    const currentPlayer = gameState.players?.[playerId];
    const hasReturnedToLobby = currentPlayer?.returnedToLobby;

    switch (gameState.state) {
      case 'lobby':
        return <LobbyScreen />;
      case 'countdown':
        return <LobbyScreen />;
      case 'playing':
        return <GameScreen />;
      case 'roundEnd':
        return <GameScreen showResults />;
      case 'gameEnd':
        // If player has already clicked "Back to Lobby", show them the lobby
        if (hasReturnedToLobby) {
          return <LobbyScreen waitingForOthers />;
        }
        return <ResultsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  // Show connection lost indicator if disconnected while in a game
  const showConnectionLost = !connected && gameState && !isReconnecting;

  return (
    <div className="min-h-screen relative">
      {renderScreen()}
      {showCountdown && <CountdownOverlay />}
      {toast && <Toast message={toast} />}

      {/* Connection Lost Overlay */}
      {showConnectionLost && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="glass rounded-2xl p-6 text-center max-w-sm animate-bounce-in">
            <div className="text-4xl mb-3 animate-pulse">📡</div>
            <h2 className="font-display text-xl font-bold mb-2 text-red-400">Connection Lost</h2>
            <p className="text-white/60 text-sm mb-4">Trying to reconnect...</p>
            <div className="flex justify-center gap-1">
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppRouter;
