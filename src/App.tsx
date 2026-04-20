/**
 * App.tsx (Phase 2)
 *
 * Adds a lobby screen. If the user fills in session/player IDs,
 * the game runs in multiplayer mode. The original single-player
 * path is preserved (just skip the lobby by clicking "Solo Play").
 */
import React, { useState } from 'react';
import TetrisGame from './components/game/TetrisGame';
import SessionSetup from './components/game/SessionSetup';
import './styles.css';

type Mode = 'lobby' | 'solo' | 'multi';

interface MultiConfig {
  sessionId: string;
  playerId: string;
}

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('lobby');
  const [config, setConfig] = useState<MultiConfig | null>(null);

  if (mode === 'lobby') {
    return (
      <SessionSetup
        onJoin={(sessionId, playerId) => {
          setConfig({ sessionId, playerId });
          setMode('multi');
        }}
        onSolo={() => setMode('solo')}
      />
    );
  }

  if (mode === 'solo') {
    return <TetrisGame />;
  }

  // Multiplayer
  return (
    <TetrisGame
      sessionId={config?.sessionId}
      playerId={config?.playerId}
    />
  );
};

export default App;
