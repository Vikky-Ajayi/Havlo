"""Property Sale Audit request submission — sellers and agents only."""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import SaleAuditRequest as SaleAuditModel, User
from app.schemas.schemas import SaleAuditRequest, SaleAuditResponse
from app.services import google_sheets

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/sale-audit",
    tags=["Sale Audit"],
    dependencies=[Depends(require_roles("seller", "agent"))],
)


@router.post("", response_model=SaleAuditResponse, status_code=status.HTTP_201_CREATED)
async def submit_sale_audit(
    payload: SaleAuditRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SaleAuditResponse:
    """Submit a Property Sale Audit request."""
    record = SaleAuditModel(
        user_id=current_user.id,
        listing_url=payload.listing_url,
        time_on_market=payload.time_on_market,
        number_of_viewings=payload.number_of_viewings,
        number_of_offers=payload.number_of_offers,
        original_asking_price=payload.original_asking_price,
        current_asking_price=payload.current_asking_price,
        price_currency=payload.price_currency,
        estate_agent_name=payload.estate_agent_name,
        property_description=payload.property_description,
        main_challenges=payload.main_challenges,
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
        "listing_url": payload.listing_url or "",
        "time_on_market": payload.time_on_market or "",
        "number_of_viewings": payload.number_of_viewings or "",
        "number_of_offers": payload.number_of_offers or "",
        "original_asking_price": payload.original_asking_price or "",
        "current_asking_price": payload.current_asking_price or "",
        "price_currency": payload.price_currency,
        "estate_agent_name": payload.estate_agent_name or "",
        "property_description": payload.property_description or "",
        "main_challenges": payload.main_challenges or "",
    }
    background_tasks.add_task(google_sheets.record_sale_audit, user_dict, form_dict)

    return SaleAuditResponse(
        request_id=str(record.id),
        message="Sale audit request submitted. Our team will prepare your report and notify you via inbox.",
    )
