"""
WebSocket connection manager for real-time inbox updates.

Tracks two channels:
  - per-user connections (a single user may have multiple tabs open)
  - admin connections (a separate set; every admin sees all activity)

All push methods are exception-safe: a dead socket is silently dropped from
the registry instead of bubbling the failure up to the caller.
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self.user_connections: dict[str, list[WebSocket]] = defaultdict(list)
        self.admin_connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    # ── User connections ──────────────────────────────────────────────────
    async def connect_user(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        async with self._lock:
            self.user_connections[user_id].append(websocket)
        logger.info("WS user connected: user=%s total=%d", user_id, len(self.user_connections[user_id]))

    async def disconnect_user(self, websocket: WebSocket, user_id: str) -> None:
        async with self._lock:
            conns = self.user_connections.get(user_id)
            if conns:
                self.user_connections[user_id] = [ws for ws in conns if ws is not websocket]
                conns = self.user_connections[user_id]
                if not conns:
                    self.user_connections.pop(user_id, None)
        logger.info("WS user disconnected: user=%s", user_id)

    def user_is_online(self, user_id: str) -> bool:
        return len(self.user_connections.get(user_id, [])) > 0

    async def send_to_user(self, user_id: str, data: dict[str, Any]) -> None:
        for ws in list(self.user_connections.get(user_id, [])):
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception as exc:
                logger.warning("WS send to user=%s failed: %s", user_id, exc)
                await self.disconnect_user(ws, user_id)

    # ── Admin connections ─────────────────────────────────────────────────
    async def connect_admin(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.admin_connections.add(websocket)
        logger.info("WS admin connected: total=%d", len(self.admin_connections))

    async def disconnect_admin(self, websocket: WebSocket) -> None:
        async with self._lock:
            self.admin_connections.discard(websocket)
        logger.info("WS admin disconnected: total=%d", len(self.admin_connections))

    async def broadcast_to_admins(self, data: dict[str, Any]) -> None:
        for ws in list(self.admin_connections):
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception as exc:
                logger.warning("WS admin send failed: %s", exc)
                await self.disconnect_admin(ws)


manager = ConnectionManager()
