"""Agent dashboard router — listings sync, AI report, advanced services payment."""
from __future__ import annotations

import logging
import re
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.agent_models import (
    AgentAdvancedServicePayment,
    AgentListing,
    AgentProfileLink,
)
from app.models.models import Payment, PaymentStatus, User
from app.services import sumup_service
from app.services.sumup_service import SumUpError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/agent",
    tags=["Agent Dashboard"],
    dependencies=[Depends(require_roles("agent", "admin"))],
)


# ── Schemas ────────────────────────────────────────────────────────────────────

class ProfileLinkRequest(BaseModel):
    profile_url: str = Field(..., min_length=10, max_length=2000)


class ProfileLinkResponse(BaseModel):
    profile_url: str
    platform: str | None
    last_synced_at: str | None


class SyncListingsResponse(BaseModel):
    count: int
    listings: list[dict]


class ListingOut(BaseModel):
    id: str
    external_url: str | None
    title: str | None
    price: str | None
    description: str | None
    image_url: str | None
    bedrooms: str | None
    platform: str | None


class AIReportRequest(BaseModel):
    listing_id: str | None = None
    listing_url: str | None = None
    listing_title: str | None = None
    listing_price: str | None = None
    listing_description: str | None = None
    listing_address: str | None = None


class AIReportResponse(BaseModel):
    report: str


class AdvancedServiceRequest(BaseModel):
    listing_id: str | None = None
    listing_url: str | None = None
    listing_title: str | None = None
    property_price_raw: str = Field(..., description="Listed price as shown, e.g. £875,000")


class AdvancedServiceResponse(BaseModel):
    payment_record_id: str
    checkout_id: str
    checkout_url: str
    service_fee_amount: float
    currency: str
    message: str


class AdvancedServiceStatusResponse(BaseModel):
    payment_record_id: str
    checkout_id: str
    status: str
    paid: bool


# ── Helpers ────────────────────────────────────────────────────────────────────

def _detect_platform(url: str) -> str:
    url_lower = url.lower()
    if "rightmove" in url_lower:
        return "rightmove"
    if "zoopla" in url_lower:
        return "zoopla"
    if "onthemarket" in url_lower:
        return "onthemarket"
    if "primelocation" in url_lower:
        return "primelocation"
    return "other"


def _parse_price_to_float(price_raw: str) -> float | None:
    """Extract a numeric value from a price string like '£875,000' or '875000'."""
    clean = re.sub(r"[^\d.]", "", price_raw)
    try:
        return float(clean) if clean else None
    except ValueError:
        return None


def _calculate_service_fee(price_raw: str) -> float:
    """
    Calculate 0.25% of the listed price, rounded UP to the nearest £500.
    E.g. £875,000 → 0.25% = £2,187.50 → rounded up to £2,500.
    Minimum fee: £500.
    """
    price = _parse_price_to_float(price_raw)
    if not price or price <= 0:
        raise ValueError(f"Could not parse a valid price from: {price_raw!r}")
    raw_fee = price * 0.0025
    rounding = 500
    rounded = max(rounding, (int(raw_fee / rounding) + (1 if raw_fee % rounding > 0 else 0)) * rounding)
    return float(rounded)


# ── Profile link CRUD ─────────────────────────────────────────────────────────

@router.get("/profile-link", response_model=ProfileLinkResponse | None)
async def get_profile_link(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentProfileLink).where(AgentProfileLink.user_id == current_user.id)
    )
    link = result.scalar_one_or_none()
    if not link:
        return None
    return ProfileLinkResponse(
        profile_url=link.profile_url,
        platform=link.platform,
        last_synced_at=link.last_synced_at.isoformat() if link.last_synced_at else None,
    )


@router.put("/profile-link", response_model=ProfileLinkResponse)
async def save_profile_link(
    payload: ProfileLinkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    platform = _detect_platform(payload.profile_url)
    result = await db.execute(
        select(AgentProfileLink).where(AgentProfileLink.user_id == current_user.id)
    )
    link = result.scalar_one_or_none()
    if link:
        link.profile_url = payload.profile_url
        link.platform = platform
    else:
        link = AgentProfileLink(
            user_id=current_user.id,
            profile_url=payload.profile_url,
            platform=platform,
        )
        db.add(link)
    await db.commit()
    await db.refresh(link)
    return ProfileLinkResponse(
        profile_url=link.profile_url,
        platform=link.platform,
        last_synced_at=link.last_synced_at.isoformat() if link.last_synced_at else None,
    )


# ── Listings sync ─────────────────────────────────────────────────────────────

@router.post("/listings/sync", response_model=SyncListingsResponse)
async def sync_listings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch the agent's profile page and import all listings."""
    result = await db.execute(
        select(AgentProfileLink).where(AgentProfileLink.user_id == current_user.id)
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No profile link saved. Please save your listing platform profile URL first.",
        )

    from app.services.listing_scraper import scrape_agent_listings
    from datetime import datetime, timezone

    try:
        scraped = await scrape_agent_listings(link.profile_url)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error("Listing sync error for user %s: %s", current_user.id, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not fetch listings. Please check your profile URL and try again.",
        )

    # Delete old listings for this user and re-import
    old_result = await db.execute(
        select(AgentListing).where(AgentListing.user_id == current_user.id)
    )
    for old in old_result.scalars().all():
        await db.delete(old)

    new_listings = []
    for item in scraped:
        listing = AgentListing(
            user_id=current_user.id,
            external_url=item.get("url") or None,
            title=item.get("title") or None,
            price=item.get("price") or None,
            description=item.get("description") or None,
            image_url=item.get("image") or None,
            bedrooms=item.get("bedrooms") or None,
            platform=item.get("platform") or link.platform,
        )
        db.add(listing)
        new_listings.append(listing)

    link.last_synced_at = datetime.now(timezone.utc)
    await db.commit()
    for l in new_listings:
        await db.refresh(l)

    listings_out = [
        {
            "id": str(l.id),
            "external_url": l.external_url,
            "title": l.title,
            "price": l.price,
            "description": l.description,
            "image_url": l.image_url,
            "bedrooms": l.bedrooms,
            "platform": l.platform,
        }
        for l in new_listings
    ]

    return SyncListingsResponse(count=len(listings_out), listings=listings_out)


@router.get("/listings", response_model=list[ListingOut])
async def get_listings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentListing).where(AgentListing.user_id == current_user.id)
    )
    listings = result.scalars().all()
    return [
        ListingOut(
            id=str(l.id),
            external_url=l.external_url,
            title=l.title,
            price=l.price,
            description=l.description,
            image_url=l.image_url,
            bedrooms=l.bedrooms,
            platform=l.platform,
        )
        for l in listings
    ]


# ── AI Report ─────────────────────────────────────────────────────────────────

@router.post("/ai-report", response_model=AIReportResponse)
async def generate_ai_report(
    payload: AIReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI-powered property analysis report using Groq."""
    listing_url = payload.listing_url
    listing_title = payload.listing_title
    listing_price = payload.listing_price
    listing_description = payload.listing_description
    listing_address = payload.listing_address

    # If a listing_id was provided, load from DB
    if payload.listing_id:
        try:
            lid = uuid.UUID(payload.listing_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid listing ID.")
        result = await db.execute(
            select(AgentListing).where(
                AgentListing.id == lid,
                AgentListing.user_id == current_user.id,
            )
        )
        listing = result.scalar_one_or_none()
        if listing:
            listing_url = listing_url or listing.external_url
            listing_title = listing_title or listing.title
            listing_price = listing_price or listing.price
            listing_description = listing_description or listing.description

    if not listing_url:
        raise HTTPException(status_code=400, detail="A listing URL is required to generate a report.")

    from app.services.groq_service import generate_property_report

    try:
        report = await generate_property_report(
            listing_url=listing_url,
            listing_title=listing_title,
            listing_price=listing_price,
            listing_description=listing_description,
            listing_address=listing_address,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("AI report failed for user %s: %s", current_user.id, e)
        raise HTTPException(
            status_code=503,
            detail="AI report generation failed. Please try again shortly.",
        )

    return AIReportResponse(report=report)


# ── Advanced services payment ─────────────────────────────────────────────────

@router.post("/advanced-service/checkout", response_model=AdvancedServiceResponse)
async def create_advanced_service_checkout(
    payload: AdvancedServiceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a SumUp checkout for 0.25% advanced services fee.
    Fee is rounded UP to the nearest £500 (minimum £500).
    """
    settings = get_settings()

    try:
        fee = _calculate_service_fee(payload.property_price_raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    reference = f"HAVLO-ADV-{uuid.uuid4().hex[:12].upper()}"
    listing_title = payload.listing_title or "Property"

    redirect_url = None
    if settings.FRONTEND_URL:
        redirect_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}"
            f"/dashboard/buyer-network?payment=success&type=advanced_service&ref={reference}"
        )

    try:
        checkout = await sumup_service.create_checkout(
            amount=fee,
            currency="GBP",
            description=f"Havlo Advanced Services — {listing_title} ({payload.property_price_raw})",
            reference=reference,
            redirect_url=redirect_url,
        )
    except SumUpError as exc:
        logger.error("SumUp advanced-service failed: %s body=%s", exc, exc.body)
        raise HTTPException(
            status_code=502,
            detail=f"Payment gateway error: {exc} {exc.body or ''}".strip(),
        )

    checkout_id = checkout.get("id", "")
    checkout_url = checkout.get("checkout_url", "")

    # Resolve listing_id if provided
    listing_uuid = None
    if payload.listing_id:
        try:
            listing_uuid = uuid.UUID(payload.listing_id)
        except ValueError:
            pass

    record = AgentAdvancedServicePayment(
        user_id=current_user.id,
        listing_id=listing_uuid,
        listing_url=payload.listing_url,
        listing_title=listing_title,
        property_price_raw=payload.property_price_raw,
        service_fee_amount=fee,
        currency="GBP",
        sumup_checkout_id=checkout_id,
        sumup_checkout_url=checkout_url,
        payment_status="pending",
    )
    db.add(record)

    payment = Payment(
        user_id=current_user.id,
        checkout_id=checkout_id,
        amount=fee,
        currency="GBP",
        status=PaymentStatus.pending,
        reference_type="advanced_service",
    )
    db.add(payment)
    await db.commit()
    await db.refresh(record)
    payment.reference_id = str(record.id)
    await db.commit()

    return AdvancedServiceResponse(
        payment_record_id=str(record.id),
        checkout_id=checkout_id,
        checkout_url=checkout_url,
        service_fee_amount=fee,
        currency="GBP",
        message=f"Checkout created for £{fee:,.0f} advanced services fee.",
    )


@router.get("/advanced-service/{record_id}/status", response_model=AdvancedServiceStatusResponse)
async def get_advanced_service_status(
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        rec_uuid = uuid.UUID(record_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid record ID.")

    result = await db.execute(
        select(AgentAdvancedServicePayment).where(
            AgentAdvancedServicePayment.id == rec_uuid,
            AgentAdvancedServicePayment.user_id == current_user.id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    if record.payment_status == "completed":
        return AdvancedServiceStatusResponse(
            payment_record_id=str(record.id),
            checkout_id=record.sumup_checkout_id or "",
            status="PAID",
            paid=True,
        )

    checkout_id = record.sumup_checkout_id or ""
    if checkout_id:
        try:
            checkout_data = await sumup_service.get_checkout_status(checkout_id)
            sumup_status = checkout_data.get("status", "PENDING").upper()
            paid = sumup_status == "PAID"
            if paid:
                record.payment_status = "completed"
                pay_result = await db.execute(
                    select(Payment).where(Payment.checkout_id == checkout_id)
                )
                payment = pay_result.scalar_one_or_none()
                if payment:
                    payment.status = PaymentStatus.completed
                await db.commit()
            return AdvancedServiceStatusResponse(
                payment_record_id=str(record.id),
                checkout_id=checkout_id,
                status=sumup_status,
                paid=paid,
            )
        except Exception as exc:
            logger.error("SumUp poll failed for advanced_service %s: %s", record_id, exc)

    return AdvancedServiceStatusResponse(
        payment_record_id=str(record.id),
        checkout_id=checkout_id,
        status="PENDING",
        paid=False,
    )
