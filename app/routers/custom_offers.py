from __future__ import annotations

import json
import logging
import random
import string
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import AsyncSessionLocal, get_db
from app.dependencies import get_current_user
from app.models.models import CustomOfferSubmission, User
from app.schemas.schemas import (
    CustomOfferAdminItem,
    CustomOfferAdminUpdateRequest,
    CustomOfferPropertyOverrides,
    CustomOfferPropertySnapshot,
    CustomOfferScrapeRequest,
    CustomOfferScrapeResponse,
    CustomOfferStatusResponse,
    CustomOfferStepAnswers,
    CustomOfferSubmitRequest,
    CustomOfferSubmitResponse,
)
from app.services import google_sheets, sumup_service
from app.services.email_service import (
    send_admin_notification_sync,
    send_custom_offer_buyer_confirmation_sync,
    send_custom_offer_status_update_sync,
)
from app.services.listing_scraper import scrape_listing_for_public_flow
from app.services.sumup_service import SumUpError

logger = logging.getLogger(__name__)

public_router = APIRouter(prefix="/custom-offers", tags=["Custom Offers"])
admin_router = APIRouter(prefix="/custom-offers", tags=["Custom Offers Admin"])

CO_PLANS: dict[str, dict[str, Any]] = {
    "connect": {
        "name": "Connect",
        "amount": 49.99,
        "currency": "GBP",
    },
    "standout": {
        "name": "Standout",
        "amount": 99.99,
        "currency": "GBP",
    },
    "advantage": {
        "name": "Advantage",
        "amount": 149.99,
        "currency": "GBP",
    },
}


def _generate_reference() -> str:
    chars = string.ascii_uppercase + string.digits
    return f"CO-{''.join(random.choices(chars, k=6))}"


def _json_dumps(data: Any) -> str:
    return json.dumps(data or {}, ensure_ascii=False)


def _json_loads(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _frontend_base_url() -> str:
    settings = get_settings()
    return (getattr(settings, "FRONTEND_URL", None) or "https://heyhavlo.com").rstrip("/")


def _status_url(reference: str) -> str:
    return f"{_frontend_base_url()}/custom-offers/status/{reference}"


def _merged_property(
    property_data: dict[str, Any],
    overrides_data: dict[str, Any],
) -> dict[str, Any]:
    merged = {**property_data}
    for field in ("title", "address", "price", "description", "image", "bedrooms", "bathrooms", "property_type"):
        value = str(overrides_data.get(field) or "").strip()
        if value:
            merged[field] = value
    return merged


def _masked_answers(raw_answers: dict[str, Any]) -> CustomOfferStepAnswers:
    masked = {**raw_answers}
    masked["email"] = "hidden@havlo.local"
    masked["phone"] = "Hidden"
    return CustomOfferStepAnswers(**masked)


def _buyer_first_name(full_name: str) -> str:
    name = (full_name or "").strip()
    return name.split(" ", 1)[0] if name else "there"


def _status_label(status_value: str) -> str:
    labels = {
        "submitted": "Submitted",
        "awaiting_seller_review": "Awaiting Seller Review",
        "seller_interested": "Seller Interested",
        "seller_not_interested": "Seller Not Interested",
        "closed": "Closed",
    }
    return labels.get(status_value, status_value.replace("_", " ").title())


def _submission_to_status_response(submission: CustomOfferSubmission) -> CustomOfferStatusResponse:
    property_data = _json_loads(submission.property_snapshot_json)
    overrides_data = _json_loads(submission.property_override_json)
    answers_data = _json_loads(submission.form_answers_json)
    return CustomOfferStatusResponse(
        submission_id=str(submission.id),
        reference=submission.reference,
        created_at=submission.created_at.isoformat() if submission.created_at else "",
        listing_url=submission.listing_url,
        listing_platform=submission.listing_platform,
        plan_id=submission.plan_id,
        plan_name=submission.plan_name,
        payment_status=submission.payment_status,
        proposal_status=submission.proposal_status,
        property=CustomOfferPropertySnapshot(**property_data),
        property_overrides=CustomOfferPropertyOverrides(**overrides_data),
        answers=_masked_answers(answers_data),
        buyer_name=submission.buyer_name,
    )


def _submission_to_admin_item(submission: CustomOfferSubmission) -> CustomOfferAdminItem:
    public_payload = _submission_to_status_response(submission)
    return CustomOfferAdminItem(
        **public_payload.model_dump(),
        updated_at=submission.updated_at.isoformat() if submission.updated_at else "",
        buyer_email=submission.buyer_email,
        buyer_phone=submission.buyer_phone,
        admin_notes=submission.admin_notes,
    )


def _needs_paid_effects(submission: CustomOfferSubmission) -> bool:
    return not all(
        [
            submission.sheets_recorded_at,
            submission.buyer_confirmation_sent_at,
            submission.admin_notification_sent_at,
        ]
    )


async def _process_paid_submission_effects(submission_id: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(CustomOfferSubmission).where(CustomOfferSubmission.id == uuid.UUID(submission_id))
        )
        submission = result.scalar_one_or_none()
        if not submission:
            return

        property_data = _json_loads(submission.property_snapshot_json)
        overrides_data = _json_loads(submission.property_override_json)
        merged_property = _merged_property(property_data, overrides_data)
        answers_data = _json_loads(submission.form_answers_json)
        answers_summary = json.dumps(answers_data, ensure_ascii=False)
        property_summary = " | ".join(
            [
                merged_property.get("address") or merged_property.get("title") or "Property not confirmed",
                merged_property.get("price") or "Price unavailable",
                submission.listing_platform or "generic",
            ]
        )
        now = datetime.utcnow()

        if not submission.sheets_recorded_at:
            recorded = google_sheets.record_custom_offer(
                {
                    "submission_id": str(submission.id),
                    "reference": submission.reference,
                    "buyer_name": submission.buyer_name,
                    "buyer_email": submission.buyer_email,
                    "buyer_phone": submission.buyer_phone,
                    "listing_url": submission.listing_url,
                    "listing_platform": submission.listing_platform,
                    "property_summary": property_summary,
                    "plan_id": submission.plan_id,
                    "plan_name": submission.plan_name,
                    "payment_status": submission.payment_status,
                    "proposal_status": submission.proposal_status,
                    "answers_summary": answers_summary,
                }
            )
            if recorded:
                submission.sheets_recorded_at = now

        if not submission.buyer_confirmation_sent_at:
            sent = send_custom_offer_buyer_confirmation_sync(
                to_email=submission.buyer_email,
                first_name=_buyer_first_name(submission.buyer_name),
                reference=submission.reference,
                status_url=_status_url(submission.reference),
                property_address=merged_property.get("address") or merged_property.get("title") or "",
            )
            if sent:
                submission.buyer_confirmation_sent_at = now

        if not submission.admin_notification_sent_at:
            sent = send_admin_notification_sync(
                "Custom Offers",
                "Paid custom-offers submission awaiting seller review.",
                {
                    "Reference": submission.reference,
                    "Buyer": submission.buyer_name,
                    "Buyer Email": submission.buyer_email,
                    "Buyer Phone": submission.buyer_phone,
                    "Listing URL": submission.listing_url,
                    "Property": property_summary,
                    "Plan": submission.plan_name,
                    "Proposal Type": str(answers_data.get("proposal_type") or "Not provided"),
                    "Buyer Status": str(answers_data.get("buyer_status") or "Not provided"),
                    "Flexible Terms": ", ".join(answers_data.get("flexible_terms") or []) or "None",
                    "Presentation Style": str(answers_data.get("presentation_style") or "Not provided"),
                    "Property Interest": str(answers_data.get("property_interest") or "Not provided"),
                    "Proposed Offer": str(answers_data.get("proposed_offer") or "Not provided"),
                    "Seller Consideration": str(answers_data.get("seller_consideration") or "Not provided"),
                    "Presentation Summary": str(answers_data.get("presentation_primary") or "Not provided"),
                    "Risk Reduction Detail": str(answers_data.get("presentation_risk") or "Not provided"),
                },
            )
            if sent:
                submission.admin_notification_sent_at = now

        await db.commit()


@public_router.post(
    "/scrape",
    response_model=CustomOfferScrapeResponse,
    status_code=status.HTTP_200_OK,
)
async def scrape_custom_offer_listing(payload: CustomOfferScrapeRequest) -> CustomOfferScrapeResponse:
    try:
        result = await scrape_listing_for_public_flow(payload.listing_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CustomOfferScrapeResponse(
        status=result.get("status", "partial"),
        platform=str(result.get("platform") or "generic"),
        message=str(result.get("message") or ""),
        property=CustomOfferPropertySnapshot(**(result.get("property") or {})),
        missing_fields=list(result.get("missing_fields") or []),
    )


@public_router.post(
    "/submit",
    response_model=CustomOfferSubmitResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_custom_offer(
    payload: CustomOfferSubmitRequest,
    db: AsyncSession = Depends(get_db),
) -> CustomOfferSubmitResponse:
    plan = CO_PLANS.get(payload.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan selected.")
    if not payload.proposal_data.confirm_responses_not_guaranteed or not payload.proposal_data.confirm_non_refundable or not payload.proposal_data.confirm_information_accurate:
        raise HTTPException(status_code=400, detail="All confirmation statements must be accepted before submission.")

    reference = _generate_reference()
    redirect_url = (payload.redirect_url or "").rstrip("/")
    if redirect_url:
        separator = "&" if "?" in redirect_url else "?"
        redirect_url = f"{redirect_url}{separator}ref={reference}"

    submission = CustomOfferSubmission(
        reference=reference,
        listing_url=payload.listing_url,
        listing_platform=payload.property_snapshot.platform or "generic",
        property_snapshot_json=_json_dumps(payload.property_snapshot.model_dump()),
        property_override_json=_json_dumps(payload.property_overrides.model_dump(exclude_none=True)),
        form_answers_json=_json_dumps(payload.proposal_data.model_dump()),
        plan_id=payload.plan_id,
        plan_name=str(plan["name"]),
        buyer_name=payload.proposal_data.full_name,
        buyer_email=payload.proposal_data.email,
        buyer_phone=payload.proposal_data.phone,
        payment_status="pending",
        proposal_status="submitted",
    )
    db.add(submission)
    await db.flush()

    try:
        checkout = await sumup_service.create_checkout(
            amount=float(plan["amount"]),
            currency=str(plan["currency"]),
            description=f"CustomOffer {plan['name']} - {payload.proposal_data.email}",
            reference=f"CO-{uuid.uuid4().hex[:12].upper()}",
            redirect_url=redirect_url or None,
        )
    except SumUpError as exc:
        await db.rollback()
        logger.error("SumUp checkout failed for custom offer %s: %s", reference, exc)
        raise HTTPException(
            status_code=502,
            detail="Unable to create a secure payment session right now. Please try again.",
        ) from exc

    submission.sumup_checkout_id = checkout.get("id") or ""
    submission.sumup_checkout_url = checkout.get("checkout_url") or checkout.get("hosted_checkout_url") or ""
    if not submission.sumup_checkout_id or not submission.sumup_checkout_url:
        await db.rollback()
        logger.error("SumUp checkout missing usable URL for custom offer %s", reference)
        raise HTTPException(
            status_code=502,
            detail="Unable to create a secure payment session right now. Please try again.",
        )
    await db.commit()

    return CustomOfferSubmitResponse(
        submission_id=str(submission.id),
        reference=submission.reference,
        checkout_url=submission.sumup_checkout_url or "",
        checkout_id=submission.sumup_checkout_id or "",
        amount=float(plan["amount"]),
        currency=str(plan["currency"]),
        message=f"Proposal submitted. Reference: {submission.reference}.",
    )


@public_router.post("/payment-verify/{reference}")
async def verify_custom_offer_payment(
    reference: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(
        select(CustomOfferSubmission).where(CustomOfferSubmission.reference == reference.upper())
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    if submission.payment_status == "completed":
        if _needs_paid_effects(submission):
            background_tasks.add_task(_process_paid_submission_effects, str(submission.id))
        return {
            "payment_status": submission.payment_status,
            "proposal_status": submission.proposal_status,
            "reference": submission.reference,
        }

    if not submission.sumup_checkout_id:
        return {
            "payment_status": submission.payment_status,
            "proposal_status": submission.proposal_status,
            "reference": submission.reference,
        }

    try:
        checkout_data = await sumup_service.get_checkout_status(submission.sumup_checkout_id)
        sumup_status = str(checkout_data.get("status") or "").upper()
        if sumup_status == "PAID":
            submission.payment_status = "completed"
            if submission.proposal_status == "submitted":
                submission.proposal_status = "awaiting_seller_review"
            await db.commit()
            background_tasks.add_task(_process_paid_submission_effects, str(submission.id))
        elif sumup_status in {"FAILED", "EXPIRED"}:
            submission.payment_status = "failed"
            await db.commit()
    except SumUpError as exc:
        logger.error("SumUp verification failed for custom offer %s: %s", reference, exc)

    return {
        "payment_status": submission.payment_status,
        "proposal_status": submission.proposal_status,
        "reference": submission.reference,
    }


@public_router.get("/status/{reference}", response_model=CustomOfferStatusResponse)
async def get_custom_offer_status(
    reference: str,
    db: AsyncSession = Depends(get_db),
) -> CustomOfferStatusResponse:
    result = await db.execute(
        select(CustomOfferSubmission).where(CustomOfferSubmission.reference == reference.upper())
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return _submission_to_status_response(submission)


@admin_router.get("/admin", response_model=list[CustomOfferAdminItem])
async def list_custom_offers_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CustomOfferAdminItem]:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    result = await db.execute(
        select(CustomOfferSubmission).order_by(CustomOfferSubmission.created_at.desc())
    )
    return [_submission_to_admin_item(item) for item in result.scalars().all()]


@admin_router.patch("/admin/{submission_id}", response_model=CustomOfferAdminItem)
async def update_custom_offer_admin(
    submission_id: str,
    payload: CustomOfferAdminUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomOfferAdminItem:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

    try:
        submission_uuid = uuid.UUID(submission_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid submission id.") from exc

    result = await db.execute(
        select(CustomOfferSubmission).where(CustomOfferSubmission.id == submission_uuid)
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    previous_status = submission.proposal_status
    if payload.proposal_status is not None:
        submission.proposal_status = payload.proposal_status
    if payload.admin_notes is not None:
        submission.admin_notes = payload.admin_notes
    await db.commit()
    await db.refresh(submission)

    if payload.proposal_status and payload.proposal_status != previous_status:
        background_tasks.add_task(
            send_custom_offer_status_update_sync,
            to_email=submission.buyer_email,
            first_name=_buyer_first_name(submission.buyer_name),
            reference=submission.reference,
            status_label=_status_label(submission.proposal_status),
            status_url=_status_url(submission.reference),
        )

    return _submission_to_admin_item(submission)
