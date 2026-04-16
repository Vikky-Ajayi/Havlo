"""
Messaging system:
  REST  — list conversations, get conversation detail, send message (user → team)
  WS    — /ws/inbox/{conversation_id}?token=<jwt>  real-time push for new messages

Admin sends messages via POST /messaging/admin/send (no auth for now — use internal bearer).
When a team member sends a message, the user receives:
  1. A WebSocket push (if connected)
  2. An SMS via Twilio (if not already notified)
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import Conversation, Message, MessageSenderType, User
from app.schemas.schemas import (
    ConversationDetailOut,
    ConversationOut,
    MessageOut,
    SendMessageRequest,
    SendMessageResponse,
)
from app.services import twilio_service
from app.services.supabase_client import get_supabase_admin
from app.services.ws_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/messaging", tags=["Messaging"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _message_to_out(msg: Message, viewer_type: str = "user") -> MessageOut:
    return MessageOut(
        id=str(msg.id),
        content=msg.content,
        sender_type=msg.sender_type.value,
        sender_name=msg.sender_name,
        created_at=msg.created_at,
        is_me=(msg.sender_type.value == viewer_type),
    )


async def _push_message_to_user(
    user_id: str,
    conversation_id: str,
    message: Message,
) -> None:
    """Push new-message event over WebSocket."""
    await manager.send_to_user(
        user_id,
        {
            "event": "new_message",
            "conversation_id": conversation_id,
            "message": {
                "id": str(message.id),
                "content": message.content,
                "sender_type": message.sender_type.value,
                "sender_name": message.sender_name,
                "created_at": message.created_at.isoformat(),
                "is_me": False,
            },
        },
    )


def _send_sms_notification(user: User, sender_name: str) -> None:
    """Fire-and-forget Twilio SMS notification."""
    settings = get_settings()
    twilio_service.send_new_message_sms(
        to_phone=user.full_phone,
        sender_name=sender_name,
        app_url=settings.FRONTEND_URL,
    )


# ── REST Endpoints ─────────────────────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    """Return all conversations for the authenticated user, newest first."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .options(selectinload(Conversation.messages))
        .order_by(desc(Conversation.last_message_at))
    )
    conversations = result.scalars().all()

    output: list[ConversationOut] = []
    for conv in conversations:
        last_msg = conv.messages[-1] if conv.messages else None
        snippet = last_msg.content[:80] if last_msg else None
        output.append(
            ConversationOut(
                id=str(conv.id),
                team_member_name=conv.team_member_name,
                team_member_initials=conv.team_member_initials,
                team_member_color=conv.team_member_color,
                subject=conv.subject,
                last_message_at=conv.last_message_at,
                last_message_snippet=snippet,
            )
        )
    return output


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetailOut:
    """Return a single conversation with all messages."""
    try:
        conv_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid conversation ID.")

    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv_uuid, Conversation.user_id == current_user.id)
        .options(selectinload(Conversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    return ConversationDetailOut(
        id=str(conv.id),
        team_member_name=conv.team_member_name,
        team_member_initials=conv.team_member_initials,
        team_member_color=conv.team_member_color,
        subject=conv.subject,
        messages=[_message_to_out(m, "user") for m in conv.messages],
    )


@router.post("/conversations/{conversation_id}/messages", response_model=SendMessageResponse)
async def send_user_message(
    conversation_id: str,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    """User sends a message in a conversation."""
    try:
        conv_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid conversation ID.")

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_uuid,
            Conversation.user_id == current_user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    msg = Message(
        conversation_id=conv_uuid,
        content=payload.content,
        sender_type=MessageSenderType.user,
        sender_name=current_user.full_name,
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    await db.commit()
    await db.refresh(msg)

    return SendMessageResponse(message=_message_to_out(msg, "user"))


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    subject: str = Query(..., min_length=1),
    team_member_name: str = Query(default="Havlo Advisory"),
    team_member_initials: str = Query(default="HA"),
    team_member_color: str = Query(default="#0052B4"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """User starts a new conversation."""
    conv = Conversation(
        user_id=current_user.id,
        team_member_name=team_member_name,
        team_member_initials=team_member_initials,
        team_member_color=team_member_color,
        subject=subject,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return {"id": str(conv.id), "subject": conv.subject}


# ── Admin Send (Team → User) ──────────────────────────────────────────────────

class AdminSendRequest(SendMessageRequest):
    sender_name: str = "Havlo Advisory"


@router.post(
    "/admin/conversations/{conversation_id}/send",
    response_model=SendMessageResponse,
    summary="Send a message as a team member (admin use)",
)
async def admin_send_message(
    conversation_id: str,
    payload: AdminSendRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    # Lightweight admin check — protect with an internal secret header in prod
    # Requires X-Admin-Secret header matching SUPABASE_SERVICE_ROLE_KEY
) -> SendMessageResponse:
    """
    Team member sends a message to a user.
    Triggers WebSocket push + SMS notification.
    """
    try:
        conv_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid conversation ID.")

    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv_uuid)
        .options(selectinload(Conversation.user))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    msg = Message(
        conversation_id=conv_uuid,
        content=payload.content,
        sender_type=MessageSenderType.team,
        sender_name=payload.sender_name,
        sms_sent=False,
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    await db.commit()
    await db.refresh(msg)

    user: User = conv.user

    # Push over WebSocket
    background_tasks.add_task(
        _push_message_to_user,
        str(user.id),
        str(conv.id),
        msg,
    )

    # Send SMS if user has a phone number
    if user.full_phone:
        background_tasks.add_task(
            _send_sms_notification,
            user,
            payload.sender_name,
        )
        # Mark as SMS sent
        msg.sms_sent = True
        await db.commit()

    return SendMessageResponse(message=_message_to_out(msg, "team"))


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/ws/inbox")
async def websocket_inbox(
    websocket: WebSocket,
    token: str = Query(..., description="Supabase JWT access token"),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Persistent WebSocket connection for real-time inbox updates.
    Connect with: ws://<host>/messaging/ws/inbox?token=<jwt>

    Events pushed from server:
      { "event": "new_message", "conversation_id": "...", "message": { ... } }
      { "event": "ping" }   (keepalive every 25 s)
    """
    # Authenticate via token
    admin = get_supabase_admin()
    try:
        user_response = admin.auth.get_user(token)
        supabase_uid = str(user_response.user.id)
    except Exception as exc:
        logger.warning("WS auth failed: %s", exc)
        await websocket.close(code=4001, reason="Unauthorized")
        return

    result = await db.execute(select(User).where(User.supabase_uid == supabase_uid))
    user = result.scalar_one_or_none()
    if not user:
        await websocket.close(code=4004, reason="User not found")
        return

    user_id = str(user.id)
    await manager.connect(websocket, user_id)

    try:
        # Send initial connection ack
        await websocket.send_text(json.dumps({"event": "connected", "user_id": user_id}))

        while True:
            # Keep connection alive — client can send any message (e.g. ping)
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=25.0)
                parsed = json.loads(data)
                if parsed.get("type") == "ping":
                    await websocket.send_text(json.dumps({"event": "pong"}))
            except asyncio.TimeoutError:
                # Send keepalive ping to client
                await websocket.send_text(json.dumps({"event": "ping"}))
            except WebSocketDisconnect:
                break
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, user_id)
