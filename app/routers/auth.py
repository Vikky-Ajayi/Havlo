"""Authentication endpoints — register, login, forgot/reset password."""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import User, UserRole
from app.schemas.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    UpdatePasswordRequest,
    UserProfile,
)
from app.services import google_sheets
from app.services.supabase_client import get_supabase_admin, get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])
security = HTTPBearer()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    """
    1. Create user in Supabase Auth
    2. Create User row in our Postgres DB
    3. Record registration in Google Sheets (background)
    """
    # Check if email already exists in our DB
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    admin = get_supabase_admin()

    # Create user in Supabase Auth
    try:
        auth_response = admin.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,  # Auto-confirm for smooth onboarding flow
                "user_metadata": {
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                    "role": payload.role,
                },
            }
        )
        supabase_user = auth_response.user
        if supabase_user is None:
            raise ValueError("Supabase returned no user")
    except Exception as exc:
        logger.error("Supabase user creation failed: %s", exc)
        msg = str(exc)
        if "already registered" in msg.lower() or "already exists" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create account. Please try again.",
        )

    # Create User row in our DB
    user = User(
        supabase_uid=str(supabase_user.id),
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone_country_code=payload.phone_country_code,
        phone_number=payload.phone_number,
        role=UserRole(payload.role),
        onboarding_complete=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Record in Google Sheets (background so it doesn't block the response)
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
    """Authenticate with Supabase and return the JWT access token."""
    client = get_supabase_client()
    try:
        auth_response = client.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
        session = auth_response.session
        supabase_user = auth_response.user
        if session is None or supabase_user is None:
            raise ValueError("No session returned")
    except Exception as exc:
        logger.warning("Login failed for %s: %s", payload.email, exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Fetch DB user
    result = await db.execute(
        select(User).where(User.supabase_uid == str(supabase_user.id))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found.",
        )

    return LoginResponse(
        access_token=session.access_token,
        user_id=str(user.id),
        role=user.role.value,
        onboarding_complete=user.onboarding_complete,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> MessageResponse:
    """Sign out the user from Supabase (invalidates their session)."""
    client = get_supabase_client()
    try:
        # Set the session token so we sign out the right user
        client.auth.set_session(credentials.credentials, "")
        client.auth.sign_out()
    except Exception as exc:
        logger.warning("Logout error (non-fatal): %s", exc)
    return MessageResponse(message="Logged out successfully.")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest) -> MessageResponse:
    """Trigger a Supabase password reset email."""
    settings = get_settings()
    client = get_supabase_client()
    try:
        client.auth.reset_password_email(
            payload.email,
            options={"redirect_to": f"{settings.FRONTEND_URL}/reset-password"},
        )
    except Exception as exc:
        logger.error("Forgot password error: %s", exc)
        # Always return success to avoid email enumeration
    return MessageResponse(
        message="If an account with that email exists, a password reset link has been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> MessageResponse:
    """
    Reset password using the access token from the Supabase reset email.
    Frontend should extract the token from the URL fragment and send it as Bearer.
    """
    admin = get_supabase_admin()
    try:
        # Verify the token first to get the uid
        user_response = admin.auth.get_user(credentials.credentials)
        if user_response.user is None:
            raise ValueError("Invalid token")
        admin.auth.admin.update_user_by_id(
            str(user_response.user.id),
            {"password": payload.new_password},
        )
    except Exception as exc:
        logger.error("Password reset failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset failed. The link may have expired.",
        )
    return MessageResponse(message="Password reset successfully.")


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user)) -> UserProfile:
    """Return the authenticated user's profile."""
    return UserProfile(
        id=str(current_user.id),
        supabase_uid=current_user.supabase_uid,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone_country_code=current_user.phone_country_code,
        phone_number=current_user.phone_number,
        full_phone=current_user.full_phone,
        role=current_user.role.value,
        onboarding_complete=current_user.onboarding_complete,
        created_at=current_user.created_at,
    )
