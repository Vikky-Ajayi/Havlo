"""Follow-ups to estate agencies in the agent campaign, once per agency.

An agency gives its details once (see agent_campaign.remember_agency_contact);
from then on this sends a short sequence to those details, counted from
StaleAgentAccount.contact_details_submitted_at, about its whole portfolio
rather than one property:

  emails: 1 hour, then day 1, 3, 7, 14, 30
  texts:  day 1 and day 7, 8am-7pm UK time only

An agency leaves the sequence once it buys any report (someone there is
engaged; follow-up is then personal), or unsubscribes -- email and SMS
separately, like the owner drips. Each (agency, channel, stage) is recorded
in StaleAgentFollowup, so nothing goes out twice; only the earliest due
stage per channel is sent each cycle, and never within MIN_GAP of the last
message on that channel, so an outage catches up gradually.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.models import StaleAgentAccount, StaleAgentFollowup, StaleListingProspect
from app.services import agent_campaign, email_service, twilio_service
from app.services.stale_prospect_abandonment import _within_sms_send_window
from app.services.stale_prospect_service import sms_unsubscribe_short_token, unsubscribe_token

logger = logging.getLogger(__name__)

EMAIL_STAGES: tuple[tuple[int, timedelta], ...] = (
    (1, timedelta(hours=1)),
    (2, timedelta(days=1)),
    (3, timedelta(days=3)),
    (4, timedelta(days=7)),
    (5, timedelta(days=14)),
    (6, timedelta(days=30)),
)
SMS_STAGES: tuple[tuple[int, timedelta], ...] = (
    (1, timedelta(days=1)),
    (2, timedelta(days=7)),
)
MIN_GAP = timedelta(hours=20)
_MAX_SENDS_PER_CYCLE = 50


def _flag(name: str) -> bool | None:
    raw = os.getenv(name, "").strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    return None


def sms_enabled() -> bool:
    """ENABLE_AGENT_FOLLOWUP_SMS if set; otherwise texts go to agencies
    whenever they go to owners (ENABLE_STALE_PROSPECT_ABANDONMENT_SMS)."""
    own = _flag("ENABLE_AGENT_FOLLOWUP_SMS")
    return own if own is not None else bool(_flag("ENABLE_STALE_PROSPECT_ABANDONMENT_SMS"))


def _public_base() -> str:
    base = (get_settings().FRONTEND_URL or "https://www.heyhavlo.com").rstrip("/")
    return "https://www.heyhavlo.com" if "localhost" in base or "127.0.0.1" in base else base


def email_unsubscribe_key(account_id: UUID | str) -> str:
    return f"agency:{account_id}"


def sms_unsubscribe_key(agent_code: str) -> str:
    return f"agency-{agent_code}"


def build_email_unsubscribe_url(account_id: UUID) -> str:
    token = unsubscribe_token(email_unsubscribe_key(account_id))
    return f"{_public_base()}/api/v1/stale-listings/agents/unsubscribe?account_id={account_id}&token={token}"


def build_sms_unsubscribe_url(agent_code: str) -> str:
    return f"{_public_base()}/ua/{agent_code}?t={sms_unsubscribe_short_token(sms_unsubscribe_key(agent_code))}"


def _next_due(stages: tuple[tuple[int, timedelta], ...], elapsed: timedelta, sent: set[int]) -> int | None:
    for stage, delay in stages:
        if stage in sent:
            continue
        return stage if elapsed >= delay else None
    return None


async def _record(account_id: UUID, channel: str, stage: int) -> bool:
    async with AsyncSessionLocal() as db:
        db.add(StaleAgentFollowup(account_id=account_id, channel=channel, stage=stage))
        try:
            await db.commit()
            return True
        except IntegrityError:
            await db.rollback()
            return False


async def run_agent_followup_cycle() -> dict:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        accounts = (await db.execute(
            select(StaleAgentAccount)
            .where(StaleAgentAccount.contact_details_submitted_at.is_not(None))
            .where(StaleAgentAccount.contact_email.is_not(None))
            .order_by(StaleAgentAccount.contact_details_submitted_at.asc())
        )).scalars().all()
        if not accounts:
            return {"agencies": 0, "sent": 0}
        ids = [a.id for a in accounts]
        purchased = set((await db.execute(
            select(StaleListingProspect.agent_account_id)
            .where(StaleListingProspect.agent_account_id.in_(ids))
            .where(StaleListingProspect.unlocked_at.is_not(None))
        )).scalars().all())
        sent: dict[tuple[UUID, str], set[int]] = {}
        last_sent: dict[tuple[UUID, str], datetime] = {}
        for account_id, channel, stage, created_at in (await db.execute(
            select(
                StaleAgentFollowup.account_id, StaleAgentFollowup.channel,
                StaleAgentFollowup.stage, StaleAgentFollowup.created_at,
            ).where(StaleAgentFollowup.account_id.in_(ids))
        )).all():
            key = (account_id, channel)
            sent.setdefault(key, set()).add(stage)
            if created_at and (key not in last_sent or created_at > last_sent[key]):
                last_sent[key] = created_at

    sms_window = sms_enabled() and _within_sms_send_window(now)
    due: list[tuple[StaleAgentAccount, str, int]] = []
    for account in accounts:
        if account.id in purchased:
            continue
        elapsed = now - account.contact_details_submitted_at
        channels = []
        if account.unsubscribed_at is None:
            channels.append(("email", EMAIL_STAGES))
        if account.sms_unsubscribed_at is None and account.contact_phone and sms_window:
            channels.append(("sms", SMS_STAGES))
        for channel, stages in channels:
            last = last_sent.get((account.id, channel))
            if last is not None and now - last < MIN_GAP:
                continue
            stage = _next_due(stages, elapsed, sent.get((account.id, channel), set()))
            if stage:
                due.append((account, channel, stage))

    delivered_count = 0
    for account, channel, stage in due[:_MAX_SENDS_PER_CYCLE]:
        # A fresh portfolio link for each message (earlier ones keep working).
        async with AsyncSessionLocal() as db:
            fresh = await db.get(StaleAgentAccount, account.id)
            if fresh is None:
                continue
            listing_count = len(await agent_campaign.portfolio(db, fresh))
            token = agent_campaign.issue_account_token(fresh)
            await db.commit()
        link = f"{_public_base()}/check/agent?token={token}"
        brand = account.brand or agent_campaign.display_company_name(account.company_name)
        first_name = (account.contact_name or "").split(" ")[0] or "there"
        try:
            if channel == "email":
                delivered = await asyncio.to_thread(
                    email_service.send_stale_agent_followup_email_sync,
                    to_email=account.contact_email,
                    first_name=first_name,
                    stage=stage,
                    brand=brand,
                    listing_count=listing_count,
                    agent_code=account.agent_code,
                    portfolio_url=link,
                    unsubscribe_url=build_email_unsubscribe_url(account.id),
                )
            else:
                e164 = twilio_service.normalize_to_e164(account.contact_phone or "")
                if not e164:
                    # Never becomes usable on its own: mark it handled.
                    await _record(account.id, "sms", stage)
                    continue
                delivered = await asyncio.to_thread(
                    twilio_service.send_stale_agent_followup_sms,
                    e164, stage, brand=brand, count=listing_count, link=link,
                    unsubscribe_url=build_sms_unsubscribe_url(account.agent_code),
                )
        except Exception:  # noqa: BLE001
            logger.exception("Agent follow-up %s stage %s raised for agency %s", channel, stage, account.id)
            continue
        if not delivered:
            logger.warning("Agent follow-up %s stage %s not delivered for agency %s; will retry", channel, stage, account.id)
            continue
        if await _record(account.id, channel, stage):
            delivered_count += 1
    return {"agencies": len(accounts), "due": len(due), "sent": delivered_count, "sms_window": sms_window}
