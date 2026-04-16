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
from app.dependencies import get_current_user, require_admin
from app.models.models import Conversation, Message, MessageSenderType, User
from app.schemas.schemas import (
    AdminSendRequest,
    AdminStartConversationRequest,
    AdminUserOut,
    ConversationDetailOut,
    ConversationOut,
    MessageOut,
    SendMessageRequest,
    SendMessageResponse,
)
from app.services import twilio_service
from app.services.local_auth import decode_access_token
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


# ── Admin (Team → User) ───────────────────────────────────────────────────────
# All endpoints below require `is_admin=True` on the authenticated user.


@router.get(
    "/admin/users",
    response_model=list[AdminUserOut],
    summary="Admin: list all users with messaging activity & unread badges",
)
async def admin_list_users(
    q: Optional[str] = Query(None, description="Search name or email (case-insensitive)"),
    only_with_threads: bool = Query(False, description="Only users that have at least one conversation"),
    limit: int = Query(200, ge=1, le=500),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[AdminUserOut]:
    """
    Returns every user (excluding the requesting admin) annotated with:
      - conversation_count
      - last_message_at (max across their conversations)
      - unread_count = count of user-sent messages newer than the latest team-sent
        message in each of their conversations (i.e. "needs admin reply")
    Sorted by last_message_at DESC (Gmail-style — most recent activity on top),
    with users who have no conversations at the bottom.
    """
    # Sub-query: per-conversation unread (user messages after the last team reply)
    last_team_subq = (
        select(
            Message.conversation_id.label("cid"),
            func.max(Message.created_at).label("last_team_at"),
        )
        .where(Message.sender_type == MessageSenderType.team)
        .group_by(Message.conversation_id)
        .subquery()
    )

    # Per-user aggregates over conversations + messages
    convo_count_subq = (
        select(
            Conversation.user_id.label("uid"),
            func.count(Conversation.id).label("convo_count"),
            func.max(Conversation.last_message_at).label("last_message_at"),
        )
        .group_by(Conversation.user_id)
        .subquery()
    )

    unread_subq = (
        select(
            Conversation.user_id.label("uid"),
            func.count(Message.id).label("unread_count"),
        )
        .select_from(Conversation)
        .join(Message, Message.conversation_id == Conversation.id)
        .outerjoin(last_team_subq, last_team_subq.c.cid == Conversation.id)
        .where(
            Message.sender_type == MessageSenderType.user,
            (last_team_subq.c.last_team_at.is_(None))
            | (Message.created_at > last_team_subq.c.last_team_at),
        )
        .group_by(Conversation.user_id)
        .subquery()
    )

    stmt = (
        select(
            User,
            func.coalesce(convo_count_subq.c.convo_count, 0).label("convo_count"),
            convo_count_subq.c.last_message_at,
            func.coalesce(unread_subq.c.unread_count, 0).label("unread_count"),
        )
        .outerjoin(convo_count_subq, convo_count_subq.c.uid == User.id)
        .outerjoin(unread_subq, unread_subq.c.uid == User.id)
        .where(User.id != _admin.id)
    )

    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            (func.lower(User.email).like(like))
            | (func.lower(User.first_name).like(like))
            | (func.lower(User.last_name).like(like))
        )
    if only_with_threads:
        stmt = stmt.where(convo_count_subq.c.convo_count > 0)

    # Sort: users with activity first (by recency), then those without — name asc
    stmt = stmt.order_by(
        desc(convo_count_subq.c.last_message_at).nulls_last(),
        User.first_name.asc(),
    ).limit(limit)

    rows = (await db.execute(stmt)).all()
    out: list[AdminUserOut] = []
    for user, convo_count, last_message_at, unread_count in rows:
        out.append(
            AdminUserOut(
                id=str(user.id),
                first_name=user.first_name,
                last_name=user.last_name,
                full_name=user.full_name,
                email=user.email,
                role=user.role.value,
                phone=user.full_phone,
                created_at=user.created_at,
                conversation_count=int(convo_count or 0),
                last_message_at=last_message_at,
                has_unread=int(unread_count or 0) > 0,
                unread_count=int(unread_count or 0),
            )
        )
    return out


@router.get(
    "/admin/users/{user_id}/conversations",
    response_model=list[ConversationOut],
    summary="Admin: list all conversations for a specific user",
)
async def admin_list_user_conversations(
    user_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID.")

    res = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_uuid)
        .options(selectinload(Conversation.messages))
        .order_by(desc(Conversation.last_message_at))
    )
    conversations = res.scalars().all()

    output: list[ConversationOut] = []
    for conv in conversations:
        last_msg = conv.messages[-1] if conv.messages else None
        snippet = last_msg.content[:80] if last_msg else None
        # Unread from admin perspective = user messages after the last team message
        last_team_at = None
        for m in reversed(conv.messages):
            if m.sender_type == MessageSenderType.team:
                last_team_at = m.created_at
                break
        unread = sum(
            1 for m in conv.messages
            if m.sender_type == MessageSenderType.user
            and (last_team_at is None or m.created_at > last_team_at)
        )
        output.append(
            ConversationOut(
                id=str(conv.id),
                team_member_name=conv.team_member_name,
                team_member_initials=conv.team_member_initials,
                team_member_color=conv.team_member_color,
                subject=conv.subject,
                last_message_at=conv.last_message_at,
                last_message_snippet=snippet,
                unread_count=unread,
            )
        )
    return output


@router.get(
    "/admin/conversations/{conversation_id}",
    response_model=ConversationDetailOut,
    summary="Admin: full message thread for any conversation",
)
async def admin_get_conversation(
    conversation_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetailOut:
    try:
        conv_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid conversation ID.")

    res = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv_uuid)
        .options(selectinload(Conversation.messages))
    )
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    return ConversationDetailOut(
        id=str(conv.id),
        team_member_name=conv.team_member_name,
        team_member_initials=conv.team_member_initials,
        team_member_color=conv.team_member_color,
        subject=conv.subject,
        # Admin views as "team", so messages from team show as is_me=True
        messages=[_message_to_out(m, "team") for m in conv.messages],
    )


@router.post(
    "/admin/conversations",
    status_code=status.HTTP_201_CREATED,
    summary="Admin: start a new conversation with a user (optionally with first message)",
)
async def admin_create_conversation(
    payload: AdminStartConversationRequest,
    background_tasks: BackgroundTasks,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        target_uuid = uuid.UUID(payload.user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID.")

    user_res = await db.execute(select(User).where(User.id == target_uuid))
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    conv = Conversation(
        user_id=target_uuid,
        team_member_name=payload.sender_name,
        team_member_initials=payload.team_member_initials,
        team_member_color=payload.team_member_color,
        subject=payload.subject,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)

    initial_msg_id: Optional[str] = None
    if payload.initial_message and payload.initial_message.strip():
        msg = Message(
            conversation_id=conv.id,
            content=payload.initial_message.strip(),
            sender_type=MessageSenderType.team,
            sender_name=payload.sender_name,
            sms_sent=False,
        )
        db.add(msg)
        conv.last_message_at = datetime.utcnow()
        await db.commit()
        await db.refresh(msg)
        initial_msg_id = str(msg.id)

        background_tasks.add_task(_push_message_to_user, str(target_user.id), str(conv.id), msg)
        if target_user.full_phone:
            background_tasks.add_task(_send_sms_notification, target_user, payload.sender_name)
            msg.sms_sent = True
            await db.commit()

    return {
        "id": str(conv.id),
        "subject": conv.subject,
        "user_id": str(target_user.id),
        "initial_message_id": initial_msg_id,
    }


@router.post(
    "/admin/conversations/{conversation_id}/send",
    response_model=SendMessageResponse,
    summary="Admin: send a message in any conversation as the team",
)
async def admin_send_message(
    conversation_id: str,
    payload: AdminSendRequest,
    background_tasks: BackgroundTasks,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    """Team member sends a message to a user. Triggers WS push + SMS notification."""
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

    background_tasks.add_task(_push_message_to_user, str(user.id), str(conv.id), msg)

    if user.full_phone:
        background_tasks.add_task(_send_sms_notification, user, payload.sender_name)
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
    payload = decode_access_token(token)
    if payload is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    user_id_str = payload.get("sub")
    if not user_id_str:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    result = await db.execute(select(User).where(User.id == user_uuid))
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
