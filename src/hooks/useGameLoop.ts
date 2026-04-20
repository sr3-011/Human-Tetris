import { useReducer, useEffect, useCallback, useRef } from 'react';
import { GameState, GameAction } from '../types';
import { gameReducer, createInitialState, getDropInterval } from '../engine/GameLoop';

// ─── useGameLoop ──────────────────────────────────────────────────────────────

export function useGameLoop(): {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
} {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);

  // ── Keyboard Controls ──────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (state.isGameOver) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          dispatch({ type: 'RESET' });
        }
        return;
      }

      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          dispatch({ type: 'MOVE_LEFT' });
          break;
        case 'ArrowRight':
          e.preventDefault();
          dispatch({ type: 'MOVE_RIGHT' });
          break;
        case 'ArrowDown':
          e.preventDefault();
          dispatch({ type: 'MOVE_DOWN' });
          break;
        case 'ArrowUp':
          e.preventDefault();
          dispatch({ type: 'ROTATE' });
          break;
        case 'Space':
          e.preventDefault();
          dispatch({ type: 'HARD_DROP' });
          break;
        case 'KeyP':
        case 'Escape':
          e.preventDefault();
          dispatch({ type: state.isPaused ? 'RESUME' : 'PAUSE' });
          break;
        default:
          break;
      }
    },
    [state.isGameOver, state.isPaused]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Gravity Tick ───────────────────────────────────────────────────────────

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (state.isGameOver || state.isPaused) return;

    const interval = getDropInterval(state.level);
    intervalRef.current = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.level, state.isGameOver, state.isPaused]);

  return { state, dispatch };
}
