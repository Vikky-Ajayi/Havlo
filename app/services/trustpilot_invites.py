"""Trustpilot review invitations for promo-code customers (Nov 2026).

A campaign to hear what the customers we gave the promo code thought of
their assessment: everyone who checks out with it gets a Trustpilot
invitation to review Havlo. Card customers aren't invited (yet).

Uses Trustpilot's Automatic Feedback Service (AFS): we email the account's
AFS address (settings.TRUSTPILOT_AFS_EMAIL) with the customer in a
structured-data snippet, and Trustpilot sends them its invitation, after
the delay set under Invitation methods in Trustpilot Business. The customer
never sees our email.

Requested once the customer has their report (at payment, or at release for
an expert-reviewed one held 48-72 hours), once per email address. Internal
addresses (settings.TEST_ORDER_EMAILS) are skipped, so the team trying the
code never sends one. Only promo checkouts from STARTED_AT onwards: earlier
ones were mostly the team opening reports with the code.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from html import escape
from typing import Any

from sqlalchemy import func, or_, select

from app.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingProspect
from app.services import analyst_review, attribution

logger = logging.getLogger(__name__)

STARTED_AT = datetime(2026, 11, 15, tzinfo=timezone.utc)
_BATCH = 50


def wants_invite(prospect: Any) -> bool:
    """Checked out with the promo code, has their report, not yet invited."""
    email = (getattr(prospect, "contact_email", None) or "").strip()
    unlocked = analyst_review._aware(getattr(prospect, "unlocked_at", None))
    return (getattr(prospect, "payment_method", None) == "promo"
            and getattr(prospect, "trustpilot_invited_at", None) is None
            and "@" in email
            and not attribution.internal_email(email)
            and unlocked is not None and unlocked >= STARTED_AT
            and analyst_review.report_available(prospect))


def snippet(prospect: Any) -> dict:
    """What Trustpilot reads from the email: who to invite, and a reference
    unique to this purchase (property codes get reused; ids don't)."""
    return {
        "recipientEmail": prospect.contact_email.strip(),
        "recipientName": (prospect.contact_name or "").strip() or "Havlo customer",
        "referenceId": str(prospect.id),
        "locale": "en-GB",
    }


def render(prospect: Any) -> tuple[str, str, str]:
    data = snippet(prospect)
    subject = f"Havlo assessment {prospect.property_code}: review invitation"
    blob = json.dumps(data).replace("</", "<\\/")
    html = (f'<html><body><script type="application/json+trustpilot">{blob}</script>'
            f"<p>Promo-code assessment for {escape(data['recipientName'])}.</p></body></html>")
    plain = f"Promo-code assessment for {data['recipientName']}."
    return subject, html, plain


async def run_invite_cycle() -> dict:
    """Ask Trustpilot to invite every promo-code customer who's due one."""
    afs = (get_settings().TRUSTPILOT_AFS_EMAIL or "").strip()
    if not afs:
        return {"invited": 0, "skipped": "TRUSTPILOT_AFS_EMAIL not set"}

    from app.services import email_service

    invited = 0
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(StaleListingProspect)
            .where(StaleListingProspect.payment_method == "promo",
                   StaleListingProspect.payment_status == "completed",
                   StaleListingProspect.trustpilot_invited_at.is_(None),
                   StaleListingProspect.contact_email.is_not(None),
                   StaleListingProspect.unlocked_at >= STARTED_AT,
                   or_(StaleListingProspect.analyst_review_due_at.is_(None),
                       StaleListingProspect.report_released_at.is_not(None)))
            .order_by(StaleListingProspect.unlocked_at)
        )).scalars().all()
        for prospect in rows:
            if invited >= _BATCH:
                break
            if not wants_invite(prospect):
                continue
            email = prospect.contact_email.strip().lower()
            already = (await db.execute(
                select(func.count()).select_from(StaleListingProspect)
                .where(func.lower(func.trim(StaleListingProspect.contact_email)) == email,
                       StaleListingProspect.trustpilot_invited_at.is_not(None))
            )).scalar_one()
            if already:
                # Invited for another property: once per person is enough.
                prospect.trustpilot_invited_at = datetime.now(timezone.utc)
                continue
            subject, html, plain = render(prospect)
            if await asyncio.to_thread(email_service._send_sync, afs, subject, html, plain):
                prospect.trustpilot_invited_at = datetime.now(timezone.utc)
                invited += 1
                logger.info("Trustpilot invitation requested for prospect %s.", prospect.property_code)
            await db.commit()
        await db.commit()
    return {"invited": invited}
