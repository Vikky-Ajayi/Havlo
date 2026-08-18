"""Realtor.com (America) high-volume property scraper."""
from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import httpx

from app.services.currency_rates import to_gbp
from app.services.scraper_base import (
    load_progress,
    normalize_listing_text,
    parse_int,
    parse_next_data,
    rate_limited_get,
    run_scraper_loop,
    save_progress,
    upsert_listing_rows,
)

logger = logging.getLogger(__name__)

NUM_WORKERS = 2
HTTP_CONCURRENCY = 2
MAX_PAGES = 40
SCRAPE_INTERVAL_HOURS = 8
PROGRESS_FILE = Path("/tmp/realtor_com_scraper_progress.json")
PROGRESS_NAMESPACE = "realtor-com-v2"
_BASE = "https://www.realtor.com"

KNOWN_LOCATIONS: list[tuple[str, str]] = [
    ("New York", "New-York_NY"),
    ("Los Angeles", "Los-Angeles_CA"),
    ("Chicago", "Chicago_IL"),
    ("Houston", "Houston_TX"),
    ("Phoenix", "Phoenix_AZ"),
    ("Philadelphia", "Philadelphia_PA"),
    ("San Antonio", "San-Antonio_TX"),
    ("San Diego", "San-Diego_CA"),
    ("Dallas", "Dallas_TX"),
    ("Austin", "Austin_TX"),
    ("Miami", "Miami_FL"),
    ("Seattle", "Seattle_WA"),
    ("Denver", "Denver_CO"),
    ("Boston", "Boston_MA"),
    ("Atlanta", "Atlanta_GA"),
    ("Las Vegas", "Las-Vegas_NV"),
    ("Portland", "Portland_OR"),
    ("Charlotte", "Charlotte_NC"),
    ("Nashville", "Nashville_TN"),
    ("Orlando", "Orlando_FL"),
]

PRICE_BANDS: list[tuple[str, Optional[int], Optional[int]]] = [
    ("u250k", None, 250_000),
    ("250k-500k", 250_001, 500_000),
    ("500k-1m", 500_001, 1_000_000),
    ("1m-2m", 1_000_001, 2_000_000),
    ("2m-5m", 2_000_001, 5_000_000),
    ("over5m", 5_000_001, None),
]


@dataclass(frozen=True)
class WorkItem:
    city: str
    slug: str
    band_label: str
    min_price: Optional[int]
    max_price: Optional[int]


def _item_key(item: WorkItem) -> str:
    return f"{item.slug}:{item.band_label}"


def _extract_listing(prop: dict[str, Any], city: str) -> Optional[dict[str, Any]]:
    try:
        listing_id = str(
            prop.get("property_id")
            or prop.get("listing_id")
            or prop.get("permalink")
            or prop.get("propertyId")
            or prop.get("id")
            or ""
        ).strip()
        if not listing_id:
            return None

        price_block = prop.get("list_price") or prop.get("price") or {}
        if isinstance(price_block, dict):
            price_native = parse_int(price_block.get("amount") or price_block.get("value"))
        else:
            price_native = parse_int(price_block)
        if price_native <= 0:
            return None

        location = prop.get("location") or {}
        address_block = location.get("address") if isinstance(location, dict) else {}
        line = ""
        if isinstance(address_block, dict):
            line = ", ".join(
                part for part in [
                    address_block.get("line"),
                    address_block.get("city"),
                    address_block.get("state_code"),
                ] if part
            )
        address = str(line or prop.get("description", {}).get("name") or city).strip()
        title = str(
            prop.get("description", {}).get("name")
            if isinstance(prop.get("description"), dict)
            else prop.get("title") or address
        ).strip()
        headline, subtitle = normalize_listing_text(title, address)

        description_block = prop.get("description") or {}
        bedrooms = parse_int(description_block.get("beds") or prop.get("beds"))
        bathrooms_raw = description_block.get("baths") or prop.get("baths")
        bathrooms = parse_int(bathrooms_raw) or None
        prop_type = str(description_block.get("type") or prop.get("prop_type") or "Home")

        images: list[str] = []
        for photo in prop.get("photos") or prop.get("thumbnail") or []:
            if isinstance(photo, dict):
                href = photo.get("href") or photo.get("url")
                if href and href not in images:
                    images.append(str(href))
            elif isinstance(photo, str) and photo not in images:
                images.append(photo)
        primary = prop.get("primary_photo") or prop.get("thumbnail")
        if isinstance(primary, dict):
            href = primary.get("href") or primary.get("url")
            if href:
                images.insert(0, str(href))
        if not images:
            return None

        permalink = prop.get("permalink") or prop.get("href") or listing_id
        url = str(permalink)
        if url.startswith("/"):
            url = f"{_BASE}{url}"
        elif not url.startswith("http"):
            url = f"{_BASE}/realestateandhomes-detail/{url}"

        clean_id = re.sub(r"[^A-Za-z0-9_-]", "", listing_id)[-40:] or listing_id[:40]

        return {
            "rightmove_id": f"RDC-{clean_id}"[:50],
            "url": url,
            "title": headline,
            "address": headline,
            "city": city,
            "region": "america",
            "country": "america",
            "source": "realtor_com",
            "price_native": price_native,
            "price_currency": "USD",
            "price_gbp": 0,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "property_type": prop_type[:100],
            "description": subtitle if subtitle != headline else None,
            "images_json": json.dumps(images[:12]),
        }
    except Exception as exc:
        logger.debug("Realtor.com parse failed: %s", exc)
        return None


async def _fetch_page(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: WorkItem,
    page: int,
) -> list[dict[str, Any]]:
    url = f"{_BASE}/realestateandhomes-search/{item.slug}"
    params: dict[str, Any] = {"pg": page + 1}
    if item.min_price is not None:
        params["price_min"] = item.min_price
    if item.max_price is not None:
        params["price_max"] = item.max_price

    resp = await rate_limited_get(
        client,
        sem,
        url,
        params=params,
        headers={"Referer": f"{_BASE}/"},
    )
    if resp.status_code != 200:
        return []

    hits = parse_next_data(
        resp.text,
        [
            ["props", "pageProps", "properties"],
            ["props", "pageProps", "searchResults", "home_search", "results"],
            ["props", "pageProps", "initialReduxState", "home_search", "results"],
        ],
    )
    if hits:
        return hits

    match = re.search(r'"results"\s*:\s*(\[\{.*?\}\])', resp.text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(1))
            if isinstance(parsed, list):
                return [row for row in parsed if isinstance(row, dict)]
        except json.JSONDecodeError:
            pass
    return []


async def _scrape_work_item(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: WorkItem,
) -> int:
    saved = 0
    empty_streak = 0
    for page in range(MAX_PAGES):
        props = await _fetch_page(client, sem, item, page)
        if not props:
            empty_streak += 1
            if empty_streak >= 2:
                break
            continue
        empty_streak = 0
        rows: list[dict[str, Any]] = []
        for prop in props:
            extracted = _extract_listing(prop, item.city)
            if extracted:
                extracted["price_gbp"] = await to_gbp(extracted["price_native"], "USD")
                rows.append(extracted)
        if rows:
            saved += await upsert_listing_rows(rows)
    return saved


async def _worker(
    worker_id: int,
    queue: asyncio.Queue,
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
                if stats["done"] % 10 == 0:
                    save_progress(PROGRESS_FILE, completed, namespace=PROGRESS_NAMESPACE)
        except Exception as exc:
            logger.error("Realtor.com worker %d error on %s: %s", worker_id, item.city, exc)
        finally:
            queue.task_done()


async def scrape_all() -> dict[str, int]:
    completed = load_progress(
        PROGRESS_FILE,
        namespace=PROGRESS_NAMESPACE,
        max_age_seconds=(SCRAPE_INTERVAL_HOURS * 3600) - 60,
    )
    async with httpx.AsyncClient() as client:
        sem = asyncio.Semaphore(HTTP_CONCURRENCY)
        queue: asyncio.Queue[WorkItem] = asyncio.Queue()
        for city, slug in KNOWN_LOCATIONS:
            for band_label, min_price, max_price in PRICE_BANDS:
                item = WorkItem(city, slug, band_label, min_price, max_price)
                if _item_key(item) not in completed:
                    queue.put_nowait(item)

        total = len(completed) + queue.qsize()
        if queue.qsize() == 0:
            logger.info("Realtor.com scraper: all work items complete for this cycle.")
            return {"new": 0, "done": len(completed), "total": total}

        stats = {"new": 0, "done": len(completed), "total": total}
        lock = asyncio.Lock()
        workers = [
            asyncio.create_task(_worker(i, queue, client, sem, completed, lock, stats))
            for i in range(NUM_WORKERS)
        ]
        await queue.join()
        for worker in workers:
            worker.cancel()
        await asyncio.gather(*workers, return_exceptions=True)

    save_progress(PROGRESS_FILE, completed, namespace=PROGRESS_NAMESPACE)
    return stats


async def start_scraper_loop() -> None:
    await run_scraper_loop("Realtor.com", scrape_all, SCRAPE_INTERVAL_HOURS, initial_delay_seconds=45)
