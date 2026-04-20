"""
game_state.py — Pure data models for multiplayer session state.
No logic here, just typed containers.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Any
import time

BOARD_WIDTH = 10
BOARD_HEIGHT = 20
MAX_AMMO = 10
SHOT_COOLDOWN_SECONDS = 1.0

Grid = list[list[Optional[Any]]]


def empty_grid() -> Grid:
    return [[None] * BOARD_WIDTH for _ in range(BOARD_HEIGHT)]


@dataclass
class PlayerState:
    player_id: str
    # Shadow board state (latest snapshot sent by the owning client).
    # Backend never runs physics on this; it only relays to the opponent.
    grid: Grid = field(default_factory=empty_grid)
    score: int = 0
    lines: int = 0
    level: int = 1
    ammo: int = 0
    is_game_over: bool = False
    last_shot_time: float = field(default_factory=lambda: 0.0)

    def can_shoot(self) -> bool:
        return (
            self.ammo > 0
            and not self.is_game_over
            and (time.time() - self.last_shot_time) >= SHOT_COOLDOWN_SECONDS
        )

    def to_dict(self) -> dict:
        return {
            "player_id": self.player_id,
            "grid": self.grid,
            "score": self.score,
            "lines": self.lines,
            "level": self.level,
            "ammo": self.ammo,
            "is_game_over": self.is_game_over,
        }


@dataclass
class Session:
    session_id: str
    players: dict[str, PlayerState] = field(default_factory=dict)
    match_start_time: Optional[float] = None  # epoch seconds
    match_ended: bool = False
    match_duration_seconds: int = 180

    def is_full(self) -> bool:
        return len(self.players) >= 2

    def get_opponent_id(self, player_id: str) -> Optional[str]:
        for pid in self.players:
            if pid != player_id:
                return pid
        return None
