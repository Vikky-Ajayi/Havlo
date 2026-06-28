"""Stale Listings — public property assessment with SumUp payment and AI report."""
from __future__ import annotations

import json
import logging
import random
import string
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import StaleListingAssessment, User
from app.schemas.schemas import (
    StaleListingAdminFinalizeRequest,
    StaleListingAdminItem,
    StaleListingListingSnapshot,
    StaleListingReportData,
    StaleListingReportResponse,
    StaleListingSubmitRequest,
    StaleListingSubmitResponse,
)
from app.services import google_sheets, sumup_service
from app.services.listing_scraper import detect_listing_platform, scrape_single_listing
from app.services.product_access import decode_stale_review_session
from app.services.sumup_service import SumUpError

logger = logging.getLogger(__name__)

SL_PACKAGES: dict[str, dict] = {
    "quick_insight":                 {"name": "Quick Insight",                 "amount": 79.99,   "currency": "GBP"},
    "professional_review":           {"name": "Professional Review",           "amount": 299.99,  "currency": "GBP"},
    "premium_strategy":              {"name": "Premium Strategy",              "amount": 1499.99, "currency": "GBP"},
    "listing_recovery_assessment":   {"name": "Listing Recovery Assessment",   "amount": 149.99,  "currency": "GBP"},
    "free_trial_assessment":         {"name": "Free Trial Assessment",         "amount": 0.00,    "currency": "GBP"},
}

public_router = APIRouter(prefix="/stale-listings", tags=["Stale Listings"])
admin_router = APIRouter(prefix="/stale-listings", tags=["Stale Listings Admin"])


def _review_preview_session(authorization: str | None) -> dict[str, str] | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    try:
        return decode_stale_review_session(token.strip())
    except ValueError:
        return None


def _generate_reference() -> str:
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=6))
    return f"SL-{suffix}"


def _snapshot_from_listing(listing: dict | None, listing_url: str = "") -> dict[str, str]:
    raw = listing or {}
    images = raw.get("images") or []
    first_image = raw.get("image") or (images[0] if isinstance(images, list) and images else "")
    return {
        "title": str(raw.get("title") or ""),
        "address": str(raw.get("address") or raw.get("title") or ""),
        "price": str(raw.get("price") or ""),
        "image": str(first_image or ""),
        "bedrooms": str(raw.get("bedrooms") or ""),
        "bathrooms": str(raw.get("bathrooms") or ""),
        "property_type": str(raw.get("property_type") or ""),
        "platform": str(raw.get("platform") or detect_listing_platform(listing_url or "")),
    }


def _snapshot_has_content(snapshot: dict[str, str]) -> bool:
    return any(
        str(snapshot.get(field) or "").strip()
        for field in ("address", "price", "image", "bedrooms", "bathrooms", "property_type", "platform")
    )


def _load_snapshot(raw_json: str | None) -> dict[str, str]:
    if not raw_json:
        return {}
    try:
        parsed = json.loads(raw_json)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _fallback_snapshot(
    listing_url: str,
    property_address: str = "",
    image_url: str = "",
) -> dict[str, str]:
    return {
        "title": "",
        "address": str(property_address or ""),
        "price": "",
        "image": str(image_url or ""),
        "bedrooms": "",
        "bathrooms": "",
        "property_type": "",
        "platform": detect_listing_platform(listing_url or ""),
    }


async def _generate_and_save_report(
    assessment_id: str,
    package: str,
    questions_data: dict,
    property_address: str,
    listing_url: str,
    first_name: str = "",
    last_name: str = "",
    email: str = "",
    reference: str = "",
    mark_in_review_on_success: bool = False,
    trigger_agent_review_email: bool = True,
) -> None:
    from app.db.database import AsyncSessionLocal
    from app.services.groq_service import generate_stale_listing_report

    # Scrape listing image if a URL was provided
    image_url = ""
    if listing_url:
        try:
            scraped = await scrape_single_listing(listing_url)
            image_url = scraped.get("image") or (scraped.get("images") or [""])[0]
            snapshot = _snapshot_from_listing(scraped, listing_url)
            logger.info("Scraped image for %s: %s", assessment_id, image_url)
        except Exception as scrape_exc:
            logger.warning("Image scrape failed for %s: %s", assessment_id, scrape_exc)
            snapshot = _fallback_snapshot(listing_url, property_address, image_url)
    else:
        snapshot = {}

    try:
        review_url = ""
        report_dict = await generate_stale_listing_report(
            package=package,
            questions_data=questions_data,
            property_address=property_address or "",
            listing_url=listing_url or "",
            listing_snapshot=snapshot,
        )
        report_json = json.dumps(report_dict)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(StaleListingAssessment).where(
                    StaleListingAssessment.id == uuid.UUID(assessment_id)
                )
            )
            assessment = result.scalar_one_or_none()
            if assessment:
                assessment.ai_report_json = report_json
                assessment.ai_report_generated_at = datetime.utcnow()
                if image_url:
                    assessment.listing_image_url = image_url
                if _snapshot_has_content(snapshot):
                    assessment.listing_snapshot_json = json.dumps(snapshot, ensure_ascii=False)
                    if not assessment.property_address and snapshot.get("address"):
                        assessment.property_address = snapshot["address"]
                if mark_in_review_on_success and assessment.report_status == "pending":
                    assessment.report_status = "in_review"
                review_recipient = (get_settings().ADMIN_NOTIFY_EMAIL or "").strip()
                review_url = ""
                if trigger_agent_review_email and review_recipient:
                    from app.services.stale_review_access import issue_stale_review_magic_link

                    review_url = await issue_stale_review_magic_link(
                        db,
                        recipient_email=review_recipient,
                        assessment_id=str(assessment.id),
                        reference=assessment.reference,
                    )
                await db.commit()
                logger.info("AI report saved for assessment %s", assessment_id)

        if trigger_agent_review_email:
            # Notify the agent that a new report needs review
            try:
                from app.services.email_service import send_stale_listing_agent_notification_sync
                import asyncio
                await asyncio.to_thread(
                    send_stale_listing_agent_notification_sync,
                    first_name,
                    last_name,
                    email,
                    reference,
                    package,
                    property_address or "",
                    listing_url or "",
                    review_url,
                )
            except Exception as email_exc:
                logger.warning("Agent notification email failed for %s: %s", assessment_id, email_exc)

    except Exception as exc:
        logger.error("AI report generation failed for %s: %s", assessment_id, exc)


async def _backfill_listing_snapshot(
    assessment_id: str,
    listing_url: str,
) -> None:
    from app.db.database import AsyncSessionLocal

    if not listing_url:
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(StaleListingAssessment).where(
                StaleListingAssessment.id == uuid.UUID(assessment_id)
            )
        )
        assessment = result.scalar_one_or_none()
        if not assessment:
            return

        try:
            scraped = await scrape_single_listing(listing_url)
            snapshot = _snapshot_from_listing(scraped, listing_url)
        except Exception as exc:
            logger.warning("Deferred listing snapshot scrape failed for %s: %s", assessment_id, exc)
            snapshot = _fallback_snapshot(
                listing_url,
                property_address=assessment.property_address or "",
                image_url=assessment.listing_image_url or "",
            )

        if not _snapshot_has_content(snapshot):
            return

        try:
            assessment.listing_snapshot_json = json.dumps(snapshot, ensure_ascii=False)
            if snapshot.get("image") and not assessment.listing_image_url:
                assessment.listing_image_url = snapshot["image"]
            if snapshot.get("address") and not assessment.property_address:
                assessment.property_address = snapshot["address"]
            await db.commit()
        except Exception as exc:
            logger.warning("Deferred listing snapshot backfill failed for %s: %s", assessment_id, exc)


@public_router.post(
    "/submit",
    response_model=StaleListingSubmitResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_stale_listing(
    payload: StaleListingSubmitRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> StaleListingSubmitResponse:
    """Submit stale listing assessment and create SumUp checkout."""
    package_info = SL_PACKAGES.get(payload.package)
    if not package_info:
        raise HTTPException(status_code=400, detail="Invalid package selected.")

    amount = float(package_info["amount"])
    currency = str(package_info["currency"])
    package_name = str(package_info["name"])

    reference = _generate_reference()

    assessment = StaleListingAssessment(
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone_country_code=payload.phone_country_code or "+44",
        phone=payload.phone,
        package=payload.package,
        property_address=payload.property_address,
        listing_url=payload.listing_url,
        questions_data=json.dumps(payload.questions_data) if payload.questions_data else "{}",
        reference=reference,
        report_status="pending",
        payment_status="pending",
    )
    db.add(assessment)
    await db.flush()
    assessment_id = str(assessment.id)

    redirect_url = (payload.redirect_url or "").rstrip("/")
    if redirect_url:
        sep = "&" if "?" in redirect_url else "?"
        redirect_url = f"{redirect_url}{sep}ref={reference}"

    checkout_url = ""
    checkout_id = ""

    if amount == 0:
        # Free plan — skip SumUp entirely and mark payment as completed immediately
        assessment.payment_status = "completed"
        await db.commit()
        background_tasks.add_task(
            _generate_and_save_report,
            assessment_id=assessment_id,
            package=payload.package,
            questions_data=payload.questions_data or {},
            property_address=payload.property_address or "",
            listing_url=payload.listing_url or "",
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            reference=reference,
        )
    else:
        try:
            checkout = await sumup_service.create_checkout(
                amount=amount,
                currency=currency,
                description=f"StaleListings {package_name} — {payload.email}",
                reference=f"SL-{uuid.uuid4().hex[:12].upper()}",
                redirect_url=redirect_url or None,
            )
            checkout_url = checkout.get("checkout_url") or checkout.get("hosted_checkout_url") or ""
            checkout_id = checkout.get("id") or ""
            if not checkout_url or not checkout_id:
                raise SumUpError("SumUp did not return a usable checkout session.")
            assessment.sumup_checkout_id = checkout_id
            assessment.sumup_checkout_url = checkout_url
        except SumUpError as exc:
            await db.rollback()
            logger.error("SumUp checkout failed for stale listing %s: %s", reference, exc)
            raise HTTPException(
                status_code=502,
                detail="Unable to create a secure payment session right now. Please try again.",
            ) from exc

        await db.commit()

        background_tasks.add_task(
            _generate_and_save_report,
            assessment_id=assessment_id,
            package=payload.package,
            questions_data=payload.questions_data or {},
            property_address=payload.property_address or "",
            listing_url=payload.listing_url or "",
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            reference=reference,
        )

    background_tasks.add_task(
        google_sheets.record_stale_listing,
        {
            "assessment_id": assessment_id,
            "reference": reference,
            "email": payload.email,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "phone_country_code": payload.phone_country_code or "+44",
            "phone": payload.phone,
            "package": payload.package,
            "property_address": payload.property_address or "",
            "listing_url": payload.listing_url or "",
            "payment_status": "pending",
            "report_status": "pending",
        },
    )

    return StaleListingSubmitResponse(
        assessment_id=assessment_id,
        reference=reference,
        checkout_url=assessment.sumup_checkout_url or "",
        checkout_id=assessment.sumup_checkout_id or "",
        amount=amount,
        message=f"Assessment submitted. Reference: {reference}.",
    )


@public_router.get("/report/{reference}", response_model=StaleListingReportResponse)
async def get_stale_listing_report(
    reference: str,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> StaleListingReportResponse:
    """Fetch report by reference code."""
    result = await db.execute(
        select(StaleListingAssessment).where(
            StaleListingAssessment.reference == reference.upper()
        )
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")

    snapshot_data = _load_snapshot(assessment.listing_snapshot_json)
    needs_snapshot = bool(assessment.listing_url) and not _snapshot_has_content(snapshot_data)
    if needs_snapshot:
        background_tasks.add_task(
            _backfill_listing_snapshot,
            assessment_id=str(assessment.id),
            listing_url=assessment.listing_url or "",
        )

    review_session = _review_preview_session(authorization)
    is_review_preview = bool(
        review_session
        and review_session.get("assessment_id") == str(assessment.id)
        and review_session.get("reference") == assessment.reference
    )

    report_data = None
    raw_json = assessment.agent_edited_report_json or assessment.ai_report_json
    if raw_json and (assessment.report_status == "completed" or is_review_preview):
        try:
            parsed = json.loads(raw_json)
            report_data = StaleListingReportData(**parsed)
        except Exception as exc:
            logger.warning("Failed to parse report JSON for %s: %s", reference, exc)

    return StaleListingReportResponse(
        assessment_id=str(assessment.id),
        reference=assessment.reference,
        email=assessment.email,
        package=assessment.package,
        property_address=assessment.property_address,
        listing_url=assessment.listing_url,
        listing_image_url=assessment.listing_image_url,
        listing_snapshot=StaleListingListingSnapshot(**snapshot_data) if snapshot_data else None,
        report_status=assessment.report_status,
        payment_status=assessment.payment_status,
        report_data=report_data,
        preview_mode=is_review_preview,
        agent_notes=assessment.agent_notes,
        created_at=assessment.created_at.isoformat() if assessment.created_at else "",
    )


@public_router.post("/payment-verify/{reference}")
async def verify_stale_listing_payment(
    reference: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Poll SumUp to verify and update payment status."""
    result = await db.execute(
        select(StaleListingAssessment).where(
            StaleListingAssessment.reference == reference.upper()
        )
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")

    if assessment.payment_status == "completed":
        return {"payment_status": "completed", "reference": reference}

    if not assessment.sumup_checkout_id:
        return {"payment_status": assessment.payment_status, "reference": reference}

    try:
        checkout_data = await sumup_service.get_checkout_status(assessment.sumup_checkout_id)
        sumup_status = (checkout_data.get("status") or "").upper()
        if sumup_status == "PAID":
            assessment.payment_status = "completed"
            await db.commit()
            return {"payment_status": "completed", "reference": reference}
        elif sumup_status in ("FAILED", "EXPIRED"):
            assessment.payment_status = "failed"
            await db.commit()
            return {"payment_status": "failed", "reference": reference}
    except SumUpError as exc:
        logger.error("SumUp verification failed for %s: %s", reference, exc)

    return {"payment_status": assessment.payment_status, "reference": reference}


@admin_router.get("/admin", response_model=list[StaleListingAdminItem])
async def list_stale_listings_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[StaleListingAdminItem]:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    result = await db.execute(
        select(StaleListingAssessment).order_by(StaleListingAssessment.created_at.desc())
    )
    assessments = result.scalars().all()
    return [
        StaleListingAdminItem(
            assessment_id=str(a.id),
            reference=a.reference,
            email=a.email,
            first_name=a.first_name,
            last_name=a.last_name,
            package=a.package,
            property_address=a.property_address,
            listing_url=a.listing_url,
            listing_image_url=a.listing_image_url,
            questions_data=a.questions_data,
            report_status=a.report_status,
            payment_status=a.payment_status,
            created_at=a.created_at.isoformat() if a.created_at else "",
            ai_report_json=a.ai_report_json,
            agent_edited_report_json=a.agent_edited_report_json,
            agent_notes=a.agent_notes,
        )
        for a in assessments
    ]


@admin_router.put("/admin/{assessment_id}/finalize")
async def finalize_stale_listing_report(
    assessment_id: str,
    payload: StaleListingAdminFinalizeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

    result = await db.execute(
        select(StaleListingAssessment).where(
            StaleListingAssessment.id == uuid.UUID(assessment_id)
        )
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")

    if payload.agent_notes is not None:
        assessment.agent_notes = payload.agent_notes
    if payload.agent_edited_report_json is not None:
        assessment.agent_edited_report_json = payload.agent_edited_report_json

    prev_status = assessment.report_status
    assessment.report_status = payload.report_status
    await db.commit()

    if payload.report_status == "completed" and prev_status != "completed":
        from app.services.email_service import send_stale_listing_report_ready_sync
        background_tasks.add_task(
            send_stale_listing_report_ready_sync,
            to_email=assessment.email,
            first_name=assessment.first_name,
            reference=assessment.reference,
        )

    return {"ok": True, "report_status": assessment.report_status}


@admin_router.post("/admin/{assessment_id}/mark-paid")
async def mark_stale_listing_paid(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Manually mark an assessment payment as completed (for testing / manual payments)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    result = await db.execute(
        select(StaleListingAssessment).where(
            StaleListingAssessment.id == uuid.UUID(assessment_id)
        )
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    assessment.payment_status = "completed"
    await db.commit()
    return {"ok": True, "payment_status": "completed", "reference": assessment.reference}


@admin_router.delete("/admin/{assessment_id}")
async def delete_stale_listing(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    result = await db.execute(
        select(StaleListingAssessment).where(
            StaleListingAssessment.id == uuid.UUID(assessment_id)
        )
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    await db.delete(assessment)
    await db.commit()
    return {"ok": True}
