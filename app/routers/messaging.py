"""Messaging REST + WebSocket endpoints."""
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
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.db.database import AsyncSessionLocal, get_db
from app.dependencies import get_current_user
from app.models.models import Conversation, Message, MessageSenderType, User
from app.schemas.schemas import (
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


async def require_admin_or_secret(
    request: Request,
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Allow admin bearer auth or X-Admin-Secret auth."""
    settings = get_settings()
    if x_admin_secret and settings.ADMIN_SECRET and x_admin_secret == settings.ADMIN_SECRET:
        return None

    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin authentication required.")

    token = auth_header.split(" ", 1)[1].strip()
    payload = await asyncio.to_thread(decode_access_token, token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin token.")
    try:
        uid = uuid.UUID(payload["sub"])
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin token.") from exc

    user = (
        await db.execute(select(User).where(User.id == uid))
    ).scalar_one_or_none()
    if not user or not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required.")
    return user


def _to_message_out(msg: Message, viewer: MessageSenderType) -> MessageOut:
    return MessageOut(
        id=str(msg.id),
        content=msg.content,
        sender_type=msg.sender_type.value,
        sender_name=msg.sender_name,
        created_at=msg.created_at,
        is_me=(msg.sender_type == viewer),
    )


def _serialize_ws_message(msg: Message, conversation_id: str) -> dict:
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


async def _maybe_send_team_sms(message_id: uuid.UUID, user_id: str) -> None:
    """Send offline SMS notification for a team message."""
    if manager.user_is_online(user_id):
        return

    async with AsyncSessionLocal() as db:
        msg = (
            await db.execute(
                select(Message)
                .where(Message.id == message_id)
                .options(selectinload(Message.conversation).selectinload(Conversation.user))
            )
        ).scalar_one_or_none()
        if not msg:
            return
        if msg.sender_type != MessageSenderType.team or msg.sms_notification_sent:
            return

        user = msg.conversation.user
        if not user:
            return
        phone = (user.full_phone or "").strip()
        if not twilio_service.is_valid_e164(phone):
            return

        settings = get_settings()
        # SMS failure should never break the API flow.
        sent_ok = await asyncio.to_thread(
            twilio_service.send_new_message_sms,
            phone,
            msg.sender_name,
            settings.FRONTEND_URL or "",
        )
        if sent_ok:
            msg.sms_notification_sent = True
            await db.commit()


async def _ensure_admin_conversation_for_user(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Conversation:
    """Guarantee the default Havlo Advisory admin conversation exists."""
    inserted_with_upsert = False
    if db.bind and db.bind.dialect.name == "postgresql":
        try:
            stmt = (
                pg_insert(Conversation)
                .values(
                    user_id=user_id,
                    team_member_name="Havlo Advisory",
                    team_member_initials="HA",
                    team_member_color="#0052B4",
                    subject="Welcome to Havlo - we're here to help",
                    is_admin_conversation=True,
                    unread_count=0,
                )
                .on_conflict_do_nothing(
                    index_elements=["user_id"],
                    index_where=Conversation.is_admin_conversation.is_(True),
                )
            )
            await db.execute(stmt)
            inserted_with_upsert = True
        except SQLAlchemyError as exc:
            # Some production DBs may miss the partial unique index required by ON CONFLICT.
            # Fall back to explicit read-then-insert path instead of failing the endpoint.
            logger.warning(
                "Admin conversation upsert fallback for user=%s due to DB error: %s",
                user_id,
                exc,
            )
            await db.rollback()

    if not inserted_with_upsert:
        existing = (
            await db.execute(
                select(Conversation).where(
                    Conversation.user_id == user_id,
                    Conversation.is_admin_conversation.is_(True),
                )
            )
        ).scalar_one_or_none()
        if not existing:
            db.add(
                Conversation(
                    user_id=user_id,
                    team_member_name="Havlo Advisory",
                    team_member_initials="HA",
                    team_member_color="#0052B4",
                    subject="Welcome to Havlo - we're here to help",
                    is_admin_conversation=True,
                    unread_count=0,
                )
            )
    await db.commit()
    conv = (
        await db.execute(
            select(Conversation).where(
                Conversation.user_id == user_id,
                Conversation.is_admin_conversation.is_(True),
            )
        )
    ).scalar_one_or_none()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not initialize inbox conversation.",
        )
    return conv


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    await _ensure_admin_conversation_for_user(current_user.id, db)

    last_message_subq = (
        select(Message.content)
        .where(Message.conversation_id == Conversation.id)
        .order_by(desc(Message.created_at))
        .limit(1)
        .correlate(Conversation)
        .scalar_subquery()
    )

    rows = (
        await db.execute(
            select(Conversation, last_message_subq.label("last_snippet"))
            .where(Conversation.user_id == current_user.id)
            .order_by(desc(Conversation.last_message_at))
        )
    ).all()

    if not rows:
        conv = await _ensure_admin_conversation_for_user(current_user.id, db)
        rows = [(conv, None)]

    return [
        ConversationOut(
            id=str(conv.id),
            team_member_name=conv.team_member_name,
            team_member_initials=conv.team_member_initials,
            team_member_color=conv.team_member_color,
            subject=conv.subject,
            last_message_at=conv.last_message_at,
            unread_count=int(conv.unread_count or 0),
            last_message_snippet=(snippet[:60] if snippet else None),
        )
        for conv, snippet in rows
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetailOut:
    try:
        conv_id = uuid.UUID(conversation_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid conversation ID.") from exc

    conv = (
        await db.execute(
            select(Conversation)
            .where(
                Conversation.id == conv_id,
                Conversation.user_id == current_user.id,
            )
            .options(selectinload(Conversation.messages))
        )
    ).scalar_one_or_none()
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")

    await db.execute(
        update(Message)
        .where(
            Message.conversation_id == conv_id,
            Message.sender_type == MessageSenderType.team,
            Message.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.execute(
        update(Conversation)
        .where(Conversation.id == conv_id)
        .values(unread_count=0)
    )
    await db.commit()
    await db.refresh(conv)

    return ConversationDetailOut(
        id=str(conv.id),
        team_member_name=conv.team_member_name,
        team_member_initials=conv.team_member_initials,
        team_member_color=conv.team_member_color,
        subject=conv.subject,
        messages=[_to_message_out(m, MessageSenderType.user) for m in conv.messages],
    )


@router.post("/conversations/{conversation_id}/messages", response_model=SendMessageResponse)
async def send_user_message(
    conversation_id: str,
    payload: SendMessageRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    try:
        conv_id = uuid.UUID(conversation_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid conversation ID.") from exc

    conv = (
        await db.execute(
            select(Conversation).where(
                Conversation.id == conv_id,
                Conversation.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")

    msg = Message(
        conversation_id=conv_id,
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

    ws_payload = _serialize_ws_message(msg, str(conv.id))
    ws_payload["user"] = {
        "id": str(current_user.id),
        "full_name": current_user.full_name,
        "email": current_user.email,
    }
    background_tasks.add_task(manager.broadcast_to_admins, ws_payload)

    return SendMessageResponse(message=_to_message_out(msg, MessageSenderType.user))


class AdminSendPayload(SendMessageRequest):
    conversation_id: str
    sender_name: str = "Havlo Advisory"


@router.post("/admin/send", response_model=SendMessageResponse)
async def admin_send_message(
    payload: AdminSendPayload,
    background_tasks: BackgroundTasks,
    admin_user: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    try:
        conv_id = uuid.UUID(payload.conversation_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid conversation ID.") from exc

    conv = (
        await db.execute(
            select(Conversation)
            .where(Conversation.id == conv_id)
            .options(selectinload(Conversation.user))
        )
    ).scalar_one_or_none()
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")

    msg = Message(
        conversation_id=conv_id,
        content=payload.content,
        sender_type=MessageSenderType.team,
        sender_name=payload.sender_name,
        sender_id=admin_user.id if admin_user else None,
        is_read=False,
        sms_notification_sent=False,
    )
    db.add(msg)
    await db.execute(
        update(Conversation)
        .where(Conversation.id == conv_id)
        .values(
            unread_count=Conversation.unread_count + 1,
            last_message_at=datetime.utcnow(),
        )
    )
    await db.commit()
    await db.refresh(msg)

    user_id = str(conv.user_id)
    background_tasks.add_task(manager.send_to_user, user_id, _serialize_ws_message(msg, str(conv.id)))
    background_tasks.add_task(_maybe_send_team_sms, msg.id, user_id)

    return SendMessageResponse(message=_to_message_out(msg, MessageSenderType.team))


@router.post("/admin/conversations/{conversation_id}/send", response_model=SendMessageResponse)
async def admin_send_message_compat(
    conversation_id: str,
    payload: SendMessageRequest,
    background_tasks: BackgroundTasks,
    admin_user: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    return await admin_send_message(
        payload=AdminSendPayload(
            conversation_id=conversation_id,
            content=payload.content,
            sender_name="Havlo Advisory",
        ),
        background_tasks=background_tasks,
        admin_user=admin_user,
        db=db,
    )


@router.get("/admin/conversations")
async def admin_list_conversations(
    _admin: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    last_message_subq = (
        select(Message.content)
        .where(Message.conversation_id == Conversation.id)
        .order_by(desc(Message.created_at))
        .limit(1)
        .correlate(Conversation)
        .scalar_subquery()
    )
    rows = (
        await db.execute(
            select(Conversation, User, last_message_subq.label("last_snippet"))
            .join(User, User.id == Conversation.user_id)
            .order_by(desc(Conversation.last_message_at))
        )
    ).all()

    return [
        {
            "id": str(conv.id),
            "team_member_name": conv.team_member_name,
            "team_member_initials": conv.team_member_initials,
            "team_member_color": conv.team_member_color,
            "subject": conv.subject,
            "last_message_at": conv.last_message_at,
            "last_message_snippet": snippet[:60] if snippet else None,
            "unread_count": int(conv.unread_count or 0),
            "user": {
                "id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
                "phone": user.full_phone,
                "role": user.role.value,
            },
        }
        for conv, user, snippet in rows
    ]


@router.get("/admin/users", response_model=list[AdminUserOut])
async def admin_list_users(
    q: Optional[str] = Query(None),
    only_with_threads: bool = Query(False),
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
    stmt = (
        select(
            User,
            func.coalesce(convo_count_subq.c.convo_count, 0).label("cc"),
            convo_count_subq.c.last_msg,
            func.coalesce(convo_count_subq.c.unread, 0).label("ucnt"),
        )
        .outerjoin(convo_count_subq, convo_count_subq.c.uid == User.id)
        .where(User.is_admin == False)  # noqa: E712
    )
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            (func.lower(User.email).like(like))
            | (func.lower(User.first_name).like(like))
            | (func.lower(User.last_name).like(like))
        )
    if only_with_threads:
        stmt = stmt.where(convo_count_subq.c.convo_count > 0)
    rows = (await db.execute(stmt.order_by(desc(convo_count_subq.c.last_msg).nulls_last()))).all()
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


@router.get("/admin/users/{user_id}/conversations", response_model=list[ConversationOut])
async def admin_user_conversations(
    user_id: str,
    _admin: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    try:
        uid = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user ID.") from exc
    last_message_subq = (
        select(Message.content)
        .where(Message.conversation_id == Conversation.id)
        .order_by(desc(Message.created_at))
        .limit(1)
        .correlate(Conversation)
        .scalar_subquery()
    )
    rows = (
        await db.execute(
            select(Conversation, last_message_subq.label("last_snippet"))
            .where(Conversation.user_id == uid)
            .order_by(desc(Conversation.last_message_at))
        )
    ).all()
    return [
        ConversationOut(
            id=str(conv.id),
            team_member_name=conv.team_member_name,
            team_member_initials=conv.team_member_initials,
            team_member_color=conv.team_member_color,
            subject=conv.subject,
            last_message_at=conv.last_message_at,
            unread_count=int(conv.unread_count or 0),
            last_message_snippet=(snippet[:60] if snippet else None),
        )
        for conv, snippet in rows
    ]


@router.post("/admin/conversations", status_code=status.HTTP_201_CREATED)
async def admin_start_conversation(
    payload: AdminStartConversationRequest,
    background_tasks: BackgroundTasks,
    admin_user: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Compatibility endpoint: upsert the one allowed admin conversation."""
    try:
        uid = uuid.UUID(payload.user_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user ID.") from exc

    conv = (
        await db.execute(
            select(Conversation).where(
                Conversation.user_id == uid,
                Conversation.is_admin_conversation.is_(True),
            )
        )
    ).scalar_one_or_none()
    if not conv:
        conv = Conversation(
            user_id=uid,
            team_member_name=payload.sender_name,
            team_member_initials=payload.team_member_initials,
            team_member_color=payload.team_member_color,
            subject=payload.subject,
            is_admin_conversation=True,
            unread_count=0,
        )
        db.add(conv)
        await db.commit()
        await db.refresh(conv)

    initial_message_id = None
    if payload.initial_message and payload.initial_message.strip():
        msg = Message(
            conversation_id=conv.id,
            content=payload.initial_message.strip(),
            sender_type=MessageSenderType.team,
            sender_name=payload.sender_name,
            sender_id=admin_user.id if admin_user else None,
            is_read=False,
            sms_notification_sent=False,
        )
        db.add(msg)
        await db.execute(
            update(Conversation)
            .where(Conversation.id == conv.id)
            .values(
                unread_count=Conversation.unread_count + 1,
                last_message_at=datetime.utcnow(),
            )
        )
        await db.commit()
        await db.refresh(msg)
        initial_message_id = str(msg.id)
        background_tasks.add_task(
            manager.send_to_user, str(uid), _serialize_ws_message(msg, str(conv.id))
        )
        background_tasks.add_task(_maybe_send_team_sms, msg.id, str(uid))

    return {
        "id": str(conv.id),
        "subject": conv.subject,
        "user_id": str(uid),
        "initial_message_id": initial_message_id,
    }


@router.get("/admin/conversations/{conversation_id}", response_model=ConversationDetailOut)
async def admin_get_conversation(
    conversation_id: str,
    _admin: Optional[User] = Depends(require_admin_or_secret),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetailOut:
    try:
        conv_id = uuid.UUID(conversation_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid conversation ID.") from exc

    conv = (
        await db.execute(
            select(Conversation)
            .where(Conversation.id == conv_id)
            .options(selectinload(Conversation.messages))
        )
    ).scalar_one_or_none()
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")

    return ConversationDetailOut(
        id=str(conv.id),
        team_member_name=conv.team_member_name,
        team_member_initials=conv.team_member_initials,
        team_member_color=conv.team_member_color,
        subject=conv.subject,
        messages=[_to_message_out(m, MessageSenderType.team) for m in conv.messages],
    )


async def _ws_authenticated_user(token: str) -> Optional[uuid.UUID]:
    payload = await asyncio.to_thread(decode_access_token, token)
    if not payload or not payload.get("sub"):
        return None
    try:
        return uuid.UUID(payload["sub"])
    except ValueError:
        return None


@router.websocket("/ws/inbox")
async def user_inbox_ws(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    user_uuid = await _ws_authenticated_user(token)
    if not user_uuid:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    user_id = str(user_uuid)
    await manager.connect_user(websocket, user_id)
    try:
        await websocket.send_text(json.dumps({"event": "connected", "user_id": user_id}))
        while True:
            raw = await websocket.receive_text()
            parsed = json.loads(raw) if raw else {}
            if parsed.get("type") == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect_user(websocket, user_id)


@router.websocket("/ws/admin")
async def admin_inbox_ws(
    websocket: WebSocket,
    secret: str = Query(...),
) -> None:
    settings = get_settings()
    if not settings.ADMIN_SECRET or secret != settings.ADMIN_SECRET:
        await websocket.close(code=4001, reason="Forbidden")
        return

    await manager.connect_admin(websocket)
    try:
        await websocket.send_text(json.dumps({"event": "admin_connected"}))
        while True:
            raw = await websocket.receive_text()
            parsed = json.loads(raw) if raw else {}
            if parsed.get("type") == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect_admin(websocket)
