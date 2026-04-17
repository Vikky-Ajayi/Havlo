"""Property Sale Audit request submission — sellers only, with SumUp payment."""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import (
    Payment,
    PaymentStatus,
    SaleAuditRequest as SaleAuditModel,
    User,
)
from app.schemas.schemas import (
    PaymentStatusResponse,
    SaleAuditRequest,
    SaleAuditResponse,
)
from app.services import google_sheets, sumup_service

logger = logging.getLogger(__name__)

# One-off Sale Audit assessment fee (matches the £1,999.99 shown in the UI).
SALE_AUDIT_FEE = 1999.99
SALE_AUDIT_CURRENCY = "GBP"

router = APIRouter(
    prefix="/sale-audit",
    tags=["Sale Audit"],
    dependencies=[Depends(require_roles("seller"))],
)


@router.post("", response_model=SaleAuditResponse, status_code=status.HTTP_201_CREATED)
async def submit_sale_audit(
    payload: SaleAuditRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SaleAuditResponse:
    """Submit a Property Sale Audit request and create a SumUp checkout."""
    settings = get_settings()
    reference = f"HAVLO-SA-{uuid.uuid4().hex[:12].upper()}"

    try:
        checkout = await sumup_service.create_checkout(
            amount=SALE_AUDIT_FEE,
            currency=SALE_AUDIT_CURRENCY,
            description="Havlo Property Sale Audit — full assessment & consultation",
            reference=reference,
            redirect_url=(
                f"{settings.FRONTEND_URL}/dashboard/sale-audit?payment=success&ref={reference}"
            ),
        )
    except Exception as exc:
        logger.error("SumUp checkout failed for sale-audit: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment gateway unavailable. Please try again.",
        )

    checkout_id = checkout.get("id", "")
    checkout_url = checkout.get("checkout_url", "")

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
        sumup_checkout_id=checkout_id,
        sumup_checkout_url=checkout_url,
        payment_status=PaymentStatus.pending,
    )
    db.add(record)

    payment = Payment(
        user_id=current_user.id,
        checkout_id=checkout_id,
        amount=SALE_AUDIT_FEE,
        currency=SALE_AUDIT_CURRENCY,
        status=PaymentStatus.pending,
        reference_type="sale_audit",
    )
    db.add(payment)
    await db.commit()
    await db.refresh(record)

    payment.reference_id = str(record.id)
    await db.commit()

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
        "checkout_id": checkout_id,
        "payment_status": "pending",
    }
    background_tasks.add_task(google_sheets.record_sale_audit, user_dict, form_dict)

    return SaleAuditResponse(
        request_id=str(record.id),
        checkout_url=checkout_url,
        checkout_id=checkout_id,
        amount=SALE_AUDIT_FEE,
        currency=SALE_AUDIT_CURRENCY,
        message=(
            f"Sale audit request created. Please complete payment of "
            f"£{SALE_AUDIT_FEE:,.2f} to begin your assessment."
        ),
    )


@router.get("/{request_id}/status", response_model=PaymentStatusResponse)
async def get_sale_audit_payment_status(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentStatusResponse:
    """Poll payment status for a Sale Audit request."""
    try:
        req_uuid = uuid.UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request ID.")

    result = await db.execute(
        select(SaleAuditModel).where(
            SaleAuditModel.id == req_uuid,
            SaleAuditModel.user_id == current_user.id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")

    if record.payment_status == PaymentStatus.completed:
        return PaymentStatusResponse(
            checkout_id=record.sumup_checkout_id or "",
            status="PAID",
            paid=True,
        )

    if record.sumup_checkout_id:
        try:
            checkout_data = await sumup_service.get_checkout_status(record.sumup_checkout_id)
            sumup_status = checkout_data.get("status", "PENDING").upper()
            paid = sumup_status == "PAID"

            if paid:
                record.payment_status = PaymentStatus.completed
                payment_result = await db.execute(
                    select(Payment).where(Payment.checkout_id == record.sumup_checkout_id)
                )
                payment = payment_result.scalar_one_or_none()
                if payment:
                    payment.status = PaymentStatus.completed
                await db.commit()

            return PaymentStatusResponse(
                checkout_id=record.sumup_checkout_id,
                status=sumup_status,
                paid=paid,
            )
        except Exception as exc:
            logger.error("SumUp poll failed for sale-audit %s: %s", request_id, exc)

    return PaymentStatusResponse(
        checkout_id=record.sumup_checkout_id or "",
        status="PENDING",
        paid=False,
    )
