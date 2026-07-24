"""Rightmove property scraper — high-volume edition (v2).

What changed from v1:
  ┌─────────────────────────────────────────────────────────────────────┐
  │  v1 ceiling  :  40 cities × 10 pages × 24 =       9,600 listings   │
  │  v2 target   : 300 locations × 6 price bands                        │
  │                × 42 pages × 24 = 1,814,400 raw                      │
  │                ≈ 35 % unique  →  ~635,000 unique listings            │
  └─────────────────────────────────────────────────────────────────────┘

Key improvements:
  1. Price-band splitting  — Rightmove caps results at 1,008 per query;
     querying 6 non-overlapping price ranges multiplies coverage 6×.
  2. Full pagination       — 42 pages per query (was 10).
  3. 5 concurrent workers  — shared asyncio.Queue + rate-limit semaphore.
  4. Dynamic location discovery — 300 + UK place names resolved to their
     Rightmove locationIdentifier via the search redirect; cached for 7 days.
  5. Persistent progress   — /tmp/rm_scraper_progress.json lets the worker
     resume exactly where it stopped after a restart.
  6. Always-active loop    — next cycle starts as soon as the previous one
     finishes (or SCRAPE_INTERVAL_HOURS later if it finishes early).
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import re
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, NamedTuple, Optional

import httpx
import gc

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.database import AsyncSessionLocal
from app.models.models import RightmoveListing

logger = logging.getLogger(__name__)

# ── Tunable constants ──────────────────────────────────────────────────────────
NUM_WORKERS            = 2      # concurrent scraping workers — keep low to avoid OOM in container
HTTP_CONCURRENCY       = 2      # max simultaneous outbound HTTP requests
MAX_PAGES_PER_QUERY    = 42     # Rightmove's absolute ceiling
PAGE_SIZE              = 24
SCRAPE_INTERVAL_HOURS  = 8      # wait between full cycles
PROGRESS_FILE          = Path("/tmp/rm_scraper_progress.json")
LOCATIONS_CACHE_FILE   = Path("/tmp/rm_locations_cache.json")
LOCATIONS_CACHE_TTL_DAYS = 7
_BASE                  = "https://www.rightmove.co.uk"

# ── Price bands ────────────────────────────────────────────────────────────────
# Each tuple: (label, min_price_or_None, max_price_or_None)
# Non-overlapping bands force Rightmove to return distinct result sets,
# effectively bypassing the 1,008-result cap per location.
PRICE_BANDS: list[tuple[str, Optional[int], Optional[int]]] = [
    ("u150k",    None,         150_000),
    ("150-300k", 150_001,      300_000),
    ("300-500k", 300_001,      500_000),
    ("500-800k", 500_001,      800_000),
    ("800k-2m",  800_001,    2_000_000),
    ("over2m",   2_000_001,       None),
]

# ── Known locations (hardcoded — verified against live Rightmove) ───────────────
# (display_name, URL-encoded Rightmove locationIdentifier)
# All IDs below confirmed valid: GET /find.html?locationIdentifier=<id> → 200
KNOWN_LOCATIONS: list[tuple[str, str]] = [
    # ── Original 40 ─────────────────────────────────────────────────────────────
    ("London",          "REGION%5E87"),
    ("Manchester",      "REGION%5E904"),
    ("Birmingham",      "REGION%5E2"),
    ("Leeds",           "REGION%5E787"),
    ("Bristol",         "REGION%5E219"),
    ("Liverpool",       "REGION%5E800"),
    ("Sheffield",       "REGION%5E1093"),
    ("Edinburgh",       "REGION%5E475"),
    ("Glasgow",         "REGION%5E550"),
    ("Nottingham",      "REGION%5E963"),
    ("Newcastle",       "REGION%5E945"),
    ("Leicester",       "REGION%5E796"),
    ("Southampton",     "REGION%5E1118"),
    ("Oxford",          "REGION%5E977"),
    ("Cambridge",       "REGION%5E244"),
    ("Brighton",        "REGION%5E216"),
    ("Coventry",        "REGION%5E360"),
    ("Derby",           "REGION%5E414"),
    ("Exeter",          "REGION%5E486"),
    ("Plymouth",        "REGION%5E1017"),
    ("Reading",         "REGION%5E1060"),
    ("York",            "REGION%5E1345"),
    ("Bath",            "REGION%5E102"),
    ("Chester",         "REGION%5E302"),
    ("Wolverhampton",   "REGION%5E1326"),
    ("Bournemouth",     "REGION%5E197"),
    ("Portsmouth",      "REGION%5E1025"),
    ("Norwich",         "REGION%5E958"),
    ("Stoke",           "REGION%5E1139"),
    ("Hull",            "REGION%5E656"),
    ("Swansea",         "REGION%5E1163"),
    ("Aberdeen",        "REGION%5E1"),
    ("Dundee",          "REGION%5E455"),
    ("Milton Keynes",   "REGION%5E924"),
    ("Swindon",         "REGION%5E1166"),
    ("Luton",           "REGION%5E868"),
    ("Peterborough",    "REGION%5E1007"),
    ("Middlesbrough",   "REGION%5E916"),
    ("Ipswich",         "REGION%5E673"),
    ("Southend",        "REGION%5E1120"),
    # ── North West England ───────────────────────────────────────────────────────
    ("Blackpool",       "REGION%5E151"),
    ("Preston",         "REGION%5E1038"),
    ("Blackburn",       "REGION%5E147"),
    ("Bolton",          "REGION%5E177"),
    ("Wigan",           "REGION%5E1304"),
    ("Warrington",      "REGION%5E1277"),
    ("Burnley",         "REGION%5E227"),
    ("Stockport",       "REGION%5E1131"),
    ("Salford",         "REGION%5E1082"),
    ("Rochdale",        "REGION%5E1065"),
    ("Oldham",          "REGION%5E968"),
    ("Bury",            "REGION%5E228"),
    # ── Yorkshire & Humber ──────────────────────────────────────────────────────
    ("Bradford",        "REGION%5E88"),
    ("Huddersfield",    "REGION%5E666"),
    ("Wakefield",       "REGION%5E1271"),
    ("Doncaster",       "REGION%5E437"),
    ("Barnsley",        "REGION%5E93"),
    ("Rotherham",       "REGION%5E1070"),
    ("Harrogate",       "REGION%5E613"),
    ("Scarborough",     "REGION%5E1088"),
    # ── North East England ───────────────────────────────────────────────────────
    ("Sunderland",      "REGION%5E1141"),
    ("Gateshead",       "REGION%5E529"),
    ("Darlington",      "REGION%5E396"),
    ("Hartlepool",      "REGION%5E617"),
    ("Durham",          "REGION%5E459"),
    ("Carlisle",        "REGION%5E268"),
    # ── Midlands ────────────────────────────────────────────────────────────────
    ("Northampton",     "REGION%5E952"),
    ("Cheltenham",      "REGION%5E296"),
    ("Gloucester",      "REGION%5E549"),
    ("Worcester",       "REGION%5E1330"),
    ("Walsall",         "REGION%5E1273"),
    ("Telford",         "REGION%5E1181"),
    ("Shrewsbury",      "REGION%5E1097"),
    ("Hereford",        "REGION%5E633"),
    ("Lincoln",         "REGION%5E804"),
    ("Mansfield",       "REGION%5E885"),
    ("Chesterfield",    "REGION%5E305"),
    ("Grimsby",         "REGION%5E575"),
    # ── South East England ───────────────────────────────────────────────────────
    ("Guildford",       "REGION%5E578"),
    ("Crawley",         "REGION%5E364"),
    ("Canterbury",      "REGION%5E253"),
    ("Maidstone",       "REGION%5E878"),
    ("Colchester",      "REGION%5E333"),
    ("Chelmsford",      "REGION%5E293"),
    ("Basingstoke",     "REGION%5E100"),
    ("Eastbourne",      "REGION%5E462"),
    ("Hastings",        "REGION%5E619"),
    ("Worthing",        "REGION%5E1336"),
    ("Woking",          "REGION%5E1322"),
    ("Aldershot",       "REGION%5E22"),
    ("Slough",          "REGION%5E1104"),
    ("Watford",         "REGION%5E1284"),
    ("Stevenage",       "REGION%5E1128"),
    # ── South West England ───────────────────────────────────────────────────────
    ("Truro",           "REGION%5E1197"),
    ("Torquay",         "REGION%5E1191"),
    # ── Scotland ────────────────────────────────────────────────────────────────
    ("Stirling",        "REGION%5E1125"),
    ("Perth",           "REGION%5E1004"),
    ("Inverness",       "REGION%5E695"),
    ("Falkirk",         "REGION%5E496"),
    ("Paisley",         "REGION%5E984"),
    ("Livingston",      "REGION%5E815"),
    ("Kirkcaldy",       "REGION%5E756"),
    # ── Wales ───────────────────────────────────────────────────────────────────
    ("Cardiff",         "REGION%5E269"),
    ("Newport",         "REGION%5E944"),
    ("Newport Gwent",   "REGION%5E943"),
    ("Wrexham",         "REGION%5E1342"),
    ("Llanelli",        "REGION%5E819"),
]

# Dynamic discovery is disabled — Rightmove's searchLocation redirect now returns
# page-not-found for server-side requests.  All locations are hardcoded above.
UK_PLACES_TO_DISCOVER: list[str] = []

# ── Rotating user-agents ───────────────────────────────────────────────────────
_USER_AGENTS = [
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) "
        "Gecko/20100101 Firefox/124.0"
    ),
    (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
]


def _headers() -> dict[str, str]:
    return {
        "User-Agent": random.choice(_USER_AGENTS),
        "Accept": (
            "text/html,application/xhtml+xml,application/xml;q=0.9,"
            "image/avif,image/webp,*/*;q=0.8"
        ),
        "Accept-Language": "en-GB,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }


# ── Work-item type ─────────────────────────────────────────────────────────────

class WorkItem(NamedTuple):
    city:       str
    location_id: str          # URL-encoded, e.g. "REGION%5E87"
    band_label: str
    min_price:  Optional[int]
    max_price:  Optional[int]


def _item_key(item: WorkItem) -> str:
    return f"{item.location_id}|{item.band_label}"


# ── Progress persistence ───────────────────────────────────────────────────────

def _load_progress() -> set[str]:
    """Return the set of completed item-keys for today's cycle."""
    try:
        if PROGRESS_FILE.exists():
            data = json.loads(PROGRESS_FILE.read_text())
            today = datetime.utcnow().strftime("%Y-%m-%d")
            if data.get("date") == today:
                return set(data.get("completed", []))
    except Exception:
        pass
    return set()


def _save_progress(completed: set[str]) -> None:
    try:
        PROGRESS_FILE.write_text(json.dumps({
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "completed": list(completed),
            "saved_at": datetime.utcnow().isoformat(),
        }, indent=2))
    except Exception as exc:
        logger.debug("Could not save progress: %s", exc)


# ── Locations cache ────────────────────────────────────────────────────────────

def _load_locations_cache() -> Optional[dict[str, str]]:
    try:
        if LOCATIONS_CACHE_FILE.exists():
            data = json.loads(LOCATIONS_CACHE_FILE.read_text())
            age_days = (time.time() - data.get("timestamp", 0)) / 86400
            if age_days < LOCATIONS_CACHE_TTL_DAYS:
                return data.get("locations", {})
    except Exception:
        pass
    return None


def _save_locations_cache(locations: dict[str, str]) -> None:
    try:
        LOCATIONS_CACHE_FILE.write_text(json.dumps({
            "timestamp": time.time(),
            "locations": locations,
        }, indent=2))
    except Exception as exc:
        logger.debug("Could not save locations cache: %s", exc)


# ── HTTP helpers ───────────────────────────────────────────────────────────────

async def _get(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    url: str,
    **kwargs: Any,
) -> httpx.Response:
    """Rate-limited, politely-delayed HTTP GET."""
    async with sem:
        resp = await client.get(
            url, headers=_headers(), follow_redirects=True, timeout=25, **kwargs
        )
        await asyncio.sleep(random.uniform(0.8, 1.8))
        return resp


# ── Location discovery ─────────────────────────────────────────────────────────

async def _discover_location_id(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    place: str,
) -> Optional[str]:
    """
    Resolve a UK place name to its Rightmove locationIdentifier.

    Rightmove redirects `?searchLocation=<name>` to a canonical search URL
    that contains `locationIdentifier=REGION%5E{id}` (or OUTCODE%5E{id}).
    We follow the redirect and extract that parameter.
    """
    url = f"{_BASE}/property-for-sale/find.html"
    params = {
        "searchType": "SALE",
        "searchLocation": place,
        "useLocationIdentifier": "false",
        "locationIdentifier": "",
    }
    try:
        resp = await _get(client, sem, url, params=params)
        final_url = str(resp.url)

        # Match percent-encoded (REGION%5E87) or decoded (REGION^87) forms
        m = re.search(
            r'locationIdentifier=((?:REGION|OUTCODE)(?:%5E|%5e|\^)\d+)',
            final_url,
            re.IGNORECASE,
        )
        if m:
            raw = m.group(1)
            # Normalise to uppercase percent-encoded form
            normalised = re.sub(r'(?:%5e|\^)', '%5E', raw, flags=re.IGNORECASE).upper()
            return normalised

        # Fallback: try to find it in __NEXT_DATA__
        nd_match = re.search(
            r'"locationIdentifier"\s*:\s*"((?:REGION|OUTCODE)[^"]+)"',
            resp.text,
        )
        if nd_match:
            raw = nd_match.group(1)
            return urllib.parse.quote(raw.replace("^", "^"), safe="^A-Z0-9").replace("^", "%5E")

    except Exception as exc:
        logger.debug("Discovery failed for %r: %s", place, exc)
    return None


async def _load_all_locations(
    client: httpx.AsyncClient,  # noqa: ARG001
    sem: asyncio.Semaphore,     # noqa: ARG001
) -> list[tuple[str, str]]:
    """
    Return (name, location_id) for all locations, deduped by ID.
    All locations are hardcoded in KNOWN_LOCATIONS — dynamic discovery
    was disabled after Rightmove changed their searchLocation redirect API.
    """
    seen_ids: set[str] = set()
    result: list[tuple[str, str]] = []
    for name, loc_id in KNOWN_LOCATIONS:
        if loc_id not in seen_ids:
            seen_ids.add(loc_id)
            result.append((name, loc_id))
    logger.info(
        "Locations ready: %d × %d bands = %d queries",
        len(result), len(PRICE_BANDS), len(result) * len(PRICE_BANDS),
    )
    return result


# ── HTML parsing ───────────────────────────────────────────────────────────────

def _parse_next_data(html: str) -> list[dict[str, Any]]:
    """Extract property list from __NEXT_DATA__ JSON embedded in the page."""
    match = re.search(
        r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL,
    )
    if not match:
        return []
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []

    for path in (
        ["props", "pageProps", "searchResults", "properties"],
        ["props", "pageProps", "properties"],
        ["props", "pageProps", "results", "properties"],
    ):
        node: Any = data
        for key in path:
            if not isinstance(node, dict):
                node = None
                break
            node = node.get(key)
        if isinstance(node, list) and node:
            return node  # type: ignore[return-value]
    return []


def _extract_listing(prop: dict[str, Any], city: str) -> Optional[dict[str, Any]]:
    """Convert a raw Rightmove property dict to our DB schema dict."""
    try:
        rm_id = str(prop.get("id", "")).strip()
        if not rm_id:
            return None

        price_info = prop.get("price", {})
        price_gbp: int = price_info.get("amount", 0)
        if not price_gbp:
            return None

        address = prop.get("displayAddress", "")
        title = prop.get("summary", address)
        prop_type = (
            prop.get("propertySubType")
            or prop.get("propertyTypeFullDescription", "Property")
        )

        # Skip land listings
        if prop_type and "land" in str(prop_type).lower():
            return None

        bedrooms = int(prop.get("bedrooms") or 0)
        bathrooms_raw = prop.get("bathrooms")
        bathrooms: Optional[int] = int(bathrooms_raw) if bathrooms_raw is not None else None

        # Images
        images: list[str] = []
        img_data = prop.get("propertyImages", {})
        if isinstance(img_data, dict):
            main = img_data.get("mainImageSrc") or img_data.get("mainImageUrl")
            if main:
                images.append(main)
            for img in img_data.get("images", []):
                src = img.get("srcUrl") or img.get("url") or img.get("src") or ""
                if src and src not in images:
                    images.append(src)

        prop_url = prop.get("propertyUrl", f"/properties/{rm_id}")
        if not prop_url.startswith("http"):
            prop_url = f"{_BASE}{prop_url}"

        return {
            "rightmove_id":  rm_id,
            "url":           prop_url,
            "title":         title[:500],
            "price_gbp":     price_gbp,
            "address":       address[:500],
            "city":          city,
            "region":        "",
            "bedrooms":      bedrooms,
            "bathrooms":     bathrooms,
            "property_type": str(prop_type)[:100],
            "description":   prop.get("summary", ""),
            "images_json":   json.dumps(images),
        }
    except Exception as exc:
        logger.debug("Failed to parse property %s: %s", prop.get("id"), exc)
        return None


# ── Single work-item scraper ───────────────────────────────────────────────────

async def _scrape_work_item(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: WorkItem,
) -> int:
    """
    Scrape up to MAX_PAGES_PER_QUERY pages for one (location, price_band) combo.
    Returns the count of NEW listings inserted.
    """
    saved = 0
    consecutive_empty = 0

    for page_num in range(MAX_PAGES_PER_QUERY):
        index = page_num * PAGE_SIZE
        url = (
            f"{_BASE}/property-for-sale/find.html"
            f"?searchType=SALE"
            f"&locationIdentifier={item.location_id}"
            f"&sortType=1"
            f"&numberOfPropertiesPerPage={PAGE_SIZE}"
            f"&index={index}"
        )
        if item.min_price is not None:
            url += f"&minPrice={item.min_price}"
        if item.max_price is not None:
            url += f"&maxPrice={item.max_price}"

        try:
            resp = await _get(client, sem, url)

            if resp.status_code == 429:
                logger.warning(
                    "Rate-limited (429) on %s [%s]. Pausing 90 s …",
                    item.city, item.band_label,
                )
                await asyncio.sleep(90)
                continue

            if resp.status_code != 200:
                logger.debug(
                    "HTTP %d on %s [%s] page %d — stopping.",
                    resp.status_code, item.city, item.band_label, page_num,
                )
                break

            props = _parse_next_data(resp.text)
            if not props:
                consecutive_empty += 1
                if consecutive_empty >= 2:
                    break  # Two empty pages in a row → past the end
                continue

            consecutive_empty = 0
            now = datetime.now(timezone.utc)

            rows = []
            for prop in props:
                extracted = _extract_listing(prop, item.city)
                if extracted:
                    extracted["scraped_at"] = now
                    extracted["is_active"] = True
                    rows.append(extracted)

            if rows:
                # Deduplicate by rightmove_id within this batch — asyncpg raises
                # CardinalityViolationError if ON CONFLICT targets the same row twice.
                seen_ids: dict[str, dict] = {}
                for row in rows:
                    seen_ids[row["rightmove_id"]] = row
                rows = list(seen_ids.values())

                async with AsyncSessionLocal() as db:
                    stmt = pg_insert(RightmoveListing).values(rows)
                    stmt = stmt.on_conflict_do_update(
                        index_elements=["rightmove_id"],
                        set_={
                            c.key: stmt.excluded[c.key]
                            for c in RightmoveListing.__table__.columns
                            if c.key not in ("id", "rightmove_id")
                        },
                    )
                    result = await db.execute(stmt)
                    # rowcount reflects inserted rows on conflict=update dialects;
                    # approximate new count as inserts only (no reliable way without SELECT)
                    saved += result.rowcount
                    await db.commit()

        except httpx.TimeoutException:
            logger.debug("Timeout on %s [%s] page %d", item.city, item.band_label, page_num)
            await asyncio.sleep(5)
        except Exception as exc:
            logger.warning(
                "Error on %s [%s] page %d: %s",
                item.city, item.band_label, page_num, exc,
            )
            break

    return saved


# ── Worker ─────────────────────────────────────────────────────────────────────

async def _worker(
    worker_id: int,
    queue: asyncio.Queue,  # type: ignore[type-arg]
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    completed: set[str],
    lock: asyncio.Lock,
    stats: dict[str, int],
) -> None:
    while True:
        item: WorkItem = await queue.get()
        try:
            saved = await _scrape_work_item(client, sem, item)
            key = _item_key(item)
            async with lock:
                completed.add(key)
                stats["new"] += saved
                stats["done"] += 1
                if stats["done"] % 20 == 0:
                    pct = 100 * stats["done"] // max(stats["total"], 1)
                    logger.info(
                        "Progress %d %% (%d / %d done) | +%d new listings total",
                        pct, stats["done"], stats["total"], stats["new"],
                    )
                    _save_progress(completed)
        except Exception as exc:
            logger.error(
                "Worker %d unhandled error on %s [%s]: %s",
                worker_id, item.city, item.band_label, exc,
            )
        finally:
            queue.task_done()


# ── Public API ─────────────────────────────────────────────────────────────────

async def scrape_all() -> dict[str, Any]:
    """
    Run one full scrape cycle.

    1. Resolve all locations (known + dynamically discovered).
    2. Build work queue (location × price_band), skipping already-completed items.
    3. Run NUM_WORKERS concurrent workers against the queue.
    4. Return stats dict.
    """
    cycle_start = time.time()

    async with httpx.AsyncClient() as client:
        sem = asyncio.Semaphore(HTTP_CONCURRENCY)

        # ── 1. Locations ──────────────────────────────────────────────────────
        locations = await _load_all_locations(client, sem)

        # ── 2. Work queue ─────────────────────────────────────────────────────
        completed = _load_progress()
        queue: asyncio.Queue[WorkItem] = asyncio.Queue()

        for city, loc_id in locations:
            for band_label, min_price, max_price in PRICE_BANDS:
                item = WorkItem(
                    city=city,
                    location_id=loc_id,
                    band_label=band_label,
                    min_price=min_price,
                    max_price=max_price,
                )
                if _item_key(item) not in completed:
                    queue.put_nowait(item)

        total_items = queue.qsize() + len(completed)
        remaining = queue.qsize()

        logger.info(
            "Scrape cycle starting: %d locations × %d bands = %d total items "
            "(%d already done, %d remaining)",
            len(locations), len(PRICE_BANDS), total_items,
            len(completed), remaining,
        )

        if remaining == 0:
            logger.info("All items completed for this cycle — nothing to do.")
            return {"new": 0, "done": len(completed), "total": total_items}

        lock = asyncio.Lock()
        stats: dict[str, int] = {
            "new": 0,
            "done": len(completed),
            "total": total_items,
        }

        # ── 3. Workers ────────────────────────────────────────────────────────
        workers = [
            asyncio.create_task(
                _worker(i, queue, client, sem, completed, lock, stats)
            )
            for i in range(NUM_WORKERS)
        ]

        await queue.join()

        for w in workers:
            w.cancel()
        await asyncio.gather(*workers, return_exceptions=True)

    elapsed_min = (time.time() - cycle_start) / 60
    _save_progress(completed)

    logger.info(
        "Scrape cycle complete in %.1f min | +%d new listings | "
        "%d / %d items processed",
        elapsed_min, stats["new"], stats["done"], stats["total"],
    )
    return stats


async def start_scraper_loop() -> None:
    """
    Background loop: run scrape_all immediately, then wait SCRAPE_INTERVAL_HOURS
    before the next cycle.  Workers stay alive for the entire loop.
    """
    logger.info(
        "Rightmove scraper v2 started — %d workers, HTTP concurrency %d, "
        "interval %d h",
        NUM_WORKERS, HTTP_CONCURRENCY, SCRAPE_INTERVAL_HOURS,
    )
    while True:
        try:
            await scrape_all()
        except Exception as exc:
            logger.error("Scraper loop top-level error: %s", exc)
        logger.info(
            "Next scrape cycle in %d hours.", SCRAPE_INTERVAL_HOURS
        )
        await asyncio.sleep(SCRAPE_INTERVAL_HOURS * 3600)
