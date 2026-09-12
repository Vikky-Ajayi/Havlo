"""Stale Listings — public property assessment with SumUp payment and AI report."""
from __future__ import annotations

import csv
import io
import json
import asyncio
import logging
import random
import re
import string
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, HTMLResponse, Response
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import (
    StaleListingAssessment,
    StaleListingDiscoveryRun,
    StaleListingProspect,
    StaleProspectAbandonmentEmail,
    StaleProspectAbandonmentSms,
    User,
)
from app.schemas.schemas import (
    AgencyPricingRequest,
    StaleProspectAbandonedItem,
    StaleProspectAbandonedResponse,
    StaleProspectAdminCreateRequest,
    StaleProspectAdminCreateResponse,
    StaleProspectCheckoutRequest,
    StaleProspectCheckoutResponse,
    StaleProspectConfirmRequest,
    StaleProspectConfirmResponse,
    StaleProspectConsoleAddressEditRequest,
    StaleProspectConsoleDetail,
    StaleProspectConsoleEditRequest,
    StaleProspectConsoleListItem,
    StaleProspectConsoleListResponse,
    StaleProspectConsoleTreatedRequest,
    StaleProspectDetailsRequest,
    StaleProspectDetailsResponse,
    StaleProspectDiscoveryRunRequest,
    StaleProspectDiscoveryRunResponse,
    StaleProspectLettersZipRequest,
    StaleProspectLookupRequest,
    StaleProspectPreviewResponse,
    StaleProspectReportResponse,
    StaleListingAdminFinalizeRequest,
    StaleListingAdminItem,
    StaleListingListingSnapshot,
    StaleListingPromoVerifyRequest,
    StaleListingPromoVerifyResponse,
    StaleListingReportData,
    StaleListingReportResponse,
    StaleListingSubmitRequest,
    StaleListingSubmitResponse,
)
from app.services import email_service, google_sheets, sumup_service
from app.services.listing_scraper import detect_listing_platform, scrape_single_listing
from app.services.product_access import decode_stale_review_session
from app.services.stale_prospect_service import (
    address_with_full_postcode,
    create_access_token,
    create_prospect_from_listing_snapshot,
    current_report_json,
    expand_report_in_background,
    extract_price,
    generate_full_report_pdf,
    generate_letter_pdf,
    hash_access_token,
    is_report_expanded,
    normalize_property_code,
    parse_listed_date,
    serialize_preview,
    serialize_report,
    send_prospect_letter_to_admin,
    sms_unsubscribe_short_token,
    snapshot_from_scrape,
    verify_sms_unsubscribe_short_token,
    verify_unsubscribe_token,
)
from app.services.stale_listing_discovery import (
    KNOWN_LOCATIONS,
    DiscoveryParams,
    build_letters_zip_for_run,
    ensure_letter_pdf_path,
    is_target_property_type,
    run_bulk_csv_upload,
    run_discovery,
    serialize_discovery_run,
)
from app.services.sumup_service import SumUpError

logger = logging.getLogger(__name__)

SL_PACKAGES: dict[str, dict] = {
    # The single flagship offering as of the pricing-section redesign — the
    # /stale-listings/seller marketing page and the /stale-listings/plan
    # checkout step both now sell only this. quick_insight and
    # professional_review are kept below (never offered by either page
    # anymore) purely so existing historical orders still resolve a package
    # name/amount correctly — do not remove them.
    "property_sale_assessment":      {"name": "Havlo Property Sale Assessment", "amount": 499.99,  "currency": "GBP"},
    "quick_insight":                 {"name": "Quick Insight",                 "amount": 79.99,   "currency": "GBP"},
    "professional_review":           {"name": "Professional Review",           "amount": 299.99,  "currency": "GBP"},
    "premium_strategy":              {"name": "Premium Strategy",              "amount": 1499.99, "currency": "GBP"},
    "listing_recovery_assessment":   {"name": "Listing Recovery Assessment",   "amount": 149.99,  "currency": "GBP"},
    "free_trial_assessment":         {"name": "Free Trial Assessment",         "amount": 0.00,    "currency": "GBP"},
}


def _stale_prospect_checkout_amount(asking_price: float | None) -> float:
    """Full-report checkout price for a letter prospect, tiered by asking price.

    - >= GBP 1,000,000: GBP 499.99
    - GBP 700,001 - 999,999.99: GBP 399.99
    - GBP 500,000 - 700,000: GBP 299.99
    - below GBP 500,000: the original flat listing_recovery_assessment price.
      Automated discovery no longer scrapes anything under GBP 500,000 (see
      DiscoveryParams.min_price), so this only applies to prospects created
      before that floor was raised — kept as-is rather than silently
      repricing a backlog letter that already went out at the old price.
    """
    price = float(asking_price or 0)
    if price >= 1_000_000:
        return 499.99
    if price > 700_000:
        return 399.99
    if price >= 500_000:
        return 299.99
    return float(SL_PACKAGES["listing_recovery_assessment"]["amount"])

public_router = APIRouter(prefix="/stale-listings", tags=["Stale Listings"])
admin_router = APIRouter(prefix="/stale-listings", tags=["Stale Listings Admin"])
# No prefix at all (mounted directly on `app` in main.py, not under
# API_PREFIX) — exclusively for links that have to fit inside an SMS.
# heyhavlo.com/u/<code>?t=<token> versus .../api/v1/stale-listings/
# prospects/unsubscribe-sms?prospect_id=<uuid>&token=<32 chars> is the
# difference between ~35 characters and 140+ eaten out of a 160-char
# segment before the message body even starts.
short_router = APIRouter(tags=["Stale Listings — short links"])


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


def _promo_code_valid(package: str, code: str | None) -> bool:
    """Check a submitted promo code against the configured value for a package."""
    if package != "listing_recovery_assessment":
        return False
    configured = get_settings().LISTING_RECOVERY_PROMO_CODE.strip()
    submitted = (code or "").strip()
    if not configured or not submitted:
        return False
    return submitted.upper() == configured.upper()


def _stale_prospect_promo_valid(code: str | None) -> bool:
    """Check a submitted promo code for the automated stale-prospect unlock.

    Separate from `_promo_code_valid` above (that one only applies to the
    older "listing_recovery_assessment" submit form) — this is a distinct
    100%-off code for the QR-code / property-code report unlock flow, mainly
    so we can pull up any listing's full report for review without paying.
    """
    configured = get_settings().STALE_PROSPECT_PROMO_CODE.strip()
    submitted = (code or "").strip()
    if not configured or not submitted:
        return False
    return submitted.upper() == configured.upper()


@public_router.post(
    "/verify-promo",
    response_model=StaleListingPromoVerifyResponse,
)
async def verify_stale_listing_promo(
    payload: StaleListingPromoVerifyRequest,
) -> StaleListingPromoVerifyResponse:
    """Verify a promo code for a stale listing package without submitting."""
    if _promo_code_valid(payload.package, payload.code):
        return StaleListingPromoVerifyResponse(valid=True, message="Promo code applied — this plan is now free.")
    return StaleListingPromoVerifyResponse(valid=False, message="That promo code is not valid.")


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

    promo_applied = False
    if amount > 0 and payload.promo_code and _promo_code_valid(payload.package, payload.promo_code):
        amount = 0.0
        promo_applied = True

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
            "payment_status": assessment.payment_status,
            "report_status": "pending",
            "promo_applied": "yes" if promo_applied else "no",
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


def _frontend_base_url() -> str:
    return (get_settings().FRONTEND_URL or "https://www.heyhavlo.com").rstrip("/")


async def _get_prospect_by_access(
    db: AsyncSession,
    *,
    token: str | None = None,
    property_code: str | None = None,
) -> StaleListingProspect:
    stmt = None
    if token and token.strip():
        stmt = select(StaleListingProspect).where(
            StaleListingProspect.qr_token_hash == hash_access_token(token.strip())
        )
    else:
        code = normalize_property_code(property_code)
        if len(code) == 4:
            stmt = select(StaleListingProspect).where(StaleListingProspect.property_code == code)
    if stmt is None:
        raise HTTPException(status_code=404, detail="We could not find that property assessment.")
    result = await db.execute(stmt)
    prospect = result.scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=404, detail="We could not find that property assessment.")
    if prospect.code_looked_up_at is None:
        prospect.code_looked_up_at = datetime.utcnow()
        await db.commit()
    return prospect


@public_router.post("/prospects/lookup", response_model=StaleProspectPreviewResponse)
async def lookup_stale_prospect(
    payload: StaleProspectLookupRequest,
    db: AsyncSession = Depends(get_db),
) -> StaleProspectPreviewResponse:
    prospect = await _get_prospect_by_access(db, property_code=payload.property_code)
    return StaleProspectPreviewResponse(**serialize_preview(prospect))


@public_router.get("/prospects/preview", response_model=StaleProspectPreviewResponse)
async def get_stale_prospect_preview(
    token: str | None = Query(default=None),
    code: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> StaleProspectPreviewResponse:
    prospect = await _get_prospect_by_access(db, token=token, property_code=code)
    return StaleProspectPreviewResponse(**serialize_preview(prospect))


@public_router.post("/prospects/confirm", response_model=StaleProspectConfirmResponse)
async def confirm_stale_prospect_property(
    payload: StaleProspectConfirmRequest,
    db: AsyncSession = Depends(get_db),
) -> StaleProspectConfirmResponse:
    """"Yes, this is my property" on the Confirm Property step. "No, try
    another ID" needs no backend call — the frontend just resets to the
    Landing step — so this only ever records a positive confirmation."""
    prospect = await _get_prospect_by_access(
        db, token=payload.token, property_code=payload.property_code
    )
    if prospect.property_confirmed_at is None:
        prospect.property_confirmed_at = datetime.utcnow()
        await db.commit()
    return StaleProspectConfirmResponse(
        prospect_id=str(prospect.id), property_code=prospect.property_code, confirmed=True
    )


@public_router.post("/prospects/details", response_model=StaleProspectDetailsResponse)
async def submit_stale_prospect_details(
    payload: StaleProspectDetailsRequest,
    db: AsyncSession = Depends(get_db),
) -> StaleProspectDetailsResponse:
    """The "Your Details" step. Re-checks email/confirm-email match
    server-side even though the frontend already does — never trust a
    client-side-only check for data we're about to store and email."""
    if payload.email.lower() != payload.confirm_email.lower():
        raise HTTPException(status_code=400, detail="Email and confirm email must match.")
    prospect = await _get_prospect_by_access(
        db, token=payload.token, property_code=payload.property_code
    )
    prospect.contact_name = payload.full_name.strip()[:200]
    prospect.contact_email = str(payload.email).strip().lower()[:255]
    prospect.contact_phone = payload.mobile_number.strip()[:50]
    # Anchor for the pre-purchase / cart-abandonment email drip — set once,
    # never reset by a later edit of the same details.
    if prospect.contact_details_submitted_at is None:
        prospect.contact_details_submitted_at = datetime.utcnow()
    await db.commit()
    return StaleProspectDetailsResponse(
        prospect_id=str(prospect.id),
        property_code=prospect.property_code,
        contact_name=prospect.contact_name,
    )


@public_router.post("/prospects/checkout", response_model=StaleProspectCheckoutResponse)
async def create_stale_prospect_checkout(
    payload: StaleProspectCheckoutRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> StaleProspectCheckoutResponse:
    prospect = await _get_prospect_by_access(
        db,
        token=payload.token,
        property_code=payload.property_code,
    )
    package = SL_PACKAGES["listing_recovery_assessment"]
    amount = _stale_prospect_checkout_amount(prospect.asking_price)
    currency = str(package["currency"])
    frontend = _frontend_base_url()
    access_key = f"token={payload.token.strip()}" if payload.token else f"code={prospect.property_code}"
    redirect_url = (payload.redirect_url or f"{frontend}/stale-listings/prospect/complete").rstrip("/")
    sep = "&" if "?" in redirect_url else "?"
    redirect_url = f"{redirect_url}{sep}{access_key}"

    if prospect.payment_status == "completed":
        # Covers a stale "Unlock" button click after the prospect was already
        # unlocked elsewhere (another tab, a retried request). Give the
        # expansion another chance in case an earlier attempt failed silently
        # — ensure_expanded_report/is_report_expanded make this a no-op if
        # it's already done.
        background_tasks.add_task(expand_report_in_background, str(prospect.id))
        return StaleProspectCheckoutResponse(
            prospect_id=str(prospect.id),
            property_code=prospect.property_code,
            checkout_url=redirect_url,
            checkout_id=prospect.sumup_checkout_id or "",
            amount=amount,
            currency=currency,
            unlocked=True,
        )

    if _stale_prospect_promo_valid(payload.promo_code):
        prospect.payment_status = "completed"
        prospect.unlocked_at = datetime.utcnow()
        await db.commit()
        logger.info("Stale prospect %s unlocked via promo code (no payment taken).", prospect.property_code)
        # Kick off the full-detail report generation now, in the background,
        # so it has a head start before the browser reaches the report page
        # instead of that page blocking on the LLM call itself.
        background_tasks.add_task(expand_report_in_background, str(prospect.id))
        return StaleProspectCheckoutResponse(
            prospect_id=str(prospect.id),
            property_code=prospect.property_code,
            checkout_url=redirect_url,
            checkout_id="",
            amount=0.0,
            currency=currency,
            unlocked=True,
        )

    if payload.payment_method == "bank_transfer":
        reference = prospect.bank_transfer_reference or f"SLP-{prospect.property_code}-{uuid.uuid4().hex[:6].upper()}"
        prospect.payment_method = "bank_transfer"
        prospect.bank_transfer_reference = reference
        prospect.payment_status = "awaiting_bank_transfer"
        await db.commit()
        settings = get_settings()
        return StaleProspectCheckoutResponse(
            prospect_id=str(prospect.id),
            property_code=prospect.property_code,
            checkout_url="",
            checkout_id="",
            amount=amount,
            currency=currency,
            payment_method="bank_transfer",
            bank_transfer_reference=reference,
            bank_transfer_account_name=settings.BANK_TRANSFER_ACCOUNT_NAME,
            bank_transfer_account_number=settings.BANK_TRANSFER_ACCOUNT_NUMBER,
            bank_transfer_bank_name=settings.BANK_TRANSFER_BANK_NAME,
        )

    try:
        checkout = await sumup_service.create_checkout(
            amount=amount,
            currency=currency,
            description=f"StaleListings full report unlock - {prospect.property_code}",
            reference=f"SLP-{prospect.property_code}-{uuid.uuid4().hex[:8].upper()}",
            redirect_url=redirect_url,
        )
    except SumUpError as exc:
        logger.error("SumUp checkout failed for stale prospect %s: %s", prospect.property_code, exc)
        raise HTTPException(
            status_code=502,
            detail="Unable to create a secure payment session right now. Please try again.",
        ) from exc

    checkout_url = checkout.get("checkout_url") or checkout.get("hosted_checkout_url") or ""
    checkout_id = checkout.get("id") or ""
    if not checkout_url or not checkout_id:
        raise HTTPException(status_code=502, detail="Payment provider did not return a checkout link.")

    prospect.sumup_checkout_id = checkout_id
    prospect.sumup_checkout_url = checkout_url
    prospect.payment_status = "pending"
    prospect.payment_method = "card"
    await db.commit()
    return StaleProspectCheckoutResponse(
        prospect_id=str(prospect.id),
        property_code=prospect.property_code,
        checkout_url=checkout_url,
        checkout_id=checkout_id,
        amount=amount,
        currency=currency,
    )


@public_router.get("/prospects/payment-status")
async def get_stale_prospect_payment_status(
    background_tasks: BackgroundTasks,
    token: str | None = Query(default=None),
    code: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    prospect = await _get_prospect_by_access(db, token=token, property_code=code)
    if prospect.payment_status == "completed":
        return {"payment_status": "completed", "property_code": prospect.property_code}
    if not prospect.sumup_checkout_id:
        return {"payment_status": prospect.payment_status, "property_code": prospect.property_code}
    try:
        checkout_data = await sumup_service.get_checkout_status(prospect.sumup_checkout_id)
        sumup_status = (checkout_data.get("status") or "").upper()
        if sumup_status == "PAID":
            prospect.payment_status = "completed"
            prospect.unlocked_at = datetime.utcnow()
            await db.commit()
            # Same head start as the promo path — SumUp confirmation is the
            # other moment a prospect actually becomes unlocked.
            background_tasks.add_task(expand_report_in_background, str(prospect.id))
        elif sumup_status in {"FAILED", "EXPIRED"}:
            prospect.payment_status = "failed"
            await db.commit()
    except SumUpError as exc:
        logger.error("SumUp verification failed for stale prospect %s: %s", prospect.property_code, exc)
    return {"payment_status": prospect.payment_status, "property_code": prospect.property_code}


@public_router.get("/prospects/report", response_model=StaleProspectReportResponse)
async def get_stale_prospect_report(
    background_tasks: BackgroundTasks,
    token: str | None = Query(default=None),
    code: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> StaleProspectReportResponse:
    prospect = await _get_prospect_by_access(db, token=token, property_code=code)
    if prospect.payment_status != "completed":
        raise HTTPException(status_code=402, detail="This full report is locked until payment is complete.")
    # This used to await the LLM expansion inline, which is exactly why the
    # page took a long time to load — the browser sat on a multi-second Groq
    # round trip before anything could render. Serve whatever's already
    # there immediately; if it hasn't been expanded yet (e.g. this is the
    # very first load right after unlocking, or the unlock happened on a
    # different device/session that never scheduled it), schedule it in the
    # background and let the next load/refresh pick up the richer version.
    if not is_report_expanded(prospect):
        background_tasks.add_task(expand_report_in_background, str(prospect.id))
    return StaleProspectReportResponse(**serialize_report(prospect))


_OUTCODE_ONLY_RE = re.compile(r"^[A-Z]{1,2}\d[A-Z\d]?$", re.IGNORECASE)


def _derive_postcode_and_city(address: str) -> tuple[str | None, str | None]:
    """Best-effort postcode/city extraction from a free-text address, purely
    to populate the denormalised postcode/city columns (search/filtering,
    the console's location dropdown) — property_address itself always keeps
    the exact text it was given. Shared by every write path that takes a
    hand-typed or edited address (manual-create, console address edit).

    Guards against the one failure mode confirmed live: an address ending
    in a bare postcode OUTCODE with no incode ("...Inverness, IV2") has no
    full postcode for the `postcode and postcode in last` branch to match,
    so `last` — "IV2" itself — fell through as the "city" once instead of
    the town before it. That's not a rare shape: it's the norm for
    automated-discovery addresses, whose displayAddress is exactly "street,
    town, OUTCODE". Reject a last-part that is itself just an outcode and
    fall back to the part before it instead.
    """
    postcode_match = re.search(r"[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}", address, re.IGNORECASE)
    postcode = postcode_match.group(0).upper() if postcode_match else None
    city = None
    address_parts = [p.strip() for p in address.split(",") if p.strip()]
    if address_parts:
        last = address_parts[-1]
        if postcode and postcode.replace(" ", "") in last.replace(" ", "").upper():
            remainder = re.sub(re.escape(postcode), "", last, flags=re.IGNORECASE).strip(" ,")
            city = remainder or (address_parts[-2] if len(address_parts) >= 2 else None)
        elif _OUTCODE_ONLY_RE.match(last):
            city = address_parts[-2] if len(address_parts) >= 2 else None
        else:
            city = last
    return postcode, city


@public_router.post("/prospects-console/prospects/manual", response_model=StaleProspectAdminCreateResponse)
async def create_stale_prospect_manually(
    payload: StaleProspectAdminCreateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> StaleProspectAdminCreateResponse:
    """Ops console manual-create: for a listing that meets every automated
    discovery criterion except having a scrapeable postal-quality address
    (see is_specific_address). The admin supplies the real address by hand,
    as free text, so it's trusted outright and used verbatim rather than
    re-validated the way an auto-scraped displayAddress would be.
    Everything else (price, days on market, property type) comes from
    scraping the listing, same as the automated pipeline — an admin
    correcting a bad address shouldn't also have to retype numbers the
    listing already states correctly.

    Deliberately unauthenticated — see the ops console page itself for why.
    """
    existing = await db.execute(
        select(StaleListingProspect).where(StaleListingProspect.rightmove_url == str(payload.rightmove_url))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This Rightmove listing has already been prospected.")

    try:
        scraped = await scrape_single_listing(str(payload.rightmove_url))
    except Exception as exc:
        logger.warning("Prospect scrape failed for %s: %s", payload.rightmove_url, exc)
        scraped = {}

    snapshot = snapshot_from_scrape(scraped, str(payload.rightmove_url))
    address = payload.address.strip()

    # Best-effort postcode/city extraction from the free-text address, purely
    # to populate the denormalised postcode/city columns (search/filtering) —
    # property_address itself always uses the admin's exact typed text.
    postcode, city = _derive_postcode_and_city(address)
    if postcode:
        snapshot["postcode"] = postcode

    price = extract_price(snapshot.get("price"))
    if price is None or price < 500000:
        raise HTTPException(
            status_code=400,
            detail="Could not read an asking price above GBP 500,000 from this listing — check the Rightmove URL scraped correctly.",
        )
    if not is_target_property_type(snapshot.get("property_type") or ""):
        raise HTTPException(
            status_code=400,
            detail="Prospect must be a detached, semi-detached, or terraced house — flats, apartments, and other property types are not targeted.",
        )

    listed_date = parse_listed_date(snapshot.get("listed_date"))
    duration_days = (datetime.now(timezone.utc) - listed_date).days if listed_date else None
    if duration_days is None or duration_days < 180:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not read a listed date from this listing to confirm it's been on the market 6+ months — "
                "check the Rightmove URL scraped correctly."
                if duration_days is None
                else "Prospect must have been listed for at least 6 months."
            ),
        )

    prospect, token, letter_path = await create_prospect_from_listing_snapshot(
        db,
        rightmove_url=str(payload.rightmove_url),
        property_address=address,
        listing_snapshot=snapshot,
        asking_price=float(price),
        listing_duration_days=duration_days,
        listed_date=listed_date,
        city=city,
        is_manual=True,
    )
    preview_url = f"{_frontend_base_url()}/stale-listings/prospect/{token}"
    await db.commit()
    await db.refresh(prospect)

    # The automated discovery pipeline records every qualifying candidate to
    # the "Stale Listing Addresses" sheet (the physical-mail source list) as
    # soon as it's found — a manually-created prospect skips discovery
    # entirely, so it never got that row. Add it now, with the property
    # code already known, so it doesn't need the separate backfill call
    # discovery's version relies on.
    background_tasks.add_task(
        google_sheets.record_stale_listing_address,
        {
            "rightmove_id": snapshot.get("rightmove_id"),
            "property_code": prospect.property_code,
            "property_address": address,
            "postcode": prospect.postcode or "",
            "city": prospect.city or "",
            "asking_price": price,
            "listed_date": listed_date,
            "listing_duration_days": duration_days,
            "property_type": snapshot.get("property_type"),
            "bedrooms": snapshot.get("bedrooms") or "",
            "bathrooms": snapshot.get("bathrooms") or "",
            "listing_url": str(payload.rightmove_url),
            "source_status": "manual_console",
        },
    )

    admin_email = (get_settings().ADMIN_NOTIFY_EMAIL or "").strip()
    email_sent = False
    if admin_email:
        background_tasks.add_task(
            send_prospect_letter_to_admin,
            str(prospect.id),
            token,
            _frontend_base_url(),
        )
        prospect.processing_status = "email_queued"
        await db.commit()

    return StaleProspectAdminCreateResponse(
        prospect_id=str(prospect.id),
        property_code=prospect.property_code,
        preview_url=preview_url,
        qr_url=preview_url,
        letter_pdf_path=letter_path,
        email_sent=email_sent,
    )


@public_router.post("/prospects-console/prospects/bulk-upload", response_model=StaleProspectDiscoveryRunResponse)
async def bulk_upload_stale_prospects(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> StaleProspectDiscoveryRunResponse:
    """Console CSV-upload field: run every row through the exact same
    scrape -> validate -> create-prospect -> letter pipeline as the single
    "add prospect manually" form above, just bulk. Expects a CSV with
    `rightmove_url` and `address` columns (any extra columns, e.g. from a
    manually-fetched export, are ignored). Processing happens in the
    background — this returns immediately with a run_id the console polls
    via the endpoint below.

    Deliberately unauthenticated, matching create_stale_prospect_manually
    above — see that endpoint's docstring for why.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")

    raw = await file.read()
    try:
        text_content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text_content = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text_content))
    if not reader.fieldnames or "rightmove_url" not in reader.fieldnames or "address" not in reader.fieldnames:
        raise HTTPException(
            status_code=400,
            detail="CSV must have 'rightmove_url' and 'address' columns.",
        )
    rows = [
        {"rightmove_url": (row.get("rightmove_url") or "").strip(), "address": (row.get("address") or "").strip()}
        for row in reader
        if (row.get("rightmove_url") or "").strip()
    ]
    if not rows:
        raise HTTPException(status_code=400, detail="No rows with a rightmove_url found in that CSV.")

    run = StaleListingDiscoveryRun(
        status="running",
        dry_run=False,
        location_names=json.dumps(["csv_upload"]),
        min_price=500000,
        min_days_on_market=180,
        max_candidates=len(rows),
        max_pages_per_location=0,
        started_at=datetime.now(timezone.utc),
        result_json=json.dumps({"created": [], "skipped": [], "failed": []}),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    background_tasks.add_task(run_bulk_csv_upload, str(run.id), rows)
    return StaleProspectDiscoveryRunResponse(**serialize_discovery_run(run))


@public_router.get(
    "/prospects-console/prospects/bulk-upload/{run_id}",
    response_model=StaleProspectDiscoveryRunResponse,
)
async def bulk_upload_status(run_id: str, db: AsyncSession = Depends(get_db)) -> StaleProspectDiscoveryRunResponse:
    """Poll a bulk-upload run's progress. Unauthenticated, matching every
    other prospects-console endpoint on this router."""
    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Run not found.")
    run = await db.get(StaleListingDiscoveryRun, run_uuid)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found.")
    return StaleProspectDiscoveryRunResponse(**serialize_discovery_run(run))


def _console_list_item(prospect: StaleListingProspect) -> StaleProspectConsoleListItem:
    snapshot = json.loads(prospect.listing_snapshot_json or "{}")
    images = snapshot.get("images") if isinstance(snapshot.get("images"), list) else []
    image_url = snapshot.get("image") or (images[0] if images else None)
    return StaleProspectConsoleListItem(
        prospect_id=str(prospect.id),
        property_code=prospect.property_code,
        property_address=address_with_full_postcode(prospect.property_address, prospect.postcode),
        postcode=prospect.postcode,
        city=prospect.city,
        rightmove_url=prospect.rightmove_url,
        asking_price=prospect.asking_price,
        listing_duration_days=prospect.listing_duration_days,
        property_type=prospect.property_type,
        bedrooms=prospect.bedrooms,
        bathrooms=prospect.bathrooms,
        image_url=image_url,
        processing_status=prospect.processing_status,
        payment_status=prospect.payment_status,
        is_manual=prospect.is_manual,
        treated_at=prospect.treated_at.isoformat() if prospect.treated_at else None,
        created_at=prospect.created_at.isoformat(),
    )


@public_router.get("/prospects-console/prospects", response_model=StaleProspectConsoleListResponse)
async def list_console_prospects(
    db: AsyncSession = Depends(get_db),
    city: str | None = Query(default=None),
    treated: bool | None = Query(default=None),
    q: str | None = Query(default=None, description="Search property address or property code"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> StaleProspectConsoleListResponse:
    filters = []
    if city:
        filters.append(StaleListingProspect.city == city)
    if treated is True:
        filters.append(StaleListingProspect.treated_at.is_not(None))
    elif treated is False:
        filters.append(StaleListingProspect.treated_at.is_(None))
    if q:
        like = f"%{q.strip()}%"
        filters.append(
            or_(
                StaleListingProspect.property_address.ilike(like),
                StaleListingProspect.property_code.ilike(like),
                StaleListingProspect.postcode.ilike(like),
            )
        )

    count_result = await db.execute(
        select(func.count()).select_from(StaleListingProspect).where(*filters)
    )
    total = int(count_result.scalar() or 0)

    result = await db.execute(
        select(StaleListingProspect)
        .where(*filters)
        .order_by(StaleListingProspect.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [_console_list_item(p) for p in result.scalars().all()]

    cities_result = await db.execute(
        select(StaleListingProspect.city)
        .where(StaleListingProspect.city.is_not(None))
        .distinct()
        .order_by(StaleListingProspect.city.asc())
    )
    # `city` is denormalised free text — clean for the ~106 automated-discovery
    # locations (candidate.city is always one of KNOWN_LOCATIONS' own names),
    # but bulk-CSV/manual-add rows derive it by guessing the last comma part
    # of a hand-typed address, which produces postcodes ("PE2"), street names
    # ("Park Road"), counties ("West Midlands"), and marketing copy as "city"
    # values. That grew this dropdown to 700+ entries, most appearing once.
    # Confirmed live: of 727 distinct values, 443 occur exactly once. Filter
    # the dropdown to known real locations rather than every raw string ever
    # parsed — the prospects themselves aren't touched, they're still found
    # via "All locations" or the address/postcode search either way.
    _known_lower = {name.lower() for name, _ in KNOWN_LOCATIONS}
    cities = [c for (c,) in cities_result.all() if c and c.strip().lower() in _known_lower]

    return StaleProspectConsoleListResponse(items=items, total=total, cities=cities)


def _prospect_funnel_status(p: StaleListingProspect) -> str:
    """Furthest stage this prospect actually reached, in priority order —
    a prospect that paid is "paid" even though it also has a confirmed_at
    and a contact_details_submitted_at."""
    if p.payment_status == "completed":
        return "paid"
    if p.contact_details_submitted_at is not None:
        return "details_submitted"
    if p.property_confirmed_at is not None:
        return "confirmed"
    return "looked_up"


_FUNNEL_STATUS_FILTERS = {
    "looked_up": lambda: StaleListingProspect.property_confirmed_at.is_(None),
    "confirmed": lambda: and_(
        StaleListingProspect.property_confirmed_at.is_not(None),
        StaleListingProspect.contact_details_submitted_at.is_(None),
    ),
    "details_submitted": lambda: and_(
        StaleListingProspect.contact_details_submitted_at.is_not(None),
        StaleListingProspect.payment_status != "completed",
    ),
    "paid": lambda: StaleListingProspect.payment_status == "completed",
}


@public_router.get("/prospects-console/abandoned", response_model=StaleProspectAbandonedResponse)
async def list_abandoned_prospects(
    db: AsyncSession = Depends(get_db),
    include_unsubscribed: bool = Query(default=False),
    stage: str | None = Query(
        default=None,
        description="Funnel stage to filter to: looked_up | confirmed | details_submitted | paid. Omit for every stage.",
    ),
    q: str | None = Query(default=None, description="Search property address, property code, contact name, or contact email"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> StaleProspectAbandonedResponse:
    """Every prospect a customer actually interacted with by code/token —
    the Follow Up console worklist. Covers the full funnel from "just
    looked up the code" (code_looked_up_at set, nothing else) through
    confirmed, details-submitted-but-unpaid, and paid; `stage` narrows to
    one of those. Excludes anyone who's unsubscribed unless
    include_unsubscribed is set, since they've explicitly opted out of
    further contact."""
    if stage is not None and stage not in _FUNNEL_STATUS_FILTERS:
        raise HTTPException(status_code=422, detail=f"stage must be one of {sorted(_FUNNEL_STATUS_FILTERS)}.")

    filters = [StaleListingProspect.code_looked_up_at.is_not(None)]
    if stage:
        filters.append(_FUNNEL_STATUS_FILTERS[stage]())
    if not include_unsubscribed:
        filters.append(StaleListingProspect.unsubscribed_at.is_(None))
    if q:
        like = f"%{q.strip()}%"
        filters.append(
            or_(
                StaleListingProspect.property_address.ilike(like),
                StaleListingProspect.property_code.ilike(like),
                StaleListingProspect.contact_name.ilike(like),
                StaleListingProspect.contact_email.ilike(like),
            )
        )

    count_result = await db.execute(
        select(func.count()).select_from(StaleListingProspect).where(*filters)
    )
    total = int(count_result.scalar() or 0)

    emails_sent_count = (
        select(func.count())
        .select_from(StaleProspectAbandonmentEmail)
        .where(StaleProspectAbandonmentEmail.prospect_id == StaleListingProspect.id)
        .correlate(StaleListingProspect)
        .scalar_subquery()
    )
    sms_sent_count = (
        select(func.count())
        .select_from(StaleProspectAbandonmentSms)
        .where(StaleProspectAbandonmentSms.prospect_id == StaleListingProspect.id)
        .correlate(StaleListingProspect)
        .scalar_subquery()
    )
    # Most recent thing that actually happened, whichever stage it was —
    # a NULL contact_details_submitted_at (e.g. a looked-up-only prospect)
    # would otherwise sort first under a plain DESC order.
    last_activity_at = func.coalesce(
        StaleListingProspect.contact_details_submitted_at,
        StaleListingProspect.property_confirmed_at,
        StaleListingProspect.code_looked_up_at,
    )
    result = await db.execute(
        select(StaleListingProspect, emails_sent_count, sms_sent_count)
        .where(*filters)
        .order_by(last_activity_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [
        StaleProspectAbandonedItem(
            prospect_id=str(p.id),
            property_code=p.property_code,
            property_address=address_with_full_postcode(p.property_address, p.postcode),
            postcode=p.postcode,
            city=p.city,
            asking_price=p.asking_price,
            contact_name=p.contact_name,
            contact_email=p.contact_email,
            contact_phone=p.contact_phone,
            payment_status=p.payment_status,
            status=_prospect_funnel_status(p),
            code_looked_up_at=p.code_looked_up_at.isoformat() if p.code_looked_up_at else None,
            property_confirmed_at=p.property_confirmed_at.isoformat() if p.property_confirmed_at else None,
            contact_details_submitted_at=p.contact_details_submitted_at.isoformat() if p.contact_details_submitted_at else None,
            abandonment_emails_sent=emails_sent,
            abandonment_sms_sent=sms_sent,
            unsubscribed_at=p.unsubscribed_at.isoformat() if p.unsubscribed_at else None,
            sms_unsubscribed_at=p.sms_unsubscribed_at.isoformat() if p.sms_unsubscribed_at else None,
            treated_at=p.treated_at.isoformat() if p.treated_at else None,
        )
        for p, emails_sent, sms_sent in result.all()
    ]
    return StaleProspectAbandonedResponse(items=items, total=total)


@public_router.get("/prospects-console/prospects/{prospect_id}", response_model=StaleProspectConsoleDetail)
async def get_console_prospect(prospect_id: str, db: AsyncSession = Depends(get_db)) -> StaleProspectConsoleDetail:
    try:
        prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
    except ValueError:
        prospect = None
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found.")

    base = _console_list_item(prospect)
    return StaleProspectConsoleDetail(
        **base.model_dump(),
        listing_snapshot=json.loads(prospect.listing_snapshot_json or "{}"),
        report_data=json.loads(current_report_json(prospect) or "{}"),
        is_edited=bool(prospect.agent_edited_report_json),
        letter_pdf_path=prospect.letter_pdf_path,
        contact_name=prospect.contact_name,
        contact_email=prospect.contact_email,
        contact_phone=prospect.contact_phone,
    )


@public_router.patch("/prospects-console/prospects/{prospect_id}/report", response_model=StaleProspectConsoleDetail)
async def update_console_prospect_report(
    prospect_id: str,
    payload: StaleProspectConsoleEditRequest,
    db: AsyncSession = Depends(get_db),
) -> StaleProspectConsoleDetail:
    """Saves an edit as agent_edited_report_json (report_json, the original
    AI output, is never overwritten) and regenerates the letter PDF from the
    edited data — see current_report_json for the read-side precedence."""
    try:
        prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
    except ValueError:
        prospect = None
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found.")

    prospect.agent_edited_report_json = json.dumps(payload.report_data, ensure_ascii=False)
    try:
        # generate_letter_pdf needs the raw QR token, not its stored hash —
        # the raw token is only ever returned once, at creation, and never
        # persisted (standard hash-only storage). Regenerating the letter
        # after an edit means issuing a fresh one; the old QR code (if
        # already printed/sent) stops working once this replaces the
        # stored hash, which is fine for the pre-send edit-and-fix case
        # this is for.
        new_token = create_access_token()
        prospect.qr_token_hash = hash_access_token(new_token)
        # generate_letter_pdf is synchronous (ReportLab drawing plus a
        # blocking httpx.get for the listing photo) — running it directly
        # in this async endpoint blocks the whole worker's event loop for
        # as long as it takes. to_thread hands it to a worker thread
        # instead; wait_for is a hard backstop so a genuinely stuck photo
        # fetch (its own 5s timeout notwithstanding) can never hang this
        # request indefinitely — it just skips the letter this time.
        letter_path = await asyncio.wait_for(
            asyncio.to_thread(generate_letter_pdf, prospect, new_token, _frontend_base_url()),
            timeout=20.0,
        )
        prospect.letter_pdf_path = letter_path
    except Exception as exc:
        logger.warning("Letter regeneration failed for prospect %s after report edit: %s", prospect_id, exc)
    await db.commit()
    await db.refresh(prospect)

    base = _console_list_item(prospect)
    return StaleProspectConsoleDetail(
        **base.model_dump(),
        listing_snapshot=json.loads(prospect.listing_snapshot_json or "{}"),
        report_data=json.loads(current_report_json(prospect) or "{}"),
        is_edited=bool(prospect.agent_edited_report_json),
        letter_pdf_path=prospect.letter_pdf_path,
        contact_name=prospect.contact_name,
        contact_email=prospect.contact_email,
        contact_phone=prospect.contact_phone,
    )


@public_router.patch("/prospects-console/prospects/{prospect_id}/address", response_model=StaleProspectConsoleDetail)
async def update_console_prospect_address(
    prospect_id: str,
    payload: StaleProspectConsoleAddressEditRequest,
    db: AsyncSession = Depends(get_db),
) -> StaleProspectConsoleDetail:
    """Lets an admin correct property_address by hand — e.g. a scraped
    displayAddress that's missing the house number/name a scrape or manual
    typo got wrong. property_address is the single source every other
    surface reads from (the letter PDF, the full report PDF, the QR
    landing page's own lookup, the console list/detail views), so editing
    it here is enough for all of them EXCEPT the already-generated letter
    PDF file sitting on disk (download_console_letter_pdf serves that file
    as-is if one already exists) — same regenerate-immediately pattern as
    update_console_prospect_report above, including issuing a fresh QR
    token, so a letter already printed against the old address doesn't
    keep pointing at a now-stale one.

    Also re-derives postcode/city from the new text (best-effort, same
    heuristic as the manual-create form) since those are denormalised
    columns used for search and the console's location filter — leaving
    them at their old values after an address edit would silently
    mismatch the two."""
    try:
        prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
    except ValueError:
        prospect = None
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found.")

    address = payload.property_address.strip()
    if not address:
        raise HTTPException(status_code=400, detail="Address cannot be empty.")

    prospect.property_address = address
    postcode, city = _derive_postcode_and_city(address)
    if postcode:
        prospect.postcode = postcode
    if city:
        prospect.city = city

    try:
        new_token = create_access_token()
        prospect.qr_token_hash = hash_access_token(new_token)
        letter_path = await asyncio.wait_for(
            asyncio.to_thread(generate_letter_pdf, prospect, new_token, _frontend_base_url()),
            timeout=20.0,
        )
        prospect.letter_pdf_path = letter_path
    except Exception as exc:
        logger.warning("Letter regeneration failed for prospect %s after address edit: %s", prospect_id, exc)
    await db.commit()
    await db.refresh(prospect)

    base = _console_list_item(prospect)
    return StaleProspectConsoleDetail(
        **base.model_dump(),
        listing_snapshot=json.loads(prospect.listing_snapshot_json or "{}"),
        report_data=json.loads(current_report_json(prospect) or "{}"),
        is_edited=bool(prospect.agent_edited_report_json),
        letter_pdf_path=prospect.letter_pdf_path,
        contact_name=prospect.contact_name,
        contact_email=prospect.contact_email,
        contact_phone=prospect.contact_phone,
    )


@public_router.patch("/prospects-console/prospects/{prospect_id}/treated", response_model=StaleProspectConsoleListItem)
async def set_console_prospect_treated(
    prospect_id: str,
    payload: StaleProspectConsoleTreatedRequest,
    db: AsyncSession = Depends(get_db),
) -> StaleProspectConsoleListItem:
    try:
        prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
    except ValueError:
        prospect = None
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found.")

    prospect.treated_at = datetime.now(timezone.utc) if payload.treated else None
    await db.commit()
    await db.refresh(prospect)
    return _console_list_item(prospect)


@public_router.get("/prospects-console/prospects/{prospect_id}/letter.pdf")
async def download_console_letter_pdf(prospect_id: str, db: AsyncSession = Depends(get_db)) -> FileResponse:
    """Serves the letter PDF, regenerating it first if it's not sitting on
    disk. There was previously no way to reach this file over HTTP at all
    — every prior delivery path (send_prospect_letter_to_admin) reads it
    straight off disk into an email attachment in the same request/
    background task that just generated it, so this is the first thing
    that ever tries to read a letter PDF that might be from a while ago.

    Railway's filesystem is ephemeral per deploy — a PDF generated by an
    earlier container is simply gone once that container's been replaced,
    regardless of how recently the prospect itself was created. Since the
    letter is fully deterministic from the current report data plus a
    token, regenerating it here is simpler and more correct than trying to
    keep the file alive with persistent storage: it's a cheap derived
    artifact, not something that needs to durably exist.
    """
    try:
        prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
    except ValueError:
        prospect = None
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found.")

    # Regenerate-if-needed (missing from disk, or this is the first real
    # download so the print date needs to lock in now) is shared with the
    # bulk letters-ZIP job — see ensure_letter_pdf_path's docstring.
    try:
        path = await ensure_letter_pdf_path(db, prospect)
        await db.commit()
        await db.refresh(prospect)
    except Exception as exc:
        logger.warning("On-demand letter regeneration failed for prospect %s: %s", prospect_id, exc)
        raise HTTPException(status_code=500, detail="Could not generate the letter PDF — try again in a moment.") from exc

    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"Havlo-letter-{prospect.property_code}.pdf",
        # Without this, browsers (and target="_blank" tab-reuse in
        # particular) can serve a cached copy of this same stable URL
        # instead of re-fetching — confirmed live: after an admin edits
        # the report and the letter is genuinely regenerated on disk, the
        # console kept showing the pre-edit PDF because the browser never
        # asked the server for it again.
        headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"},
    )


@public_router.get("/prospects-console/prospects/{prospect_id}/full-report.pdf")
async def download_console_full_report_pdf(prospect_id: str, db: AsyncSession = Depends(get_db)) -> FileResponse:
    """Serves the Full Property Assessment report as a real PDF (built with
    ReportLab — see generate_full_report_pdf's docstring), replacing the
    console's previous "Print / save full report as PDF" button, which just
    called window.print() on the on-screen preview modal — a plain browser
    print of a page never laid out for paper, producing pages of near-blank
    browser-paginated output with Chrome's own chrome stamped on it.

    Always regenerates (no on-disk cache check, unlike the letter endpoint
    above) — there's no print-date lock-in reason here, and an admin who
    just edited the report should never be served a stale cached copy.
    """
    try:
        prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
    except ValueError:
        prospect = None
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found.")

    try:
        path = await asyncio.wait_for(
            asyncio.to_thread(generate_full_report_pdf, prospect),
            timeout=25.0,
        )
    except Exception as exc:
        logger.warning("Full-report PDF generation failed for prospect %s: %s", prospect_id, exc)
        raise HTTPException(status_code=500, detail="Could not generate the report PDF — try again in a moment.") from exc

    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"Havlo-full-report-{prospect.property_code}.pdf",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"},
    )


@public_router.post(
    "/prospects-console/prospects/letters-zip",
    response_model=StaleProspectDiscoveryRunResponse,
)
async def start_letters_zip(
    payload: StaleProspectLettersZipRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> StaleProspectDiscoveryRunResponse:
    """Console's "Generate Folder" letters tab: build a downloadable ZIP of
    the letter PDFs for an admin-picked selection of prospects. Creates a
    StaleListingDiscoveryRun row purely to reuse its existing
    tracking/polling/storage plumbing (same convention as
    location_names=["csv_upload"] for bulk uploads) — the actual zipping
    happens in the background since regenerating hundreds of PDFs can take
    a while; the console polls the run below and shows a download button
    once letters_zip_status is "ready".

    Deliberately unauthenticated, matching every other prospects-console
    endpoint on this router.
    """
    run = StaleListingDiscoveryRun(
        status="completed",
        dry_run=False,
        location_names=json.dumps(["manual_letters_zip"]),
        min_price=0,
        min_days_on_market=0,
        max_candidates=len(payload.prospect_ids),
        max_pages_per_location=0,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        result_json=json.dumps({"created": [], "skipped": [], "failed": []}),
        letters_zip_status="queued",
        letters_zip_total=len(payload.prospect_ids),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    background_tasks.add_task(build_letters_zip_for_run, str(run.id), payload.prospect_ids)
    return StaleProspectDiscoveryRunResponse(**serialize_discovery_run(run))


@public_router.get(
    "/prospects-console/prospects/letters-zip/{run_id}",
    response_model=StaleProspectDiscoveryRunResponse,
)
async def letters_zip_status_endpoint(run_id: str, db: AsyncSession = Depends(get_db)) -> StaleProspectDiscoveryRunResponse:
    """Poll a letters-ZIP job's progress — used both for the console's
    ad-hoc "Generate Folder" selection and, on the same bulk-upload run
    object, for the auto-built ZIP that follows a CSV upload. Unauthenticated,
    matching every other prospects-console endpoint on this router."""
    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Run not found.")
    run = await db.get(StaleListingDiscoveryRun, run_uuid)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found.")
    return StaleProspectDiscoveryRunResponse(**serialize_discovery_run(run))


@public_router.get("/prospects-console/prospects/letters-zip/{run_id}/download")
async def download_letters_zip(run_id: str, db: AsyncSession = Depends(get_db)) -> Response:
    """Serves a finished letters ZIP straight out of the run row (stored as
    bytea, not a disk file — see the model column comments for why).
    Unauthenticated, matching every other prospects-console endpoint on
    this router."""
    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Run not found.")
    run = await db.get(StaleListingDiscoveryRun, run_uuid)
    if not run or not run.letters_zip_data:
        raise HTTPException(status_code=404, detail="This letters ZIP isn't ready (or doesn't exist).")
    return Response(
        content=run.letters_zip_data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{run.letters_zip_filename or "havlo-letters.zip"}"'},
    )


@admin_router.post(
    "/admin/prospects/discovery-runs",
    response_model=StaleProspectDiscoveryRunResponse,
)
async def create_stale_prospect_discovery_run(
    payload: StaleProspectDiscoveryRunRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StaleProspectDiscoveryRunResponse:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

    locations = [item.strip() for item in (payload.location_names or []) if item.strip()]
    run = StaleListingDiscoveryRun(
        status="queued",
        dry_run=payload.dry_run,
        location_names=json.dumps(locations),
        min_price=payload.min_price,
        min_days_on_market=payload.min_days_on_market,
        max_candidates=payload.max_candidates,
        max_pages_per_location=payload.max_pages_per_location,
        started_by_user_id=current_user.id,
        result_json=json.dumps({"eligible": [], "created": [], "skipped": [], "failed": []}),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    background_tasks.add_task(
        run_discovery,
        str(run.id),
        DiscoveryParams(
            dry_run=payload.dry_run,
            location_names=locations or None,
            max_candidates=payload.max_candidates,
            max_pages_per_location=payload.max_pages_per_location,
            min_price=payload.min_price,
            min_days_on_market=payload.min_days_on_market,
        ),
    )
    return StaleProspectDiscoveryRunResponse(**serialize_discovery_run(run))


@admin_router.get(
    "/admin/prospects/discovery-runs",
    response_model=list[StaleProspectDiscoveryRunResponse],
)
async def list_stale_prospect_discovery_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[StaleProspectDiscoveryRunResponse]:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    result = await db.execute(
        select(StaleListingDiscoveryRun)
        .order_by(StaleListingDiscoveryRun.created_at.desc())
        .limit(10)
    )
    return [
        StaleProspectDiscoveryRunResponse(**serialize_discovery_run(run))
        for run in result.scalars().all()
    ]


@admin_router.get(
    "/admin/prospects/discovery-runs/{run_id}",
    response_model=StaleProspectDiscoveryRunResponse,
)
async def get_stale_prospect_discovery_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StaleProspectDiscoveryRunResponse:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Discovery run not found.") from exc
    run = await db.get(StaleListingDiscoveryRun, run_uuid)
    if not run:
        raise HTTPException(status_code=404, detail="Discovery run not found.")
    return StaleProspectDiscoveryRunResponse(**serialize_discovery_run(run))


@admin_router.post("/admin/prospects/backfill-postcodes")
async def backfill_stale_prospect_postcodes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=500, ge=1, le=2000),
) -> dict:
    """Re-scrape each postcode-less prospect's Rightmove listing to fill in
    its postcode. One-off backfill for prospects discovered before the
    postcode column existed (Rightmove's displayAddress never carries the
    full postcode; the detail-page PAGE_MODEL does, via separate outcode/
    incode fields — see _combine_postcode in listing_scraper.py) — safe to
    re-run any time, it only ever touches rows still missing one.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

    from app.services.listing_scraper import scrape_single_listing

    result = await db.execute(
        select(StaleListingProspect)
        .where(StaleListingProspect.postcode.is_(None))
        .order_by(StaleListingProspect.created_at.asc())
        .limit(limit)
    )
    prospects = list(result.scalars().all())
    if not prospects:
        return {"total": 0, "updated": 0, "outcode_only": 0, "failed": 0, "failures": []}

    semaphore = asyncio.Semaphore(5)
    failures: list[dict] = []
    updated = 0
    outcode_only = 0

    async def _backfill_one(prospect: StaleListingProspect) -> None:
        nonlocal updated, outcode_only
        async with semaphore:
            try:
                scraped = await scrape_single_listing(prospect.rightmove_url)
                postcode = (scraped.get("postcode") or "").strip()
                if not postcode:
                    failures.append({
                        "property_code": prospect.property_code,
                        "rightmove_url": prospect.rightmove_url,
                        "reason": "no_postcode_in_listing"
                        + (" (listing may be blocked/removed)" if scraped.get("blocked") else ""),
                    })
                    return
                prospect.postcode = postcode
                updated += 1
                if " " not in postcode:
                    outcode_only += 1
                from app.services import google_sheets
                await asyncio.to_thread(
                    google_sheets.update_stale_listing_postcode,
                    rightmove_id=prospect.rightmove_id or "",
                    listing_url=prospect.rightmove_url,
                    postcode=postcode,
                )
            except Exception as exc:
                failures.append({
                    "property_code": prospect.property_code,
                    "rightmove_url": prospect.rightmove_url,
                    "reason": str(exc)[:200],
                })

    await asyncio.gather(*(_backfill_one(p) for p in prospects))
    await db.commit()

    return {
        "total": len(prospects),
        "updated": updated,
        "outcode_only": outcode_only,
        "failed": len(failures),
        "failures": failures,
    }


@admin_router.post("/admin/prospects/sync-to-sheets")
async def sync_stale_prospects_to_sheets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reconcile the Stale Listing Addresses Google Sheet against every
    prospect in the database, adding any rows the sheet is missing.

    record_stale_listing_address() writes one row per prospect at discovery
    time and is best-effort (a Sheets outage must never break discovery) —
    under sustained rate limiting from concurrent discovery cycles, some of
    those single-row writes can be silently dropped, so the sheet's row
    count can fall behind the database's. This reads the sheet once,
    figures out which prospects are missing (matched by Rightmove ID or
    listing URL, same as the live write path), and adds them in a few
    batched writes. Safe to re-run any time — already-present rows are
    left untouched.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

    from app.services import google_sheets

    result = await db.execute(select(StaleListingProspect))
    prospects = list(result.scalars().all())

    listing_dicts = [
        {
            "rightmove_id": p.rightmove_id or "",
            "listing_url": p.rightmove_url,
            "property_code": p.property_code,
            "property_address": p.property_address,
            "postcode": p.postcode or "",
            "city": p.city or "",
            "asking_price": p.asking_price,
            "listed_date": p.listed_date,
            "listing_duration_days": p.listing_duration_days,
            "property_type": p.property_type,
            "bedrooms": p.bedrooms,
            "bathrooms": p.bathrooms,
            "discovery_run_id": str(p.discovery_run_id) if p.discovery_run_id else "",
            "source_status": p.source_status or ("manual_console" if p.is_manual else "stale_180_days_plus"),
        }
        for p in prospects
    ]

    sync_result = await asyncio.to_thread(google_sheets.sync_all_stale_listing_addresses, listing_dicts)
    return sync_result


@admin_router.post("/admin/prospects/regenerate-letters")
async def regenerate_all_stale_prospect_letters(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=2000, ge=1, le=5000),
) -> dict:
    """Regenerate every prospect's letter PDF against current drawing code
    (fonts/spacing/layout) — a one-off catch-up after a design change,
    rather than waiting for each one to self-heal lazily on next download.

    Explicit, deliberate action rather than something to run casually:
    regenerating mints a fresh QR access token per prospect (the raw token
    is never persisted, only its hash — see generate_letter_pdf's other
    call sites — so there is no way to regenerate a PDF while keeping its
    existing QR code valid). That invalidates the QR code on any physical
    letter already mailed with the old one. Confirmed with the business
    before wiring this up that nothing has been mailed yet.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

    result = await db.execute(
        select(StaleListingProspect).order_by(StaleListingProspect.created_at.asc()).limit(limit)
    )
    prospects = list(result.scalars().all())
    if not prospects:
        return {"total": 0, "regenerated": 0, "failed": 0, "failures": []}

    semaphore = asyncio.Semaphore(5)
    failures: list[dict] = []
    regenerated = 0

    async def _regenerate_one(prospect: StaleListingProspect) -> None:
        nonlocal regenerated
        async with semaphore:
            try:
                new_token = create_access_token()
                prospect.qr_token_hash = hash_access_token(new_token)
                prospect.letter_pdf_path = await asyncio.wait_for(
                    asyncio.to_thread(generate_letter_pdf, prospect, new_token, _frontend_base_url()),
                    timeout=20.0,
                )
                regenerated += 1
            except Exception as exc:
                failures.append({
                    "property_code": prospect.property_code,
                    "reason": str(exc)[:200],
                })

    await asyncio.gather(*(_regenerate_one(p) for p in prospects))
    await db.commit()

    return {
        "total": len(prospects),
        "regenerated": regenerated,
        "failed": len(failures),
        "failures": failures,
    }


@admin_router.get("/admin/prospects/email-diagnostics")
async def stale_prospect_email_diagnostics(
    current_user: User = Depends(get_current_user),
) -> dict:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    settings = get_settings()
    diagnostics = email_service.diagnostics()
    diagnostics["admin_notify_email_set"] = bool((settings.ADMIN_NOTIFY_EMAIL or "").strip())
    diagnostics["admin_notify_email"] = settings.ADMIN_NOTIFY_EMAIL or None
    return diagnostics


@admin_router.post("/admin/prospects/email-test")
async def send_stale_prospect_test_email(
    current_user: User = Depends(get_current_user),
) -> dict:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    to_email = (get_settings().ADMIN_NOTIFY_EMAIL or "").strip()
    if not to_email:
        raise HTTPException(status_code=400, detail="ADMIN_NOTIFY_EMAIL is not configured.")
    sent = await asyncio.to_thread(email_service.send_test_email, to_email)
    if not sent:
        raise HTTPException(
            status_code=502,
            detail="Email provider did not accept the test email. Check RESEND_API_KEY, EMAIL_FROM and verified sender/domain.",
        )
    return {"ok": True, "to_email": to_email}


@admin_router.post("/admin/prospects/{prospect_id}/abandonment-test-email")
async def send_stale_prospect_abandonment_test_email(
    prospect_id: str,
    stage: int = Query(..., ge=1, le=12, description="Which of the 12 drip stages to preview (1-12)."),
    to_email: str | None = Query(None, description="Defaults to ADMIN_NOTIFY_EMAIL if omitted."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """QA helper: send any one of the 12 abandonment-drip stages for a real
    prospect's data right now, without waiting for its timer and without
    recording it as sent (the real automated send loop is untouched)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found.")
    recipient = (to_email or get_settings().ADMIN_NOTIFY_EMAIL or "").strip()
    if not recipient:
        raise HTTPException(status_code=400, detail="Provide to_email or configure ADMIN_NOTIFY_EMAIL.")

    from app.services.stale_prospect_abandonment import build_unsubscribe_url

    sent = await asyncio.to_thread(
        email_service.send_stale_prospect_abandonment_email_sync,
        to_email=recipient,
        first_name=(prospect.contact_name or "Test").split(" ")[0] or "Test",
        stage=stage,
        asking_price=prospect.asking_price,
        property_code=prospect.property_code,
        unsubscribe_url=build_unsubscribe_url(prospect.id),
    )
    if not sent:
        raise HTTPException(
            status_code=502,
            detail="Email provider did not accept the test email. Check RESEND_API_KEY, EMAIL_FROM and verified sender/domain.",
        )
    return {"ok": True, "to_email": recipient, "stage": stage, "prospect_id": str(prospect.id)}


@admin_router.post("/admin/prospects/{prospect_id}/post-purchase-test-email")
async def send_stale_prospect_post_purchase_test_email(
    prospect_id: str,
    stage: int = Query(..., ge=1, le=12, description="Which of the 12 post-purchase stages to preview (1-12)."),
    to_email: str | None = Query(None, description="Defaults to ADMIN_NOTIFY_EMAIL if omitted."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """QA helper: send any one of the 12 post-purchase-drip stages for a
    real prospect's data right now, without waiting for its timer and
    without recording it as sent."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found.")
    recipient = (to_email or get_settings().ADMIN_NOTIFY_EMAIL or "").strip()
    if not recipient:
        raise HTTPException(status_code=400, detail="Provide to_email or configure ADMIN_NOTIFY_EMAIL.")

    from app.services.stale_prospect_abandonment import build_unsubscribe_url

    sent = await asyncio.to_thread(
        email_service.send_stale_prospect_post_purchase_email_sync,
        to_email=recipient,
        first_name=(prospect.contact_name or "Test").split(" ")[0] or "Test",
        stage=stage,
        asking_price=prospect.asking_price,
        property_code=prospect.property_code,
        unsubscribe_url=build_unsubscribe_url(prospect.id),
    )
    if not sent:
        raise HTTPException(
            status_code=502,
            detail="Email provider did not accept the test email. Check RESEND_API_KEY, EMAIL_FROM and verified sender/domain.",
        )
    return {"ok": True, "to_email": recipient, "stage": stage, "prospect_id": str(prospect.id)}


def _stale_listing_confirmation_page(message: str) -> HTMLResponse:
    """Shared confirmation/error page for every unsubscribe link (email,
    long-form SMS, short-form SMS). Plain flex/block CSS on real <div>s
    rather than an email-style nested-table layout — the previous version
    used <table width="480"> for the card, and padding set directly on a
    <table> element (rather than a td/div) is unreliably applied by mobile
    browsers. On narrow phone screens that meant no actual side margin,
    so the 480px-wide card ran off the right edge of the viewport instead
    of shrinking to fit (confirmed live on iOS Safari — the card was cut
    off and text truncated). width:100%/max-width on a div does not have
    that failure mode."""
    return HTMLResponse(f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>StaleListings</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 0; background: #F5F6F8; font-family: Arial, Helvetica, sans-serif; }}
  .wrap {{ min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 16px; }}
  .card {{ width: 100%; max-width: 480px; background: #FFFFFF; border-radius: 14px; border: 1px solid rgba(207,207,206,0.4); padding: 32px 24px; text-align: center; }}
  .card h1 {{ margin: 0 0 14px; font-size: 16px; font-weight: 800; color: #111111; }}
  .card p {{ margin: 0; font-size: 14px; line-height: 22px; color: #556274; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>StaleListings</h1>
    <p>{message}</p>
  </div>
</div>
</body></html>""")


@public_router.get("/prospects/unsubscribe", response_class=HTMLResponse)
async def unsubscribe_stale_prospect(
    prospect_id: str,
    token: str,
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """Public, no-login link clicked from an abandonment-drip email. Verifies
    an HMAC token (see stale_prospect_service.unsubscribe_token) rather than
    requiring auth, so it works straight from an inbox."""

    _page = _stale_listing_confirmation_page

    try:
        prospect_uuid = uuid.UUID(prospect_id)
    except ValueError:
        return _page("This unsubscribe link is invalid.")

    if not verify_unsubscribe_token(prospect_id, token):
        return _page("This unsubscribe link is invalid or has expired.")

    prospect = await db.get(StaleListingProspect, prospect_uuid)
    if prospect and prospect.unsubscribed_at is None:
        prospect.unsubscribed_at = datetime.utcnow()
        await db.commit()

    return _page("You've been unsubscribed from these reminder emails. You won't receive any more.")


@public_router.get("/prospects/unsubscribe-sms", response_class=HTMLResponse)
async def unsubscribe_stale_prospect_sms(
    prospect_id: str,
    token: str,
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """Public, no-login link clicked from an abandonment-SMS text. Sets
    sms_unsubscribed_at — deliberately separate from unsubscribed_at (the
    email drip's own opt-out): stopping the texts must not silently stop
    the emails too, or vice versa. Same HMAC-token verification as the
    email unsubscribe endpoint above."""

    _page = _stale_listing_confirmation_page

    try:
        prospect_uuid = uuid.UUID(prospect_id)
    except ValueError:
        return _page("This unsubscribe link is invalid.")

    if not verify_unsubscribe_token(prospect_id, token):
        return _page("This unsubscribe link is invalid or has expired.")

    prospect = await db.get(StaleListingProspect, prospect_uuid)
    if prospect and prospect.sms_unsubscribed_at is None:
        prospect.sms_unsubscribed_at = datetime.utcnow()
        await db.commit()

    return _page("You've been unsubscribed from these text message reminders. You won't receive any more.")


@short_router.get("/u/{property_code}", response_class=HTMLResponse)
async def unsubscribe_stale_prospect_sms_short(
    property_code: str,
    t: str,
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """Short-link version of unsubscribe_stale_prospect_sms above, for
    texted links specifically — see short_router's own docstring/comment
    for why this needs to be this much shorter. Keyed by property_code (4
    digits, already public on every letter/text) + a short deterministic
    token (sms_unsubscribe_short_token) rather than the prospect's UUID +
    the full 32-char token; same outcome (sets sms_unsubscribed_at), same
    confirmation page. The long-form endpoint stays in place unchanged —
    this doesn't replace it, just gives the SMS ladder something that
    fits in a message."""

    _page = _stale_listing_confirmation_page

    code = normalize_property_code(property_code)
    if len(code) != 4 or not verify_sms_unsubscribe_short_token(code, t):
        return _page("This unsubscribe link is invalid or has expired.")

    result = await db.execute(select(StaleListingProspect).where(StaleListingProspect.property_code == code))
    prospect = result.scalar_one_or_none()
    if prospect and prospect.sms_unsubscribed_at is None:
        prospect.sms_unsubscribed_at = datetime.utcnow()
        await db.commit()

    return _page("You've been unsubscribed from these text message reminders. You won't receive any more.")


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


@admin_router.post("/admin/prospects/{prospect_id}/mark-bank-transfer-paid")
async def mark_stale_prospect_bank_transfer_paid(
    prospect_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Manual reconciliation for the "Bank Transfer" payment option: once you
    see the funds land under the reference shown to the homeowner, mark it
    here to unlock their report — same unlock path as SumUp/promo."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found.")
    if prospect.payment_status != "completed":
        prospect.payment_status = "completed"
        prospect.unlocked_at = datetime.utcnow()
        await db.commit()
        background_tasks.add_task(expand_report_in_background, str(prospect.id))
    return {
        "ok": True,
        "payment_status": "completed",
        "property_code": prospect.property_code,
        "bank_transfer_reference": prospect.bank_transfer_reference,
    }


@public_router.post("/agency-pricing-request")
async def agency_pricing_request(
    payload: AgencyPricingRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    """Receive an agency custom pricing enquiry and email ADMIN_NOTIFY_EMAIL."""
    fields = {
        "Agency Name": payload.agency_name,
        "Website": payload.website or "—",
        "Contact Person": payload.contact_person,
        "Phone": payload.phone,
        "Email": payload.email,
        "Preferred Callback Time": payload.preferred_callback_time,
    }
    background_tasks.add_task(
        email_service.send_admin_notification_sync,
        "Agency Pricing Requests",
        f"New agency pricing enquiry from {payload.agency_name} ({payload.email})",
        fields,
    )
    return {"ok": True}


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
