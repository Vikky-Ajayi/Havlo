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
    PropertyDemandCheckRequest,
    PropertyDemandCheckResponse,
    SellFasterRequest,
    SellFasterResponse,
)
from app.services import google_sheets, sumup_service
from app.services.sumup_service import SumUpError

logger = logging.getLogger(__name__)

# ── Server-side pricing — sole source of truth. NEVER trust client amounts. ──
SELL_FASTER_PLANS: dict[str, dict] = {
    "launch":         {"name": "Launch",         "setup": 2000.00, "monthly": 1500.00, "currency": "GBP"},
    "global":         {"name": "Global",         "setup": 2000.00, "monthly": 1500.00, "currency": "GBP"},
    "global-plus":    {"name": "Global+",        "setup": 3500.00, "monthly": 2500.00, "currency": "GBP"},
    "worldwide":      {"name": "Worldwide",      "setup": 5000.00, "monthly": 3500.00, "currency": "GBP"},
    "private-client": {"name": "Private Client", "setup": 5000.00, "monthly": 3500.00, "currency": "GBP"},
}

# Public, no-auth router for price discovery.
public_router = APIRouter(prefix="/sell-faster", tags=["Sell Faster"])


@public_router.get("/plans")
async def list_sell_faster_plans() -> dict:
    """Return the public price list. Frontend MUST use these for display."""
    return SELL_FASTER_PLANS


router = APIRouter(
    prefix="/sell-faster",
    tags=["Sell Faster"],
    dependencies=[Depends(require_roles("seller"))],
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

    # SECURITY: pricing comes EXCLUSIVELY from the server-side map.
    plan = SELL_FASTER_PLANS.get(payload.plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid plan selected",
        )
    setup_price = float(plan["setup"])
    monthly_price = float(plan["monthly"])
    currency = str(plan["currency"]).upper()
    total_amount = round(setup_price, 2)
    reference = f"HAVLO-SF-{uuid.uuid4().hex[:12].upper()}"

    redirect_url = None
    if settings.FRONTEND_URL:
        redirect_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}"
            f"/dashboard/sell-faster?payment=success&ref={reference}"
        )

    logger.info(
        "Sell Faster checkout requested ref=%s plan=%s amount=%.2f currency=%s",
        reference, payload.plan_id, total_amount, currency,
    )

    try:
        checkout = await sumup_service.create_checkout(
            amount=total_amount,
            currency=currency,
            description=(
                f"Havlo Sell Faster — {plan['name']} Plan "
                f"(Setup fee £{setup_price:.0f}; £{monthly_price:.0f}/month thereafter)"
            ),
            reference=reference,
            redirect_url=redirect_url,
        )
    except SumUpError as exc:
        logger.error("SumUp sell-faster failed: %s body=%s", exc, exc.body)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"SumUp error: {exc} {exc.body or ''}".strip(),
        )
    except Exception as exc:
        logger.exception("Unexpected error creating SumUp checkout: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment gateway unavailable. Please try again.",
        )

    checkout_id = checkout.get("id", "")
    checkout_url = checkout.get("checkout_url", "")

    application = SellFasterApplication(
        user_id=current_user.id,
        plan_id=payload.plan_id,
        plan_name=plan["name"],
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
        currency=currency,
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
        currency=currency,
        message=(
            f"Application created. Please complete the setup payment of £{total_amount:.2f} "
            f"(£{monthly_price:.0f}/month thereafter) to activate your campaign."
        ),
    )


@router.post("/property-demand-check", response_model=PropertyDemandCheckResponse)
async def submit_property_demand_check(
    payload: PropertyDemandCheckRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
) -> PropertyDemandCheckResponse:
    """Log a Property Demand Check submission to Google Sheets and return market guidance."""
    user_dict = {
        "id": str(current_user.id),
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
    }
    form_dict = {
        "property_address": payload.property_address,
        "city": payload.city,
        "postcode": payload.postcode,
        "listing_url": payload.listing_url or "",
    }
    background_tasks.add_task(google_sheets.record_property_demand_check, user_dict, form_dict)
    logger.info(
        "Property Demand Check submitted user=%s city=%s postcode=%s",
        current_user.id, payload.city, payload.postcode,
    )
    return PropertyDemandCheckResponse(
        ok=True,
        city=payload.city,
        markets=["United Arab Emirates", "Singapore", "United States", "Hong Kong"],
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
