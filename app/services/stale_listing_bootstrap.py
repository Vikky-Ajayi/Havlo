from __future__ import annotations

import asyncio
import json
import logging
import random
import string
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import StaleListingAssessment
from app.config import get_settings
from app.services.email_service import send_stale_listing_agent_notification_sync
from app.services.groq_service import generate_stale_listing_report
from app.services.listing_scraper import detect_listing_platform, scrape_single_listing
from app.services.stale_review_access import issue_stale_review_magic_link

logger = logging.getLogger(__name__)

DEFAULT_STALE_BOOTSTRAP_QUESTIONS: dict[str, Any] = {
    "q1_viewings": "1-3 viewings in the last 8 weeks",
    "q2_feedback": [
        "Too expensive for the area",
        "Photos did not stand out",
        "Smaller than expected",
    ],
    "q3_under_offer": "No",
    "q4_price_reduction": "No, price unchanged since launch",
    "q5_flexibility": "Open to pricing and presentation changes if supported by evidence",
    "q6_marketing": [
        "Rightmove only",
        "Estate agent website",
    ],
    "q7_listing_features": [
        "Photos",
        "Floor plan",
    ],
    "q8_photos": "Not satisfied",
    "q9_asking_price": "Close to asking price",
    "q10_challenge": "Low viewing numbers despite being on the market for a long time",
}

DEFAULT_STALE_BOOTSTRAP_PLANS = [
    "quick_insight",
    "professional_review",
    "premium_strategy",
]


def _generate_reference() -> str:
    chars = string.ascii_uppercase + string.digits
    return f"SL-{''.join(random.choices(chars, k=6))}"


def _listing_snapshot(raw: dict[str, Any], listing_url: str) -> dict[str, str]:
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
        "platform": str(raw.get("platform") or detect_listing_platform(listing_url)),
    }


def _snapshot_has_content(snapshot: dict[str, str]) -> bool:
    return any(
        str(snapshot.get(field) or "").strip()
        for field in ("address", "price", "image", "bedrooms", "bathrooms", "property_type", "platform")
    )


async def bootstrap_stale_listing_assessments(
    db: AsyncSession,
    *,
    listing_url: str,
    customer_email: str,
    plans: list[str] | None = None,
    first_name: str = "Vino",
    last_name: str = "Vestige",
    phone_country_code: str = "+44",
    phone: str = "0000000000",
    force: bool = False,
) -> list[dict[str, Any]]:
    selected_plans = plans or list(DEFAULT_STALE_BOOTSTRAP_PLANS)
    normalized_email = (customer_email or "").strip().lower()
    if not normalized_email:
        raise ValueError("customer_email is required.")
    if not listing_url.strip():
        raise ValueError("listing_url is required.")

    scraped_listing = await scrape_single_listing(listing_url)
    property_address = str(scraped_listing.get("address") or scraped_listing.get("title") or "").strip()
    if not property_address:
        raise ValueError("Could not scrape a usable property address from the listing URL.")

    snapshot = _listing_snapshot(scraped_listing, listing_url)

    if not force:
        existing = await db.execute(
            select(StaleListingAssessment).where(
                StaleListingAssessment.email == normalized_email,
                StaleListingAssessment.listing_url == listing_url,
                StaleListingAssessment.package.in_(selected_plans),
            )
        )
        existing_rows = list(existing.scalars().all())
        if existing_rows:
            raise ValueError(
                f"Found {len(existing_rows)} existing stale-listings assessment(s) for {normalized_email} and this listing. "
                "Pass force=True to create another production test set."
            )

    created: list[dict[str, Any]] = []

    for plan in selected_plans:
        assessment = StaleListingAssessment(
            email=normalized_email,
            first_name=first_name,
            last_name=last_name,
            phone_country_code=phone_country_code,
            phone=phone,
            package=plan,
            property_address=property_address,
            listing_url=listing_url,
            questions_data=json.dumps(DEFAULT_STALE_BOOTSTRAP_QUESTIONS, ensure_ascii=False),
            payment_status="completed",
            report_status="pending",
            listing_image_url=snapshot.get("image") or None,
            listing_snapshot_json=json.dumps(snapshot, ensure_ascii=False),
            reference=_generate_reference(),
            sumup_checkout_id=None,
            sumup_checkout_url=None,
        )
        db.add(assessment)
        await db.commit()
        await db.refresh(assessment)

        refreshed_listing = await scrape_single_listing(listing_url)
        refreshed_snapshot = _listing_snapshot(refreshed_listing, listing_url)
        report_dict = await generate_stale_listing_report(
            package=plan,
            questions_data=DEFAULT_STALE_BOOTSTRAP_QUESTIONS,
            property_address=property_address,
            listing_url=listing_url,
            listing_snapshot=refreshed_snapshot,
        )
        assessment.ai_report_json = json.dumps(report_dict, ensure_ascii=False)
        assessment.ai_report_generated_at = datetime.utcnow()
        if refreshed_snapshot.get("image"):
            assessment.listing_image_url = refreshed_snapshot["image"]
        if _snapshot_has_content(refreshed_snapshot):
            assessment.listing_snapshot_json = json.dumps(refreshed_snapshot, ensure_ascii=False)
            if not assessment.property_address and refreshed_snapshot.get("address"):
                assessment.property_address = refreshed_snapshot["address"]
        assessment.report_status = "in_review"

        review_recipient = (get_settings().ADMIN_NOTIFY_EMAIL or "").strip()
        review_url = ""
        if review_recipient:
            review_url = await issue_stale_review_magic_link(
                db,
                recipient_email=review_recipient,
                assessment_id=str(assessment.id),
                reference=assessment.reference,
            )

        await db.commit()

        if review_recipient:
            sent = await asyncio.to_thread(
                send_stale_listing_agent_notification_sync,
                first_name,
                last_name,
                normalized_email,
                assessment.reference,
                plan,
                assessment.property_address or property_address,
                listing_url,
                review_url,
            )
            if not sent:
                logger.warning("Agent review email did not send for %s", assessment.reference)

        refreshed_result = await db.execute(
            select(StaleListingAssessment).where(StaleListingAssessment.id == uuid.UUID(str(assessment.id)))
        )
        refreshed = refreshed_result.scalar_one()

        created.append(
            {
                "assessment_id": str(refreshed.id),
                "reference": refreshed.reference,
                "package": refreshed.package,
                "email": refreshed.email,
                "payment_status": refreshed.payment_status,
                "report_status": refreshed.report_status,
                "property_address": refreshed.property_address,
                "listing_url": refreshed.listing_url,
                "has_ai_report": bool(refreshed.ai_report_json),
                "listing_image_url": refreshed.listing_image_url,
            }
        )

    return created
