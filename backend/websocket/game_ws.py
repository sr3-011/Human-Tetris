"""
game_ws.py — WebSocket route handler.
Receives client actions, delegates to GameManager, broadcasts state.
"""
from __future__ import annotations
import json
from fastapi import WebSocket, WebSocketDisconnect
from services.game_manager import game_manager


async def game_ws_handler(websocket: WebSocket, session_id: str, player_id: str):
    await websocket.accept()

    # ── Join session ──────────────────────────────────────────────────────────
    joined = game_manager.join_session(session_id, player_id, websocket)
    if not joined:
        await websocket.send_json({
            "type": "ERROR",
            "payload": {"message": "Session is full (max 2 players)."},
        })
        await websocket.close()
        return

    # Notify the joining player of their assignment
    await websocket.send_json({
        "type": "CONNECTED",
        "payload": {
            "player_id": player_id,
            "session_id": session_id,
        },
    })

    # Broadcast updated state to all players (so both see each other joining)
    await game_manager.broadcast(session_id, game_manager.build_state_update(session_id))

    # Start match timer once we have 2 players
    await game_manager.maybe_start_match(session_id)

    # ── Message Loop ──────────────────────────────────────────────────────────
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")
            payload = msg.get("payload", {})

            # ── GRID_SNAPSHOT: client -> backend relay ──────────────────────
            if msg_type == "GRID_SNAPSHOT":
                game_manager.update_player_snapshot(session_id, player_id, payload)
                await game_manager.broadcast(session_id, game_manager.build_state_update(session_id))

            # ── ACTIONS (backend relay / validation) ────────────────────────
            elif msg_type == "ACTION" and payload.get("action") == "SHOOT":
                target_row = payload.get("target_row")
                target_col = payload.get("target_col")

                success, reason = game_manager.process_shot(session_id, player_id, target_row, target_col)
                if success:
                    event = game_manager.build_sabotage_event(
                        session_id, player_id, int(target_row), int(target_col)
                    )
                    if event:
                        await game_manager.broadcast(session_id, event)
                else:
                    await game_manager.send_to(session_id, player_id, {
                        "type": "SHOOT_REJECTED",
                        "payload": {"reason": reason},
                    })

    except WebSocketDisconnect:
        pass
    finally:
        game_manager.leave_session(session_id, player_id)
        # Notify remaining players
        await game_manager.broadcast(session_id, {
            "type": "PLAYER_LEFT",
            "payload": {"player_id": player_id},
        })
        await game_manager.broadcast(
            session_id,
            game_manager.build_state_update(session_id),
        )
