"""Authentication endpoints — register, login, forgot/reset password."""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import User, UserRole
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
from app.services import google_sheets
from app.services.local_auth import create_access_token, hash_password_async, verify_password_async

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])
security = HTTPBearer()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    hashed_password = await hash_password_async(payload.password)
    user = User(
        supabase_uid=str(uuid.uuid4()),
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
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    await db.refresh(user)

    user_dict = {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone_country_code": user.phone_country_code,
        "phone_number": user.phone_number,
        "role": user.role.value,
    }
    background_tasks.add_task(google_sheets.record_registration, user_dict)

    return RegisterResponse(
        message="Account created successfully. Please log in.",
        user_id=str(user.id),
        role=user.role.value,
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
