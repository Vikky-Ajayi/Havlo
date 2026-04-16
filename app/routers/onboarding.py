"""Onboarding form submission endpoint."""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import OnboardingData, User
from app.schemas.schemas import OnboardingRequest, OnboardingResponse
from app.services import google_sheets

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


@router.post("", response_model=OnboardingResponse, status_code=status.HTTP_201_CREATED)
async def submit_onboarding(
    payload: OnboardingRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OnboardingResponse:
    """
    Save the 5-step onboarding form data.
    If already completed, updates the existing record.
    """
    result = await db.execute(
        select(OnboardingData).where(OnboardingData.user_id == current_user.id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Update
        existing.services = payload.services
        existing.countries = payload.countries
        existing.property_type = payload.property_type
        existing.timeframe = payload.timeframe
        existing.budget_amount = payload.budget_amount
        existing.budget_currency = payload.budget_currency
        onboarding = existing
    else:
        # Create
        onboarding = OnboardingData(
            user_id=current_user.id,
            services=payload.services,
            countries=payload.countries,
            property_type=payload.property_type,
            timeframe=payload.timeframe,
            budget_amount=payload.budget_amount,
            budget_currency=payload.budget_currency,
        )
        db.add(onboarding)

    # Mark user onboarding complete
    current_user.onboarding_complete = True
    await db.commit()
    await db.refresh(onboarding)

    user_dict = {
        "id": str(current_user.id),
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "role": current_user.role.value,
    }
    onboarding_dict = {
        "services": payload.services,
        "countries": payload.countries,
        "property_type": payload.property_type,
        "timeframe": payload.timeframe,
        "budget_amount": payload.budget_amount or "",
        "budget_currency": payload.budget_currency,
    }
    background_tasks.add_task(google_sheets.record_onboarding, user_dict, onboarding_dict)

    return OnboardingResponse(
        message="Onboarding completed successfully.",
        onboarding_id=str(onboarding.id),
    )


@router.get("")
async def get_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return the user's onboarding data if it exists."""
    result = await db.execute(
        select(OnboardingData).where(OnboardingData.user_id == current_user.id)
    )
    onboarding = result.scalar_one_or_none()
    if not onboarding:
        return {"completed": False}
    return {
        "completed": True,
        "services": onboarding.services,
        "countries": onboarding.countries,
        "property_type": onboarding.property_type,
        "timeframe": onboarding.timeframe,
        "budget_amount": onboarding.budget_amount,
        "budget_currency": onboarding.budget_currency,
    }
