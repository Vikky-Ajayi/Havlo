"""The analyst-review funnel (/review/seller, /review/agent).

Those pages sell an analyst-reviewed report rather than an instant one. On
payment (mark_paid) such a lead's report is held for 48 hours
(analyst_review_due_at) while a Havlo analyst reads it and edits it in the
prospects console. It goes out (report_released_at) when that time comes,
or earlier with "Release now" in the console, and the customer is emailed a
link to it ("your report is ready"); the email is retried until delivered.

While a report is held, everything that would show or announce it waits:
the report and agent-report endpoints, the 90-day dashboard and its text
(listing_monitor), and the post-purchase drip, whose first email ("your
report is ready") this one replaces for these customers.

Every other funnel leaves both columns NULL, so nothing here changes them.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingProspect
from app.services.scraper_base import run_scraper_loop

logger = logging.getLogger(__name__)

# ads_funnel.seller_source("review") and agent_source("review"). Not the
# "review_agent_listing" owner prospect made for an agent's link: nobody
# buys that one.
REVIEW_LEAD_SOURCES = ("review_seller", "review_agent")
REVIEW_PERIOD = timedelta(hours=48)
# Give up on a "report ready" email that still hasn't gone after this long
# (Resend down or unconfigured); the report itself is already open to them.
EMAIL_RETRY_LIMIT = timedelta(days=7)
_EMAIL_BATCH = 50


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def is_review_lead(prospect: StaleListingProspect) -> bool:
    return prospect.lead_source in REVIEW_LEAD_SOURCES


def mark_paid(prospect: StaleListingProspect, now: datetime | None = None) -> None:
    """Every way a prospect's payment completes (card, promo code, bank
    transfer) goes through here. The caller commits."""
    now = now or _now()
    prospect.payment_status = "completed"
    prospect.unlocked_at = now
    if is_review_lead(prospect) and prospect.analyst_review_due_at is None and prospect.report_released_at is None:
        prospect.analyst_review_due_at = now + REVIEW_PERIOD


def report_on_hold(prospect: StaleListingProspect) -> bool:
    """Paid for, but the analyst review isn't finished."""
    return prospect.analyst_review_due_at is not None and prospect.report_released_at is None


def report_available(prospect: StaleListingProspect) -> bool:
    return prospect.payment_status == "completed" and not report_on_hold(prospect)


def purchase_started_at(prospect: StaleListingProspect) -> datetime | None:
    """When the customer got their report: release for a reviewed one,
    payment for the rest. Anchors the post-purchase drip and the 90-day
    dashboard."""
    return _aware(prospect.report_released_at) or _aware(prospect.unlocked_at)


def release(prospect: StaleListingProspect, now: datetime | None = None) -> bool:
    """Release a held report. False if it wasn't held. The caller commits
    and then calls deliver_report_ready."""
    if not report_on_hold(prospect):
        return False
    prospect.report_released_at = now or _now()
    return True


def funnel_path(prospect: StaleListingProspect) -> str:
    """The page a homeowner's Stale Listings emails and texts link back to:
    the analyst-review page for its sellers, the letter funnel otherwise."""
    return "/review/seller" if prospect.lead_source == "review_seller" else "/stale-listings/prospect"


def report_access_token(prospect_id: Any) -> str:
    """The access token in the "report ready" email's link. Derived from the
    prospect id, so a retried email carries the same link and only one hash
    is ever added to the prospect."""
    secret = (get_settings().SECRET_KEY or "").encode("utf-8")
    return hmac.new(secret, f"analyst-report:{prospect_id}".encode("utf-8"), hashlib.sha256).hexdigest()[:43]


def report_url(prospect: StaleListingProspect) -> str:
    """Back to the /review/ page the customer bought from, which opens the report
    for a released prospect. Adds the link's token to the prospect (the
    caller commits)."""
    from app.services import stale_prospect_service as sps
    from app.services.email_service import _frontend_base_url

    token = report_access_token(prospect.id)
    token_hash = sps.hash_access_token(token)
    if token_hash not in (prospect.qr_token_hashes or []):
        prospect.qr_token_hashes = [*(prospect.qr_token_hashes or []), token_hash]
    page = "agent" if prospect.audience == "agent" else "seller"
    return f"{_frontend_base_url()}/review/{page}?token={token}"


async def deliver_report_ready(prospect_id: UUID | str) -> bool:
    """Email a released report's link, once. True when it's been sent (now
    or before)."""
    from app.services import email_service
    from app.services import stale_prospect_service as sps
    from app.services.stale_prospect_abandonment import build_unsubscribe_url

    pid = UUID(str(prospect_id))
    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, pid)
        if prospect is None or prospect.report_released_at is None:
            return False
        if prospect.report_ready_emailed_at is not None:
            return True
        if not prospect.contact_email:
            return False
        expanded = sps.is_report_expanded(prospect)
    if not expanded:
        # Normally done at payment; make sure the link opens the full report.
        await sps.expand_report_in_background(str(pid))

    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, pid)
        url = report_url(prospect)
        await db.commit()
        details = {
            "to_email": prospect.contact_email,
            "first_name": (prospect.contact_name or "").split(" ")[0] or "there",
            "property_address": prospect.property_address,
            "report_url": url,
            "unsubscribe_url": build_unsubscribe_url(prospect.id),
            "audience": prospect.audience,
        }
    try:
        sent = await asyncio.to_thread(email_service.send_analyst_report_ready_email_sync, **details)
    except Exception:  # noqa: BLE001
        logger.exception("Report-ready email raised for prospect %s", pid)
        sent = False
    if not sent:
        logger.warning("Report-ready email not delivered for prospect %s; will retry.", pid)
        return False
    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, pid)
        if prospect is not None and prospect.report_ready_emailed_at is None:
            prospect.report_ready_emailed_at = _now()
            await db.commit()
    return True


async def run_release_cycle(now: datetime | None = None) -> dict[str, int]:
    """Release every held report whose 48 hours are up, then email every
    released report not yet emailed."""
    now = now or _now()
    async with AsyncSessionLocal() as db:
        due = (await db.execute(
            select(StaleListingProspect)
            .where(
                StaleListingProspect.payment_status == "completed",
                StaleListingProspect.analyst_review_due_at.is_not(None),
                StaleListingProspect.analyst_review_due_at <= now,
                StaleListingProspect.report_released_at.is_(None),
            )
            .limit(200)
        )).scalars().all()
        for prospect in due:
            release(prospect, now)
        await db.commit()
        to_email = (await db.execute(
            select(StaleListingProspect.id)
            .where(
                StaleListingProspect.report_released_at.is_not(None),
                StaleListingProspect.report_released_at >= now - EMAIL_RETRY_LIMIT,
                StaleListingProspect.analyst_review_due_at.is_not(None),
                StaleListingProspect.report_ready_emailed_at.is_(None),
                StaleListingProspect.contact_email.is_not(None),
            )
            .order_by(StaleListingProspect.report_released_at.asc())
            .limit(_EMAIL_BATCH)
        )).scalars().all()
    emailed = 0
    for pid in to_email:
        if await deliver_report_ready(pid):
            emailed += 1
    return {"released": len(due), "emailed": emailed}


async def start_release_loop() -> None:
    """Started once from app startup (app/main.py). Every 5 minutes, so a
    report goes out within minutes of its 48 hours."""
    await run_scraper_loop(
        "analyst-review-release",
        run_release_cycle,
        interval_hours=5 / 60,
        initial_delay_seconds=75,
    )
