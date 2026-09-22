"""America (Zillow) stale-listing discovery and CSV bulk upload.

Mirrors the UK/Rightmove pipeline in stale_listing_discovery.py -- scrape,
validate against the same three criteria (price floor, target home type,
days-on-market), then create a fully processed prospect (LLM report + letter
PDF) -- but with Zillow's data model:

  * "Days on Zillow" is Zillow's own counter, read straight from the listing,
    so there is no Rightmove-style "Reduced on" date ambiguity to work around.
  * Zillow has no oldest-first sort and caps every search at 20 pages, so the
    stale tail is reached by sorting newest-first, keeping each price band
    under the reachable-results cap (bisecting bands that are too big), and
    reading pages from the LAST one backwards until listings stop being old
    enough.
  * US prospects are not written to the UK "Stale Listing Addresses" Google
    Sheet -- that sheet is the UK physical-mail source list.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_, select, text

from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingDiscoveryRun, StaleListingProspect
from app.services import zillow_scraper as zillow
from app.services.stale_prospect_service import (
    create_prospect_from_listing_snapshot,
    extract_price,
    parse_listed_date,
)

logger = logging.getLogger(__name__)

COUNTRY = "US"


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


def min_price_default() -> int:
    return _env_int("US_STALE_LISTINGS_MIN_PRICE", 500_000)


def min_days_default() -> int:
    return _env_int("US_STALE_LISTINGS_MIN_DAYS", 180)


def us_snapshot(scraped: dict[str, Any], url: str) -> dict[str, Any]:
    """Prospect listing_snapshot_json for a Zillow listing. Same core keys as
    snapshot_from_scrape (the report prompt, letter and console all read
    those) plus the Zillow-specific extras."""
    images = scraped.get("images") if isinstance(scraped.get("images"), list) else []
    return {
        "title": scraped.get("title") or scraped.get("address") or "",
        "address": scraped.get("address") or scraped.get("title") or "",
        "postcode": scraped.get("zipcode") or scraped.get("postcode") or "",
        "price": scraped.get("price") or "",
        "image": scraped.get("image") or (images[0] if images else ""),
        "images": images,
        "bedrooms": scraped.get("bedrooms") or "",
        "bathrooms": scraped.get("bathrooms") or "",
        "property_type": scraped.get("property_type") or "",
        "platform": "Zillow",
        "country": COUNTRY,
        "currency": "USD",
        "description": scraped.get("description") or "",
        "listed_date": scraped.get("listed_date") or "",
        "features": scraped.get("features") if isinstance(scraped.get("features"), list) else [],
        "price_reduced": bool(scraped.get("price_reduced")),
        "rightmove_id": scraped.get("zpid") or zillow.zpid_from_url(url) or "",
        "city": scraped.get("city") or "",
        "state": scraped.get("state") or "",
        "sqft": scraped.get("sqft"),
        "year_built": scraped.get("year_built"),
        "days_on_zillow": scraped.get("days_on_zillow"),
    }


def skip_reason(
    scraped: dict[str, Any],
    *,
    min_price: int,
    min_days: int,
    override_duration_check: bool = False,
) -> str | None:
    """None if the listing qualifies, otherwise the skip code. Same codes the
    UK bulk upload uses where the rule is the same."""
    price = extract_price(scraped.get("price"))
    if price is None or price < min_price:
        return "below_minimum_price_or_unscrapable"
    if not zillow.is_target_home_type(scraped.get("home_type_raw")):
        return "not_target_property_type"
    status = str(scraped.get("status") or "").upper()
    if status and status not in {"FOR_SALE", "ACTIVE"}:
        return "not_currently_for_sale"
    days = scraped.get("days_on_zillow")
    if not override_duration_check and (days is None or days < min_days):
        return "not_stale_enough_or_unscrapable"
    return None


async def _existing_by_zpid_or_url(zpids: list[str], urls: list[str]) -> dict[str, str]:
    """{zpid-or-url: property_code} for every US prospect already stored."""
    conditions = []
    if zpids:
        conditions.append(StaleListingProspect.rightmove_id.in_(zpids))
    if urls:
        conditions.append(StaleListingProspect.rightmove_url.in_(urls))
    if not conditions:
        return {}
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(
                StaleListingProspect.rightmove_id,
                StaleListingProspect.rightmove_url,
                StaleListingProspect.property_code,
            ).where(StaleListingProspect.country == COUNTRY, or_(*conditions))
        )
        matches: dict[str, str] = {}
        for rid, url, code in result.all():
            if rid:
                matches[rid] = code
            if url:
                matches[url] = code
        return matches


async def _create_prospect(
    scraped: dict[str, Any],
    url: str,
    *,
    address: str | None = None,
    discovery_run_id: uuid.UUID | None = None,
) -> tuple[str, str]:
    """Create the prospect row + report + letter. Returns (prospect_id, property_code)."""
    snapshot = us_snapshot(scraped, url)
    price = extract_price(snapshot.get("price")) or 0.0
    days = scraped.get("days_on_zillow")
    days = int(days) if isinstance(days, (int, float)) else 0
    listed_date = parse_listed_date(snapshot.get("listed_date")) if scraped.get("days_on_zillow") is not None else None
    final_address = (address or "").strip() or snapshot["address"]
    async with AsyncSessionLocal() as db:
        prospect, _token, _letter = await create_prospect_from_listing_snapshot(
            db,
            rightmove_url=url,
            property_address=final_address,
            listing_snapshot=snapshot,
            asking_price=float(price),
            listing_duration_days=days,
            listed_date=listed_date,
            discovery_run_id=discovery_run_id,
            city=snapshot.get("city") or None,
            expand_report=False,
            is_manual=False,
            country=COUNTRY,
        )
        await db.commit()
        return str(prospect.id), prospect.property_code


# ── CSV bulk upload ──────────────────────────────────────────────────────────

async def process_us_bulk_upload_row(
    row: dict[str, str],
    row_num: int,
    override_duration_check: bool = False,
    session: "zillow.ZillowSession | None" = None,
) -> dict[str, Any]:
    """One CSV row (a Zillow listing URL, optional address override) through
    scrape -> validate -> create. Never raises.

    `session`: pass the SAME ZillowSession across every row in one upload
    (see run_bulk_csv_upload) so a CSV of many URLs looks like one visitor
    working through a list, sharing cookies/fingerprint/pacing/circuit-
    breaker, rather than opening a brand-new identity per row -- a bulk
    upload is exactly the volume where that distinction matters most.
    """
    raw_url = (row.get("rightmove_url") or "").strip()
    address = (row.get("address") or "").strip()
    url = zillow.normalize_zillow_url(raw_url)
    base = {"row": row_num, "rightmove_url": raw_url, "address": address}
    if not url or not zillow.is_zillow_url(url):
        return {"outcome": "failed", **base,
                "reason": "Not a Zillow listing URL (expected https://www.zillow.com/homedetails/..._zpid/)."}
    try:
        zpid = zillow.zpid_from_url(url) or ""
        existing = await _existing_by_zpid_or_url([zpid] if zpid else [], [url])
        if existing:
            return {"outcome": "skipped", **base, "rightmove_url": url, "reason": "duplicate_prospect"}

        try:
            scraped = await zillow.scrape_zillow_listing(url, session=session)
        except zillow.ZillowCircuitOpenError as exc:
            # Distinct, clearer reason than the generic branch below: the
            # session is blocked outright, so every row after this one in
            # the same upload will fail the same way until a fresh run
            # starts -- worth saying plainly rather than "scrape failed".
            return {"outcome": "failed", **base, "rightmove_url": url,
                    "reason": f"Zillow blocked this scraping session: {str(exc)[:200]}"}
        except Exception as exc:
            logger.warning("US bulk-upload scrape failed for %s: %s", url, exc)
            return {"outcome": "failed", **base, "rightmove_url": url, "reason": f"Zillow scrape failed: {str(exc)[:200]}"}

        base["address"] = address or scraped.get("address") or ""
        reason = skip_reason(
            scraped,
            min_price=min_price_default(),
            min_days=min_days_default(),
            override_duration_check=override_duration_check,
        )
        if reason:
            return {"outcome": "skipped", **base, "rightmove_url": url, "reason": reason}

        prospect_id, property_code = await _create_prospect(scraped, url, address=address)
        return {"outcome": "created", **base, "rightmove_url": url,
                "property_code": property_code, "prospect_id": prospect_id}
    except Exception as exc:
        logger.exception("US bulk-upload row %d failed: %s", row_num, url)
        return {"outcome": "failed", **base, "reason": str(exc)[:240]}


# ── Discovery ────────────────────────────────────────────────────────────────

@dataclass(slots=True)
class UsDiscoveryParams:
    dry_run: bool = False
    location_names: list[str] | None = None
    max_candidates: int = 60
    max_tail_pages: int = 4
    min_price: int = 500_000
    min_days_on_market: int = 180


_PRICE_LADDER: list[tuple[int, int | None]] = [
    (500_000, 600_000),
    (600_000, 750_000),
    (750_000, 1_000_000),
    (1_000_000, 1_500_000),
    (1_500_000, 3_000_000),
    (3_000_000, None),
]


def price_bands(min_price: int) -> list[tuple[int, int | None]]:
    bands: list[tuple[int, int | None]] = []
    for lo, hi in _PRICE_LADDER:
        if hi is not None and hi <= min_price:
            continue
        bands.append((max(lo, min_price), hi))
    return bands or [(min_price, None)]


def split_band(lo: int, hi: int | None) -> list[tuple[int, int | None]] | None:
    """Halve a band that has too many results to reach the oldest ones. None
    when it is already too narrow to split usefully."""
    upper = hi if hi is not None else lo * 2
    if upper - lo < 20_000:
        return None
    mid = int(round((lo + upper) / 2, -3))
    return [(lo, mid), (mid + 1, hi)]


@dataclass(slots=True)
class _State:
    run_uuid: uuid.UUID
    params: UsDiscoveryParams
    results: dict[str, list[dict[str, Any]]]
    lock: asyncio.Lock
    finalize_sem: asyncio.Semaphore
    session: "zillow.ZillowSession"
    seen: set[str] = field(default_factory=set)
    processed: int = 0
    candidates_seen: int = 0
    eligible_count: int = 0
    created_count: int = 0
    skipped_count: int = 0
    failed_count: int = 0
    dirty: bool = False


async def _flush(state: _State) -> None:
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


async def _add_result(state: _State, bucket: str, item: dict[str, Any], counter: str) -> None:
    async with state.lock:
        setattr(state, counter, getattr(state, counter) + 1)
        state.results[bucket].append(item)
        state.dirty = True


def _out_of_budget(state: _State) -> bool:
    return state.processed >= state.params.max_candidates


def _preliminary_skip(listing: zillow.ZillowListing, params: UsDiscoveryParams) -> str | None:
    if listing.price is None or listing.price < params.min_price:
        return "below_minimum_price"
    if not zillow.is_target_home_type(listing.home_type):
        return "not_target_property_type"
    if listing.status_text and listing.status_text not in {"FOR_SALE", "ACTIVE"}:
        return "not_currently_for_sale"
    if listing.days_on_zillow is not None and listing.days_on_zillow < params.min_days_on_market:
        return "not_stale_enough"
    return None


async def _finalize_listing(state: _State, listing: zillow.ZillowListing, region_label: str) -> None:
    async with state.finalize_sem:
        item = {
            "url": listing.url,
            "address": listing.address,
            "price": listing.price,
            "duration_days": listing.days_on_zillow,
            "city": listing.city or region_label,
        }
        try:
            try:
                scraped = await zillow.scrape_zillow_listing(listing.url, session=state.session)
                # The detail page is authoritative for description/features,
                # but if it comes back undated fall back to the search row.
                if scraped.get("days_on_zillow") is None:
                    scraped["days_on_zillow"] = listing.days_on_zillow
            except zillow.ZillowCircuitOpenError:
                raise
            except Exception as exc:
                logger.info("Zillow detail fetch failed for %s (%s); using search-result data", listing.url, exc)
                scraped = zillow.scraped_from_search_listing(listing)

            reason = skip_reason(
                scraped, min_price=state.params.min_price, min_days=state.params.min_days_on_market
            )
            if reason:
                await _add_result(state, "skipped", {**item, "reason": reason}, "skipped_count")
                return

            async with state.lock:
                state.eligible_count += 1
                state.results["eligible"].append(item)
                state.dirty = True
            if state.params.dry_run:
                return

            prospect_id, property_code = await _create_prospect(
                scraped, listing.url, discovery_run_id=state.run_uuid
            )
            await _add_result(
                state, "created", {**item, "prospect_id": prospect_id, "property_code": property_code}, "created_count"
            )
        except zillow.ZillowCircuitOpenError:
            raise
        except Exception as exc:
            logger.exception("US discovery failed to process %s", listing.url)
            await _add_result(state, "failed", {**item, "reason": str(exc)[:240]}, "failed_count")


async def _scan_band(state: _State, region_label: str, slug: str, lo: int, hi: int | None) -> None:
    """One region + price band: read its stale tail and process what qualifies."""
    if _out_of_budget(state):
        return
    try:
        first = await zillow.fetch_search_page(slug, 1, lo, hi, session=state.session)
    except zillow.ZillowCircuitOpenError:
        raise
    except Exception as exc:
        await _add_result(state, "failed", {"location": region_label, "band": f"{lo}-{hi or ''}", "reason": str(exc)[:240]}, "failed_count")
        return

    if first.total_results > zillow.MAX_REACHABLE_RESULTS:
        halves = split_band(lo, hi)
        if halves:
            for half_lo, half_hi in halves:
                await _scan_band(state, region_label, slug, half_lo, half_hi)
            return

    pages_to_read = list(range(first.total_pages, 0, -1))[: state.params.max_tail_pages]
    for page_number in pages_to_read:
        if _out_of_budget(state):
            return
        if page_number == 1:
            page = first
        else:
            try:
                page = await zillow.fetch_search_page(slug, page_number, lo, hi, session=state.session)
            except zillow.ZillowCircuitOpenError:
                raise
            except Exception as exc:
                await _add_result(
                    state, "failed",
                    {"location": region_label, "page": page_number, "reason": str(exc)[:240]}, "failed_count",
                )
                return

        ages = [item.days_on_zillow for item in page.listings if item.days_on_zillow is not None]
        tasks: list[asyncio.Task] = []
        new_ids = [item.zpid for item in page.listings]
        existing = await _existing_by_zpid_or_url(new_ids, [item.url for item in page.listings])
        for listing in page.listings:
            if listing.zpid in state.seen:
                continue
            state.seen.add(listing.zpid)
            if listing.zpid in existing or listing.url in existing:
                await _add_result(
                    state, "skipped",
                    {"url": listing.url, "address": listing.address, "reason": "duplicate_prospect",
                     "property_code": existing.get(listing.zpid) or existing.get(listing.url)},
                    "skipped_count",
                )
                continue
            async with state.lock:
                state.candidates_seen += 1
                state.dirty = True
            reason = _preliminary_skip(listing, state.params)
            if reason:
                await _add_result(
                    state, "skipped",
                    {"url": listing.url, "address": listing.address, "price": listing.price,
                     "duration_days": listing.days_on_zillow, "reason": reason},
                    "skipped_count",
                )
                continue
            # Only listings that actually get a detail fetch + LLM report count
            # against the run's budget; cheap search-row rejections are free.
            async with state.lock:
                if _out_of_budget(state):
                    break
                state.processed += 1
            tasks.append(asyncio.create_task(_finalize_listing(state, listing, region_label)))
        if tasks:
            # Plain gather (no return_exceptions): a ZillowCircuitOpenError
            # raised by any one finalize task is meant to propagate and stop
            # the whole run, same as one raised by the page fetch above.
            await asyncio.gather(*tasks)
        async with state.lock:
            await _flush(state)

        # Newest-first order: walking pages backwards only gets younger. Once
        # even the oldest listing on a page is under the threshold, every
        # earlier page is too.
        if ages and max(ages) < state.params.min_days_on_market:
            return


async def run_us_discovery(run_id: str, params: UsDiscoveryParams) -> None:
    try:
        run_uuid = uuid.UUID(str(run_id))
    except ValueError:
        logger.warning("Invalid US discovery run id %s", run_id)
        return
    results: dict[str, list[dict[str, Any]]] = {"eligible": [], "created": [], "skipped": [], "failed": []}
    async with AsyncSessionLocal() as db:
        run = await db.get(StaleListingDiscoveryRun, run_uuid)
        if not run:
            return
        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        run.result_json = json.dumps(results)
        await db.commit()

    session = zillow.open_session()
    state = _State(
        run_uuid=run_uuid,
        params=params,
        results=results,
        lock=asyncio.Lock(),
        finalize_sem=asyncio.Semaphore(max(1, min(6, _env_int("US_STALE_LISTINGS_FINALIZE_CONCURRENCY", 3)))),
        session=session,
    )
    try:
        if not zillow.proxy_configured():
            logger.warning("US discovery running without ZILLOW_SCRAPER_PROXY_URL; Zillow will very likely block it.")
        circuit_open_reason: str | None = None
        try:
            regions = zillow.regions_for_request(params.location_names)
            for index, (label, slug) in enumerate(regions):
                if _out_of_budget(state):
                    break
                # A real visitor moving from one city's listings to an
                # entirely different one, city after city with zero pause, is
                # itself an unusual pattern -- a longer break here than the
                # per-request pacing inside ZillowSession, distinct from that
                # and on top of it.
                if index > 0:
                    await asyncio.sleep(random.uniform(4.0, 9.0))
                for lo, hi in price_bands(params.min_price):
                    if _out_of_budget(state):
                        break
                    await _scan_band(state, label, slug, lo, hi)
        except zillow.ZillowCircuitOpenError as exc:
            # Not a failure: whatever this run already found is real and
            # already committed. Zillow is actively blocking this session
            # right now, and retrying into that only risks a longer-lived
            # block on the same identity -- stop here and let the admin
            # start a fresh run (fresh session, and ideally a better/rotated
            # proxy) rather than hammering forward.
            circuit_open_reason = str(exc)
            logger.warning("US discovery run %s stopped early: %s", run_id, exc)
        async with state.lock:
            state.dirty = True
            await _flush(state)
        async with AsyncSessionLocal() as db:
            run = await db.get(StaleListingDiscoveryRun, run_uuid)
            if run:
                run.status = "completed"
                run.completed_at = datetime.now(timezone.utc)
                run.result_json = json.dumps(state.results, ensure_ascii=False)
                if circuit_open_reason:
                    run.error_message = (
                        f"Stopped early -- {circuit_open_reason} Results found before that point were kept."
                    )[:1000]
                await db.commit()
    except Exception as exc:
        logger.exception("US discovery run %s failed", run_id)
        async with AsyncSessionLocal() as db:
            run = await db.get(StaleListingDiscoveryRun, run_uuid)
            if run:
                run.status = "failed"
                run.error_message = str(exc)[:1000]
                run.completed_at = datetime.now(timezone.utc)
                run.result_json = json.dumps(state.results, ensure_ascii=False)
                await db.commit()
    finally:
        await session.aclose()


async def active_us_run_exists() -> bool:
    """True if a US discovery run is queued/running and recent -- guards the
    unauthenticated console 'Scan Zillow' button against stacking scans (each
    one spends proxy credits)."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text(
                """
                SELECT 1 FROM stale_listing_discovery_runs
                WHERE country = 'US'
                  AND status IN ('queued', 'running')
                  AND created_at > now() - interval '2 hours'
                  AND location_names <> '["csv_upload"]'
                LIMIT 1
                """
            )
        )
        return result.first() is not None
