"""Meta-ads landing pages (/assess/seller and /assess/agent).

A visitor pastes their Rightmove listing link instead of entering the
property code from a letter. The listing is read, the prospect, report and
preview are made exactly as discovery makes them, and the visitor carries
on through the normal /check funnel by access token.

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

import hashlib
import hmac
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.models import AdsUrlReminderLead, StaleAgentAccount, StaleListingProspect
from app.services import agent_campaign
from app.services import stale_prospect_service as sps
from app.services.listing_scraper import scrape_single_listing

logger = logging.getLogger(__name__)

LEAD_SELLER = "meta_seller"
LEAD_AGENT = "meta_agent"
LEAD_AGENT_LISTING = "meta_agent_listing"
NURTURED_LEAD_SOURCES = (LEAD_SELLER, LEAD_AGENT)

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


async def _agent_copy(db: AsyncSession, owner: StaleListingProspect) -> StaleListingProspect:
    """An agent's own copy of the listing: its own details, checkout and
    unlock. Reused until someone has given their details on it; after that
    each new visitor gets a fresh copy, so two people at one agency never
    share a checkout. Linked to the agency's account when the agency is
    already in the letter campaign (for the report's portfolio figures)."""
    existing = (await db.execute(
        select(StaleListingProspect)
        .where(
            StaleListingProspect.parent_prospect_id == owner.id,
            StaleListingProspect.lead_source == LEAD_AGENT,
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
        lead_source=LEAD_AGENT,
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


async def _seller_copy(db: AsyncSession, owner: StaleListingProspect) -> StaleListingProspect:
    """A homeowner funnel of its own for a listing whose prospect is already
    taken. Like an agent copy, but audience "owner" and a 4-digit code (the
    homeowner emails link by code). Reused until someone gives details."""
    existing = (await db.execute(
        select(StaleListingProspect)
        .where(
            StaleListingProspect.parent_prospect_id == owner.id,
            StaleListingProspect.lead_source == LEAD_SELLER,
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
        lead_source=LEAD_SELLER,
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
    db: AsyncSession, *, listing_url: str, audience: str, reminder_token: str | None = None
) -> dict[str, Any]:
    """The access token for the pasted listing, making whatever is needed.
    Commits. Raises ListingLinkError for a link we can't use."""
    if audience not in AUDIENCES:
        raise ListingLinkError("Unknown audience.")
    url = clean_rightmove_url(listing_url)
    owner = await _owner_prospect(db, url)
    if audience == "owner":
        if owner is None:
            target = await _create_owner_prospect(db, url, LEAD_SELLER)
        elif not owner.contact_email and owner.payment_status != "completed":
            # Found by discovery (or made for an agent's link) but nobody
            # has started its funnel: the ads visitor is the one doing so.
            owner.lead_source = LEAD_SELLER
            target = owner
        else:
            # Someone has already given their details on this listing, or
            # paid for its report. Anyone can paste a Rightmove link, so the
            # visitor gets a funnel of their own rather than that one.
            target = await _seller_copy(db, owner)
    else:
        if owner is None:
            owner = await _create_owner_prospect(db, url, LEAD_AGENT_LISTING)
        target = await _agent_copy(db, owner)
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
    return {"token": token, "audience": target.audience, "property_code": target.property_code, "prefill": prefill}


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
    db: AsyncSession, *, first_name: str, email: str, audience: str
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
        first_name=first_name,
        email=email,
        token_hash=sps.hash_access_token(reminder_token(lead_id)),
    )
    db.add(lead)
    await db.commit()
    return lead, True
