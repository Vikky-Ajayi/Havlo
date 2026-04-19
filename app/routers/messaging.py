"""
Messaging system — REST + WebSocket.

Architecture
============
Two parties exchange messages inside a `Conversation`:
  • the end user (sender_type = "user")
  • the Havlo team / admin (sender_type = "team")

Real-time channels:
  • /messaging/ws/inbox?token=<jwt>          — a single user's stream
  • /messaging/ws/admin?secret=<ADMIN_SECRET> — admin firehose: every new
    message from every user shows up here in real time

Admin REST endpoints accept *either* a valid bearer token from a user with
`is_admin = True` (so the existing AdminPanel keeps working) *or* the
`X-Admin-Secret` header matching `ADMIN_SECRET` env var (for service-to-service
or external automation use).

Read-state model
----------------
`conversations.unread_count` holds the unread team-message count from the
**user's** perspective. It is incremented when the team sends a message and
reset to 0 when the user opens the conversation (GET …/conversations/{id}).

`messages.is_read` becomes True once the recipient has opened the conversation.

SMS notification
----------------
A team-sent message triggers an SMS only when:
  1. the user has no active WebSocket connection, AND
  2. the message has not yet been notified (sms_notification_sent = False), AND
  3. the user's `full_phone` is in valid E.164 format
SMS sending always runs as a background task and never blocks the response.
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
    Header,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db.database import AsyncSessionLocal, get_db
from app.dependencies import get_current_user
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


# ── Admin auth (bearer-admin OR X-Admin-Secret) ────────────────────────────────

async def require_admin_or_secret(
    request: Request,
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Allow either a valid `X-Admin-Secret` header, or a bearer token belonging
    to an `is_admin = True` user. Returns the User when bearer-authed, else None."""
    settings = get_settings()
    if x_admin_secret and settings.ADMIN_SECRET and x_admin_secret == settings.ADMIN_SECRET:
        return None

    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin authentication required.")
    token = auth_header.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin token.")
    try:
        uid = uuid.UUID(payload["sub"])
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin token.")
    res = await db.execute(select(User).where(User.id == uid))
    user = res.scalar_one_or_none()
    if not user or not bool(user.is_admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required.")
    return user


# ── Helpers ────────────────────────────────────────────────────────────────────

def _msg_to_out(msg: Message, viewer_type: str) -> MessageOut:
    return MessageOut(
        id=str(msg.id),
        content=msg.content,
        sender_type=msg.sender_type.value,
        sender_name=msg.sender_name,
        created_at=msg.created_at,
        is_me=(msg.sender_type.value == viewer_type),
    )


def _serialize_message_for_ws(msg: Message, conversation_id: str) -> dict:
    return {
        "event": "new_message",
        "conversation_id": conversation_id,
        "message": {
            "id": str(msg.id),
            "content": msg.content,
            "sender_type": msg.sender_type.value,
            "sender_name": msg.sender_name,
            "created_at": msg.created_at.isoformat(),
        },
    }


async def _maybe_send_sms(message_id: uuid.UUID, user_id: str) -> None:
    """Background task: send SMS if user is offline and we haven't already sent one.
    Uses its own DB session (BackgroundTasks runs after the request closes)."""
    if manager.is_user_online(user_id):
        return
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(Message).where(Message.id == message_id).options(
                selectinload(Message.conversation).selectinload(Conversation.user)
            )
        )
        msg = res.scalar_one_or_none()
        if not msg or msg.sms_notification_sent:
            return
        user = msg.conversation.user
        if not user or not user.full_phone:
            return

        settings = get_settings()
        ok = await asyncio.to_thread(
            twilio_service.send_new_message_sms,
            user.full_phone,
            msg.sender_name,
            settings.FRONTEND_URL or "",
            msg.content,
        )
        if ok:
            msg.sms_notification_sent = True
            msg.sms_sent = True
            await db.commit()


# ── User REST endpoints ───────────────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    """List the current user's conversations with snippet & unread badge."""
    # Single query: convo + last message snippet via correlated subquery
    last_msg_subq = (
        select(Message.content)
        .where(Message.conversation_id == Conversation.id)
        .order_by(desc(Message.created_at))
        .limit(1)
        .correlate(Conversation)
        .scalar_subquery()
    )

    rows = (await db.execute(
        select(Conversation, last_msg_subq.label("last_snippet"))
        .where(Conversation.user_id == current_user.id)
        .order_by(desc(Conversation.last_message_at))
    )).all()

    return [
        ConversationOut(
            id=str(c.id),
            team_member_name=c.team_member_name,
            team_member_initials=c.team_member_initials,
            team_member_color=c.team_member_color,
            subject=c.subject,
            last_message_at=c.last_message_at,
            last_message_snippet=(snip[:80] if snip else None),
            unread_count=int(c.unread_count or 0),
        )
        for c, snip in rows
    ]


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    subject: str = Query(..., min_length=1, max_length=500),
    team_member_name: str = Query(default="Havlo Advisory"),
    team_member_initials: str = Query(default="HA"),
    team_member_color: str = Query(default="#0052B4"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
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


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetailOut:
    """Fetch full thread; resets the user's unread badge."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid conversation ID.")

    res = await db.execute(
        select(Conversation)
        .where(Conversation.id == cid, Conversation.user_id == current_user.id)
        .options(selectinload(Conversation.messages))
    )
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")

    # Atomic reset (avoids races with concurrent admin sends)
    if conv.unread_count or any(
        m.sender_type == MessageSenderType.team and not m.is_read for m in conv.messages
    ):
        await db.execute(
            update(Message)
            .where(
                Message.conversation_id == cid,
                Message.sender_type == MessageSenderType.team,
                Message.is_read.is_(False),
            )
            .values(is_read=True)
        )
        await db.execute(
            update(Conversation)
            .where(Conversation.id == cid)
            .values(unread_count=0)
        )
        await db.commit()

    return ConversationDetailOut(
        id=str(conv.id),
        team_member_name=conv.team_member_name,
        team_member_initials=conv.team_member_initials,
        team_member_color=conv.team_member_color,
        subject=conv.subject,
        messages=[_msg_to_out(m, "user") for m in conv.messages],
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=SendMessageResponse,
)
async def user_send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid conversation ID.")

    res = await db.execute(
        select(Conversation).where(
            Conversation.id == cid, Conversation.user_id == current_user.id
        )
    )
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")

    msg = Message(
        conversation_id=cid,
        content=payload.content,
        sender_type=MessageSenderType.user,
        sender_name=current_user.full_name,
        sender_id=current_user.id,
        is_read=False,
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    await db.commit()
    await db.refresh(msg)

    # Fan out to admin firehose (best-effort, never block).
    try:
        await manager.send_to_admins({
            **_serialize_message_for_ws(msg, str(cid)),
            "user": {
                "id": str(current_user.id),
                "full_name": current_user.full_name,
                "email": current_user.email,
            },
            "subject": conv.subject,
        })
    except Exception as exc:
        logger.warning("Admin WS fan-out failed: %s", exc)

    return SendMessageResponse(message=_msg_to_out(msg, "user"))


# ── Admin REST endpoints ──────────────────────────────────────────────────────

@router.get(
    "/admin/conversations",
    response_model=list[dict],
    summary="Admin: list ALL conversations across ALL users",
)
async def admin_list_all_conversations(
    limit: int = Query(200, ge=1, le=500),
    _admin: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    last_msg_subq = (
        select(Message.content)
        .where(Message.conversation_id == Conversation.id)
        .order_by(desc(Message.created_at))
        .limit(1)
        .correlate(Conversation)
        .scalar_subquery()
    )
    admin_unread_subq = (
        select(func.count(Message.id))
        .where(
            Message.conversation_id == Conversation.id,
            Message.sender_type == MessageSenderType.user,
            Message.is_read.is_(False),
        )
        .correlate(Conversation)
        .scalar_subquery()
    )

    rows = (await db.execute(
        select(
            Conversation,
            User,
            last_msg_subq.label("snippet"),
            admin_unread_subq.label("admin_unread"),
        )
        .join(User, User.id == Conversation.user_id)
        .order_by(desc(Conversation.last_message_at))
        .limit(limit)
    )).all()

    return [
        {
            "id": str(c.id),
            "subject": c.subject,
            "team_member_name": c.team_member_name,
            "team_member_initials": c.team_member_initials,
            "team_member_color": c.team_member_color,
            "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
            "last_message_snippet": (snippet[:80] if snippet else None),
            "unread_count": int(unread or 0),  # admin's unread (user msgs)
            "user": {
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "phone": u.full_phone,
                "role": u.role.value,
            },
        }
        for c, u, snippet, unread in rows
    ]


@router.get(
    "/admin/conversations/{conversation_id}",
    response_model=ConversationDetailOut,
)
async def admin_get_conversation(
    conversation_id: str,
    _admin: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetailOut:
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid conversation ID.")

    res = await db.execute(
        select(Conversation)
        .where(Conversation.id == cid)
        .options(selectinload(Conversation.messages))
    )
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")

    # Admin opening the thread → mark user messages as read
    await db.execute(
        update(Message)
        .where(
            Message.conversation_id == cid,
            Message.sender_type == MessageSenderType.user,
            Message.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.commit()

    return ConversationDetailOut(
        id=str(conv.id),
        team_member_name=conv.team_member_name,
        team_member_initials=conv.team_member_initials,
        team_member_color=conv.team_member_color,
        subject=conv.subject,
        messages=[_msg_to_out(m, "team") for m in conv.messages],
    )


class _AdminSendBody(AdminSendRequest):
    conversation_id: str


@router.post(
    "/admin/send",
    response_model=SendMessageResponse,
    summary="Admin: send a message into any conversation (X-Admin-Secret or admin bearer)",
)
async def admin_send(
    payload: _AdminSendBody,
    background_tasks: BackgroundTasks,
    _admin: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    return await _admin_post_message(
        conversation_id=payload.conversation_id,
        content=payload.content,
        sender_name=payload.sender_name,
        admin_user=_admin,
        background_tasks=background_tasks,
        db=db,
    )


@router.post(
    "/admin/conversations/{conversation_id}/send",
    response_model=SendMessageResponse,
    summary="Admin: send a message in a specific conversation",
)
async def admin_send_in_conversation(
    conversation_id: str,
    payload: AdminSendRequest,
    background_tasks: BackgroundTasks,
    _admin: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    return await _admin_post_message(
        conversation_id=conversation_id,
        content=payload.content,
        sender_name=payload.sender_name,
        admin_user=_admin,
        background_tasks=background_tasks,
        db=db,
    )


async def _admin_post_message(
    *,
    conversation_id: str,
    content: str,
    sender_name: str,
    admin_user: Optional[User],
    background_tasks: BackgroundTasks,
    db: AsyncSession,
) -> SendMessageResponse:
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid conversation ID.")

    res = await db.execute(
        select(Conversation)
        .where(Conversation.id == cid)
        .options(selectinload(Conversation.user))
    )
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")

    msg = Message(
        conversation_id=cid,
        content=content,
        sender_type=MessageSenderType.team,
        sender_name=sender_name,
        sender_id=admin_user.id if admin_user else None,
        is_read=False,
    )
    db.add(msg)
    now = datetime.utcnow()
    # Atomic increment — survives concurrent admin sends.
    await db.execute(
        update(Conversation)
        .where(Conversation.id == cid)
        .values(
            last_message_at=now,
            unread_count=Conversation.unread_count + 1,
        )
    )
    await db.commit()
    await db.refresh(msg)

    user_id = str(conv.user_id)

    # Push live to user (best-effort)
    try:
        await manager.send_to_user(user_id, _serialize_message_for_ws(msg, str(cid)))
    except Exception as exc:
        logger.warning("User WS push failed (user=%s): %s", user_id, exc)

    # SMS only if offline; runs after response is sent.
    background_tasks.add_task(_maybe_send_sms, msg.id, user_id)

    return SendMessageResponse(message=_msg_to_out(msg, "team"))


@router.post(
    "/admin/conversations",
    status_code=status.HTTP_201_CREATED,
    summary="Admin: start a new conversation with a user",
)
async def admin_create_conversation(
    payload: AdminStartConversationRequest,
    background_tasks: BackgroundTasks,
    _admin: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        target_uuid = uuid.UUID(payload.user_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user ID.")

    user_res = await db.execute(select(User).where(User.id == target_uuid))
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")

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
            sender_id=_admin.id if _admin else None,
            is_read=False,
        )
        db.add(msg)
        await db.execute(
            update(Conversation)
            .where(Conversation.id == conv.id)
            .values(last_message_at=datetime.utcnow(), unread_count=1)
        )
        await db.commit()
        await db.refresh(msg)
        initial_msg_id = str(msg.id)

        try:
            await manager.send_to_user(
                str(target_user.id),
                _serialize_message_for_ws(msg, str(conv.id)),
            )
        except Exception as exc:
            logger.warning("User WS push failed: %s", exc)
        background_tasks.add_task(_maybe_send_sms, msg.id, str(target_user.id))

    return {
        "id": str(conv.id),
        "subject": conv.subject,
        "user_id": str(target_user.id),
        "initial_message_id": initial_msg_id,
    }


# ── Backward-compat admin user-list endpoints (used by AdminPanel) ─────────────

@router.get("/admin/users", response_model=list[AdminUserOut])
async def admin_list_users(
    q: Optional[str] = Query(None),
    only_with_threads: bool = Query(False),
    limit: int = Query(200, ge=1, le=500),
    _admin: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> list[AdminUserOut]:
    convo_count_subq = (
        select(
            Conversation.user_id.label("uid"),
            func.count(Conversation.id).label("convo_count"),
            func.max(Conversation.last_message_at).label("last_msg"),
            func.coalesce(func.sum(Conversation.unread_count), 0).label("unread"),
        )
        .group_by(Conversation.user_id)
        .subquery()
    )

    # Admin-side unread = user messages with is_read=false
    admin_unread_subq = (
        select(
            Conversation.user_id.label("uid"),
            func.count(Message.id).label("admin_unread"),
        )
        .join(Message, Message.conversation_id == Conversation.id)
        .where(
            Message.sender_type == MessageSenderType.user,
            Message.is_read.is_(False),
        )
        .group_by(Conversation.user_id)
        .subquery()
    )

    stmt = (
        select(
            User,
            func.coalesce(convo_count_subq.c.convo_count, 0).label("cc"),
            convo_count_subq.c.last_msg,
            func.coalesce(admin_unread_subq.c.admin_unread, 0).label("ucnt"),
        )
        .outerjoin(convo_count_subq, convo_count_subq.c.uid == User.id)
        .outerjoin(admin_unread_subq, admin_unread_subq.c.uid == User.id)
        .where(User.is_admin == False)  # noqa: E712
    )
    if _admin is not None:
        stmt = stmt.where(User.id != _admin.id)
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            (func.lower(User.email).like(like))
            | (func.lower(User.first_name).like(like))
            | (func.lower(User.last_name).like(like))
        )
    if only_with_threads:
        stmt = stmt.where(convo_count_subq.c.convo_count > 0)

    stmt = stmt.order_by(
        desc(convo_count_subq.c.last_msg).nulls_last(),
        User.first_name.asc(),
    ).limit(limit)

    rows = (await db.execute(stmt)).all()
    return [
        AdminUserOut(
            id=str(u.id),
            first_name=u.first_name,
            last_name=u.last_name,
            full_name=u.full_name,
            email=u.email,
            role=u.role.value,
            phone=u.full_phone,
            created_at=u.created_at,
            conversation_count=int(cc or 0),
            last_message_at=last_msg,
            has_unread=int(ucnt or 0) > 0,
            unread_count=int(ucnt or 0),
        )
        for u, cc, last_msg, ucnt in rows
    ]


@router.get(
    "/admin/users/{user_id}/conversations",
    response_model=list[ConversationOut],
)
async def admin_list_user_conversations(
    user_id: str,
    _admin: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user ID.")

    last_msg_subq = (
        select(Message.content)
        .where(Message.conversation_id == Conversation.id)
        .order_by(desc(Message.created_at))
        .limit(1)
        .correlate(Conversation)
        .scalar_subquery()
    )
    admin_unread_subq = (
        select(func.count(Message.id))
        .where(
            Message.conversation_id == Conversation.id,
            Message.sender_type == MessageSenderType.user,
            Message.is_read.is_(False),
        )
        .correlate(Conversation)
        .scalar_subquery()
    )

    rows = (await db.execute(
        select(
            Conversation,
            last_msg_subq.label("snippet"),
            admin_unread_subq.label("unread"),
        )
        .where(Conversation.user_id == uid)
        .order_by(desc(Conversation.last_message_at))
    )).all()

    return [
        ConversationOut(
            id=str(c.id),
            team_member_name=c.team_member_name,
            team_member_initials=c.team_member_initials,
            team_member_color=c.team_member_color,
            subject=c.subject,
            last_message_at=c.last_message_at,
            last_message_snippet=(snip[:80] if snip else None),
            unread_count=int(unread or 0),
        )
        for c, snip, unread in rows
    ]


# ── WebSocket endpoints ───────────────────────────────────────────────────────

async def _ws_authed_user(token: str) -> Optional[uuid.UUID]:
    """Decode JWT off the event loop (jose's HMAC verify is fast but still sync)."""
    payload = await asyncio.to_thread(decode_access_token, token)
    if not payload:
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    try:
        return uuid.UUID(sub)
    except ValueError:
        return None


@router.websocket("/ws/inbox")
async def websocket_user_inbox(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    """User WebSocket: receives `new_message` events for their conversations."""
    user_uuid = await _ws_authed_user(token)
    if user_uuid is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    user_id = str(user_uuid)
    await manager.connect_user(websocket, user_id)
    try:
        await websocket.send_text(json.dumps({"event": "connected", "user_id": user_id}))
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=20.0)
                try:
                    parsed = json.loads(data)
                except json.JSONDecodeError:
                    parsed = {}
                if parsed.get("type") == "ping":
                    await websocket.send_text(json.dumps({"event": "pong"}))
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"event": "ping"}))
            except WebSocketDisconnect:
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("User WS error (user=%s): %s", user_id, exc)
    finally:
        await manager.disconnect_user(websocket, user_id)


@router.websocket("/ws/admin")
async def websocket_admin_firehose(
    websocket: WebSocket,
    secret: str = Query(...),
) -> None:
    """Admin firehose: receives every `new_message` from every user, real-time."""
    settings = get_settings()
    if not settings.ADMIN_SECRET or secret != settings.ADMIN_SECRET:
        await websocket.close(code=4003, reason="Forbidden")
        return

    await manager.connect_admin(websocket)
    try:
        await websocket.send_text(json.dumps({"event": "admin_connected"}))
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=20.0)
                try:
                    parsed = json.loads(data)
                except json.JSONDecodeError:
                    parsed = {}
                if parsed.get("type") == "ping":
                    await websocket.send_text(json.dumps({"event": "pong"}))
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"event": "ping"}))
            except WebSocketDisconnect:
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("Admin WS error: %s", exc)
    finally:
        await manager.disconnect_admin(websocket)
