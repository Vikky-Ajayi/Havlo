"""WebSocket connection manager for real-time inbox updates."""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages active WebSocket connections per user.
    A user can have multiple connections (e.g., different browser tabs).
    """

    def __init__(self) -> None:
        # user_id (str) → list of active WebSocket connections
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        self._connections[user_id].append(websocket)
        logger.info("WS connected: user=%s  total=%d", user_id, len(self._connections[user_id]))

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        try:
            self._connections[user_id].remove(websocket)
        except ValueError:
            pass
        if not self._connections[user_id]:
            del self._connections[user_id]
        logger.info("WS disconnected: user=%s", user_id)

    async def send_to_user(self, user_id: str, data: dict[str, Any]) -> None:
        """Send a JSON payload to all connections belonging to a user."""
        connections = list(self._connections.get(user_id, []))
        dead: list[WebSocket] = []
        for ws in connections:
            try:
                await ws.send_text(json.dumps(data))
            except Exception as exc:
                logger.warning("WS send failed (user=%s): %s", user_id, exc)
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Send a message to every connected user (admin use)."""
        tasks = [
            self.send_to_user(uid, data)
            for uid in list(self._connections.keys())
        ]
        await asyncio.gather(*tasks, return_exceptions=True)


# Singleton instance — shared across all routers
manager = ConnectionManager()
