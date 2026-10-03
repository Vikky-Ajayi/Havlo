"""Email flows for Meta-ads leads (see app/services/ads_funnel.py).

Three sequences, their copy word for word from the briefs and kept in
app/services/ads_email_content/ (except that the reminders mention only
Rightmove, the one site we read listings from, where the brief also named
Zoopla and OnTheMarket):

- url_reminder.json: 5 emails (immediately, days 1, 3, 7, 14) to a visitor
  who asked to be reminded to add their listing link. Stops once a link is
  submitted or they unsubscribe.
- vendor.json: the 6-month homeowner nurture, 52 emails counted from when
  they gave their details, plus a 3-email checkout-recovery branch
  (2h, 24h, 72h after first reaching the Payment step).
- agent.json: the 12-month agent nurture, 104 emails, the same checkout
  branch, and a "property sold / withdrawn" email.

Nurture exits: purchase (payment_status "completed") or unsubscribe stop
both flows, for the person rather than one listing: unsubscribing from any
of their listings' emails stops them all, and an agent who buys any
assessment gets no more of these emails. "Property sold" stops a homeowner's emails; for an agent it
sends the sold email once and from then on skips every email about that
property, keeping the ones that invite them to assess another listing.

The checkout branch pauses the main flow while it runs. When it ends the
main flow picks up at the next scheduled email: like after any gap (the
loop being down), emails whose time passed in the meantime are skipped
rather than sent in a burst. A main email also never goes within
MIN_GAP of the lead's previous one.

Each send is recorded (AdsNurtureEmail / AdsUrlReminderEmail, unique per
stage), which is what keeps a stage from going twice across cycles and
workers.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.models import AdsNurtureEmail, AdsUrlReminderEmail, AdsUrlReminderLead, StaleListingProspect
from app.services import email_service
from app.services import stale_prospect_service as sps
from app.services.ads_funnel import NURTURED_LEAD_SOURCES, _signed, reminder_token, reminder_unsubscribe_token
from app.services.scraper_base import run_scraper_loop
from app.services.stale_prospect_abandonment import build_unsubscribe_url

logger = logging.getLogger(__name__)

CONTENT_DIR = Path(__file__).resolve().parent / "ads_email_content"

LANDING_PATHS = {"owner": "/assess/seller", "agent": "/assess/agent"}

MIN_GAP = timedelta(hours=20)
# A branch email more than this late (the loop was down) is skipped.
BRANCH_LATE_LIMIT = timedelta(hours=24)
REMINDER_WINDOW = timedelta(days=21)

PROPERTY_FIELD = "[Property Address]"

_POLL_LIMIT = 500
_MAX_SENDS_PER_CYCLE = 100


@lru_cache(maxsize=None)
def flow_content(name: str) -> dict[str, list[dict[str, Any]]]:
    return json.loads((CONTENT_DIR / f"{name}.json").read_text(encoding="utf-8"))


def _offset(entry: dict[str, Any]) -> timedelta:
    if entry.get("hours") is not None:
        return timedelta(hours=int(entry["hours"]))
    return timedelta(days=int(entry.get("days") or 0))


def _public_base() -> str:
    base = (get_settings().FRONTEND_URL or "https://www.heyhavlo.com").rstrip("/")
    if "localhost" in base or "127.0.0.1" in base:
        base = "https://www.heyhavlo.com"
    return base


# ── Links ──────────────────────────────────────────────────────────────────


def nurture_access_token(prospect_id: Any) -> str:
    """The access token in a lead's email links. Derived from the prospect
    id, so every email carries the same one; its hash is added to the
    prospect's tokens before the first email goes."""
    return _signed("ads-nurture-access", str(prospect_id), 48)


def closed_token(prospect_id: Any) -> str:
    return _signed("ads-property-closed", str(prospect_id), 32)


def build_closed_url(prospect_id: Any) -> str:
    return (
        f"{_public_base()}/api/v1/stale-listings/prospects/property-closed"
        f"?prospect_id={prospect_id}&token={closed_token(prospect_id)}"
    )


def build_reminder_unsubscribe_url(lead_id: Any) -> str:
    return (
        f"{_public_base()}/api/v1/stale-listings/ads/reminder-unsubscribe"
        f"?lead_id={lead_id}&token={reminder_unsubscribe_token(lead_id)}"
    )


def build_reminder_link(lead: AdsUrlReminderLead) -> str:
    path = LANDING_PATHS.get(lead.audience, LANDING_PATHS["owner"])
    return f"{_public_base()}{path}?reminder={reminder_token(lead.id)}#listing-link"


def _cta_url(prospect: StaleListingProspect, cta: str) -> str:
    label = cta.upper()
    landing = f"{_public_base()}{LANDING_PATHS.get(prospect.audience, LANDING_PATHS['owner'])}"
    if label.startswith("ASSESS "):
        # "Assess another / a current / a slow-moving listing": a fresh start.
        return landing
    step = "payment" if label.startswith("COMPLETE ") else "assessment"
    return f"{landing}?token={nurture_access_token(prospect.id)}&step={step}"


# ── Scheduling (pure) ──────────────────────────────────────────────────────


def _about_the_property(entry: dict[str, Any]) -> bool:
    text = " ".join([entry.get("subject", ""), *entry.get("paragraphs", [])])
    return PROPERTY_FIELD in text or entry.get("cta", "").upper().startswith("VIEW ")


def plan_next_nurture_email(
    *,
    audience: str,
    anchor: datetime,
    now: datetime,
    sent: dict[tuple[str, int], datetime],
    checkout_visited_at: datetime | None = None,
    property_closed_at: datetime | None = None,
) -> tuple[str, int] | None:
    """The (flow, stage) to send a nurture lead now, if any."""
    content = flow_content("agent" if audience == "agent" else "vendor")

    if audience == "agent" and property_closed_at is not None and ("closed", 1) not in sent:
        return ("closed", 1)

    if checkout_visited_at is not None:
        branch = content["checkout"]
        for entry in branch:
            key = ("checkout", int(entry["stage"]))
            if key in sent:
                continue
            due_at = checkout_visited_at + _offset(entry)
            if now < due_at:
                break
            if now - due_at <= BRANCH_LATE_LIMIT:
                return key
        last_step = max(_offset(e) for e in branch)
        finished = ("checkout", int(branch[-1]["stage"])) in sent
        if not finished and now < checkout_visited_at + last_step + BRANCH_LATE_LIMIT:
            return None  # main flow paused while the branch runs

    closed_agent = audience == "agent" and property_closed_at is not None
    sent_main = [stage for flow, stage in sent if flow == "main"]
    highest_sent = max(sent_main, default=0)
    due = [
        entry for entry in content["main"]
        if int(entry["stage"]) > highest_sent
        and anchor + _offset(entry) <= now
        and not (closed_agent and _about_the_property(entry))
    ]
    if not due:
        return None
    entry = due[-1]
    if int(entry["stage"]) > 1 and sent and now - max(sent.values()) < MIN_GAP:
        return None
    return ("main", int(entry["stage"]))


def plan_next_reminder(*, created_at: datetime, now: datetime, sent: Iterable[int]) -> int | None:
    sent = set(sent)
    if now - created_at > REMINDER_WINDOW:
        return None
    highest_sent = max(sent, default=0)
    due = [
        int(e["stage"]) for e in flow_content("url_reminder")["main"]
        if int(e["stage"]) > highest_sent and created_at + _offset(e) <= now
    ]
    return due[-1] if due else None


# ── Rendering ──────────────────────────────────────────────────────────────


def _entry(flow_name: str, flow: str, stage: int) -> dict[str, Any]:
    return next(e for e in flow_content(flow_name)[flow] if int(e["stage"]) == stage)


def _preheader(paragraphs: list[str]) -> str:
    first = (paragraphs[0] if paragraphs else "").strip()
    return first if len(first) <= 140 else first[:137].rsplit(" ", 1)[0] + "…"


def render_nurture_email(prospect: StaleListingProspect, flow: str, stage: int) -> dict[str, Any]:
    """Keyword arguments for email_service.send_ads_flow_email_sync."""
    flow_name = "agent" if prospect.audience == "agent" else "vendor"
    entry = _entry(flow_name, flow, stage)
    address = sps.address_with_full_postcode(prospect.property_address, prospect.postcode)

    def fill(text: str) -> str:
        return text.replace(PROPERTY_FIELD, address)

    paragraphs = [fill(p) for p in entry["paragraphs"]]
    note, link_text, link_url = None, "", ""
    footer = entry.get("footer")
    if flow_name == "vendor":
        note = flow_content("vendor")["main"][0]["footer"]
        link_text, link_url = "Click here", build_closed_url(prospect.id)
    elif footer and footer.startswith("No longer want"):
        note, link_text, link_url = f"{footer} Unsubscribe", "Unsubscribe", build_unsubscribe_url(prospect.id)
    elif flow != "closed" and prospect.property_closed_at is None:
        note = flow_content("agent")["main"][0]["footer"]
        link_text, link_url = "Tell us", build_closed_url(prospect.id)
    return {
        "subject": fill(entry["subject"]),
        "preheader": _preheader(paragraphs),
        "paragraphs": paragraphs,
        "cta_label": entry["cta"],
        "cta_url": _cta_url(prospect, entry["cta"]),
        "unsubscribe_url": build_unsubscribe_url(prospect.id),
        "note": note,
        "note_link_text": link_text,
        "note_link_url": link_url,
    }


def render_reminder_email(lead: AdsUrlReminderLead, stage: int) -> dict[str, Any]:
    entry = _entry("url_reminder", "main", stage)
    return {
        "subject": entry["subject"],
        "preheader": entry["preview"],
        "paragraphs": entry["paragraphs"],
        "after_cta": entry.get("after_cta") or [],
        "cta_label": entry["cta"],
        "cta_url": build_reminder_link(lead),
        "unsubscribe_url": build_reminder_unsubscribe_url(lead.id),
        "sign_off": False,
        "signature": True,
        "social_proof": False,
    }


def _first_name(name: str | None) -> str:
    return (name or "").strip().split(" ")[0] or "there"


# ── Send loops ─────────────────────────────────────────────────────────────


async def _ensure_link_token(prospect: StaleListingProspect) -> None:
    token_hash = sps.hash_access_token(nurture_access_token(prospect.id))
    if token_hash in (prospect.qr_token_hashes or []):
        return
    async with AsyncSessionLocal() as db:
        fresh = await db.get(StaleListingProspect, prospect.id)
        if fresh is not None and token_hash not in (fresh.qr_token_hashes or []):
            fresh.qr_token_hashes = [*(fresh.qr_token_hashes or []), token_hash]
            await db.commit()


async def _stopped_leads(db: Any, candidates: list[StaleListingProspect]) -> set[UUID]:
    """Leads whose emails stop because of something done on another of
    their prospects: anyone who unsubscribed from any of them, and an agent
    who has bought any assessment (as has anyone at their agency, when it's
    in the letter campaign). Purchase and unsubscribe are per person, not
    per listing."""
    P = StaleListingProspect
    emails = {c.contact_email.strip().lower() for c in candidates if c.contact_email}
    if not emails:
        return set()
    email = func.lower(func.trim(P.contact_email))
    unsubscribed = set((await db.execute(
        select(email).where(email.in_(emails), P.unsubscribed_at.is_not(None))
    )).scalars().all())
    agent_buyers = set((await db.execute(
        select(email).where(email.in_(emails), P.audience == "agent", P.payment_status == "completed")
    )).scalars().all())
    account_ids = {c.agent_account_id for c in candidates if c.audience == "agent" and c.agent_account_id}
    paid_accounts: set[UUID] = set()
    if account_ids:
        paid_accounts = set((await db.execute(
            select(P.agent_account_id).where(P.agent_account_id.in_(account_ids), P.payment_status == "completed")
        )).scalars().all())
    stopped: set[UUID] = set()
    for c in candidates:
        key = (c.contact_email or "").strip().lower()
        if key in unsubscribed:
            stopped.add(c.id)
        elif c.audience == "agent" and (key in agent_buyers or c.agent_account_id in paid_accounts):
            stopped.add(c.id)
    return stopped


async def run_ads_nurture_cycle(only_prospect_id: UUID | None = None) -> dict:
    now = datetime.now(timezone.utc)
    P = StaleListingProspect
    async with AsyncSessionLocal() as db:
        stmt = (
            select(P)
            .where(
                P.lead_source.in_(NURTURED_LEAD_SOURCES),
                P.contact_details_submitted_at.is_not(None),
                P.contact_email.is_not(None),
                P.payment_status != "completed",
                P.unsubscribed_at.is_(None),
                (P.audience == "agent") | P.property_closed_at.is_(None),
            )
            .order_by(P.contact_details_submitted_at.asc())
            .limit(_POLL_LIMIT)
        )
        if only_prospect_id is not None:
            stmt = stmt.where(P.id == only_prospect_id)
        candidates = list((await db.execute(stmt)).scalars().all())
        stopped = await _stopped_leads(db, candidates)
        candidates = [c for c in candidates if c.id not in stopped]
        if not candidates:
            return {"candidates": 0, "sent": 0}
        rows = await db.execute(
            select(AdsNurtureEmail.prospect_id, AdsNurtureEmail.flow, AdsNurtureEmail.stage, AdsNurtureEmail.sent_at)
            .where(AdsNurtureEmail.prospect_id.in_([c.id for c in candidates]))
        )
        sent_map: dict[UUID, dict[tuple[str, int], datetime]] = {}
        for prospect_id, flow, stage, sent_at in rows.all():
            sent_map.setdefault(prospect_id, {})[(flow, stage)] = sent_at

    due: list[tuple[StaleListingProspect, str, int]] = []
    for prospect in candidates:
        if len(due) >= _MAX_SENDS_PER_CYCLE:
            break
        planned = plan_next_nurture_email(
            audience=prospect.audience,
            anchor=prospect.contact_details_submitted_at,
            now=now,
            sent=sent_map.get(prospect.id, {}),
            checkout_visited_at=prospect.checkout_visited_at,
            property_closed_at=prospect.property_closed_at,
        )
        if planned:
            due.append((prospect, *planned))

    sent = 0
    for prospect, flow, stage in due:
        try:
            await _ensure_link_token(prospect)
            delivered = await asyncio.to_thread(
                email_service.send_ads_flow_email_sync,
                to_email=prospect.contact_email,
                first_name=_first_name(prospect.contact_name),
                **render_nurture_email(prospect, flow, stage),
            )
        except Exception:
            logger.exception("Ads nurture email raised for prospect=%s flow=%s stage=%s", prospect.id, flow, stage)
            continue
        if not delivered:
            logger.warning("Ads nurture email not delivered for prospect=%s flow=%s stage=%s; retrying next cycle.",
                           prospect.id, flow, stage)
            continue
        async with AsyncSessionLocal() as db:
            db.add(AdsNurtureEmail(prospect_id=prospect.id, flow=flow, stage=stage))
            try:
                await db.commit()
                sent += 1
            except IntegrityError:
                await db.rollback()
    return {"candidates": len(candidates), "due": len(due), "sent": sent}


async def run_url_reminder_cycle(only_lead_id: UUID | None = None) -> dict:
    now = datetime.now(timezone.utc)
    L = AdsUrlReminderLead
    async with AsyncSessionLocal() as db:
        stmt = (
            select(L)
            .where(L.url_submitted_at.is_(None), L.unsubscribed_at.is_(None), L.created_at >= now - REMINDER_WINDOW)
            .order_by(L.created_at.asc())
            .limit(_POLL_LIMIT)
        )
        if only_lead_id is not None:
            stmt = stmt.where(L.id == only_lead_id)
        leads = list((await db.execute(stmt)).scalars().all())
        if not leads:
            return {"candidates": 0, "sent": 0}
        rows = await db.execute(
            select(AdsUrlReminderEmail.lead_id, AdsUrlReminderEmail.stage)
            .where(AdsUrlReminderEmail.lead_id.in_([lead.id for lead in leads]))
        )
        sent_map: dict[UUID, set[int]] = {}
        for lead_id, stage in rows.all():
            sent_map.setdefault(lead_id, set()).add(stage)

    sent = 0
    due = 0
    for lead in leads:
        if due >= _MAX_SENDS_PER_CYCLE:
            break
        stage = plan_next_reminder(created_at=lead.created_at, now=now, sent=sent_map.get(lead.id, set()))
        if stage is None:
            continue
        due += 1
        try:
            delivered = await asyncio.to_thread(
                email_service.send_ads_flow_email_sync,
                to_email=lead.email,
                first_name=_first_name(lead.first_name),
                **render_reminder_email(lead, stage),
            )
        except Exception:
            logger.exception("URL reminder email raised for lead=%s stage=%s", lead.id, stage)
            continue
        if not delivered:
            continue
        async with AsyncSessionLocal() as db:
            db.add(AdsUrlReminderEmail(lead_id=lead.id, stage=stage))
            try:
                await db.commit()
                sent += 1
            except IntegrityError:
                await db.rollback()
    return {"candidates": len(leads), "due": due, "sent": sent}


async def run_ads_email_cycle() -> dict:
    return {"reminders": await run_url_reminder_cycle(), "nurture": await run_ads_nurture_cycle()}


async def start_ads_email_loop() -> None:
    """Started from app startup (app/main.py). Every 5 minutes, like the
    abandonment drip; the first email of each flow is also sent straight
    away by the request that starts it."""
    await run_scraper_loop("ads-funnel-emails", run_ads_email_cycle, interval_hours=5 / 60, initial_delay_seconds=50)
