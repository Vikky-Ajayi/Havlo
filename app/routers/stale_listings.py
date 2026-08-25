"""Stale Listings — public property assessment with SumUp payment and AI report."""
from __future__ import annotations

import json
import asyncio
import logging
import random
import string
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import StaleListingAssessment, StaleListingDiscoveryRun, StaleListingProspect, User
from app.schemas.schemas import (
    AgencyPricingRequest,
    StaleProspectAdminCreateRequest,
    StaleProspectAdminCreateResponse,
    StaleProspectCheckoutRequest,
    StaleProspectCheckoutResponse,
    StaleProspectConfirmRequest,
    StaleProspectConfirmResponse,
    StaleProspectDetailsRequest,
    StaleProspectDetailsResponse,
    StaleProspectDiscoveryRunRequest,
    StaleProspectDiscoveryRunResponse,
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
    create_prospect_from_listing_snapshot,
    expand_report_in_background,
    extract_price,
    hash_access_token,
    is_report_expanded,
    is_specific_address,
    normalize_property_code,
    parse_listed_date,
    serialize_preview,
    serialize_report,
    send_prospect_letter_to_admin,
    snapshot_from_scrape,
)
from app.services.stale_listing_discovery import (
    DiscoveryParams,
    is_target_property_type,
    run_discovery,
    serialize_discovery_run,
)
from app.services.sumup_service import SumUpError

logger = logging.getLogger(__name__)

SL_PACKAGES: dict[str, dict] = {
    "quick_insight":                 {"name": "Quick Insight",                 "amount": 79.99,   "currency": "GBP"},
    "professional_review":           {"name": "Professional Review",           "amount": 299.99,  "currency": "GBP"},
    "premium_strategy":              {"name": "Premium Strategy",              "amount": 1499.99, "currency": "GBP"},
    "listing_recovery_assessment":   {"name": "Listing Recovery Assessment",   "amount": 149.99,  "currency": "GBP"},
    "free_trial_assessment":         {"name": "Free Trial Assessment",         "amount": 0.00,    "currency": "GBP"},
}


def _stale_prospect_checkout_amount(asking_price: float | None) -> float:
    """Full-report checkout price for a letter prospect, tiered by asking price.

    - >= GBP 1,000,000: GBP 999.99
    - GBP 500,000 - 999,999.99: GBP 499.99
    - below GBP 500,000: the original flat listing_recovery_assessment price.
      Automated discovery no longer scrapes anything under GBP 500,000 (see
      DiscoveryParams.min_price), so this only applies to prospects created
      before that floor was raised — kept as-is rather than silently
      repricing a backlog letter that already went out at the old price.
    """
    price = float(asking_price or 0)
    if price >= 1_000_000:
        return 999.99
    if price >= 500_000:
        return 499.99
    return float(SL_PACKAGES["listing_recovery_assessment"]["amount"])

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


@admin_router.post("/admin/prospects/from-url", response_model=StaleProspectAdminCreateResponse)
async def create_stale_prospect_from_url(
    payload: StaleProspectAdminCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StaleProspectAdminCreateResponse:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

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
    address = (payload.property_address or snapshot.get("address") or snapshot.get("title") or "").strip()
    price = payload.asking_price if payload.asking_price is not None else extract_price(snapshot.get("price"))
    if price is None or price < 500000:
        raise HTTPException(status_code=400, detail="Prospect must be a residential sale listing above GBP 500,000.")
    if not is_target_property_type(snapshot.get("property_type") or ""):
        raise HTTPException(
            status_code=400,
            detail="Prospect must be a detached, semi-detached, or terraced house — flats, apartments, and other property types are not targeted.",
        )
    if int(payload.listing_duration_days or 0) < 180:
        raise HTTPException(status_code=400, detail="Prospect must have been listed for at least 6 months.")
    if not is_specific_address(address):
        raise HTTPException(status_code=400, detail="Prospect address is not specific enough for a personalised letter.")

    listed_date = parse_listed_date(snapshot.get("listed_date"))
    prospect, token, letter_path = await create_prospect_from_listing_snapshot(
        db,
        rightmove_url=str(payload.rightmove_url),
        property_address=address,
        listing_snapshot=snapshot,
        asking_price=float(price),
        listing_duration_days=int(payload.listing_duration_days),
        listed_date=listed_date,
    )
    preview_url = f"{_frontend_base_url()}/stale-listings/prospect/{token}"
    await db.commit()
    await db.refresh(prospect)

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
