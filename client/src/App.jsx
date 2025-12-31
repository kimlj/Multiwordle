import React from 'react';
import { useGameStore } from './lib/store';
import { useSocket } from './hooks/useSocket';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';
import ResultsScreen from './components/ResultsScreen';
import CountdownOverlay from './components/CountdownOverlay';
import Toast from './components/Toast';

function App() {
  const { gameState, showCountdown, toast, isReconnecting, connected, playerId } = useGameStore();
  useSocket(); // Initialize socket connection

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

  return (
    <div className="min-h-screen relative">
      {renderScreen()}
      {showCountdown && <CountdownOverlay />}
      {toast && <Toast message={toast} />}
    </div>
  );
}

export default App;
