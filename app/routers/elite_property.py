"""Elite Property Introductions application — sellers and agents only."""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import ElitePropertyApplication, User
from app.schemas.schemas import ElitePropertyRequest, ElitePropertyResponse
from app.services import google_sheets

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/elite-property",
    tags=["Elite Property"],
    dependencies=[Depends(require_roles("seller"))],
)


@router.post(
    "/apply",
    response_model=ElitePropertyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def apply_elite_property(
    payload: ElitePropertyRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ElitePropertyResponse:
    """Submit an Elite Property Introductions application."""
    application = ElitePropertyApplication(
        user_id=current_user.id,
        property_address=payload.property_address,
        property_type=payload.property_type,
        asking_price=payload.asking_price,
        asking_price_currency=payload.asking_price_currency,
        description=payload.description,
        target_buyer_profile=payload.target_buyer_profile,
        additional_info=payload.additional_info,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)

    user_dict = {
        "id": str(current_user.id),
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "phone_country_code": current_user.phone_country_code,
        "phone_number": current_user.phone_number,
    }
    form_dict = {
        "property_address": payload.property_address,
        "property_type": payload.property_type,
        "asking_price": payload.asking_price or "",
        "asking_price_currency": payload.asking_price_currency,
        "description": payload.description or "",
        "target_buyer_profile": payload.target_buyer_profile or "",
        "additional_info": payload.additional_info or "",
    }
    background_tasks.add_task(google_sheets.record_elite_property, user_dict, form_dict)

    return ElitePropertyResponse(
        application_id=str(application.id),
        message="Application submitted. Our elite property team will review and contact you within 2 business days.",
    )
