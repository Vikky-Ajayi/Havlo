"""International Buyer Network applications with SumUp payment (setup + monthly)."""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import BuyerNetworkApplication, Payment, PaymentStatus, User
from app.schemas.schemas import (
    BuyerNetworkRequest,
    BuyerNetworkResponse,
    PaymentStatusResponse,
)
from app.services import google_sheets, sumup_service
from app.services.sumup_service import SumUpError

logger = logging.getLogger(__name__)

# ── Server-side pricing — sole source of truth. NEVER trust client amounts. ──
BUYER_NETWORK_PACKAGES: dict[str, dict] = {
    "partner": {"name": "Partner",                "setup": 2000.00, "monthly": 2000.00, "currency": "GBP"},
    "growth":  {"name": "Growth Partner",         "setup": 4000.00, "monthly": 4000.00, "currency": "GBP"},
    "private": {"name": "Private Client Partner", "setup": 7500.00, "monthly": 7500.00, "currency": "GBP"},
}

# Public, no-auth router for price discovery.
public_router = APIRouter(prefix="/buyer-network", tags=["Buyer Network"])


@public_router.get("/packages")
async def list_buyer_network_packages() -> dict:
    """Return the public price list. Frontend MUST use these for display."""
    return BUYER_NETWORK_PACKAGES


router = APIRouter(
    prefix="/buyer-network",
    tags=["Buyer Network"],
    dependencies=[Depends(require_roles("seller", "agent"))],
)


@router.post("", response_model=BuyerNetworkResponse, status_code=status.HTTP_201_CREATED)
async def submit_buyer_network(
    payload: BuyerNetworkRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BuyerNetworkResponse:
    """
    Submit a Buyer Network application.
    Charges setup fee + first month payment via SumUp (GBP).
    """
    settings = get_settings()

    # SECURITY: pricing comes EXCLUSIVELY from the server-side map.
    package = BUYER_NETWORK_PACKAGES.get(payload.package_id)
    if not package:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid plan selected",
        )
    setup_price = float(package["setup"])
    monthly_price = float(package["monthly"])
    currency = str(package["currency"]).upper()
    total_amount = round(setup_price + monthly_price, 2)
    reference = f"HAVLO-BN-{uuid.uuid4().hex[:12].upper()}"

    redirect_url = None
    if settings.FRONTEND_URL:
        redirect_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}"
            f"/dashboard/buyer-network?payment=success&ref={reference}"
        )

    logger.info(
        "Buyer Network checkout requested ref=%s package=%s amount=%.2f currency=%s",
        reference, payload.package_id, total_amount, currency,
    )

    try:
        checkout = await sumup_service.create_checkout(
            amount=total_amount,
            currency=currency,
            description=(
                f"Havlo Buyer Network — {package['name']} Package "
                f"(Setup £{setup_price:.0f} + Month 1 £{monthly_price:.0f})"
            ),
            reference=reference,
            redirect_url=redirect_url,
        )
    except SumUpError as exc:
        logger.error("SumUp buyer-network failed: %s body=%s", exc, exc.body)
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

    application = BuyerNetworkApplication(
        user_id=current_user.id,
        package_id=payload.package_id,
        package_name=package["name"],
        company_name=payload.company_name,
        number_of_properties=payload.number_of_properties,
        property_types=payload.property_types,
        target_markets=payload.target_markets,
        contact_preference=payload.contact_preference,
        additional_info=payload.additional_info,
    )
    db.add(application)

    payment = Payment(
        user_id=current_user.id,
        checkout_id=checkout_id,
        amount=total_amount,
        currency=currency,
        status=PaymentStatus.pending,
        reference_type="buyer_network",
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
        "package_id": payload.package_id,
        "package_name": payload.package_name,
        "company_name": payload.company_name or "",
        "number_of_properties": payload.number_of_properties or "",
        "property_types": payload.property_types,
        "target_markets": payload.target_markets,
        "contact_preference": payload.contact_preference,
        "additional_info": payload.additional_info or "",
    }
    background_tasks.add_task(google_sheets.record_buyer_network, user_dict, form_dict)

    return BuyerNetworkResponse(
        application_id=str(application.id),
        checkout_url=checkout_url,
        checkout_id=checkout_id,
        total_amount=total_amount,
        currency=currency,
        message=(
            f"Application created. Please complete payment of £{total_amount:.2f} "
            f"(Setup £{setup_price:.0f} + Month 1 £{monthly_price:.0f}) to activate."
        ),
    )


@router.get("/{application_id}/status", response_model=PaymentStatusResponse)
async def get_buyer_network_payment_status(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentStatusResponse:
    """Poll SumUp payment status for a Buyer Network application."""
    try:
        app_uuid = uuid.UUID(application_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid application ID.")

    result = await db.execute(
        select(BuyerNetworkApplication).where(
            BuyerNetworkApplication.id == app_uuid,
            BuyerNetworkApplication.user_id == current_user.id,
        )
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    # No checkout stored on BuyerNetworkApplication yet — look up via Payment table
    payment_result = await db.execute(
        select(Payment).where(
            Payment.reference_type == "buyer_network",
            Payment.reference_id == str(application.id),
        )
    )
    payment = payment_result.scalar_one_or_none()

    if payment and payment.status == PaymentStatus.completed:
        return PaymentStatusResponse(
            checkout_id=payment.checkout_id,
            status="PAID",
            paid=True,
        )

    if payment and payment.checkout_id:
        try:
            checkout_data = await sumup_service.get_checkout_status(payment.checkout_id)
            sumup_status = checkout_data.get("status", "PENDING").upper()
            paid = sumup_status == "PAID"

            if paid:
                payment.status = PaymentStatus.completed
                await db.commit()

            return PaymentStatusResponse(
                checkout_id=payment.checkout_id,
                status=sumup_status,
                paid=paid,
            )
        except Exception as exc:
            logger.error("SumUp poll failed for buyer-network %s: %s", application_id, exc)

    return PaymentStatusResponse(
        checkout_id=payment.checkout_id if payment else "",
        status="PENDING",
        paid=False,
    )
