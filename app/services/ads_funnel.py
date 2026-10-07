"""Ads landing pages: Meta (/assess/seller, /assess/agent) and Google
(/property-assessment/seller, /property-assessment/agent).

A visitor pastes their Rightmove listing link instead of entering the
property code from a letter. The listing is read, the prospect, report and
preview are made exactly as discovery makes them, and the visitor carries
on through the normal /check funnel by access token.

Tags below are for Meta; Google leads get the same with "google_" in
place of "meta_" (seller_source() etc.).

- A homeowner gets the listing's owner prospect (made here when discovery
  hasn't found the listing already), tagged lead_source "meta_seller". If
  someone has already given details on it or paid for it, the visitor gets
  a copy of their own instead: anyone can paste any Rightmove link, so it
  must never open someone else's funnel or paid report.
- An agent gets their own copy of it, like an agency opening a property
  from /check/agent, tagged "meta_agent". An owner prospect made only so an
  agent could assess the listing is tagged "meta_agent_listing"; nobody is
  emailed about that one.

Visitors without their link to hand leave a first name and email instead
(AdsUrlReminderLead); app/services/ads_nurture.py emails them a link back.
Prospects made here skip the letter PDF and stay at processing_status
"report_ready", never a letter status, so the letter email loop leaves
them alone.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.models import AdsUrlReminderLead, StaleAgentAccount, StaleListingProspect
from app.services import agent_campaign, google_sheets
from app.services import stale_prospect_service as sps
from app.services.listing_scraper import scrape_single_listing

logger = logging.getLogger(__name__)

# Which ads the visitor came from: the Meta landing pages (/assess/...) or
# the Google ones (/property-assessment/...). Same pages and funnel; the
# channel only changes the lead_source tag and where links back point.
CHANNELS = ("meta", "google")


def seller_source(channel: str) -> str:
    return f"{_channel(channel)}_seller"


def agent_source(channel: str) -> str:
    return f"{_channel(channel)}_agent"


def agent_listing_source(channel: str) -> str:
    return f"{_channel(channel)}_agent_listing"


def _channel(channel: str | None) -> str:
    return channel if channel in CHANNELS else "meta"


def channel_of(lead_source: str | None) -> str:
    return "google" if (lead_source or "").startswith("google_") else "meta"


LEAD_SELLER = seller_source("meta")
LEAD_AGENT = agent_source("meta")
LEAD_AGENT_LISTING = agent_listing_source("meta")
SELLER_SOURCES = tuple(seller_source(c) for c in CHANNELS)
AGENT_SOURCES = tuple(agent_source(c) for c in CHANNELS)
AGENT_LISTING_SOURCES = tuple(agent_listing_source(c) for c in CHANNELS)
NURTURED_LEAD_SOURCES = SELLER_SOURCES + AGENT_SOURCES

AUDIENCES = ("owner", "agent")

_OUTCODE_ONLY_RE = re.compile(r"^[A-Z]{1,2}\d[A-Z\d]?$", re.IGNORECASE)


class ListingLinkError(ValueError):
    """A problem with the pasted link, worded for the visitor."""


def clean_rightmove_url(raw: str) -> str:
    """The canonical listing URL for whatever form of Rightmove link was
    pasted (app links, ?channel=..., #/ fragments, utm tags)."""
    text = (raw or "").strip()
    listing_id = sps.rightmove_listing_id(text)
    if not listing_id:
        if re.search(r"zoopla|onthemarket|primelocation", text, re.IGNORECASE):
            raise ListingLinkError(
                "We can only read Rightmove listings at the moment. Please paste your property's Rightmove link."
            )
        raise ListingLinkError(
            "Please paste the link to the property's Rightmove listing "
            "(it looks like rightmove.co.uk/properties/123456789)."
        )
    return f"https://www.rightmove.co.uk/properties/{listing_id}"


def _city_from_address(address: str) -> str | None:
    parts = [p.strip() for p in (address or "").split(",") if p.strip()]
    if len(parts) < 2:
        return None
    last = parts[-1]
    if _OUTCODE_ONLY_RE.match(last) or re.search(r"\d[A-Z]{2}$", last, re.IGNORECASE):
        return parts[-2] if len(parts) >= 3 else None
    return last[:100]


async def _owner_prospect(db: AsyncSession, url: str) -> StaleListingProspect | None:
    return (await db.execute(
        select(StaleListingProspect)
        .where(
            sps.same_rightmove_listing(url),
            StaleListingProspect.audience == "owner",
            StaleListingProspect.country == "UK",
        )
        .order_by(StaleListingProspect.created_at.asc())
        .limit(1)
    )).scalar_one_or_none()


async def _create_owner_prospect(db: AsyncSession, url: str, lead_source: str) -> StaleListingProspect:
    """Read the listing and make its prospect, report and preview. No price,
    age or property-type gate: the visitor chose to have this listing looked
    at, unlike discovery picking listings to write to."""
    try:
        scraped = await scrape_single_listing(url)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Ads funnel: scrape failed for %s: %s", url, exc)
        scraped = {}
    snapshot = sps.snapshot_from_scrape(scraped or {}, url)
    snapshot["rightmove_id"] = sps.rightmove_listing_id(url)
    address = (snapshot.get("address") or "").strip()
    price = sps.extract_price(snapshot.get("price"))
    if (scraped or {}).get("blocked") or not address or not price:
        raise ListingLinkError(
            "We couldn't read that listing just now. Please check the link opens your property on "
            "Rightmove and try again."
        )
    listed_date = sps.parse_listed_date(snapshot.get("listed_date"))
    days = max((datetime.now(timezone.utc) - listed_date).days, 0) if listed_date else 0
    prospect, _token, _letter = await sps.create_prospect_from_listing_snapshot(
        db,
        rightmove_url=url,
        property_address=address,
        listing_snapshot=snapshot,
        asking_price=float(price),
        listing_duration_days=days,
        listed_date=listed_date,
        city=_city_from_address(address),
        make_letter=False,
    )
    prospect.lead_source = lead_source
    return prospect


async def _agent_copy(db: AsyncSession, owner: StaleListingProspect, lead_source: str) -> StaleListingProspect:
    """An agent's own copy of the listing: its own details, checkout and
    unlock. Reused until someone has given their details on it; after that
    each new visitor gets a fresh copy, so two people at one agency never
    share a checkout. Linked to the agency's account when the agency is
    already in the letter campaign (for the report's portfolio figures)."""
    existing = (await db.execute(
        select(StaleListingProspect)
        .where(
            StaleListingProspect.parent_prospect_id == owner.id,
            StaleListingProspect.lead_source == lead_source,
            StaleListingProspect.contact_email.is_(None),
        )
        .limit(1)
    )).scalar_one_or_none()
    if existing is not None:
        return existing
    account_id = None
    key = agent_campaign.company_key(owner.agent_company_name)
    if key:
        account_id = (await db.execute(
            select(StaleAgentAccount.id).where(StaleAgentAccount.company_key == key)
        )).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    placeholder = sps.create_access_token()
    copy = StaleListingProspect(
        **{field: getattr(owner, field) for field in agent_campaign._COPIED_FIELDS},
        property_code=await agent_campaign.make_agent_copy_code(db),
        qr_token_hash=sps.hash_access_token(placeholder),
        qr_token_hashes=[],
        audience="agent",
        agent_account_id=account_id,
        parent_prospect_id=owner.id,
        lead_source=lead_source,
        source_status="active",
        processing_status="report_ready",
        discovered_at=now,
        processed_at=now,
        payment_status="pending",
        agent_checked_at=now,
    )
    db.add(copy)
    await db.flush()
    return copy


async def _seller_copy(db: AsyncSession, owner: StaleListingProspect, lead_source: str) -> StaleListingProspect:
    """A homeowner funnel of its own for a listing whose prospect is already
    taken. Like an agent copy, but audience "owner" and a 4-digit code (the
    homeowner emails link by code). Reused until someone gives details."""
    existing = (await db.execute(
        select(StaleListingProspect)
        .where(
            StaleListingProspect.parent_prospect_id == owner.id,
            StaleListingProspect.lead_source == lead_source,
            StaleListingProspect.contact_email.is_(None),
            StaleListingProspect.payment_status != "completed",
        )
        .limit(1)
    )).scalar_one_or_none()
    if existing is not None:
        return existing
    now = datetime.now(timezone.utc)
    placeholder = sps.create_access_token()
    copy = StaleListingProspect(
        **{field: getattr(owner, field) for field in agent_campaign._COPIED_FIELDS},
        property_code=await sps.make_property_code(db),
        qr_token_hash=sps.hash_access_token(placeholder),
        qr_token_hashes=[],
        audience="owner",
        parent_prospect_id=owner.id,
        lead_source=lead_source,
        source_status="active",
        processing_status="report_ready",
        discovered_at=now,
        processed_at=now,
        payment_status="pending",
        agent_checked_at=now,
    )
    db.add(copy)
    await db.flush()
    return copy


def _grant_access(prospect: StaleListingProspect) -> str:
    """A new access token for the visitor. Added alongside the prospect's
    other tokens without becoming its "current" one, which is the token
    printed on any letter."""
    token = sps.create_access_token()
    token_hash = sps.hash_access_token(token)
    prospect.qr_token_hashes = [*(prospect.qr_token_hashes or []), token_hash]
    return token


async def start_from_listing(
    db: AsyncSession, *, listing_url: str, audience: str, reminder_token: str | None = None, channel: str = "meta"
) -> dict[str, Any]:
    """The access token for the pasted listing, making whatever is needed.
    Commits. Raises ListingLinkError for a link we can't use."""
    if audience not in AUDIENCES:
        raise ListingLinkError("Unknown audience.")
    channel = _channel(channel)
    url = clean_rightmove_url(listing_url)
    owner = await _owner_prospect(db, url)
    if audience == "owner":
        if owner is None:
            target = await _create_owner_prospect(db, url, seller_source(channel))
        elif not owner.contact_email and owner.payment_status != "completed":
            # Found by discovery (or made for an agent's link) but nobody
            # has started its funnel: the ads visitor is the one doing so.
            owner.lead_source = seller_source(channel)
            target = owner
        else:
            # Someone has already given their details on this listing, or
            # paid for its report. Anyone can paste a Rightmove link, so the
            # visitor gets a funnel of their own rather than that one.
            target = await _seller_copy(db, owner, seller_source(channel))
    else:
        if owner is None:
            owner = await _create_owner_prospect(db, url, agent_listing_source(channel))
        target = await _agent_copy(db, owner, agent_source(channel))
    if target.code_looked_up_at is None:
        target.code_looked_up_at = datetime.now(timezone.utc)
    token = _grant_access(target)

    prefill: dict[str, str] = {}
    lead = await find_reminder_lead(db, reminder_token) if reminder_token else None
    if lead is not None:
        if lead.url_submitted_at is None:
            lead.url_submitted_at = datetime.now(timezone.utc)
            lead.prospect_id = target.id
        prefill = {"first_name": lead.first_name, "email": lead.email}
    await db.commit()
    return {
        "token": token, "audience": target.audience, "property_code": target.property_code, "prefill": prefill,
        "prospect_id": target.id,
    }


def sheet_row(prospect: StaleListingProspect) -> dict[str, str]:
    """The listing's row on the "Ads Funnel Listings" sheet tab, which the
    team uses to send ads leads a follow-up letter (they look up the full
    mailing address by hand from the Rightmove link)."""
    source = "Google ad" if channel_of(prospect.lead_source) == "google" else "Meta ad"
    agent = " - ".join(
        part for part in (prospect.agent_brand or prospect.agent_company_name, prospect.agent_branch_name) if part
    )
    return {
        "source": source,
        "audience": "Agent" if prospect.audience == "agent" else "Seller",
        "rightmove_url": prospect.rightmove_url or "",
        "address": sps.address_with_full_postcode(prospect.property_address, prospect.postcode),
        "postcode": prospect.postcode or "",
        "asking_price": f"£{prospect.asking_price:,.0f}" if prospect.asking_price else "",
        "listing_agent": agent,
        "property_code": prospect.property_code or "",
        "contact_name": prospect.contact_name or "",
        "contact_email": prospect.contact_email or "",
        "contact_phone": prospect.contact_phone or "",
    }


SHEET_BATCH = 200


async def log_listings_to_sheet(only_prospect_id: Any | None = None) -> dict[str, int]:
    """Add ads leads not yet on the "Ads Funnel Listings" tab: run for one
    lead straight after its link is pasted, and every few minutes for any
    still missing (which also backfilled everyone from before the tab
    existed). Each lead is claimed in the database before the sheet write
    (ads_sheet_logged_at), so two runs never add the same row; a failed
    write releases the claim and the next run tries again."""
    from app.db.database import AsyncSessionLocal

    if not google_sheets.is_configured():
        return {"logged": 0}
    P = StaleListingProspect
    now = datetime.now(timezone.utc)
    pending = (
        select(P.id)
        .where(P.lead_source.in_(NURTURED_LEAD_SOURCES), P.ads_sheet_logged_at.is_(None))
        .order_by(P.created_at.asc())
        .limit(SHEET_BATCH)
    )
    if only_prospect_id is not None:
        pending = pending.where(P.id == only_prospect_id)
    async with AsyncSessionLocal() as db:
        stmt = (
            update(P)
            .where(P.id.in_(pending), P.ads_sheet_logged_at.is_(None))
            .values(ads_sheet_logged_at=now)
            .returning(P.id)
        )
        claimed = list((await db.execute(stmt)).scalars().all())
        await db.commit()
        if not claimed:
            return {"logged": 0}
        prospects = list((await db.execute(
            select(P).where(P.id.in_(claimed)).order_by(P.created_at.asc())
        )).scalars().all())
        rows = []
        for p in prospects:
            row = sheet_row(p)
            # When they came through the ads (a reused discovery listing was
            # created long before).
            came = p.code_looked_up_at or p.created_at or now
            row["logged_at"] = came.astimezone(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")
            rows.append(row)
    try:
        await asyncio.to_thread(google_sheets.append_ads_funnel_listings, rows)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Ads funnel sheet: %d row(s) not written, will retry: %s", len(rows), exc)
        async with AsyncSessionLocal() as db:
            await db.execute(update(P).where(P.id.in_(claimed), P.ads_sheet_logged_at == now).values(ads_sheet_logged_at=None))
            await db.commit()
        return {"logged": 0, "failed": len(rows)}
    return {"logged": len(rows)}


# ── "Email me a reminder" leads ────────────────────────────────────────────


def _signed(purpose: str, ident: str, length: int = 40) -> str:
    secret = (get_settings().SECRET_KEY or "").encode("utf-8")
    return hmac.new(secret, f"{purpose}:{ident}".encode("utf-8"), hashlib.sha256).hexdigest()[:length]


def reminder_token(lead_id: Any) -> str:
    """The token in a reminder email's link back to the landing page.
    Derived from the lead id, so every email of the sequence carries the
    same one and only its hash is stored."""
    return _signed("ads-url-reminder", str(lead_id))


def reminder_unsubscribe_token(lead_id: Any) -> str:
    return _signed("ads-url-reminder-unsubscribe", str(lead_id), 32)


def verify_reminder_unsubscribe(lead_id: str, token: str) -> bool:
    return hmac.compare_digest(reminder_unsubscribe_token(lead_id), (token or "").strip())


async def find_reminder_lead(db: AsyncSession, token: str | None) -> AdsUrlReminderLead | None:
    token = (token or "").strip()
    if not token:
        return None
    return (await db.execute(
        select(AdsUrlReminderLead).where(AdsUrlReminderLead.token_hash == sps.hash_access_token(token))
    )).scalar_one_or_none()


async def create_reminder_lead(
    db: AsyncSession, *, first_name: str, email: str, audience: str, channel: str = "meta"
) -> tuple[AdsUrlReminderLead, bool]:
    """The visitor's reminder lead and whether it's new. Asking twice while
    the first sequence is still running doesn't start a second one. Commits."""
    email = email.strip().lower()[:255]
    first_name = " ".join(first_name.split())[:200] or "there"
    if audience not in AUDIENCES:
        audience = "owner"
    open_lead = (await db.execute(
        select(AdsUrlReminderLead)
        .where(
            AdsUrlReminderLead.email == email,
            AdsUrlReminderLead.audience == audience,
            AdsUrlReminderLead.url_submitted_at.is_(None),
            AdsUrlReminderLead.unsubscribed_at.is_(None),
        )
        .limit(1)
    )).scalar_one_or_none()
    if open_lead is not None:
        return open_lead, False
    lead_id = uuid.uuid4()
    lead = AdsUrlReminderLead(
        id=lead_id,
        audience=audience,
        channel=_channel(channel),
        first_name=first_name,
        email=email,
        token_hash=sps.hash_access_token(reminder_token(lead_id)),
    )
    db.add(lead)
    await db.commit()
    return lead, True


# ── Confirm Property summary (ads homeowners) ───────────────────────────────
# "Your assessment identified potential issues across:" Buyer Appeal,
# Pricing Position, Listing Presentation and Local Competition, plus one
# finding. Every line comes from the prospect's own report, or for
# competition, a count of the similar homes for sale around it on
# Rightmove; nothing is made up for the page.

COMPETITION_PENDING_LIMIT = 300  # seconds before a "pending" search is retried
_PRESENTATION_ICONS = {"photos", "description"}
_PRESENTATION_WORDS = re.compile(
    r"photo|image|picture|description|floor ?plan|virtual tour|video|headline|wording|presentation|staging|first impression",
    re.IGNORECASE,
)


def score_status(score: Any) -> str | None:
    """How a 0-100 report score reads on the summary."""
    try:
        value = int(score)
    except (TypeError, ValueError):
        return None
    if value < 50:
        return "Needs attention"
    if value < 70:
        return "Review recommended"
    return "Performing well"


def presentation_opportunities(report: dict[str, Any]) -> int:
    """Distinct presentation points the report raises: findings marked as
    photo or description issues, and actions about photos, wording,
    floorplans, tours and the like."""
    titles: set[str] = set()
    for finding in report.get("key_findings") or []:
        if not isinstance(finding, dict) or finding.get("type") == "strength":
            continue
        text = f"{finding.get('title') or ''} {finding.get('description') or ''}"
        if finding.get("icon") in _PRESENTATION_ICONS or _PRESENTATION_WORDS.search(text):
            titles.add((finding.get("title") or text).strip().lower())
    for action in report.get("action_plan") or []:
        if not isinstance(action, dict):
            continue
        text = f"{action.get('title') or ''} {action.get('description') or ''}"
        if _PRESENTATION_WORDS.search(text):
            titles.add((action.get("title") or text).strip().lower())
    return len(titles)


def _loads(raw: str | None) -> dict[str, Any]:
    try:
        value = json.loads(raw or "{}")
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def assessment_summary(prospect: StaleListingProspect) -> dict[str, Any]:
    report = _loads(sps.current_report_json(prospect))
    preview = _loads(prospect.preview_json)
    scores = report.get("scores") or preview.get("scores") or {}
    issues = [f for f in (report.get("key_findings") or preview.get("key_issues") or [])
              if isinstance(f, dict) and f.get("type") != "strength"]
    finding = next((f.get("description") or f.get("title") for f in issues if f.get("description") or f.get("title")), None)
    presentation = presentation_opportunities(report)
    competition = _loads(prospect.competition_json)
    return {
        "buyer_appeal": score_status(scores.get("buyer_appeal")),
        "pricing": score_status(scores.get("pricing")),
        "presentation": {"count": presentation, "status": score_status(scores.get("listing_presentation"))},
        "competition": {
            "status": competition.get("status") or "pending",
            "count": competition.get("count"),
            "basis": competition.get("basis"),
            "area": competition.get("area"),
            "fallback": score_status(scores.get("competition")),
        },
        "finding": finding,
    }


def competition_needs_search(prospect: StaleListingProspect, now: datetime | None = None) -> bool:
    competition = _loads(prospect.competition_json)
    status = competition.get("status")
    if status in ("ready", "unavailable"):
        return False
    if status == "pending" and prospect.competition_at is not None:
        now = now or datetime.now(timezone.utc)
        return (now - prospect.competition_at).total_seconds() > COMPETITION_PENDING_LIMIT
    return True


async def mark_competition_pending(db: AsyncSession, prospect: StaleListingProspect) -> bool:
    """Claim the search for this prospect (so several requests, or workers,
    don't each start one). Commits. False if it's done or already running."""
    if prospect.country != "UK" or not competition_needs_search(prospect):
        return False
    prospect.competition_json = json.dumps({"status": "pending"})
    prospect.competition_at = datetime.now(timezone.utc)
    await db.commit()
    return True


async def count_competition(prospect: StaleListingProspect) -> dict[str, Any]:
    """Similar homes for sale around the property, from the same Rightmove
    search the agent report uses: same type and a bedroom either way when
    there are enough of those, else the same type, else every home."""
    from app.services import agent_report, land_registry
    from app.services import listing_monitor as lm

    snapshot = _loads(prospect.listing_snapshot_json)
    known = (prospect.postcode, snapshot.get("postcode"), prospect.property_address)
    query = land_registry.full_postcode(*known) or land_registry.outcode(*known) or ""
    rows, radius, _own = await agent_report._search_nearby(query, lm.rightmove_listing_id(prospect.rightmove_url))
    if not rows:
        return {"status": "unavailable"}
    property_type = prospect.property_type or snapshot.get("property_type") or ""
    similar = [r for r in rows if lm.is_similar(r, prospect.bedrooms, property_type)]
    same_type = [r for r in rows if lm.broad_type(r.get("type") or "") == lm.broad_type(property_type)]
    if len(similar) >= agent_report.SIMILAR_MIN:
        chosen, basis = similar, "similar"
    elif property_type and len(same_type) >= agent_report.SIMILAR_MIN:
        chosen, basis = same_type, "same_type"
    else:
        chosen, basis = rows, "nearby"
    for_sale = [r for r in chosen if (r.get("status") or "on_market") == "on_market"]
    return {"status": "ready", "count": len(for_sale), "basis": basis, "area": agent_report.radius_label(radius)}


async def refresh_competition(prospect_id: Any) -> None:
    """Background task: run the search and store the result."""
    from app.db.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            prospect = await db.get(StaleListingProspect, prospect_id)
            if prospect is None:
                return
            result = await count_competition(prospect)
    except Exception:  # noqa: BLE001
        logger.exception("Ads funnel: competition search failed for %s", prospect_id)
        result = {"status": "unavailable"}
    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, prospect_id)
        if prospect is not None:
            prospect.competition_json = json.dumps(result)
            prospect.competition_at = datetime.now(timezone.utc)
            await db.commit()
