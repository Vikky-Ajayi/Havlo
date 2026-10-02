"""User profile management endpoints."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import BuyAbroadFavourite, User
from app.schemas.schemas import (
    FavouriteListingsRequest,
    FavouriteListingsResponse,
    MessageResponse,
    UpdatePasswordRequest,
    UpdateProfileRequest,
    UserProfile,
)
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


# ── Buy Abroad favourites ──────────────────────────────────────────────────────
# The homes a user saved on the Buy Abroad marketplace, oldest first. Every
# call answers with the whole list so the browser can replace its copy.

_MAX_FAVOURITES = 500


async def _favourite_ids(db: AsyncSession, user_id) -> list[str]:
    result = await db.execute(
        select(BuyAbroadFavourite.listing_id)
        .where(BuyAbroadFavourite.user_id == user_id)
        .order_by(BuyAbroadFavourite.created_at, BuyAbroadFavourite.id)
    )
    return list(result.scalars().all())


@router.get("/me/favourite-listings", response_model=FavouriteListingsResponse)
async def list_favourite_listings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FavouriteListingsResponse:
    return FavouriteListingsResponse(listing_ids=await _favourite_ids(db, current_user.id))


@router.post("/me/favourite-listings", response_model=FavouriteListingsResponse)
async def add_favourite_listings(
    payload: FavouriteListingsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FavouriteListingsResponse:
    """Saves one or more homes. Already-saved ones are left as they are."""
    user_id = current_user.id
    saved = set(await _favourite_ids(db, user_id))
    new_ids = [i for i in dict.fromkeys(payload.listing_ids) if i not in saved]
    if len(saved) + len(new_ids) > _MAX_FAVOURITES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You can save up to {_MAX_FAVOURITES} homes. Remove some to save more.",
        )
    if new_ids:
        # A microsecond apart so homes saved together keep their order.
        now = datetime.now(timezone.utc)
        db.add_all(
            BuyAbroadFavourite(user_id=user_id, listing_id=i, created_at=now + timedelta(microseconds=n))
            for n, i in enumerate(new_ids)
        )
        try:
            await db.commit()
        except IntegrityError:
            # The same home saved from another tab at the same moment; the
            # other request already stored it.
            await db.rollback()
    return FavouriteListingsResponse(listing_ids=await _favourite_ids(db, user_id))


@router.delete("/me/favourite-listings/{listing_id}", response_model=FavouriteListingsResponse)
async def remove_favourite_listing(
    listing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FavouriteListingsResponse:
    user_id = current_user.id
    await db.execute(
        delete(BuyAbroadFavourite).where(
            BuyAbroadFavourite.user_id == user_id,
            BuyAbroadFavourite.listing_id == listing_id.strip(),
        )
    )
    await db.commit()
    return FavouriteListingsResponse(listing_ids=await _favourite_ids(db, user_id))
