"""
game_manager.py — In-memory session registry + event coordination.
Backend coordinates multiplayer + game rules (attacks/sabotage) but does NOT own grids.
"""
from __future__ import annotations
import time
import random
import asyncio
from typing import Optional, Any
from fastapi import WebSocket

from models.game_state import (
    Session,
    PlayerState,
    BOARD_WIDTH,
    BOARD_HEIGHT,
    MAX_AMMO,
)


# ─── GameManager ─────────────────────────────────────────────────────────────

class GameManager:
    def __init__(self):
        # session_id → Session
        self._sessions: dict[str, Session] = {}
        # (session_id, player_id) → WebSocket
        self._connections: dict[tuple[str, str], WebSocket] = {}

    # ── Session Management ────────────────────────────────────────────────────

    def get_or_create_session(self, session_id: str) -> Session:
        if session_id not in self._sessions:
            self._sessions[session_id] = Session(session_id=session_id)
        return self._sessions[session_id]

    def join_session(self, session_id: str, player_id: str, ws: WebSocket) -> bool:
        """Returns False if session is full and player is not already in it."""
        session = self.get_or_create_session(session_id)
        if player_id not in session.players:
            if session.is_full():
                return False
            session.players[player_id] = PlayerState(player_id=player_id)
        self._connections[(session_id, player_id)] = ws
        return True

    def leave_session(self, session_id: str, player_id: str):
        self._connections.pop((session_id, player_id), None)
        session = self._sessions.get(session_id)
        if session:
            session.players.pop(player_id, None)
            if not session.players:
                del self._sessions[session_id]

    def get_session(self, session_id: str) -> Optional[Session]:
        return self._sessions.get(session_id)

    # ── Match Timer ────────────────────────────────────────────────────────────

    async def maybe_start_match(self, session_id: str):
        session = self.get_session(session_id)
        if not session:
            return
        if session.match_start_time is not None or session.match_ended:
            return
        if not session.is_full():
            return

        session.match_start_time = time.time()

        # Broadcast start_time to both clients
        await self.broadcast(
            session_id,
            {
                "type": "MATCH_START",
                "payload": {
                    "start_time": session.match_start_time,
                    "duration_seconds": session.match_duration_seconds,
                },
            },
        )

        # Schedule game over
        asyncio.create_task(self._end_match_after_delay(session_id))

    async def _end_match_after_delay(self, session_id: str):
        session = self.get_session(session_id)
        if not session:
            return
        duration = session.match_duration_seconds
        await asyncio.sleep(duration)

        session = self.get_session(session_id)
        if not session or session.match_ended:
            return

        session.match_ended = True
        # Determine winner by highest score
        scores = {pid: p.score for pid, p in session.players.items()}
        if scores:
            winner_id = max(scores, key=scores.get)
            # If tied, no single winner
            max_score = scores[winner_id]
            tied = [pid for pid, s in scores.items() if s == max_score]
            winner_id_out: Optional[str] = winner_id if len(tied) == 1 else None
        else:
            winner_id_out = None
            scores = {}

        await self.broadcast(
            session_id,
            {
                "type": "GAME_OVER",
                "payload": {
                    "winner_player_id": winner_id_out,
                    "scores": scores,
                },
            },
        )

    # ── Events / Rules ─────────────────────────────────────────────────────────

    def build_sabotage_event(self, session_id: str, shooter_id: str, row: int, col: int) -> Optional[dict]:
        session = self.get_session(session_id)
        if not session:
            return None
        target_id = session.get_opponent_id(shooter_id)
        if not target_id:
            return None
        return {
            "type": "SABOTAGE",
            "payload": {
                "shooter_player_id": shooter_id,
                "targetPlayer": target_id,
                "row": int(row),
                "col": int(col),
            },
        }

    def update_player_snapshot(self, session_id: str, player_id: str, payload: dict[str, Any]):
        session = self.get_session(session_id)
        if not session or player_id not in session.players:
            return
        if session.match_ended:
            return
        player = session.players[player_id]

        grid = payload.get("grid")
        if isinstance(grid, list):
            # Relay only; don't mutate.
            player.grid = grid

        if "score" in payload:
            player.score = int(payload["score"])
        if "lines" in payload:
            player.lines = int(payload["lines"])
        if "level" in payload:
            player.level = int(payload["level"])
        if "ammo" in payload:
            player.ammo = int(payload["ammo"])
        if "is_game_over" in payload:
            player.is_game_over = bool(payload["is_game_over"])

    def _ammo_for_lines(self, lines: int) -> int:
        if lines <= 0:
            return 0
        if lines == 1:
            return 1
        if lines == 2:
            return 2
        if lines == 3:
            return 3
        return 4  # Tetris!

    # ── Shooting Logic ────────────────────────────────────────────────────────

    def process_shot(
        self,
        session_id: str,
        shooter_id: str,
        target_row: Optional[int] = None,
        target_col: Optional[int] = None,
    ) -> tuple[bool, str]:
        """
        Applies a shot from shooter to their opponent.
        Returns (success, reason).
        """
        session = self.get_session(session_id)
        if not session:
            return False, "session_not_found"
        if session.match_ended:
            return False, "match_over"

        shooter = session.players.get(shooter_id)
        if not shooter:
            return False, "shooter_not_found"

        # Cooldown validation only.
        # Grid is client-authoritative; ammo is UI-side and not guaranteed to be snapshot-updated.
        if shooter.is_game_over:
            return False, "shooter_game_over"
        if (time.time() - shooter.last_shot_time) < 1.0:
            return False, "cooldown"

        opponent_id = session.get_opponent_id(shooter_id)
        if not opponent_id:
            return False, "no_opponent"

        opponent = session.players[opponent_id]
        if opponent.is_game_over:
            return False, "opponent_game_over"

        if target_col is None or not (0 <= int(target_col) < BOARD_WIDTH):
            return False, "invalid_target"
        if target_row is None or not (0 <= int(target_row) < BOARD_HEIGHT):
            return False, "invalid_target"

        # Backend coordinates rules/cooldowns only; grid mutation happens on clients via events.
        shooter.last_shot_time = time.time()

        return True, "hit"

    # ── Broadcasting ──────────────────────────────────────────────────────────

    async def broadcast(self, session_id: str, message: dict):
        """Send message to all connected players in session."""
        session = self.get_session(session_id)
        if not session:
            return
        for pid in list(session.players.keys()):
            ws = self._connections.get((session_id, pid))
            if ws:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass  # Client disconnected; handled by disconnect cleanup

    async def send_to(self, session_id: str, player_id: str, message: dict):
        """Send message to a specific player."""
        ws = self._connections.get((session_id, player_id))
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                pass

    def build_state_update(self, session_id: str) -> dict:
        """Build the STATE_UPDATE payload for broadcasting."""
        session = self.get_session(session_id)
        if not session:
            return {}
        return {
            "type": "STATE_UPDATE",
            "payload": {
                "players": {
                    pid: p.to_dict()
                    for pid, p in session.players.items()
                }
            },
        }


# ─── Singleton ────────────────────────────────────────────────────────────────

game_manager = GameManager()
