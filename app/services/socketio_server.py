"""
Isolated python-socketio AsyncServer for the realtime messaging layer.

This module is intentionally additive: it lives alongside the existing
native FastAPI WebSocket (`ws_manager`) and does not replace it. The
existing inbox WebSocket continues to power the offline notification
trigger and admin/user inbox refresh logic untouched.

Socket.IO is mounted on top of the FastAPI ASGI app in `app.main` and
adds these realtime features:

  • message:new       — mirrored from existing send paths
  • message:edited    — emitted when a sender edits their own message
  • message:deleted   — emitted on soft delete
  • message:read      — emitted when the receiver opens the conversation
  • typing            — broadcast while a user is composing

Clients authenticate by passing the same JWT used for REST in the
`auth` payload, then join one room per conversation.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any, Optional

import socketio
from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.models.models import Conversation, User
from app.services.local_auth import decode_access_token

logger = logging.getLogger(__name__)


sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_interval=25,
    ping_timeout=20,
    logger=False,
    engineio_logger=False,
)


def _conv_room(conversation_id: str) -> str:
    return f"conversation:{conversation_id}"


def _user_room(user_id: str) -> str:
    return f"user:{user_id}"


async def _resolve_token(token: str) -> Optional[User]:
    payload = await asyncio.to_thread(decode_access_token, token)
    if not payload or not payload.get("sub"):
        return None
    try:
        uid = uuid.UUID(payload["sub"])
    except ValueError:
        return None
    async with AsyncSessionLocal() as db:
        return (
            await db.execute(select(User).where(User.id == uid))
        ).scalar_one_or_none()


async def _user_owns_conversation(user_id: uuid.UUID, conversation_id: uuid.UUID, is_admin: bool) -> bool:
    async with AsyncSessionLocal() as db:
        conv = (
            await db.execute(select(Conversation).where(Conversation.id == conversation_id))
        ).scalar_one_or_none()
        if not conv:
            return False
        return is_admin or conv.user_id == user_id


@sio.event
async def connect(sid: str, environ: dict, auth: Optional[dict]):
    token = ""
    if isinstance(auth, dict):
        token = (auth.get("token") or "").strip()
    if not token:
        # Fallback: ?token=… in the query string.
        qs = environ.get("QUERY_STRING", "") or ""
        for pair in qs.split("&"):
            if pair.startswith("token="):
                from urllib.parse import unquote
                token = unquote(pair.split("=", 1)[1])
                break
    if not token:
        logger.info("sio connect rejected: missing token sid=%s", sid)
        return False

    user = await _resolve_token(token)
    if not user:
        logger.info("sio connect rejected: bad token sid=%s", sid)
        return False

    await sio.save_session(sid, {
        "user_id": str(user.id),
        "is_admin": bool(user.is_admin),
        "full_name": user.full_name,
    })
    await sio.enter_room(sid, _user_room(str(user.id)))
    if user.is_admin:
        await sio.enter_room(sid, "admins")
    logger.info("sio user connected: user=%s admin=%s sid=%s", user.id, user.is_admin, sid)


@sio.event
async def disconnect(sid: str):
    logger.debug("sio disconnect sid=%s", sid)


@sio.event
async def join_conversation(sid: str, data: dict) -> dict:
    """Subscribe this socket to a conversation's room (after auth check)."""
    sess = await sio.get_session(sid)
    if not sess:
        return {"ok": False, "error": "unauthenticated"}

    cid_raw = (data or {}).get("conversation_id")
    if not cid_raw:
        return {"ok": False, "error": "missing conversation_id"}
    try:
        conv_id = uuid.UUID(str(cid_raw))
        user_id = uuid.UUID(sess["user_id"])
    except ValueError:
        return {"ok": False, "error": "invalid id"}

    if not await _user_owns_conversation(user_id, conv_id, bool(sess.get("is_admin"))):
        return {"ok": False, "error": "forbidden"}

    await sio.enter_room(sid, _conv_room(str(conv_id)))
    return {"ok": True}


@sio.event
async def leave_conversation(sid: str, data: dict) -> dict:
    cid_raw = (data or {}).get("conversation_id")
    if cid_raw:
        await sio.leave_room(sid, _conv_room(str(cid_raw)))
    return {"ok": True}


@sio.event
async def typing(sid: str, data: dict) -> dict:
    """Relay a transient 'is typing' / 'stopped typing' signal to the room."""
    sess = await sio.get_session(sid)
    if not sess:
        return {"ok": False}
    cid_raw = (data or {}).get("conversation_id")
    if not cid_raw:
        return {"ok": False}
    payload = {
        "conversation_id": str(cid_raw),
        "user_id": sess["user_id"],
        "sender_name": sess.get("full_name") or "",
        "is_admin": bool(sess.get("is_admin")),
        "is_typing": bool((data or {}).get("is_typing", True)),
    }
    await sio.emit("typing", payload, room=_conv_room(str(cid_raw)), skip_sid=sid)
    return {"ok": True}


# ── Server-side emit helpers (called from REST endpoints) ────────────────────

async def emit_message_new(conversation_id: str, message: dict, recipient_user_id: Optional[str] = None) -> None:
    payload = {"conversation_id": conversation_id, "message": message}
    await sio.emit("message:new", payload, room=_conv_room(conversation_id))
    if recipient_user_id:
        # Also fan-out to the recipient's personal room so their inbox badge
        # can update even when they don't have the conversation open.
        await sio.emit("message:new", payload, room=_user_room(recipient_user_id))
    await sio.emit("message:new", payload, room="admins")


async def emit_message_edited(conversation_id: str, message: dict) -> None:
    await sio.emit(
        "message:edited",
        {"conversation_id": conversation_id, "message": message},
        room=_conv_room(conversation_id),
    )
    await sio.emit(
        "message:edited",
        {"conversation_id": conversation_id, "message": message},
        room="admins",
    )


async def emit_message_deleted(conversation_id: str, message_id: str) -> None:
    await sio.emit(
        "message:deleted",
        {"conversation_id": conversation_id, "message_id": message_id},
        room=_conv_room(conversation_id),
    )
    await sio.emit(
        "message:deleted",
        {"conversation_id": conversation_id, "message_id": message_id},
        room="admins",
    )


async def emit_message_read(conversation_id: str, reader_user_id: str, message_ids: list[str]) -> None:
    await sio.emit(
        "message:read",
        {
            "conversation_id": conversation_id,
            "reader_user_id": reader_user_id,
            "message_ids": message_ids,
        },
        room=_conv_room(conversation_id),
    )


