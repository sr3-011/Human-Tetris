/**
 * useGameSocket.ts
 * Manages the WebSocket connection to the multiplayer backend.
 * Client-Authority + Backend-Relay:
 * - Client sends `GRID_SNAPSHOT` after local grid mutations.
 * - Backend relays snapshots as shadow boards.
 * - Backend sends `SABOTAGE` to the victim; victim mutates locally and sends a new snapshot.
 */
import { useEffect, useRef, useCallback, useState } from 'react';

import { Grid } from '../types';

export const WS_BASE = 'ws://localhost:8000/ws/game';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RemotePlayerState {
  player_id: string;
  grid: Grid;
  score: number;
  lines: number;
  level: number;
  ammo: number;
  is_game_over: boolean;
}

export interface MultiplayerState {
  connected: boolean;
  playerId: string;
  sessionId: string;
  players: Record<string, RemotePlayerState>;
  /** Transient flash: which column was just shot on which player's board */
  shotEffect: { targetId: string; col: number } | null;
  matchStartTime: number | null; // epoch seconds
  winnerPlayerId: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGameSocket(
  sessionId: string,
  playerId: string,
  onSabotage?: (row: number, col: number) => void,
  onGameOver?: (winnerPlayerId: string | null) => void,
): {
  mp: MultiplayerState;
  shoot: (targetRow: number, targetCol: number) => void;
  sendGridSnapshot: (args: {
    grid: Grid;
    score: number;
    lines: number;
    level: number;
    ammo: number;
    is_game_over: boolean;
  }) => void;
} {
  const wsRef = useRef<WebSocket | null>(null);
  const [mp, setMp] = useState<MultiplayerState>({
    connected: false,
    playerId,
    sessionId,
    players: {},
    shotEffect: null,
    matchStartTime: null,
    winnerPlayerId: null,
  });

  // ── Connect ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const url = `${WS_BASE}/${sessionId}/${playerId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setMp(prev => ({ ...prev, connected: true }));
    };

    ws.onclose = () => {
      setMp(prev => ({ ...prev, connected: false }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
    };
    // We intentionally only re-connect when session/player IDs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, playerId]);

  // ── Incoming message handler ──────────────────────────────────────────────

  const handleMessage = useCallback((msg: Record<string, unknown>) => {
    const type = msg.type as string;
    const payload = (msg.payload ?? {}) as Record<string, unknown>;

    switch (type) {
      case 'STATE_UPDATE': {
        const players = payload.players as Record<string, RemotePlayerState>;
        setMp(prev => ({ ...prev, players }));
        break;
      }
      case 'SHOT_EFFECT': {
        const targetId = payload.target_id as string;
        const col = payload.target_col as number;
        setMp(prev => ({ ...prev, shotEffect: { targetId, col } }));
        setTimeout(() => setMp(prev => ({ ...prev, shotEffect: null })), 600);
        break;
      }
      case 'SABOTAGE': {
        const targetPlayer = payload.targetPlayer as string;
        const row = payload.row as number;
        const col = payload.col as number;
        if (targetPlayer === playerId) {
          onSabotage?.(row, col);
        } else {
          setMp(prev => ({ ...prev, shotEffect: { targetId: targetPlayer, col } }));
          setTimeout(() => setMp(prev => ({ ...prev, shotEffect: null })), 600);
        }
        break;
      }
      case 'MATCH_START': {
        const startTime = payload.start_time as number;
        setMp(prev => ({ ...prev, matchStartTime: startTime, winnerPlayerId: null }));
        break;
      }
      case 'GAME_OVER': {
        const winnerPlayerId = payload.winner_player_id as string | null;
        setMp(prev => ({ ...prev, winnerPlayerId }));
        onGameOver?.(winnerPlayerId);
        break;
      }
      case 'PLAYER_LEFT': {
        setMp(prev => {
          const players = { ...prev.players };
          delete players[payload.player_id as string];
          return { ...prev, players };
        });
        break;
      }
      default:
        break;
    }
  }, [onGameOver, onSabotage, playerId]);

  // ── Shoot ─────────────────────────────────────────────────────────────────

  const shoot = useCallback((targetRow: number, targetCol: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'ACTION',
      payload: { action: 'SHOOT', target_row: targetRow, target_col: targetCol },
    }));
  }, []);

  const sendGridSnapshot = useCallback((args: {
    grid: Grid;
    score: number;
    lines: number;
    level: number;
    ammo: number;
    is_game_over: boolean;
  }) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'GRID_SNAPSHOT',
      payload: {
        grid: args.grid,
        score: args.score,
        lines: args.lines,
        level: args.level,
        ammo: args.ammo,
        is_game_over: args.is_game_over,
      },
    }));
  }, []);

  return { mp, shoot, sendGridSnapshot };
}
