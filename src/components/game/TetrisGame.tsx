/**
 * TetrisGame.tsx (Phase 2 — Multiplayer)
 *
 * Changes from Phase 1:
 *  - Accepts optional sessionId/playerId props
 *  - Adds useAmmo hook for ammo tracking
 *  - Adds useGameSocket hook for WS connection
 *  - Adds F key → SHOOT action
 *  - Renders opponent board panel + ammo counter
 *  - All original game logic untouched
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useGameLoop } from '../../hooks/useGameLoop';
import { useAmmo } from '../../hooks/useAmmo';
import { useGameSocket } from '../../hooks/useGameSocket';
import { renderFrame, renderNextPiece, CANVAS_WIDTH, CANVAS_HEIGHT } from '../../engine/TetrisBoard';
import { CELL_SIZE, BOARD_WIDTH } from '../../types';
import OpponentBoard from './OpponentBoard';

const NEXT_CANVAS_SIZE = 4 * CELL_SIZE;
const MAX_AMMO = 10;
const SHOOT_COOLDOWN_MS = 1000;

// ─── TetrisGame Component ─────────────────────────────────────────────────────

interface TetrisGameProps {
  sessionId?: string;
  playerId?: string;
}

const TetrisGame: React.FC<TetrisGameProps> = ({ sessionId, playerId }) => {
  const { state, dispatch } = useGameLoop();
  const { ammo, consumeAmmo } = useAmmo(state.lines);
  const boardRef = useRef<HTMLCanvasElement>(null);
  const nextRef = useRef<HTMLCanvasElement>(null);

  // Multiplayer (only active when sessionId/playerId are provided)
  const isMultiplayer = !!(sessionId && playerId);
  const { mp, shoot, sendGridSnapshot } = useGameSocket(
    sessionId ?? '',
    playerId ?? '',
    (row, col) => dispatch({ type: 'APPLY_SHOT', row, col }),
    () => dispatch({ type: 'SET_GAME_OVER' }),
  );

  // Shoot cooldown gate (additional client-side guard)
  const lastShotRef = useRef<number>(0);

  // ── Render Board ──────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = boardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderFrame(ctx, state.grid, state.currentPiece, state.isGameOver, state.isPaused);
  }, [state.grid, state.currentPiece, state.isGameOver, state.isPaused]);

  // ── Render Next Piece ─────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = nextRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderNextPiece(ctx, state.nextPiece);
  }, [state.nextPiece]);

  // ── Shoot handler ─────────────────────────────────────────────────────────

  const handleShoot = useCallback((targetRow?: number, targetCol?: number) => {
    if (!isMultiplayer) return;
    const now = Date.now();
    if (now - lastShotRef.current < SHOOT_COOLDOWN_MS) return;
    if (!consumeAmmo()) return;

    lastShotRef.current = now;
    const col = typeof targetCol === 'number' ? targetCol : (state.currentPiece?.position.x ?? 4);
    const row = typeof targetRow === 'number' ? targetRow : 0;
    shoot(row, col);
  }, [isMultiplayer, consumeAmmo, shoot, state.currentPiece]);

  // ── Shadow relay: send full grid snapshots to backend ──────────────────
  const lastSnapshotSentAtRef = useRef<number>(0);
  const prevIsGameOverRef = useRef<boolean>(state.isGameOver);
  useEffect(() => {
    if (!isMultiplayer) return;
    const now = Date.now();
    const forced = state.isGameOver !== prevIsGameOverRef.current;
    if (!forced && now - lastSnapshotSentAtRef.current < 50) return; // throttle to avoid bursts
    lastSnapshotSentAtRef.current = now;
    prevIsGameOverRef.current = state.isGameOver;

    sendGridSnapshot({
      grid: state.grid,
      score: state.score,
      lines: state.lines,
      level: state.level,
      ammo,
      is_game_over: state.isGameOver,
    });
  }, [
    isMultiplayer,
    state.grid,
    state.score,
    state.lines,
    state.level,
    state.isGameOver,
    ammo,
    sendGridSnapshot,
  ]);

  // ── Keyboard Controls (add F key, keep everything else unchanged) ─────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyF') {
        e.preventDefault();
        handleShoot();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleShoot]);

  // ── UI Handlers ───────────────────────────────────────────────────────────

  const handleReset = useCallback(() => dispatch({ type: 'RESET' }), [dispatch]);
  const handlePauseToggle = useCallback(
    () => dispatch({ type: state.isPaused ? 'RESUME' : 'PAUSE' }),
    [dispatch, state.isPaused]
  );

  // ── Touch Controls ────────────────────────────────────────────────────────

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < 10 && absDy < 10) {
      dispatch({ type: 'ROTATE' });
    } else if (absDx > absDy) {
      dispatch({ type: dx < 0 ? 'MOVE_LEFT' : 'MOVE_RIGHT' });
    } else {
      if (dy > 0) dispatch({ type: dy > 80 ? 'HARD_DROP' : 'MOVE_DOWN' });
    }
    touchStartRef.current = null;
  }, [dispatch]);

  // ── Opponent data ─────────────────────────────────────────────────────────

  const opponentId = Object.keys(mp.players).find(id => id !== playerId);
  const opponent = opponentId ? mp.players[opponentId] : null;
  const flashCol =
    mp.shotEffect && mp.shotEffect.targetId === opponentId
      ? mp.shotEffect.col
      : null;

  const { score, lines, level, isGameOver, isPaused } = state;

  return (
    <div className="tetris-root">
      {/* ── Header ── */}
      <header className="tetris-header">
        <span className="logo-text">TETRIS</span>
        <span className="logo-sub">{isMultiplayer ? 'MULTIPLAYER · SHOOTER' : 'NEON EDITION'}</span>
        {isMultiplayer && (
          <span className={`conn-badge ${mp.connected ? 'conn-ok' : 'conn-off'}`}>
            {mp.connected ? '● ONLINE' : '○ OFFLINE'}
          </span>
        )}
      </header>

      {/* ── Main layout ── */}
      <div className="tetris-layout">

        {/* Left panel — stats */}
        <aside className="panel panel-left">
          <StatBlock label="SCORE" value={score.toLocaleString()} accent="cyan" />
          <StatBlock label="LINES" value={lines.toString()} accent="green" />
          <StatBlock label="LEVEL" value={level.toString()} accent="purple" />

          {/* Ammo counter — only in multiplayer */}
          {isMultiplayer && (
            <div className="ammo-block">
              <div className="stat-label">AMMO</div>
              <div className="ammo-pips">
                {Array.from({ length: MAX_AMMO }).map((_, i) => (
                  <div key={i} className={`ammo-pip ${i < ammo ? 'ammo-pip--full' : ''}`} />
                ))}
              </div>
              <button
                className={`btn btn-shoot ${ammo <= 0 ? 'btn-shoot--empty' : ''}`}
                onClick={() => handleShoot()}
                disabled={ammo <= 0 || !isMultiplayer}
              >
                🔫 SHOOT [F]
              </button>
            </div>
          )}

          <div className="controls-hint">
            <p className="hint-title">CONTROLS</p>
            <div className="hint-row"><kbd>←→</kbd><span>Move</span></div>
            <div className="hint-row"><kbd>↑</kbd><span>Rotate</span></div>
            <div className="hint-row"><kbd>↓</kbd><span>Soft drop</span></div>
            <div className="hint-row"><kbd>SPC</kbd><span>Hard drop</span></div>
            {isMultiplayer && <div className="hint-row"><kbd>F</kbd><span>Shoot!</span></div>}
            <div className="hint-row"><kbd>P</kbd><span>Pause</span></div>
          </div>
        </aside>

        {/* Center — Board */}
        <main
          className="board-wrapper"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="board-frame">
            <canvas
              ref={boardRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="board-canvas"
            />
          </div>
        </main>

        {/* Right panel */}
        <aside className="panel panel-right">
          <div className="next-label">NEXT</div>
          <div className="next-frame">
            <canvas
              ref={nextRef}
              width={NEXT_CANVAS_SIZE}
              height={NEXT_CANVAS_SIZE}
              className="next-canvas"
            />
          </div>

          {/* Opponent board — only in multiplayer */}
          {isMultiplayer && (
            <div className="opponent-panel">
              <div className="opponent-label">
                {opponentId ? `⚔ ${opponentId}` : '⏳ WAITING...'}
              </div>
              {opponent ? (
                <>
                  <div className="opponent-frame">
                    <OpponentBoard
                      grid={opponent.grid}
                      isGameOver={opponent.is_game_over}
                      flashCol={flashCol ?? null}
                      onShoot={(row, col) => handleShoot(row, col)}
                    />
                  </div>
                  <div className="opponent-stats">
                    <span>LV {opponent.level}</span>
                    <span>{opponent.score.toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <div className="opponent-frame opponent-frame--empty">
                  <span>No opponent yet</span>
                </div>
              )}
            </div>
          )}

          <div className="action-buttons">
            <button
              className={`btn ${isPaused ? 'btn-resume' : 'btn-pause'}`}
              onClick={handlePauseToggle}
              disabled={isGameOver}
            >
              {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
            </button>
            <button className="btn btn-reset" onClick={handleReset}>
              ↺ RESTART
            </button>
          </div>

          <div className="speed-bar-wrap">
            <div className="speed-label">SPEED</div>
            <div className="speed-bar">
              <div
                className="speed-fill"
                style={{ height: `${Math.min((level / 10) * 100, 100)}%` }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

// ─── StatBlock ────────────────────────────────────────────────────────────────

interface StatBlockProps {
  label: string;
  value: string;
  accent: 'cyan' | 'green' | 'purple';
}

const StatBlock: React.FC<StatBlockProps> = ({ label, value, accent }) => (
  <div className={`stat-block stat-${accent}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
  </div>
);

export default TetrisGame;
