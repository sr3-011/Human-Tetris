/**
 * SessionSetup.tsx
 */
import React, { useState } from 'react';

interface SessionSetupProps {
  onJoin: (sessionId: string, playerId: string) => void;
  onSolo: () => void;
}

const SessionSetup: React.FC<SessionSetupProps> = ({ onJoin, onSolo }) => {
  const [sessionId, setSessionId] = useState('room1');
  const [playerId, setPlayerId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = playerId.trim() || `player_${Math.random().toString(36).slice(2, 6)}`;
    onJoin(sessionId.trim() || 'room1', pid);
  };

  return (
    <div className="lobby-root">
      <div className="lobby-card">
        <h1 className="lobby-title">TETRIS<span className="lobby-title-accent"> MP</span></h1>
        <p className="lobby-subtitle">NEON SHOOTER EDITION</p>

        <form onSubmit={handleSubmit} className="lobby-form">
          <div className="lobby-field">
            <label className="lobby-label">SESSION ID</label>
            <input
              className="lobby-input"
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
              placeholder="room1"
              maxLength={24}
            />
            <span className="lobby-hint">Share this with your opponent</span>
          </div>

          <div className="lobby-field">
            <label className="lobby-label">PLAYER NAME</label>
            <input
              className="lobby-input"
              value={playerId}
              onChange={e => setPlayerId(e.target.value)}
              placeholder="e.g. player1"
              maxLength={20}
            />
            <span className="lobby-hint">Leave blank for a random name</span>
          </div>

          <button type="submit" className="lobby-btn">▶ JOIN MULTIPLAYER</button>
        </form>

        <button type="button" className="lobby-btn-solo" onClick={onSolo}>
          SOLO PLAY →
        </button>

        <div className="lobby-rules">
          <div className="lobby-rules-title">HOW SHOOTER MODE WORKS</div>
          <div className="lobby-rule-row">🎮 Both players share the same Session ID</div>
          <div className="lobby-rule-row">🧱 Clear lines → earn ammo bullets</div>
          <div className="lobby-rule-row">🔫 Press <kbd>F</kbd> to shoot opponent board</div>
          <div className="lobby-rule-row">💥 Shots remove blocks from a column (pit effect)</div>
        </div>
      </div>
    </div>
  );
};

export default SessionSetup;
