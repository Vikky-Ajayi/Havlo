"""Pre-purchase / cart-abandonment email drip for StaleListings prospects.

Twelve emails, sent after the "Your Details" step is submitted without
checkout completing, counted from StaleListingProspect.contact_details_
submitted_at:

  1. 30 minutes   5. 4 days     9.  21 days
  2. 6 hours      6. 7 days     10. 30 days
  3. 24 hours     7. 10 days    11. 45 days
  4. 2 days       8. 14 days    12. 60 days

A prospect leaves the sequence permanently as soon as payment_status becomes
"completed" (they checked out) or unsubscribed_at is set (they clicked the
unsubscribe link in an email) — both checked fresh on every cycle, so a
late-arriving payment or unsubscribe always wins over an already-scheduled
send.

Per product decision, this only applies to prospects whose contact_details_
submitted_at is set after this feature shipped — no backfill of prospects
who already had contact details before then.

Alongside the email ladder, a separate SMS ladder runs Day 0 -> Day 90 every
3 days (see run_abandonment_sms_cycle below) — its own table
(StaleProspectAbandonmentSms), its own opt-out (sms_unsubscribed_at, not
unsubscribed_at), and a business-hours (8am-7pm Europe/London) send window.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingProspect, StaleProspectAbandonmentEmail, StaleProspectAbandonmentSms
from app.services import email_service, twilio_service
from app.services.scraper_base import run_scraper_loop
from app.services.stale_prospect_service import sms_unsubscribe_short_token, unsubscribe_token
from app.config import get_settings

logger = logging.getLogger(__name__)

# (stage, delay-since-contact_details_submitted_at). Stage numbers are
# stored in StaleProspectAbandonmentEmail.stage and must never be reused
# for a different delay — they're the idempotency key alongside prospect_id.
ABANDONMENT_STAGES: tuple[tuple[int, timedelta], ...] = (
    (1, timedelta(minutes=30)),
    (2, timedelta(hours=6)),
    (3, timedelta(hours=24)),
    (4, timedelta(days=2)),
    (5, timedelta(days=4)),
    (6, timedelta(days=7)),
    (7, timedelta(days=10)),
    (8, timedelta(days=14)),
    (9, timedelta(days=21)),
    (10, timedelta(days=30)),
    (11, timedelta(days=45)),
    (12, timedelta(days=60)),
)

# How many prospects to poll per cycle, and how many actual sends to perform
# per cycle. Sends are capped independently and much lower than the poll
# limit so that a long outage (loop down for days) catches up gradually —
# one stage per prospect per cycle, never a burst of everything at once.
_POLL_LIMIT = 500
_MAX_SENDS_PER_CYCLE = 100


def build_unsubscribe_url(prospect_id: UUID) -> str:
    base = (get_settings().FRONTEND_URL or "https://www.heyhavlo.com").rstrip("/")
    if "localhost" in base or "127.0.0.1" in base:
        base = "https://www.heyhavlo.com"
    token = unsubscribe_token(str(prospect_id))
    return f"{base}/api/v1/stale-listings/prospects/unsubscribe?prospect_id={prospect_id}&token={token}"


async def run_abandonment_email_cycle() -> dict:
    # contact_details_submitted_at is DateTime(timezone=True) — comes back
    # from the DB tz-aware. datetime.utcnow() is naive, so subtracting it
    # from that column raised "can't subtract offset-naive and
    # offset-aware datetimes" on every single cycle (this loop has been
    # crash-looping since it shipped; no abandonment email has gone out).
    now = datetime.now(timezone.utc)
    sent = 0
    skipped_already_sent = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(StaleListingProspect)
            .where(
                StaleListingProspect.contact_details_submitted_at.is_not(None),
                StaleListingProspect.payment_status != "completed",
                StaleListingProspect.unsubscribed_at.is_(None),
                StaleListingProspect.contact_email.is_not(None),
            )
            .order_by(StaleListingProspect.contact_details_submitted_at.asc())
            .limit(_POLL_LIMIT)
        )
        candidates = list(result.scalars().all())
        if not candidates:
            return {"candidates": 0, "sent": 0}

        candidate_ids = [c.id for c in candidates]
        sent_result = await db.execute(
            select(StaleProspectAbandonmentEmail.prospect_id, StaleProspectAbandonmentEmail.stage).where(
                StaleProspectAbandonmentEmail.prospect_id.in_(candidate_ids)
            )
        )
        sent_map: dict[UUID, set[int]] = {}
        for prospect_id, stage in sent_result.all():
            sent_map.setdefault(prospect_id, set()).add(stage)

    due: list[tuple[StaleListingProspect, int]] = []
    for prospect in candidates:
        if len(due) >= _MAX_SENDS_PER_CYCLE:
            break
        elapsed = now - prospect.contact_details_submitted_at
        already_sent = sent_map.get(prospect.id, set())
        # Only the earliest due-but-unsent stage — self-healing catch-up
        # instead of a burst if the loop was down for a while.
        for stage, delay in ABANDONMENT_STAGES:
            if stage in already_sent:
                continue
            if elapsed >= delay:
                due.append((prospect, stage))
            break  # stop at the first not-yet-sent stage either way

    for prospect, stage in due:
        try:
            delivered = await asyncio.to_thread(
                email_service.send_stale_prospect_abandonment_email_sync,
                to_email=prospect.contact_email,
                first_name=(prospect.contact_name or "").split(" ")[0] or "there",
                stage=stage,
                asking_price=prospect.asking_price,
                property_code=prospect.property_code,
                unsubscribe_url=build_unsubscribe_url(prospect.id),
            )
        except Exception:
            logger.exception(
                "Abandonment email send raised for prospect=%s stage=%s", prospect.id, stage
            )
            continue

        if not delivered:
            logger.warning(
                "Abandonment email not delivered (Resend unconfigured or failed) "
                "for prospect=%s stage=%s — will retry next cycle.",
                prospect.id, stage,
            )
            continue

        async with AsyncSessionLocal() as db:
            db.add(StaleProspectAbandonmentEmail(prospect_id=prospect.id, stage=stage))
            try:
                await db.commit()
                sent += 1
            except IntegrityError:
                # Another cycle already recorded this (prospect, stage) —
                # the email may have just been double-sent in a narrow race,
                # but the record is what stops a third one next cycle.
                await db.rollback()
                skipped_already_sent += 1

    return {
        "candidates": len(candidates),
        "due": len(due),
        "sent": sent,
        "skipped_already_recorded": skipped_already_sent,
    }


async def start_abandonment_email_loop() -> None:
    """Started once from app startup (see app/main.py), alongside the other
    dedicated background loops. Polls every 5 minutes — frequent enough that
    the 30-minute first email goes out within a few minutes of being due,
    cheap enough to run indefinitely."""
    await run_scraper_loop(
        "stale-prospect-abandonment",
        run_abandonment_email_cycle,
        interval_hours=5 / 60,
        initial_delay_seconds=30,
    )


# Day 0 -> Day 90 SMS ladder, every 3 days (31 stages) — separate from the
# 12-stage email ladder above: own table (StaleProspectAbandonmentSms), own
# opt-out (sms_unsubscribed_at rather than unsubscribed_at), own channel.
# Links via ?code={property_code} rather than a token — the same param the
# manual "Enter Property ID" entry already uses (StaleProspectWizard.tsx
# reads token OR code) — deliberately NOT reissuing a fresh access token
# the way the letter-resend paths do, since that would invalidate the QR
# code on any physical letter already mailed to this prospect. property_code
# carries no less exposure than a reissued token would (both are already
# shown/printed to the prospect).
#
# Stage numbers ARE the day number (0, 3, 6, ... 90) — see
# twilio_service.SMS_ABANDONMENT_STAGE_DAYS, the single source of truth for
# both the cadence and the copy.
_SMS_POLL_LIMIT = 500
_MAX_SMS_SENDS_PER_CYCLE = 100

# Business-hours send window, in the property market this targets — a text
# arriving at 2am reads very differently to one arriving at 2pm. A message
# that becomes "due" outside this window simply waits for the next 5-minute
# cycle that falls inside it; nothing is skipped or lost, just delayed.
_SMS_SEND_WINDOW_TZ = ZoneInfo("Europe/London")
_SMS_SEND_WINDOW_START_HOUR = 8   # 8am
_SMS_SEND_WINDOW_END_HOUR = 19    # 7pm (exclusive — last send opportunity is 18:59)


def _within_sms_send_window(now_utc: datetime) -> bool:
    local_hour = now_utc.astimezone(_SMS_SEND_WINDOW_TZ).hour
    return _SMS_SEND_WINDOW_START_HOUR <= local_hour < _SMS_SEND_WINDOW_END_HOUR


def build_sms_unsubscribe_url(property_code: str) -> str:
    """Distinct from build_unsubscribe_url (email) — points at its own
    endpoint and sets sms_unsubscribed_at, not unsubscribed_at. Uses the
    short /u/<code>?t=<12-char token> route (unsubscribe_stale_prospect_
    sms_short in stale_listings.py), not the long-form UUID+32-char-token
    one the email drip's link uses — that one alone was ~90+ characters,
    which does not fit alongside an actual message inside an SMS's
    character budget without pushing every send into extra segments."""
    base = (get_settings().FRONTEND_URL or "https://www.heyhavlo.com").rstrip("/")
    if "localhost" in base or "127.0.0.1" in base:
        base = "https://www.heyhavlo.com"
    token = sms_unsubscribe_short_token(property_code)
    return f"{base}/u/{property_code}?t={token}"


async def run_abandonment_sms_cycle() -> dict:
    now = datetime.now(timezone.utc)
    sent = 0

    if not _within_sms_send_window(now):
        return {"candidates": 0, "sent": 0, "skipped_outside_send_window": True}

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(StaleListingProspect)
            .where(
                StaleListingProspect.contact_details_submitted_at.is_not(None),
                StaleListingProspect.payment_status != "completed",
                StaleListingProspect.sms_unsubscribed_at.is_(None),
                StaleListingProspect.contact_phone.is_not(None),
            )
            .order_by(StaleListingProspect.contact_details_submitted_at.asc())
            .limit(_SMS_POLL_LIMIT)
        )
        candidates = list(result.scalars().all())
        if not candidates:
            return {"candidates": 0, "sent": 0}

        candidate_ids = [c.id for c in candidates]
        sent_result = await db.execute(
            select(StaleProspectAbandonmentSms.prospect_id, StaleProspectAbandonmentSms.stage).where(
                StaleProspectAbandonmentSms.prospect_id.in_(candidate_ids)
            )
        )
        sent_map: dict[UUID, set[int]] = {}
        for prospect_id, stage in sent_result.all():
            sent_map.setdefault(prospect_id, set()).add(stage)

    due: list[tuple[StaleListingProspect, int]] = []
    for prospect in candidates:
        if len(due) >= _MAX_SMS_SENDS_PER_CYCLE:
            break
        elapsed = now - prospect.contact_details_submitted_at
        already_sent = sent_map.get(prospect.id, set())
        # Only the earliest due-but-unsent stage — self-healing catch-up
        # instead of a burst if the loop was down (or outside send hours)
        # for a while, same pattern as the email ladder.
        for day in twilio_service.SMS_ABANDONMENT_STAGE_DAYS:
            if day in already_sent:
                continue
            if elapsed >= timedelta(days=day):
                due.append((prospect, day))
            break

    base_url = (get_settings().FRONTEND_URL or "https://www.heyhavlo.com").rstrip("/")
    if "localhost" in base_url or "127.0.0.1" in base_url:
        base_url = "https://www.heyhavlo.com"

    for prospect, stage in due:
        e164 = twilio_service.normalize_to_e164(prospect.contact_phone or "")
        # step=assessment overrides the wizard's normal resume-where-you-
        # left-off default, which would otherwise send anyone with contact
        # details on file and pending payment straight back to the Payment
        # step (see StaleProspectWizard.tsx's boot effect) — right for
        # someone revisiting their own link mid-checkout, wrong for a
        # re-engagement nudge, which should show the value again (the free
        # assessment snippet) before asking them to pay a second time.
        preview_url = f"{base_url}/stale-listings/prospect?code={prospect.property_code}&step=assessment"
        unsubscribe_url = build_sms_unsubscribe_url(prospect.property_code)

        if not e164:
            # An unusable number will never become usable on its own —
            # still record this stage as "handled" (below) so this
            # prospect isn't re-checked at every stage forever, exactly
            # like recording a real send, just without one going out.
            delivered = False
            skip_reason = f"unusable phone number: {prospect.contact_phone!r}"
        else:
            try:
                delivered = await asyncio.to_thread(
                    twilio_service.send_stale_prospect_abandonment_sms,
                    e164,
                    stage,
                    preview_url,
                    unsubscribe_url,
                )
            except Exception:
                logger.exception("Abandonment SMS send raised for prospect=%s stage=%s", prospect.id, stage)
                continue
            skip_reason = "Twilio unconfigured or rejected the message" if not delivered else ""

        if not delivered and e164:
            # Genuine Twilio failure — leave this stage unrecorded so it
            # retries next cycle, same as the email cycle above.
            async with AsyncSessionLocal() as db:
                fresh = await db.get(StaleListingProspect, prospect.id)
                if fresh:
                    fresh.last_error = f"Abandonment SMS (day {stage}) not delivered — {skip_reason}"
                    await db.commit()
            continue

        async with AsyncSessionLocal() as db:
            db.add(StaleProspectAbandonmentSms(prospect_id=prospect.id, stage=stage))
            if not delivered:
                fresh = await db.get(StaleListingProspect, prospect.id)
                if fresh:
                    fresh.last_error = f"Abandonment SMS (day {stage}) skipped — {skip_reason}"
            try:
                await db.commit()
                if delivered:
                    sent += 1
            except IntegrityError:
                # Another cycle already recorded this (prospect, stage).
                await db.rollback()

    return {"candidates": len(candidates), "due": len(due), "sent": sent}


async def start_abandonment_sms_loop() -> None:
    """Started once from app startup (see app/main.py), alongside the email
    loop. Same 5-minute polling cadence — frequent enough that a message
    goes out within minutes of both being due AND the send window opening."""
    await run_scraper_loop(
        "stale-prospect-abandonment-sms",
        run_abandonment_sms_cycle,
        interval_hours=5 / 60,
        initial_delay_seconds=45,
    )
