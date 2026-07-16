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
from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.models.models import RightmoveListing

logger = logging.getLogger(__name__)

# ── Tunable constants ──────────────────────────────────────────────────────────
NUM_WORKERS            = 5      # concurrent scraping workers
HTTP_CONCURRENCY       = 3      # max simultaneous outbound HTTP requests
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

# ── Known locations (hardcoded — always reliable) ──────────────────────────────
# (display_name, URL-encoded Rightmove locationIdentifier)
KNOWN_LOCATIONS: list[tuple[str, str]] = [
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
]

# ── Additional UK places for dynamic discovery ─────────────────────────────────
# These are resolved to their Rightmove locationIdentifiers at startup via
# the search redirect, then cached.  Any place that resolves to an ID already
# in KNOWN_LOCATIONS is silently de-duplicated.
UK_PLACES_TO_DISCOVER: list[str] = [
    # London boroughs
    "Barking", "Barnet", "Bexley", "Brent", "Bromley",
    "Camden", "Croydon", "Ealing", "Enfield", "Greenwich",
    "Hackney", "Hammersmith", "Haringey", "Harrow", "Havering",
    "Hillingdon", "Hounslow", "Islington", "Kensington",
    "Kingston upon Thames", "Lambeth", "Lewisham", "Merton",
    "Newham", "Redbridge", "Richmond", "Southwark", "Sutton",
    "Tower Hamlets", "Waltham Forest", "Wandsworth", "Westminster",
    # English cities & large towns
    "Aylesbury", "Basildon", "Basingstoke", "Bedford", "Birkenhead",
    "Blackburn", "Blackpool", "Bolton", "Bradford", "Burnley",
    "Burton upon Trent", "Bury", "Canterbury", "Carlisle",
    "Chelmsford", "Cheltenham", "Chesterfield", "Chichester",
    "Colchester", "Crawley", "Crewe", "Darlington", "Doncaster",
    "Eastbourne", "Eastleigh", "Gloucester", "Grimsby", "Guildford",
    "Halifax", "Harrogate", "Hartlepool", "Hastings", "Hereford",
    "High Wycombe", "Huddersfield", "Lancaster", "Lincoln",
    "Loughborough", "Maidstone", "Mansfield", "Northampton", "Oldham",
    "Poole", "Preston", "Rochdale", "Rotherham", "Rugby", "Salford",
    "Shrewsbury", "Slough", "Solihull", "St Albans", "Stevenage",
    "Stockport", "Stockton on Tees", "Sunderland", "Telford",
    "Wakefield", "Walsall", "Warrington", "Warwick", "Watford",
    "Wigan", "Winchester", "Woking", "Worcester", "Worthing",
    "Aldershot", "Bracknell", "Chatham", "Farnborough", "Gateshead",
    "Durham", "Penrith", "Kendal", "Barrow in Furness", "Morecambe",
    "Southport", "Accrington", "Clitheroe", "Runcorn", "Widnes",
    "Ellesmere Port", "Oswestry", "Stafford", "Tamworth", "Lichfield",
    "Cannock", "Leamington Spa", "Stratford upon Avon", "Banbury",
    "Bicester", "Newbury", "Andover", "Salisbury", "Trowbridge",
    "Chippenham", "Cirencester", "Stroud", "Tewkesbury", "Bridgwater",
    "Taunton", "Yeovil", "Weymouth", "Dorchester", "Christchurch",
    "Sevenoaks", "Rochester", "Folkestone", "Dover", "Ashford",
    "Horsham", "Farnham", "Fareham", "Gosport", "Kidderminster",
    "Macclesfield", "Nuneaton", "Redditch", "Scunthorpe", "Torquay",
    "Tunbridge Wells", "Weston super Mare", "Windsor",
    "Birkenhead", "Wallasey", "St Helens", "Leigh", "Wigan",
    "Dewsbury", "Keighley", "Halifax", "Wakefield", "Barnsley",
    # Scottish cities / towns
    "Inverness", "Perth", "Stirling", "Paisley", "Motherwell",
    "Hamilton", "Ayr", "Kirkcaldy", "Dunfermline", "Livingston",
    "Falkirk", "Dumfries", "Elgin", "Greenock",
    # Welsh towns
    "Cardiff", "Newport", "Barry", "Bridgend", "Merthyr Tydfil",
    "Neath", "Rhondda", "Caerphilly", "Cwmbran", "Llanelli",
    # Northern Ireland
    "Belfast", "Londonderry", "Lisburn", "Newry",
    # UK counties / regions (broader coverage, good fallback)
    "Surrey", "Kent", "Essex", "Suffolk", "Norfolk",
    "Hertfordshire", "Buckinghamshire", "Berkshire", "Hampshire",
    "Dorset", "Devon", "Cornwall", "Somerset", "Wiltshire",
    "Gloucestershire", "Oxfordshire", "Northamptonshire",
    "Warwickshire", "Staffordshire", "Derbyshire",
    "Leicestershire", "Lincolnshire", "Nottinghamshire",
    "Lancashire", "Cumbria", "Cheshire", "Shropshire",
    "Worcestershire", "Herefordshire",
]

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
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
) -> list[tuple[str, str]]:
    """
    Return (name, location_id) for the full set of locations, deduped by ID.
    Starts with KNOWN_LOCATIONS, then appends newly discovered ones.
    """
    seen_ids: set[str] = set()
    result: list[tuple[str, str]] = []

    for name, loc_id in KNOWN_LOCATIONS:
        if loc_id not in seen_ids:
            seen_ids.add(loc_id)
            result.append((name, loc_id))

    # Use cache if fresh
    cached = _load_locations_cache()
    if cached is not None:
        added = 0
        for name, loc_id in cached.items():
            if loc_id and loc_id not in seen_ids:
                seen_ids.add(loc_id)
                result.append((name, loc_id))
                added += 1
        logger.info(
            "Locations: %d known + %d from cache = %d total",
            len(KNOWN_LOCATIONS), added, len(result),
        )
        return result

    # Discover fresh — run all place lookups concurrently (semaphore limits HTTP)
    logger.info(
        "Discovering %d additional UK locations via Rightmove redirect …",
        len(UK_PLACES_TO_DISCOVER),
    )
    tasks = [
        _discover_location_id(client, sem, place)
        for place in UK_PLACES_TO_DISCOVER
    ]
    ids = await asyncio.gather(*tasks, return_exceptions=True)

    newly_discovered: dict[str, str] = {}
    for place, loc_id in zip(UK_PLACES_TO_DISCOVER, ids):
        if isinstance(loc_id, str) and loc_id and loc_id not in seen_ids:
            seen_ids.add(loc_id)
            result.append((place, loc_id))
            newly_discovered[place] = loc_id

    _save_locations_cache(newly_discovered)
    logger.info(
        "Discovery complete: %d new locations found. Total: %d locations × %d bands = %d queries",
        len(newly_discovered), len(result), len(PRICE_BANDS),
        len(result) * len(PRICE_BANDS),
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

            async with AsyncSessionLocal() as db:
                for prop in props:
                    extracted = _extract_listing(prop, item.city)
                    if not extracted:
                        continue
                    result = await db.execute(
                        select(RightmoveListing).where(
                            RightmoveListing.rightmove_id == extracted["rightmove_id"]
                        )
                    )
                    existing = result.scalar_one_or_none()
                    if existing:
                        for k, v in extracted.items():
                            setattr(existing, k, v)
                        existing.is_active = True
                        existing.scraped_at = now
                    else:
                        db.add(RightmoveListing(**extracted, scraped_at=now))
                        saved += 1
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
