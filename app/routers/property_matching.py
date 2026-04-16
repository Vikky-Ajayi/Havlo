"""Property matching form submission — buyers and agents only."""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import PropertyMatchingRequest as PropertyMatchingModel, User
from app.schemas.schemas import PropertyMatchingRequest, PropertyMatchingResponse
from app.services import google_sheets

logger = logging.getLogger(__name__)

# Only buyers and agents can submit property matching requests
router = APIRouter(
    prefix="/property-matching",
    tags=["Property Matching"],
    dependencies=[Depends(require_roles("buyer", "agent"))],
)


@router.post("", response_model=PropertyMatchingResponse, status_code=status.HTTP_201_CREATED)
async def submit_property_matching(
    payload: PropertyMatchingRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PropertyMatchingResponse:
    """Submit a property matching request."""
    record = PropertyMatchingModel(
        user_id=current_user.id,
        property_type=payload.property_type,
        location=payload.location,
        budget_amount=payload.budget_amount,
        budget_currency=payload.budget_currency,
        bedrooms=payload.bedrooms,
        bathrooms=payload.bathrooms,
        additional_requirements=payload.additional_requirements,
        contact_preference=payload.contact_preference,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    user_dict = {
        "id": str(current_user.id),
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "phone_country_code": current_user.phone_country_code,
        "phone_number": current_user.phone_number,
    }
    form_dict = {
        "property_type": payload.property_type,
        "location": payload.location,
        "budget_amount": payload.budget_amount or "",
        "budget_currency": payload.budget_currency,
        "bedrooms": payload.bedrooms or "",
        "bathrooms": payload.bathrooms or "",
        "additional_requirements": payload.additional_requirements or "",
        "contact_preference": payload.contact_preference,
    }
    background_tasks.add_task(google_sheets.record_property_matching, user_dict, form_dict)

    return PropertyMatchingResponse(
        request_id=str(record.id),
        message="Property matching request submitted. Our team will be in touch shortly.",
    )
