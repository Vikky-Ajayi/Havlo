"""Sell Faster — Relaunch plan applications with SumUp payment (setup + monthly)."""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import Payment, PaymentStatus, SellFasterApplication, User
from app.schemas.schemas import (
    PaymentStatusResponse,
    SellFasterRequest,
    SellFasterResponse,
)
from app.services import google_sheets, sumup_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/sell-faster",
    tags=["Sell Faster"],
    dependencies=[Depends(require_roles("seller", "agent"))],
)


@router.post("", response_model=SellFasterResponse, status_code=status.HTTP_201_CREATED)
async def submit_sell_faster(
    payload: SellFasterRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SellFasterResponse:
    """
    Submit a Sell Faster / Relaunch application.
    Charges setup fee + first month via SumUp (both in GBP).
    """
    settings = get_settings()
    total_amount = payload.setup_price + payload.monthly_price
    reference = f"HAVLO-SF-{uuid.uuid4().hex[:12].upper()}"

    try:
        checkout = await sumup_service.create_checkout(
            amount=total_amount,
            currency="GBP",
            description=(
                f"Havlo Sell Faster — {payload.plan_name} Plan "
                f"(Setup £{payload.setup_price:.0f} + Month 1 £{payload.monthly_price:.0f})"
            ),
            reference=reference,
            redirect_url=(
                f"{settings.FRONTEND_URL}/dashboard/sell-faster?payment=success&ref={reference}"
            ),
        )
    except Exception as exc:
        logger.error("SumUp checkout failed for sell-faster: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment gateway unavailable. Please try again.",
        )

    checkout_id = checkout.get("id", "")
    checkout_url = checkout.get("checkout_url", "")

    application = SellFasterApplication(
        user_id=current_user.id,
        plan_id=payload.plan_id,
        plan_name=payload.plan_name,
        property_address=payload.property_address,
        property_type=payload.property_type,
        asking_price=payload.asking_price,
        target_countries=payload.target_countries,
        contact_preference=payload.contact_preference,
        agent_name=payload.agent_name,
        agent_email=payload.agent_email,
        agent_phone=payload.agent_phone,
        additional_info=payload.additional_info,
        sumup_checkout_id=checkout_id,
        sumup_checkout_url=checkout_url,
        payment_status=PaymentStatus.pending,
    )
    db.add(application)

    payment = Payment(
        user_id=current_user.id,
        checkout_id=checkout_id,
        amount=total_amount,
        currency="GBP",
        status=PaymentStatus.pending,
        reference_type="sell_faster",
    )
    db.add(payment)
    await db.commit()
    await db.refresh(application)

    payment.reference_id = str(application.id)
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
        "plan_id": payload.plan_id,
        "plan_name": payload.plan_name,
        "property_address": payload.property_address,
        "property_type": payload.property_type,
        "asking_price": payload.asking_price or "",
        "target_countries": payload.target_countries,
        "contact_preference": payload.contact_preference,
        "agent_name": payload.agent_name or "",
        "agent_email": payload.agent_email or "",
        "agent_phone": payload.agent_phone or "",
        "additional_info": payload.additional_info or "",
        "checkout_id": checkout_id,
        "payment_status": "pending",
    }
    background_tasks.add_task(google_sheets.record_sell_faster, user_dict, form_dict)

    return SellFasterResponse(
        application_id=str(application.id),
        checkout_url=checkout_url,
        checkout_id=checkout_id,
        total_amount=total_amount,
        currency="GBP",
        message=(
            f"Application created. Please complete payment of £{total_amount:.2f} "
            f"(Setup £{payload.setup_price:.0f} + Month 1 £{payload.monthly_price:.0f}) to activate your campaign."
        ),
    )


@router.get("/{application_id}/status", response_model=PaymentStatusResponse)
async def get_sell_faster_payment_status(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentStatusResponse:
    """Poll payment status for a Sell Faster application."""
    try:
        app_uuid = uuid.UUID(application_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid application ID.")

    result = await db.execute(
        select(SellFasterApplication).where(
            SellFasterApplication.id == app_uuid,
            SellFasterApplication.user_id == current_user.id,
        )
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    if application.payment_status == PaymentStatus.completed:
        return PaymentStatusResponse(
            checkout_id=application.sumup_checkout_id or "",
            status="PAID",
            paid=True,
        )

    if application.sumup_checkout_id:
        try:
            checkout_data = await sumup_service.get_checkout_status(application.sumup_checkout_id)
            sumup_status = checkout_data.get("status", "PENDING").upper()
            paid = sumup_status == "PAID"

            if paid:
                application.payment_status = PaymentStatus.completed
                payment_result = await db.execute(
                    select(Payment).where(Payment.checkout_id == application.sumup_checkout_id)
                )
                payment = payment_result.scalar_one_or_none()
                if payment:
                    payment.status = PaymentStatus.completed
                await db.commit()

            return PaymentStatusResponse(
                checkout_id=application.sumup_checkout_id,
                status=sumup_status,
                paid=paid,
            )
        except Exception as exc:
            logger.error("SumUp poll failed for sell-faster %s: %s", application_id, exc)

    return PaymentStatusResponse(
        checkout_id=application.sumup_checkout_id or "",
        status="PENDING",
        paid=False,
    )
