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
from typing import Any

import httpx
from sqlalchemy import or_, select

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
    is_specific_address,
    parse_listed_date,
    snapshot_from_scrape,
)

logger = logging.getLogger(__name__)


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


@dataclass(slots=True)
class DiscoveryParams:
    dry_run: bool = True
    location_names: list[str] | None = None
    max_candidates: int = 25
    max_pages_per_location: int = 2
    min_price: int = 300001
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
    if not listed_date or duration_days is None:
        return "missing_reliable_listing_date"
    if duration_days < params.min_days_on_market:
        return "not_stale_enough"
    if not is_specific_address(address):
        return "address_not_postal_quality"
    return None


async def _existing_prospect(db, candidate: Candidate) -> StaleListingProspect | None:
    result = await db.execute(
        select(StaleListingProspect).where(
            or_(
                StaleListingProspect.rightmove_url == candidate.url,
                StaleListingProspect.rightmove_id == candidate.rightmove_id,
            )
        )
    )
    return result.scalars().first()


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


async def run_discovery(run_id: str, params: DiscoveryParams) -> None:
    """Run discovery in the background and persist progress after each candidate."""
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

    processed = 0
    emails_sent_this_run = 0
    target_reached = False
    locations = _locations_for_request(params.location_names)
    try:
        async with httpx.AsyncClient() as client:
            for city, location_id in locations:
                if processed >= params.max_candidates or target_reached:
                    break
                for page in range(params.max_pages_per_location):
                    if processed >= params.max_candidates or target_reached:
                        break
                    try:
                        candidates = await _fetch_search_page(client, city, location_id, page, params.min_price)
                    except Exception as exc:
                        results["failed"].append({"location": city, "page": page, "reason": str(exc)[:240]})
                        async with AsyncSessionLocal() as db:
                            run = await db.get(StaleListingDiscoveryRun, run_uuid)
                            if run:
                                run.failed_count += 1
                                run.result_json = json.dumps(results, ensure_ascii=False)
                                await db.commit()
                        break

                    if not candidates:
                        break

                    for candidate in candidates:
                        if processed >= params.max_candidates or target_reached:
                            break
                        processed += 1
                        await asyncio.sleep(0.8)
                        async with AsyncSessionLocal() as db:
                            run = await db.get(StaleListingDiscoveryRun, run_uuid)
                            if not run:
                                return
                            run.candidates_seen += 1
                            existing = await _existing_prospect(db, candidate)
                            if existing:
                                run.skipped_count += 1
                                results["skipped"].append({
                                    "url": candidate.url,
                                    "address": candidate.address,
                                    "reason": "duplicate_prospect",
                                    "property_code": existing.property_code,
                                })
                                run.result_json = json.dumps(results, ensure_ascii=False)
                                await db.commit()
                                continue
                            await db.commit()

                        try:
                            scraped = await scrape_single_listing(candidate.url)
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
                                params=params,
                            )
                        except Exception as exc:
                            reason = f"detail_scrape_failed: {str(exc)[:180]}"
                            snapshot = {}
                            address = candidate.address
                            price = candidate.price
                            listed_date = None
                            duration_days = None

                        async with AsyncSessionLocal() as db:
                            run = await db.get(StaleListingDiscoveryRun, run_uuid)
                            if not run:
                                return
                            if reason:
                                run.skipped_count += 1
                                results["skipped"].append({
                                    "url": candidate.url,
                                    "address": address or candidate.address,
                                    "price": price,
                                    "listed_date": listed_date.isoformat() if listed_date else None,
                                    "duration_days": duration_days,
                                    "reason": reason,
                                })
                                run.result_json = json.dumps(results, ensure_ascii=False)
                                await db.commit()
                                continue

                            run.eligible_count += 1
                            eligible_item = {
                                "url": candidate.url,
                                "address": address,
                                "price": price,
                                "listed_date": listed_date.isoformat() if listed_date else None,
                                "duration_days": duration_days,
                                "city": candidate.city,
                            }
                            results["eligible"].append(eligible_item)
                            if params.dry_run:
                                run.result_json = json.dumps(results, ensure_ascii=False)
                                await db.commit()
                                continue

                            # Keep a separate address register for every
                            # qualifying 180-day-plus listing, even before
                            # report/email processing completes.
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
                                    "discovery_run_id": str(run.id),
                                },
                            )

                            try:
                                prospect, token, letter_path = await create_prospect_from_listing_snapshot(
                                    db,
                                    rightmove_url=candidate.url,
                                    property_address=address,
                                    listing_snapshot=snapshot,
                                    asking_price=float(price or 0),
                                    listing_duration_days=int(duration_days or params.min_days_on_market),
                                    listed_date=listed_date,
                                    discovery_run_id=run.id,
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
                                run.created_prospects_count += 1
                                if email_sent:
                                    emails_sent_this_run += 1
                                if params.target_emails and emails_sent_this_run >= params.target_emails:
                                    target_reached = True
                                results["created"].append({
                                    **eligible_item,
                                    "prospect_id": str(prospect.id),
                                    "property_code": prospect.property_code,
                                    "preview_url": preview_url,
                                    "letter_pdf_path": letter_path,
                                    "email_sent": email_sent,
                                })
                                run.result_json = json.dumps(results, ensure_ascii=False)
                                await db.commit()
                            except Exception as exc:
                                await db.rollback()
                                async with AsyncSessionLocal() as fail_db:
                                    fail_run = await fail_db.get(StaleListingDiscoveryRun, run_uuid)
                                    if fail_run:
                                        fail_run.failed_count += 1
                                        results["failed"].append({
                                            "url": candidate.url,
                                            "address": address,
                                            "reason": str(exc)[:240],
                                        })
                                        fail_run.result_json = json.dumps(results, ensure_ascii=False)
                                        await fail_db.commit()
                                logger.exception("Failed to process stale prospect %s", candidate.url)

        async with AsyncSessionLocal() as db:
            run = await db.get(StaleListingDiscoveryRun, run_uuid)
            if run:
                run.status = "completed"
                run.completed_at = datetime.now(timezone.utc)
                run.result_json = json.dumps(results, ensure_ascii=False)
                await db.commit()
    except Exception as exc:
        logger.exception("Discovery run %s failed", run_id)
        async with AsyncSessionLocal() as db:
            run = await db.get(StaleListingDiscoveryRun, run_uuid)
            if run:
                run.status = "failed"
                run.error_message = str(exc)[:1000]
                run.completed_at = datetime.now(timezone.utc)
                run.result_json = json.dumps(results, ensure_ascii=False)
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
        min_price=_env_int("STALE_LISTINGS_MIN_PRICE", 300001),
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
