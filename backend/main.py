"""
main.py — FastAPI entrypoint.
Run with: uvicorn main:app --reload --port 8000
"""
import sys
import os

# Make backend subfolders importable
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from websocket.game_ws import game_ws_handler

app = FastAPI(title="Tetris Multiplayer Backend")

# Allow the Vite dev server (port 5173) to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def health():
    return {"status": "ok", "message": "Tetris multiplayer backend running"}


@app.websocket("/ws/game/{session_id}/{player_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    player_id: str,
):
    await game_ws_handler(websocket, session_id, player_id)
