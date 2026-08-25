"""Admin-triggered Rightmove discovery for stale listing prospect letters."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import or_, select, text

from app.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingDiscoveryRun, StaleListingProspect
from app.services import email_service
from app.services import google_sheets
from app.services.listing_scraper import scrape_single_listing
from app.services.rightmove_scraper import KNOWN_LOCATIONS, PAGE_SIZE, _BASE, _headers, _parse_next_data
from app.services.scraper_base import run_once_with_advisory_lock
from app.services.stale_prospect_service import (
    create_prospect_from_listing_snapshot,
    extract_price,
    generate_letter_pdf,
    hash_access_token,
    is_specific_address,
    parse_listed_date,
    snapshot_from_scrape,
    create_access_token,
)

logger = logging.getLogger(__name__)


async def retry_pending_stale_prospect_emails(*, target: int) -> dict[str, int]:
    """Retry durable prospect letters that were created but not delivered.

    Discovery must never lose a qualifying listing because Resend or the
    process was temporarily unavailable. A fresh token/PDF is generated for
    each retry so the emailed preview URL remains valid without storing raw
    access tokens in the database.
    """
    sent = 0
    attempted = 0
    admin_email = (get_settings().ADMIN_NOTIFY_EMAIL or "").strip()
    if not admin_email:
        logger.error("Stale-letter retry paused: ADMIN_NOTIFY_EMAIL is not configured.")
        return {"attempted": 0, "sent": 0}

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(StaleListingProspect)
            .where(
                StaleListingProspect.processing_status.in_(
                    ("letter_ready", "email_failed", "email_skipped")
                )
            )
            .order_by(StaleListingProspect.created_at.asc())
            .limit(max(0, target))
        )
        prospects = list(result.scalars().all())

    for candidate in prospects:
        attempted += 1
        token = create_access_token()
        pdf_path = generate_letter_pdf(
            candidate,
            token,
            get_settings().FRONTEND_URL or "https://www.heyhavlo.com",
        )
        preview_url = (
            f"{(get_settings().FRONTEND_URL or 'https://www.heyhavlo.com').rstrip('/')}"
            f"/stale-listings/prospect/{token}"
        )
        email_sent = await asyncio.to_thread(
            email_service.send_stale_prospect_letter_sync,
            to_email=admin_email,
            property_address=candidate.property_address,
            property_code=candidate.property_code,
            preview_url=preview_url,
            letter_pdf_path=pdf_path,
        )
        async with AsyncSessionLocal() as db:
            prospect = await db.get(StaleListingProspect, candidate.id)
            if prospect:
                prospect.qr_token_hash = hash_access_token(token)
                prospect.letter_pdf_path = pdf_path
                prospect.processing_status = "email_sent" if email_sent else "email_failed"
                prospect.letter_sent_at = datetime.now(timezone.utc) if email_sent else None
                prospect.last_error = None if email_sent else "Email provider did not accept the retry."
                await db.commit()
        if email_sent:
            sent += 1
    return {"attempted": attempted, "sent": sent}


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


def _env_float(name: str, default: float, *, minimum: float = 0.1) -> float:
    try:
        return max(minimum, float(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


RESIDENTIAL_EXCLUDE = (
    "commercial",
    "business",
    "office",
    "retail",
    "industrial",
    "warehouse",
    "land",
    "plot",
    "parking",
    "garage",
    "farm land",
    "development",
)

# Only these three house types are wanted. Substring matching on "detached"
# also catches "Semi-Detached" and "Link-Detached", and "terrace" catches
# both "Terraced" and "End of Terrace" — the Rightmove propertySubType
# values actually seen for those categories. Everything else (flats,
# apartments, penthouses, maisonettes, bungalows, park homes, barn
# conversions, etc.) is deliberately excluded.
TARGET_PROPERTY_TYPES = ("detached", "terrace")


def is_target_property_type(property_type: str) -> bool:
    text = str(property_type or "").lower()
    return any(term in text for term in TARGET_PROPERTY_TYPES)


@dataclass(slots=True)
class DiscoveryParams:
    dry_run: bool = True
    location_names: list[str] | None = None
    max_candidates: int = 25
    max_pages_per_location: int = 2
    min_price: int = 500000
    min_days_on_market: int = 180
    target_emails: int = 0


@dataclass(slots=True)
class Candidate:
    rightmove_id: str
    url: str
    city: str
    address: str
    price: float | None
    property_type: str
    bedrooms: int | None
    bathrooms: int | None
    images: list[str]
    summary: str
    listed_date_raw: str


def _clean(value: Any, max_len: int = 1000) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:max_len]


def _first_deep_value(node: Any, keys: set[str]) -> Any:
    if isinstance(node, dict):
        for key, value in node.items():
            if key in keys and value:
                return value
        for value in node.values():
            found = _first_deep_value(value, keys)
            if found:
                return found
    elif isinstance(node, list):
        for item in node:
            found = _first_deep_value(item, keys)
            if found:
                return found
    return None


def _listing_date_raw(prop: dict[str, Any]) -> str:
    """Extract a usable Rightmove date from scalar or nested update fields."""
    value = _first_deep_value(
        prop,
        {
            "firstVisibleDate",
            "dateFirstListed",
            "listingDate",
            "addedOrReduced",
            "listingUpdateDate",
        },
    )
    if isinstance(value, dict):
        value = (
            value.get("listingUpdateDate")
            or value.get("firstVisibleDate")
            or value.get("dateFirstListed")
            or value.get("listingDate")
            or value.get("date")
        )
    return _clean(value, 120)


def _candidate_from_property(prop: dict[str, Any], city: str) -> Candidate | None:
    rm_id = _clean(prop.get("id"), 80)
    if not rm_id:
        return None
    price_info = prop.get("price") if isinstance(prop.get("price"), dict) else {}
    price = extract_price(price_info.get("amount") or price_info.get("displayPrices") or price_info.get("primaryPrice"))
    address = _clean(prop.get("displayAddress"), 500)
    prop_type = _clean(prop.get("propertySubType") or prop.get("propertyTypeFullDescription") or prop.get("propertyType"), 100)
    prop_url = _clean(prop.get("propertyUrl") or f"/properties/{rm_id}", 1000)
    if prop_url and not prop_url.startswith("http"):
        prop_url = f"{_BASE}{prop_url}"

    images: list[str] = []
    img_data = prop.get("propertyImages")
    if isinstance(img_data, dict):
        for key in ("mainImageSrc", "mainImageUrl"):
            src = _clean(img_data.get(key), 1000)
            if src and src not in images:
                images.append(src)
        for img in img_data.get("images") or []:
            if isinstance(img, dict):
                src = _clean(img.get("srcUrl") or img.get("url") or img.get("src"), 1000)
                if src and src not in images:
                    images.append(src)

    listed_raw = _listing_date_raw(prop)

    bedrooms = prop.get("bedrooms")
    bathrooms = prop.get("bathrooms")
    return Candidate(
        rightmove_id=rm_id,
        url=prop_url,
        city=city,
        address=address,
        price=price,
        property_type=prop_type,
        bedrooms=int(bedrooms) if str(bedrooms or "").isdigit() else None,
        bathrooms=int(bathrooms) if str(bathrooms or "").isdigit() else None,
        images=images[:12],
        summary=_clean(prop.get("summary") or prop.get("description"), 1600),
        listed_date_raw=_clean(listed_raw, 120),
    )


def _locations_for_request(names: list[str] | None) -> list[tuple[str, str]]:
    if not names:
        return KNOWN_LOCATIONS
    wanted = {name.strip().lower() for name in names if name.strip()}
    matched = [(name, loc_id) for name, loc_id in KNOWN_LOCATIONS if name.lower() in wanted]
    return matched or KNOWN_LOCATIONS


async def _fetch_search_page(
    client: httpx.AsyncClient,
    city: str,
    location_id: str,
    page: int,
    min_price: int,
) -> list[Candidate]:
    index = page * PAGE_SIZE
    url = (
        f"{_BASE}/property-for-sale/find.html"
        f"?searchType=SALE"
        f"&locationIdentifier={location_id}"
        # Oldest first is essential here.  The normal Rightmove default is
        # newest-first, which means a small page window never reaches the
        # listings this job is intended to find.
        f"&sortType=6"
        f"&numberOfPropertiesPerPage={PAGE_SIZE}"
        f"&index={index}"
        f"&minPrice={min_price}"
    )
    response = await client.get(url, headers=_headers(), follow_redirects=True, timeout=25)
    if response.status_code == 429:
        raise RuntimeError("Rightmove returned HTTP 429 rate limit")
    response.raise_for_status()
    props = _parse_next_data(response.text)
    candidates = [
        candidate
        for prop in props
        if (candidate := _candidate_from_property(prop, city))
    ]
    # Rightmove's sortType is not consistently honoured across locations.
    # Sort the actual dates in the response before detail scraping so the
    # dedicated stale job reaches qualifying inventory quickly.
    candidates.sort(
        key=lambda item: (
            parse_listed_date(item.listed_date_raw) is None,
            parse_listed_date(item.listed_date_raw) or datetime.max.replace(tzinfo=timezone.utc),
        )
    )
    return candidates


def _merge_snapshot(candidate: Candidate, scraped: dict[str, Any]) -> dict[str, Any]:
    snapshot = snapshot_from_scrape(scraped, candidate.url)
    images = snapshot.get("images") if isinstance(snapshot.get("images"), list) else []
    if not images:
        images = candidate.images
    # A detail page may expose the latest price reduction/update date while
    # the search result exposes the original first-visible date.  For stale
    # inventory the earliest reliable date is the meaningful market duration.
    candidate_date = parse_listed_date(candidate.listed_date_raw)
    detail_date = parse_listed_date(snapshot.get("listed_date"))
    if candidate_date and detail_date:
        listed_date = min(candidate_date, detail_date).isoformat()
    elif candidate_date:
        # Detail pages often say "Added today" or "Reduced today" rather than
        # exposing a date. Never let that label erase the valid search date.
        listed_date = candidate_date.isoformat()
    else:
        listed_date = snapshot.get("listed_date") or candidate.listed_date_raw
    return {
        **snapshot,
        "rightmove_id": candidate.rightmove_id,
        "title": snapshot.get("title") or candidate.address,
        "address": snapshot.get("address") or candidate.address,
        "price": snapshot.get("price") or (f"GBP {candidate.price:,.0f}" if candidate.price else ""),
        "image": snapshot.get("image") or (images[0] if images else ""),
        "images": images,
        "bedrooms": snapshot.get("bedrooms") or candidate.bedrooms or "",
        "bathrooms": snapshot.get("bathrooms") or candidate.bathrooms or "",
        "property_type": snapshot.get("property_type") or candidate.property_type,
        "description": snapshot.get("description") or candidate.summary,
        "listed_date": listed_date,
        "city": candidate.city,
        "platform": "Rightmove",
    }


def _skip_reason(
    *,
    snapshot: dict[str, Any],
    address: str,
    price: float | None,
    listed_date: datetime | None,
    duration_days: int | None,
    params: DiscoveryParams,
) -> str | None:
    if price is None or price < params.min_price:
        return "below_minimum_price"
    prop_type = str(snapshot.get("property_type") or "").lower()
    if any(term in prop_type for term in RESIDENTIAL_EXCLUDE):
        return "not_residential_sale"
    if not is_target_property_type(prop_type):
        return "not_target_property_type"
    if not listed_date or duration_days is None:
        return "missing_reliable_listing_date"
    if duration_days < params.min_days_on_market:
        return "not_stale_enough"
    if not is_specific_address(address):
        return "address_not_postal_quality"
    return None


async def _bulk_existing_prospects(db, candidates: list[Candidate]) -> dict[str, str]:
    """Look up every candidate on a search page in a single query.

    The previous version issued one SELECT per listing (up to 24 per search
    page, run one at a time). At UK-wide scan volumes that N+1 query pattern
    was the single biggest source of latency in the discovery loop — it is
    why a dedicated job with a 15-minute delivery target could only ever
    advance one search page roughly every 90-100 seconds. Batching the
    lookup removes 23 of every 24 round trips.
    """
    ids = [c.rightmove_id for c in candidates if c.rightmove_id]
    urls = [c.url for c in candidates if c.url]
    if not ids and not urls:
        return {}
    conditions = []
    if ids:
        conditions.append(StaleListingProspect.rightmove_id.in_(ids))
    if urls:
        conditions.append(StaleListingProspect.rightmove_url.in_(urls))
    result = await db.execute(
        select(
            StaleListingProspect.rightmove_id,
            StaleListingProspect.rightmove_url,
            StaleListingProspect.property_code,
        ).where(or_(*conditions))
    )
    matches: dict[str, str] = {}
    for rightmove_id, rightmove_url, property_code in result.all():
        if rightmove_id:
            matches[rightmove_id] = property_code
        if rightmove_url:
            matches[rightmove_url] = property_code
    return matches


def _candidate_duplicate_code(candidate: Candidate, existing: dict[str, str]) -> str | None:
    if candidate.rightmove_id and candidate.rightmove_id in existing:
        return existing[candidate.rightmove_id]
    if candidate.url in existing:
        return existing[candidate.url]
    return None


async def _scrape_detail_bounded(sem: asyncio.Semaphore, candidate: Candidate) -> dict[str, Any]:
    async with sem:
        return await scrape_single_listing(candidate.url)


_DISCOVERY_CURSOR_KEY = "stale_listing_discovery_cursor"
# Legacy /tmp file, kept only so a mid-cycle deploy doesn't lose an
# in-flight cursor outright; the durable source of truth is now the
# scraper_kv_state DB table (see _load_discovery_cursors below).
_DISCOVERY_CURSOR_FILE = Path(
    os.getenv("STALE_LISTINGS_CURSOR_FILE", "/tmp/stale_listing_discovery_cursor.json")
)


async def _load_discovery_cursors() -> dict[str, int]:
    """Per-location "resume from this page" cursor, persisted across the
    15-minute discovery cycles.

    Without this, every cycle restarted every location at page 0. Once the
    front of a location's oldest-first results had already been turned into
    prospects by an earlier cycle, every later cycle burned its entire
    per-cycle candidate budget re-confirming those same duplicates and never
    reached fresh inventory deeper in the results — this was the reason
    emails stopped going out entirely once the initial backlog was cleared
    (eligible=0, skipped=<budget> every cycle).

    This used to be a JSON file under /tmp, which works within one running
    container but is wiped on every Railway deploy/restart — so the cursor
    kept silently resetting to page 0 every time we shipped an unrelated
    change, and discovery went back to re-scanning the same near-threshold
    listings instead of progressing deeper into stale inventory. It is now
    persisted in the database (scraper_kv_state) so it survives redeploys.
    """
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                text("SELECT value_json FROM scraper_kv_state WHERE key = :key"),
                {"key": _DISCOVERY_CURSOR_KEY},
            )
            row = result.first()
            if row and row[0]:
                data = json.loads(row[0])
                if isinstance(data, dict):
                    return {
                        str(key): int(value)
                        for key, value in data.items()
                        if isinstance(value, (int, float)) or str(value).lstrip("-").isdigit()
                    }
    except Exception as exc:
        logger.debug("Could not load stale-listing discovery cursor from DB: %s", exc)
        # Fall back to the legacy file in case the DB table isn't there yet
        # (e.g. migration hasn't run) — better than silently losing state.
        try:
            if _DISCOVERY_CURSOR_FILE.exists():
                data = json.loads(_DISCOVERY_CURSOR_FILE.read_text())
                if isinstance(data, dict):
                    return {str(key): int(value) for key, value in data.items()}
        except Exception:
            pass
    return {}


async def _save_discovery_cursors(cursors: dict[str, int]) -> None:
    payload = json.dumps(cursors)
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(
                text(
                    """
                    INSERT INTO scraper_kv_state (key, value_json, updated_at)
                    VALUES (:key, :value, now())
                    ON CONFLICT (key) DO UPDATE
                        SET value_json = EXCLUDED.value_json, updated_at = now()
                    """
                ),
                {"key": _DISCOVERY_CURSOR_KEY, "value": payload},
            )
            await db.commit()
    except Exception as exc:
        logger.debug("Could not persist stale-listing discovery cursor to DB: %s", exc)
    # Best-effort legacy write too, so a container that dies before the next
    # deploy still has something to resume from if the DB write ever fails.
    try:
        _DISCOVERY_CURSOR_FILE.write_text(payload)
    except Exception:
        pass


def serialize_discovery_run(run: StaleListingDiscoveryRun) -> dict[str, Any]:
    try:
        results = json.loads(run.result_json or "{}")
    except Exception:
        results = {}
    locations = []
    try:
        parsed = json.loads(run.location_names or "[]")
        if isinstance(parsed, list):
            locations = [str(item) for item in parsed]
    except Exception:
        locations = []
    return {
        "run_id": str(run.id),
        "status": run.status,
        "dry_run": run.dry_run,
        "location_names": locations,
        "min_price": run.min_price,
        "min_days_on_market": run.min_days_on_market,
        "max_candidates": run.max_candidates,
        "max_pages_per_location": run.max_pages_per_location,
        "candidates_seen": run.candidates_seen,
        "eligible_count": run.eligible_count,
        "created_prospects_count": run.created_prospects_count,
        "skipped_count": run.skipped_count,
        "failed_count": run.failed_count,
        "results": results,
        "error_message": run.error_message,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


@dataclass(slots=True)
class _DiscoveryState:
    """Mutable counters/results shared by every location task in one run.

    All mutation goes through `lock` so concurrent locations never race on
    the same `StaleListingDiscoveryRun` row (the old code re-loaded that row
    fresh per candidate and could lose concurrent increments). The lock only
    ever guards cheap in-memory bookkeeping — the slow parts (HTTP fetches,
    the LLM report call, PDF rendering, email send) all run outside it.
    """

    run_uuid: uuid.UUID
    params: DiscoveryParams
    results: dict[str, list[dict[str, Any]]]
    lock: asyncio.Lock
    detail_sem: asyncio.Semaphore
    finalize_sem: asyncio.Semaphore
    processed: int = 0
    candidates_seen: int = 0
    eligible_count: int = 0
    created_count: int = 0
    skipped_count: int = 0
    failed_count: int = 0
    emails_sent: int = 0
    target_reached: bool = False
    dirty: bool = False


async def _flush_run_progress(state: _DiscoveryState) -> None:
    """Persist accumulated counters/results. Caller must hold state.lock."""
    if not state.dirty:
        return
    async with AsyncSessionLocal() as db:
        run = await db.get(StaleListingDiscoveryRun, state.run_uuid)
        if run:
            run.candidates_seen = state.candidates_seen
            run.eligible_count = state.eligible_count
            run.created_prospects_count = state.created_count
            run.skipped_count = state.skipped_count
            run.failed_count = state.failed_count
            run.result_json = json.dumps(state.results, ensure_ascii=False)
            await db.commit()
    state.dirty = False


async def _should_stop(state: _DiscoveryState) -> bool:
    async with state.lock:
        return state.processed >= state.params.max_candidates or state.target_reached


async def _record_skip(state: _DiscoveryState, candidate: Candidate, *, reason: str, **extra: Any) -> None:
    async with state.lock:
        state.skipped_count += 1
        state.results["skipped"].append({
            "url": candidate.url,
            "address": candidate.address,
            "reason": reason,
            **extra,
        })
        state.dirty = True


async def _finalize_candidate(
    state: _DiscoveryState,
    candidate: Candidate,
    detail_task: asyncio.Task | None,
) -> None:
    """Run the expensive per-candidate tail: detail fetch → eligibility →
    report/PDF/email. Bounded by `finalize_sem` so several qualifying
    candidates across different locations can be processed at once instead
    of strictly one at a time.
    """
    async with state.finalize_sem:
        try:
            if detail_task is None:
                # Only reachable for a candidate whose preliminary fields
                # were incomplete and so was never pre-fetched above.
                scraped = await _scrape_detail_bounded(state.detail_sem, candidate)
            else:
                scraped = await detail_task
            snapshot = _merge_snapshot(candidate, scraped)
            address = _clean(snapshot.get("address") or snapshot.get("title"), 500)
            price = extract_price(snapshot.get("price")) or candidate.price
            listed_date = parse_listed_date(snapshot.get("listed_date") or candidate.listed_date_raw)
            duration_days = None
            if listed_date:
                duration_days = (datetime.now(timezone.utc) - listed_date.astimezone(timezone.utc)).days
            reason = _skip_reason(
                snapshot=snapshot,
                address=address,
                price=price,
                listed_date=listed_date,
                duration_days=duration_days,
                params=state.params,
            )
        except Exception as exc:
            reason = f"detail_scrape_failed: {str(exc)[:180]}"
            snapshot = {}
            address = candidate.address
            price = candidate.price
            listed_date = None
            duration_days = None

        if reason:
            async with state.lock:
                state.skipped_count += 1
                state.results["skipped"].append({
                    "url": candidate.url,
                    "address": address or candidate.address,
                    "price": price,
                    "listed_date": listed_date.isoformat() if listed_date else None,
                    "duration_days": duration_days,
                    "reason": reason,
                })
                state.dirty = True
            return

        async with state.lock:
            state.eligible_count += 1
            eligible_item = {
                "url": candidate.url,
                "address": address,
                "price": price,
                "listed_date": listed_date.isoformat() if listed_date else None,
                "duration_days": duration_days,
                "city": candidate.city,
            }
            state.results["eligible"].append(eligible_item)
            if state.params.dry_run:
                state.dirty = True
                await _flush_run_progress(state)
                return

        # Keep a separate address register for every qualifying 180-day-plus
        # listing, even before report/email processing completes. This and
        # everything below runs without the lock held.
        await asyncio.to_thread(
            google_sheets.record_stale_listing_address,
            {
                "rightmove_id": candidate.rightmove_id,
                "property_address": address,
                "city": candidate.city,
                "asking_price": price,
                "listed_date": listed_date,
                "listing_duration_days": duration_days,
                "property_type": snapshot.get("property_type") or candidate.property_type,
                "bedrooms": snapshot.get("bedrooms") or candidate.bedrooms or "",
                "bathrooms": snapshot.get("bathrooms") or candidate.bathrooms or "",
                "listing_url": candidate.url,
                "discovery_run_id": str(state.run_uuid),
            },
        )

        try:
            async with AsyncSessionLocal() as db:
                prospect, token, letter_path = await create_prospect_from_listing_snapshot(
                    db,
                    rightmove_url=candidate.url,
                    property_address=address,
                    listing_snapshot=snapshot,
                    asking_price=float(price or 0),
                    listing_duration_days=int(duration_days or state.params.min_days_on_market),
                    listed_date=listed_date,
                    discovery_run_id=state.run_uuid,
                    expand_report=False,
                )
                preview_url = f"{(get_settings().FRONTEND_URL or 'https://www.heyhavlo.com').rstrip('/')}/stale-listings/prospect/{token}"
                admin_email = (get_settings().ADMIN_NOTIFY_EMAIL or "").strip()
                email_sent = False
                if admin_email:
                    email_sent = await asyncio.to_thread(
                        email_service.send_stale_prospect_letter_sync,
                        to_email=admin_email,
                        property_address=address,
                        property_code=prospect.property_code,
                        preview_url=preview_url,
                        letter_pdf_path=letter_path,
                    )
                    if email_sent:
                        prospect.letter_sent_at = datetime.now(timezone.utc)
                prospect.processing_status = "email_sent" if email_sent else "letter_ready"
                await db.commit()
                created_entry = {
                    **eligible_item,
                    "prospect_id": str(prospect.id),
                    "property_code": prospect.property_code,
                    "preview_url": preview_url,
                    "letter_pdf_path": letter_path,
                    "email_sent": email_sent,
                }

            # The earlier record_stale_listing_address call ran before this
            # prospect (and its property code) existed, so that row's Property
            # Code column was left blank. Fill it in now that the code exists.
            await asyncio.to_thread(
                google_sheets.update_stale_listing_property_code,
                rightmove_id=candidate.rightmove_id,
                listing_url=candidate.url,
                property_code=prospect.property_code,
            )
            async with state.lock:
                state.created_count += 1
                if email_sent:
                    state.emails_sent += 1
                if state.params.target_emails and state.emails_sent >= state.params.target_emails:
                    state.target_reached = True
                state.results["created"].append(created_entry)
                state.dirty = True
                await _flush_run_progress(state)
        except Exception as exc:
            logger.exception("Failed to process stale prospect %s", candidate.url)
            async with state.lock:
                state.failed_count += 1
                state.results["failed"].append({
                    "url": candidate.url,
                    "address": address,
                    "reason": str(exc)[:240],
                })
                state.dirty = True


async def _run_location(
    state: _DiscoveryState,
    client: httpx.AsyncClient,
    city: str,
    location_id: str,
    location_sem: asyncio.Semaphore,
    start_page: int,
) -> tuple[str, int]:
    """Scan one location starting from its persisted page cursor.

    Returns `(location_id, next_start_page)` so the caller can persist where
    this location left off for the next 15-minute cycle.
    """
    async with location_sem:
        for offset in range(state.params.max_pages_per_location):
            page = start_page + offset
            if await _should_stop(state):
                return location_id, page
            try:
                candidates = await _fetch_search_page(client, city, location_id, page, state.params.min_price)
            except Exception as exc:
                async with state.lock:
                    state.failed_count += 1
                    state.results["failed"].append({"location": city, "page": page, "reason": str(exc)[:240]})
                    state.dirty = True
                    await _flush_run_progress(state)
                return location_id, page

            if not candidates:
                # No more results at this index for this location/price
                # filter. Restart from the front next cycle rather than
                # remembering a page index past the end of what Rightmove
                # will ever return here.
                return location_id, 0

            # One bulk lookup replaces the old one-query-per-candidate check.
            # A transient DB/connection-pool hiccup here must not propagate:
            # this coroutine runs concurrently with every other location
            # under asyncio.gather, and an uncaught exception here previously
            # cancelled the *entire* cycle — discarding every other
            # location's real, already-committed progress for one blip.
            try:
                async with AsyncSessionLocal() as db:
                    existing_map = await _bulk_existing_prospects(db, candidates)
            except Exception as exc:
                async with state.lock:
                    state.failed_count += 1
                    state.results["failed"].append({"location": city, "page": page, "reason": str(exc)[:240]})
                    state.dirty = True
                    await _flush_run_progress(state)
                return location_id, page

            # Pre-fetch detail pages concurrently for anything the search
            # response doesn't already prove is too recent/cheap/duplicate.
            # Rightmove detail requests are the slowest single step here;
            # awaiting them one-by-one is what starved every 15-minute cycle
            # of real throughput.
            detail_tasks: dict[str, asyncio.Task] = {}
            for candidate in candidates:
                if _candidate_duplicate_code(candidate, existing_map) is not None:
                    continue
                candidate_date = parse_listed_date(candidate.listed_date_raw)
                candidate_duration = (
                    (datetime.now(timezone.utc) - candidate_date.astimezone(timezone.utc)).days
                    if candidate_date
                    else None
                )
                likely_eligible = (
                    candidate.price is None or candidate.price >= state.params.min_price
                ) and not any(
                    term in str(candidate.property_type or "").lower()
                    for term in RESIDENTIAL_EXCLUDE
                ) and (
                    candidate.property_type == "" or is_target_property_type(candidate.property_type)
                ) and (
                    candidate_duration is None
                    or candidate_duration >= state.params.min_days_on_market
                )
                if likely_eligible:
                    detail_tasks[candidate.rightmove_id] = asyncio.create_task(
                        _scrape_detail_bounded(state.detail_sem, candidate)
                    )

            finalize_tasks: list[asyncio.Task] = []
            for candidate in candidates:
                # Checked, and skipped, before the candidate budget is
                # touched: this used to run after the budget gate below, so
                # every already-known listing consumed one of the cycle's
                # max_candidates slots just like a genuinely new one. Once a
                # location's earliest oldest-first pages were fully turned
                # into prospects by an earlier cycle, the whole budget got
                # burned re-confirming those same duplicates before any
                # location ever reached fresh, un-prospected listings —
                # which is why emails stopped going out entirely once the
                # initial backlog was cleared. Duplicates are cheap (one
                # bulk lookup, no detail fetch) and free to skip.
                duplicate_code = _candidate_duplicate_code(candidate, existing_map)
                if duplicate_code is not None:
                    await _record_skip(state, candidate, reason="duplicate_prospect", property_code=duplicate_code)
                    continue

                async with state.lock:
                    if state.processed >= state.params.max_candidates or state.target_reached:
                        break
                    state.processed += 1
                    state.candidates_seen += 1
                    state.dirty = True

                # The search result already contains enough information to
                # discard most non-qualifying listings before the expensive
                # detail request; otherwise a large batch spends its entire
                # delivery window opening recent or under-price properties.
                candidate_listed_date = parse_listed_date(candidate.listed_date_raw)
                candidate_duration_days = (
                    (datetime.now(timezone.utc) - candidate_listed_date.astimezone(timezone.utc)).days
                    if candidate_listed_date
                    else None
                )
                preliminary_reason = None
                if candidate.price is None or candidate.price < state.params.min_price:
                    preliminary_reason = "below_minimum_price"
                elif any(
                    term in str(candidate.property_type or "").lower()
                    for term in RESIDENTIAL_EXCLUDE
                ):
                    preliminary_reason = "not_residential_sale"
                elif candidate.property_type and not is_target_property_type(candidate.property_type):
                    preliminary_reason = "not_target_property_type"
                elif (
                    candidate_listed_date is not None
                    and candidate_duration_days is not None
                    and candidate_duration_days < state.params.min_days_on_market
                ):
                    preliminary_reason = "not_stale_enough"
                if preliminary_reason:
                    await _record_skip(
                        state,
                        candidate,
                        reason=preliminary_reason,
                        price=candidate.price,
                        listed_date=candidate_listed_date.isoformat() if candidate_listed_date else None,
                        duration_days=candidate_duration_days,
                    )
                    continue

                finalize_tasks.append(
                    asyncio.create_task(
                        _finalize_candidate(state, candidate, detail_tasks.get(candidate.rightmove_id))
                    )
                )

            if finalize_tasks:
                await asyncio.gather(*finalize_tasks)

            async with state.lock:
                await _flush_run_progress(state)

            if await _should_stop(state):
                return location_id, page + 1

        return location_id, start_page + state.params.max_pages_per_location


async def run_discovery(run_id: str, params: DiscoveryParams) -> None:
    """Run discovery in the background, scanning several locations concurrently.

    Locations run in parallel (bounded by `STALE_LISTINGS_LOCATION_CONCURRENCY`)
    instead of one fully-paginated city before the next starts. Combined with
    batched duplicate lookups and concurrent report/PDF/email finalization,
    this is what actually lets a 15-minute cycle reach dozens of qualifying
    listings instead of one or two.
    """
    try:
        run_uuid = uuid.UUID(str(run_id))
    except ValueError:
        logger.warning("Invalid stale discovery run id %s", run_id)
        return
    results: dict[str, list[dict[str, Any]]] = {"eligible": [], "created": [], "skipped": [], "failed": []}
    async with AsyncSessionLocal() as db:
        run = await db.get(StaleListingDiscoveryRun, run_uuid)
        if not run:
            logger.warning("Discovery run %s disappeared before start", run_id)
            return
        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        run.result_json = json.dumps(results)
        await db.commit()

    state = _DiscoveryState(
        run_uuid=run_uuid,
        params=params,
        results=results,
        lock=asyncio.Lock(),
        detail_sem=asyncio.Semaphore(max(2, min(32, _env_int("STALE_LISTINGS_DETAIL_CONCURRENCY", 10)))),
        finalize_sem=asyncio.Semaphore(max(1, min(12, _env_int("STALE_LISTINGS_FINALIZE_CONCURRENCY", 4)))),
    )
    location_concurrency = max(1, min(20, _env_int("STALE_LISTINGS_LOCATION_CONCURRENCY", 6)))
    location_sem = asyncio.Semaphore(location_concurrency)
    locations = _locations_for_request(params.location_names)

    # A dry run (the admin "explore" endpoint) never creates prospects, so
    # advancing the real cursor from one would make the next automated cycle
    # silently skip pages that were never actually mined for real prospects.
    cursors = await _load_discovery_cursors() if not params.dry_run else {}

    try:
        async with httpx.AsyncClient() as client:
            # return_exceptions=True is deliberate defense-in-depth on top of
            # _run_location's own internal try/except blocks: with plain
            # gather(), a single location raising anything unexpected cancels
            # every other still-running location and discards their progress
            # for the entire cycle — confirmed live when one transient
            # Supabase connection blip in one location took down all ~107.
            location_results = await asyncio.gather(*(
                _run_location(
                    state, client, city, location_id, location_sem,
                    cursors.get(location_id, 0),
                )
                for city, location_id in locations
            ), return_exceptions=True)

        if not params.dry_run:
            for (city, location_id), outcome in zip(locations, location_results):
                if isinstance(outcome, BaseException):
                    logger.warning(
                        "Location %s (%s) raised and was skipped for this cycle: %s",
                        city, location_id, outcome,
                    )
                    continue
                _, next_page = outcome
                cursors[location_id] = next_page
            await _save_discovery_cursors(cursors)

        async with state.lock:
            state.dirty = True
            await _flush_run_progress(state)

        async with AsyncSessionLocal() as db:
            run = await db.get(StaleListingDiscoveryRun, run_uuid)
            if run:
                run.status = "completed"
                run.completed_at = datetime.now(timezone.utc)
                run.result_json = json.dumps(state.results, ensure_ascii=False)
                await db.commit()
    except Exception as exc:
        logger.exception("Discovery run %s failed", run_id)
        async with AsyncSessionLocal() as db:
            run = await db.get(StaleListingDiscoveryRun, run_uuid)
            if run:
                run.status = "failed"
                run.error_message = str(exc)[:1000]
                run.completed_at = datetime.now(timezone.utc)
                run.result_json = json.dumps(state.results, ensure_ascii=False)
                await db.commit()


async def run_automatic_discovery_once(
    *,
    target_emails: int = 0,
    max_candidates: int | None = None,
    max_pages_per_location: int | None = None,
) -> dict[str, Any]:
    """Create and execute one non-dry-run discovery cycle.

    This is intentionally separate from the admin endpoint so scheduled
    discovery uses the exact same processing and duplicate checks without
    requiring a logged-in admin or an HTTP request.
    """
    params = DiscoveryParams(
        dry_run=False,
        max_candidates=max_candidates or _env_int("STALE_LISTINGS_MAX_CANDIDATES", 200),
        max_pages_per_location=max_pages_per_location or _env_int("STALE_LISTINGS_MAX_PAGES_PER_LOCATION", 10),
        min_price=_env_int("STALE_LISTINGS_MIN_PRICE", 500000),
        min_days_on_market=_env_int("STALE_LISTINGS_MIN_DAYS", 180),
        target_emails=max(0, target_emails),
    )
    async with AsyncSessionLocal() as db:
        run = StaleListingDiscoveryRun(
            status="queued",
            dry_run=False,
            location_names=json.dumps([]),
            min_price=params.min_price,
            min_days_on_market=params.min_days_on_market,
            max_candidates=params.max_candidates,
            max_pages_per_location=params.max_pages_per_location,
            result_json=json.dumps({"eligible": [], "created": [], "skipped": [], "failed": []}),
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)
        run_id = str(run.id)

    logger.info(
        "Dedicated direct stale-listing scrape starting "
        "(target_emails=%d, max_candidates=%d, max_pages_per_location=%d, min_price=%d, min_days=%d).",
        params.target_emails,
        params.max_candidates,
        params.max_pages_per_location,
        params.min_price,
        params.min_days_on_market,
    )
    await run_discovery(run_id, params)

    async with AsyncSessionLocal() as db:
        run = await db.get(StaleListingDiscoveryRun, uuid.UUID(run_id))
        if not run:
            return {"run_id": run_id, "status": "missing"}
        return {
            "run_id": run_id,
            "status": run.status,
            "created_prospects": run.created_prospects_count,
            "emails_sent": sum(
                1
                for item in (json.loads(run.result_json or "{}").get("created", []) if run.result_json else [])
                if item.get("email_sent") is True
            ),
            "eligible": run.eligible_count,
            "skipped": run.skipped_count,
            "failed": run.failed_count,
        }


async def start_automatic_discovery_loop() -> None:
    """Run stale prospect discovery automatically on a recurring schedule."""
    # A short cycle keeps the pipeline moving when a previous cycle has
    # already exhausted its first batch.  The advisory lock still prevents
    # multiple workers from running the same cycle concurrently.
    interval_hours = _env_float("STALE_LISTINGS_DISCOVERY_INTERVAL_HOURS", 0.25)
    initial_delay_seconds = _env_float("STALE_LISTINGS_DISCOVERY_INITIAL_DELAY_SECONDS", 60.0)
    logger.info(
        "Automatic stale-listing discovery loop started "
        "(initial delay %.0fs, interval %.1fh).",
        initial_delay_seconds,
        interval_hours,
    )
    await asyncio.sleep(initial_delay_seconds)
    while True:
        try:
            result = await run_once_with_advisory_lock(
                "stale-listing-discovery",
                run_automatic_discovery_once,
            )
            logger.info("Automatic stale-listing discovery cycle finished: %s", result)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Automatic stale-listing discovery cycle failed.")
        await asyncio.sleep(interval_hours * 3600)
