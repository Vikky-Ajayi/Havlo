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
        self._user_conns: dict[str, set[WebSocket]] = defaultdict(set)
        self._admin_conns: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    # ── User connections ──────────────────────────────────────────────────
    async def connect_user(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        async with self._lock:
            self._user_conns[user_id].add(websocket)
        logger.info("WS user connected: user=%s total=%d", user_id, len(self._user_conns[user_id]))

    async def disconnect_user(self, websocket: WebSocket, user_id: str) -> None:
        async with self._lock:
            conns = self._user_conns.get(user_id)
            if conns:
                conns.discard(websocket)
                if not conns:
                    self._user_conns.pop(user_id, None)
        logger.info("WS user disconnected: user=%s", user_id)

    def is_user_online(self, user_id: str) -> bool:
        return bool(self._user_conns.get(user_id))

    async def send_to_user(self, user_id: str, data: dict[str, Any]) -> None:
        for ws in list(self._user_conns.get(user_id, [])):
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception as exc:
                logger.warning("WS send to user=%s failed: %s", user_id, exc)
                await self.disconnect_user(ws, user_id)

    # ── Admin connections ─────────────────────────────────────────────────
    async def connect_admin(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._admin_conns.add(websocket)
        logger.info("WS admin connected: total=%d", len(self._admin_conns))

    async def disconnect_admin(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._admin_conns.discard(websocket)
        logger.info("WS admin disconnected: total=%d", len(self._admin_conns))

    async def send_to_admins(self, data: dict[str, Any]) -> None:
        for ws in list(self._admin_conns):
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception as exc:
                logger.warning("WS admin send failed: %s", exc)
                await self.disconnect_admin(ws)


manager = ConnectionManager()
