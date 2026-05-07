"""Agent dashboard router — listings sync, AI report, advanced services payment."""
from __future__ import annotations

import json
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
    address: str | None
    price: str | None
    description: str | None
    image_url: str | None
    images: list[str]
    bedrooms: str | None
    bathrooms: str | None
    property_type: str | None
    listed_date: str | None
    features: list[str]
    floor_area: str | None
    platform: str | None
    ai_report: str | None
    ai_report_generated_at: str | None


class ScrapeUrlRequest(BaseModel):
    url: str = Field(..., min_length=10, max_length=2000)


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


class ManualListingRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    price: str | None = Field(None, max_length=100)
    bedrooms: str | None = Field(None, max_length=50)
    bathrooms: str | None = Field(None, max_length=50)
    address: str | None = Field(None, max_length=500)
    property_type: str | None = Field(None, max_length=100)
    listed_date: str | None = Field(None, max_length=100)
    floor_area: str | None = Field(None, max_length=100)
    description: str | None = None
    external_url: str | None = Field(None, max_length=2000)
    image_url: str | None = Field(None, max_length=2000)
    images: list[str] | None = None
    features: list[str] | None = None


class UpdateListingRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    price: str | None = Field(None, max_length=100)
    bedrooms: str | None = Field(None, max_length=50)
    bathrooms: str | None = Field(None, max_length=50)
    address: str | None = Field(None, max_length=500)
    property_type: str | None = Field(None, max_length=100)
    listed_date: str | None = Field(None, max_length=100)
    floor_area: str | None = Field(None, max_length=100)
    description: str | None = None
    external_url: str | None = Field(None, max_length=2000)
    image_url: str | None = Field(None, max_length=2000)


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


class ActivatedListingOut(BaseModel):
    payment_record_id: str
    listing_id: str | None
    listing_url: str | None
    listing_title: str | None
    service_fee_amount: float
    activated_at: str


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
    clean = re.sub(r"[^\d.]", "", price_raw)
    try:
        return float(clean) if clean else None
    except ValueError:
        return None


def _calculate_service_fee(price_raw: str) -> float:
    price = _parse_price_to_float(price_raw)
    if not price or price <= 0:
        raise ValueError(f"Could not parse a valid price from: {price_raw!r}")
    raw_fee = price * 0.0025
    rounding = 500
    return float(max(rounding, (int(raw_fee / rounding) + (1 if raw_fee % rounding > 0 else 0)) * rounding))


def _listing_to_out(l: AgentListing) -> ListingOut:
    images: list[str] = []
    if l.images_json:
        try:
            images = json.loads(l.images_json)
        except Exception:
            pass
    if not images and l.image_url:
        images = [l.image_url]

    features: list[str] = []
    if l.features_json:
        try:
            features = json.loads(l.features_json)
        except Exception:
            pass

    return ListingOut(
        id=str(l.id),
        external_url=l.external_url,
        title=l.title,
        address=l.address,
        price=l.price,
        description=l.description,
        image_url=images[0] if images else l.image_url,
        images=images,
        bedrooms=l.bedrooms,
        bathrooms=l.bathrooms,
        property_type=l.property_type,
        listed_date=l.listed_date,
        features=features,
        floor_area=l.floor_area,
        platform=l.platform,
        ai_report=l.ai_report,
        ai_report_generated_at=l.ai_report_generated_at.isoformat() if l.ai_report_generated_at else None,
    )


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

    # Delete old listings and re-import fresh
    old_result = await db.execute(
        select(AgentListing).where(AgentListing.user_id == current_user.id)
    )
    for old in old_result.scalars().all():
        await db.delete(old)

    new_listings: list[AgentListing] = []
    for item in scraped:
        images = item.get("images") or []
        features = item.get("features") or []
        listing = AgentListing(
            user_id=current_user.id,
            external_url=item.get("url") or None,
            title=item.get("title") or None,
            address=item.get("address") or None,
            price=item.get("price") or None,
            description=item.get("description") or None,
            image_url=images[0] if images else (item.get("image") or None),
            images_json=json.dumps(images) if images else None,
            bedrooms=item.get("bedrooms") or None,
            bathrooms=item.get("bathrooms") or None,
            property_type=item.get("property_type") or None,
            listed_date=item.get("listed_date") or None,
            features_json=json.dumps(features) if features else None,
            floor_area=item.get("floor_area") or None,
            platform=item.get("platform") or link.platform,
        )
        db.add(listing)
        new_listings.append(listing)

    link.last_synced_at = datetime.now(timezone.utc)
    await db.commit()
    for lst in new_listings:
        await db.refresh(lst)

    listings_out = [_listing_to_out(lst).model_dump() for lst in new_listings]
    return SyncListingsResponse(count=len(listings_out), listings=listings_out)


@router.get("/listings", response_model=list[ListingOut])
async def get_listings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentListing).where(AgentListing.user_id == current_user.id)
    )
    return [_listing_to_out(l) for l in result.scalars().all()]


@router.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(
    listing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a listing owned by the current agent."""
    result = await db.execute(
        select(AgentListing).where(
            AgentListing.id == listing_id,
            AgentListing.user_id == current_user.id,
        )
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")
    await db.delete(listing)
    await db.commit()


@router.patch("/listings/{listing_id}", response_model=ListingOut)
async def update_listing(
    listing_id: str,
    payload: UpdateListingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update editable fields on an existing listing."""
    try:
        lid = uuid.UUID(listing_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid listing ID.")
    result = await db.execute(
        select(AgentListing).where(
            AgentListing.id == lid,
            AgentListing.user_id == current_user.id,
        )
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "image_url" and value:
            listing.image_url = value
            import json as _json
            listing.images_json = _json.dumps([value])
        else:
            setattr(listing, field, value or None)

    await db.commit()
    await db.refresh(listing)
    return _listing_to_out(listing)


@router.post("/listings/manual", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
async def add_manual_listing(
    payload: ManualListingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a single listing manually (no portal sync required)."""
    images = payload.images or ([payload.image_url] if payload.image_url else [])
    features = payload.features or []
    listing = AgentListing(
        user_id=current_user.id,
        external_url=payload.external_url or None,
        title=payload.title,
        address=payload.address or None,
        price=payload.price or None,
        description=payload.description or None,
        image_url=images[0] if images else None,
        images_json=json.dumps(images) if images else None,
        bedrooms=payload.bedrooms or None,
        bathrooms=payload.bathrooms or None,
        property_type=payload.property_type or None,
        listed_date=payload.listed_date or None,
        features_json=json.dumps(features) if features else None,
        floor_area=payload.floor_area or None,
        platform="manual",
    )
    db.add(listing)
    await db.commit()
    await db.refresh(listing)
    return _listing_to_out(listing)


@router.post("/listings/scrape-url", response_model=dict)
async def scrape_listing_url(
    payload: ScrapeUrlRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Scrape a single property listing URL and return all extracted details.
    Used by the 'Paste a link' tab in the Add Listing modal.
    Does NOT save to the database — call /listings/manual afterwards to save.
    """
    from app.services.listing_scraper import scrape_single_listing

    try:
        data = await scrape_single_listing(payload.url)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error("Scrape-url error for user %s url=%s: %s", current_user.id, payload.url, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not fetch the listing. Please check the URL and try again.",
        )

    return {
        "title": data.get("title") or "",
        "address": data.get("address") or "",
        "price": data.get("price") or "",
        "description": data.get("description") or "",
        "images": data.get("images") or [],
        "image_url": data.get("image") or (data.get("images") or [""])[0],
        "bedrooms": data.get("bedrooms") or "",
        "bathrooms": data.get("bathrooms") or "",
        "property_type": data.get("property_type") or "",
        "listed_date": data.get("listed_date") or "",
        "features": data.get("features") or [],
        "floor_area": data.get("floor_area") or "",
        "platform": data.get("platform") or "",
        "external_url": payload.url,
        "blocked": bool(data.get("blocked")),
    }


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

    db_listing = None
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
        db_listing = result.scalar_one_or_none()
        if db_listing:
            listing_url = listing_url or db_listing.external_url
            listing_title = listing_title or db_listing.title
            listing_price = listing_price or db_listing.price
            listing_description = listing_description or db_listing.description
            listing_address = listing_address or db_listing.address

    if not listing_url:
        raise HTTPException(status_code=400, detail="A listing URL is required to generate a report.")

    from app.services.groq_service import generate_property_report
    from datetime import datetime, timezone

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

    if db_listing is not None:
        db_listing.ai_report = report
        db_listing.ai_report_generated_at = datetime.now(timezone.utc)
        await db.commit()

    return AIReportResponse(report=report)


# ── Advanced services payment ─────────────────────────────────────────────────

@router.post("/advanced-service/checkout", response_model=AdvancedServiceResponse)
async def create_advanced_service_checkout(
    payload: AdvancedServiceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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


@router.get("/activated-listings", response_model=list[ActivatedListingOut])
async def get_activated_listings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentAdvancedServicePayment).where(
            AgentAdvancedServicePayment.user_id == current_user.id,
            AgentAdvancedServicePayment.payment_status == "completed",
        )
    )
    records = result.scalars().all()
    return [
        ActivatedListingOut(
            payment_record_id=str(r.id),
            listing_id=str(r.listing_id) if r.listing_id else None,
            listing_url=r.listing_url,
            listing_title=r.listing_title,
            service_fee_amount=r.service_fee_amount,
            activated_at=r.created_at.isoformat(),
        )
        for r in records
    ]


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
