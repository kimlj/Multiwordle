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
  const { gameState, showCountdown, toast } = useGameStore();
  useSocket(); // Initialize socket connection

  const renderScreen = () => {
    if (!gameState) {
      return <HomeScreen />;
    }

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
