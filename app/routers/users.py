"""User profile management endpoints."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import User
from app.schemas.schemas import MessageResponse, UpdatePasswordRequest, UpdateProfileRequest, UserProfile
from app.services.local_auth import hash_password_async, verify_password_async

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["Users"])


@router.patch("/profile", response_model=UserProfile)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    if payload.first_name is not None:
        current_user.first_name = payload.first_name
    if payload.last_name is not None:
        current_user.last_name = payload.last_name
    if payload.phone_country_code is not None:
        current_user.phone_country_code = payload.phone_country_code
    if payload.phone_number is not None:
        current_user.phone_number = payload.phone_number

    await db.commit()
    await db.refresh(current_user)

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
        created_at=current_user.created_at,
    )


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    payload: UpdatePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    if not current_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change not available for this account.",
        )

    if not await verify_password_async(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.password_hash = await hash_password_async(payload.new_password)
    await db.commit()

    return MessageResponse(message="Password updated successfully.")
