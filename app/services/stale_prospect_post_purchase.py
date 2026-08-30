"""Post-purchase nurture / upsell email drip for StaleListings prospects
("phase two" — see app/services/stale_prospect_abandonment.py for "phase
one", the pre-purchase / cart-abandonment drip).

Twelve emails, counted from StaleListingProspect.unlocked_at (set the moment
payment_status becomes "completed"):

  1. immediately   5. day 25    9.  day 43
  2. day 7         6. day 29    10. day 49
  3. day 14        7. day 35    11. day 53
  4. day 21        8. day 39    12. day 56

Stage 1 (the "your assessment is ready" delivery) always sends regardless of
unsubscribed_at — it's the transactional confirmation of what they already
paid for, not marketing, and a prior opt-out on the pre-purchase drip must
never block a paying customer from being told their purchase is ready.
Stages 2-12 (all nurture/upsell) skip once unsubscribed_at is set, same as
the pre-purchase drip.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingProspect, StaleProspectPostPurchaseEmail
from app.services import email_service
from app.services.scraper_base import run_scraper_loop
from app.services.stale_prospect_abandonment import build_unsubscribe_url

logger = logging.getLogger(__name__)

POST_PURCHASE_STAGES: tuple[tuple[int, timedelta], ...] = (
    (1, timedelta(days=0)),
    (2, timedelta(days=7)),
    (3, timedelta(days=14)),
    (4, timedelta(days=21)),
    (5, timedelta(days=25)),
    (6, timedelta(days=29)),
    (7, timedelta(days=35)),
    (8, timedelta(days=39)),
    (9, timedelta(days=43)),
    (10, timedelta(days=49)),
    (11, timedelta(days=53)),
    (12, timedelta(days=56)),
)

_POLL_LIMIT = 500
_MAX_SENDS_PER_CYCLE = 100


async def run_post_purchase_email_cycle() -> dict:
    # unlocked_at is DateTime(timezone=True) — comes back from the DB
    # tz-aware. datetime.utcnow() is naive, so subtracting it from that
    # column raised "can't subtract offset-naive and offset-aware
    # datetimes" on every single cycle (this loop has been crash-looping
    # since it shipped; no post-purchase nurture email has gone out).
    now = datetime.now(timezone.utc)
    sent = 0
    skipped_already_sent = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(StaleListingProspect)
            .where(
                StaleListingProspect.unlocked_at.is_not(None),
                StaleListingProspect.contact_email.is_not(None),
            )
            .order_by(StaleListingProspect.unlocked_at.asc())
            .limit(_POLL_LIMIT)
        )
        candidates = list(result.scalars().all())
        if not candidates:
            return {"candidates": 0, "sent": 0}

        candidate_ids = [c.id for c in candidates]
        sent_result = await db.execute(
            select(StaleProspectPostPurchaseEmail.prospect_id, StaleProspectPostPurchaseEmail.stage).where(
                StaleProspectPostPurchaseEmail.prospect_id.in_(candidate_ids)
            )
        )
        sent_map: dict[UUID, set[int]] = {}
        for prospect_id, stage in sent_result.all():
            sent_map.setdefault(prospect_id, set()).add(stage)

    due: list[tuple[StaleListingProspect, int]] = []
    for prospect in candidates:
        if len(due) >= _MAX_SENDS_PER_CYCLE:
            break
        elapsed = now - prospect.unlocked_at
        already_sent = sent_map.get(prospect.id, set())
        for stage, delay in POST_PURCHASE_STAGES:
            if stage in already_sent:
                continue
            # Stage 1 is transactional (delivering the purchase itself) and
            # always sends. Stages 2-12 are nurture/upsell and respect an
            # earlier unsubscribe from either drip.
            if stage > 1 and prospect.unsubscribed_at is not None:
                break
            if elapsed >= delay:
                due.append((prospect, stage))
            break  # earliest due-but-unsent stage only, per prospect per cycle

    for prospect, stage in due:
        try:
            delivered = await asyncio.to_thread(
                email_service.send_stale_prospect_post_purchase_email_sync,
                to_email=prospect.contact_email,
                first_name=(prospect.contact_name or "").split(" ")[0] or "there",
                stage=stage,
                asking_price=prospect.asking_price,
                property_code=prospect.property_code,
                unsubscribe_url=build_unsubscribe_url(prospect.id),
            )
        except Exception:
            logger.exception(
                "Post-purchase email send raised for prospect=%s stage=%s", prospect.id, stage
            )
            continue

        if not delivered:
            logger.warning(
                "Post-purchase email not delivered (Resend unconfigured or failed) "
                "for prospect=%s stage=%s — will retry next cycle.",
                prospect.id, stage,
            )
            continue

        async with AsyncSessionLocal() as db:
            db.add(StaleProspectPostPurchaseEmail(prospect_id=prospect.id, stage=stage))
            try:
                await db.commit()
                sent += 1
            except IntegrityError:
                await db.rollback()
                skipped_already_sent += 1

    return {
        "candidates": len(candidates),
        "due": len(due),
        "sent": sent,
        "skipped_already_recorded": skipped_already_sent,
    }


async def start_post_purchase_email_loop() -> None:
    """Started once from app startup (see app/main.py). Polls every 5
    minutes — plenty for the coarsest schedule here (day-granularity after
    the immediate first send)."""
    await run_scraper_loop(
        "stale-prospect-post-purchase",
        run_post_purchase_email_cycle,
        interval_hours=5 / 60,
        initial_delay_seconds=45,
    )
