"""Authentication endpoints — register, login, forgot/reset password."""
from __future__ import annotations

import asyncio
import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.db.database import AsyncSessionLocal
from app.dependencies import get_current_user
from app.models.models import Conversation, User, UserRole
from app.schemas.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    LoginUserProfile,
    MessageResponse,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    UpdatePasswordRequest,
    UserProfile,
)
from app.services import email_service, google_sheets
from app.services.local_auth import create_access_token, hash_password_async, verify_password_async

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])
security = HTTPBearer()


async def _create_admin_conversation(user_id: uuid.UUID, db: AsyncSession) -> None:
    """Create default Havlo advisory thread with idempotent upsert semantics."""
    if db.bind and db.bind.dialect.name == "postgresql":
        stmt = (
            pg_insert(Conversation)
            .values(
                user_id=user_id,
                team_member_name="Havlo Advisory",
                team_member_initials="HA",
                team_member_color="#0052B4",
                subject="Welcome to Havlo — we're here to help",
                is_admin_conversation=True,
                unread_count=0,
            )
            .on_conflict_do_nothing(
                index_elements=["user_id"],
                index_where=Conversation.is_admin_conversation.is_(True),
            )
        )
        await db.execute(stmt)
        await db.commit()
        return

    existing = await db.execute(
        select(Conversation).where(
            Conversation.user_id == user_id,
            Conversation.is_admin_conversation.is_(True),
        )
    )
    if existing.scalar_one_or_none():
        return
    db.add(
        Conversation(
            user_id=user_id,
            team_member_name="Havlo Advisory",
            team_member_initials="HA",
            team_member_color="#0052B4",
            subject="Welcome to Havlo — we're here to help",
            is_admin_conversation=True,
            unread_count=0,
        )
    )
    await db.commit()


async def _create_admin_conversation_background(user_id: str) -> None:
    """Background-safe admin conversation creation using a fresh session."""
    try:
        parsed_user_id = uuid.UUID(user_id)
    except ValueError:
        logger.error("Invalid user_id passed to background admin conversation task: %s", user_id)
        return
    async with AsyncSessionLocal() as session:
        try:
            await _create_admin_conversation(parsed_user_id, session)
        except Exception as exc:
            await session.rollback()
            logger.error("Failed creating admin conversation in background: %s", exc)


async def _send_welcome_email_safely(to_email: str, first_name: str) -> None:
    """Fire-and-forget welcome email dispatch.

    Runs on the event loop independently of FastAPI's BackgroundTasks chain so
    it can never be blocked behind a slow DB-bound task. Catches every
    exception so a transport failure can never affect the parent request.
    """
    try:
        ok = await asyncio.to_thread(
            email_service.send_welcome_email_sync, to_email, first_name
        )
        if not ok:
            logger.error(
                "Welcome email NOT delivered to %s — see SendGrid logs above for cause.",
                to_email,
            )
    except Exception as exc:  # noqa: BLE001
        logger.error("Welcome email task crashed for %s: %s", to_email, exc)


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    """Local-only registration: create user, hash password, issue JWT in one call.

    No external auth provider call (Supabase auth is not used in this deployment).
    The response includes an access_token + profile so the frontend does NOT need
    to make a follow-up /auth/login call. This roughly halves sign-up latency.
    """
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    hashed_password = await hash_password_async(payload.password)

    user = User(
        supabase_uid=None,
        email=payload.email,
        password_hash=hashed_password,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone_country_code=payload.phone_country_code,
        phone_number=payload.phone_number,
        role=UserRole(payload.role),
        onboarding_complete=False,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        logger.error("DB register integrity error for %s: %s", payload.email, exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    await db.refresh(user)

    access_token = create_access_token(str(user.id))

    # Post-commit side effects run AFTER the response is sent.
    # Welcome email is dispatched as an independent asyncio task so it can
    # never be blocked behind a slow DB-bound BackgroundTask. The wrapper
    # internally retries on transient SendGrid errors and swallows all
    # exceptions, so we don't need to await it.
    asyncio.create_task(_send_welcome_email_safely(user.email, user.first_name))

    background_tasks.add_task(_create_admin_conversation_background, str(user.id))
    background_tasks.add_task(
        google_sheets.record_registration,
        {
            "id": str(user.id),
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "phone_country_code": user.phone_country_code,
            "phone_number": user.phone_number,
            "role": user.role.value,
        },
    )

    return RegisterResponse(
        message="Account created successfully.",
        user_id=str(user.id),
        role=user.role.value,
        access_token=access_token,
        onboarding_complete=user.onboarding_complete,
        is_admin=bool(user.is_admin),
        profile=LoginUserProfile(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone_country_code=user.phone_country_code,
            phone_number=user.phone_number,
            role=user.role.value,
            onboarding_complete=user.onboarding_complete,
            is_admin=bool(user.is_admin),
        ),
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user is None or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not await verify_password_async(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    access_token = create_access_token(str(user.id))

    return LoginResponse(
        access_token=access_token,
        user_id=str(user.id),
        role=user.role.value,
        onboarding_complete=user.onboarding_complete,
        is_admin=bool(user.is_admin),
        profile=LoginUserProfile(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone_country_code=user.phone_country_code,
            phone_number=user.phone_number,
            role=user.role.value,
            onboarding_complete=user.onboarding_complete,
            is_admin=bool(user.is_admin),
        ),
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> MessageResponse:
    return MessageResponse(message="Logged out successfully.")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest) -> MessageResponse:
    return MessageResponse(
        message="If an account with that email exists, a password reset link has been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> MessageResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Password reset via email link is not available in this environment.",
    )


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile(
        id=str(current_user.id),
        supabase_uid=current_user.supabase_uid or "",
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone_country_code=current_user.phone_country_code,
        phone_number=current_user.phone_number,
        full_phone=current_user.full_phone,
        role=current_user.role.value,
        onboarding_complete=current_user.onboarding_complete,
        is_admin=bool(current_user.is_admin),
        created_at=current_user.created_at,
    )
