"""Bayut (Dubai/UAE) high-volume property scraper."""
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
HITS_PER_PAGE = 25
SCRAPE_INTERVAL_HOURS = 8
PROGRESS_FILE = Path("/tmp/bayut_scraper_progress.json")
_BASE = "https://www.bayut.com"

KNOWN_LOCATIONS: list[tuple[str, str]] = [
    ("Dubai", "5002"),
    ("Abu Dhabi", "6020"),
    ("Sharjah", "5351"),
    ("Ajman", "5385"),
    ("Ras Al Khaimah", "5544"),
    ("Fujairah", "6542"),
    ("Al Ain", "6057"),
    ("Jumeirah Village Circle", "5416"),
    ("Dubai Marina", "5003"),
    ("Business Bay", "5004"),
    ("Palm Jumeirah", "5005"),
    ("Downtown Dubai", "5006"),
    ("Arabian Ranches", "5007"),
    ("Dubai Hills Estate", "5008"),
    ("Mohammed Bin Rashid City", "5009"),
]

PRICE_BANDS: list[tuple[str, Optional[int], Optional[int]]] = [
    ("u500k", None, 500_000),
    ("500k-1m", 500_001, 1_000_000),
    ("1m-2m", 1_000_001, 2_000_000),
    ("2m-5m", 2_000_001, 5_000_000),
    ("5m-10m", 5_000_001, 10_000_000),
    ("over10m", 10_000_001, None),
]


@dataclass(frozen=True)
class WorkItem:
    city: str
    location_id: str
    band_label: str
    min_price: Optional[int]
    max_price: Optional[int]


def _item_key(item: WorkItem) -> str:
    return f"{item.location_id}:{item.band_label}"


def _extract_images(prop: dict[str, Any]) -> list[str]:
    images: list[str] = []
    cover = prop.get("coverPhoto") or prop.get("photo") or {}
    if isinstance(cover, dict):
        url = cover.get("url") or cover.get("thumbnail") or cover.get("main")
        if url:
            images.append(str(url))
    for photo in prop.get("photos") or prop.get("images") or []:
        if isinstance(photo, dict):
            url = photo.get("url") or photo.get("thumbnail")
            if url and url not in images:
                images.append(str(url))
        elif isinstance(photo, str) and photo not in images:
            images.append(photo)
    return images[:12]


def _extract_hit(prop: dict[str, Any], city: str) -> Optional[dict[str, Any]]:
    try:
        external_id = str(
            prop.get("externalID")
            or prop.get("id")
            or prop.get("objectID")
            or ""
        ).strip()
        if not external_id:
            return None

        price_block = prop.get("price")
        if isinstance(price_block, dict):
            raw_price = price_block.get("value") or price_block.get("amount") or price_block.get("raw")
        else:
            raw_price = price_block
        price_native = int(float(raw_price or 0))
        if price_native <= 0:
            return None

        raw_location = prop.get("location") or prop.get("displayAddress") or prop.get("title") or city
        if isinstance(raw_location, list):
            address = ", ".join(
                str(part.get("name") if isinstance(part, dict) else part)
                for part in raw_location
                if part
            )
        elif isinstance(raw_location, dict):
            address = str(raw_location.get("name") or raw_location.get("title") or city)
        else:
            address = str(raw_location)
        address = address.strip()
        title = str(prop.get("title") or address).strip()
        headline, subtitle = normalize_listing_text(title, address)

        slug = prop.get("slug") or external_id
        url = str(prop.get("url") or f"{_BASE}/property/details-{slug}.html")
        if url.startswith("/"):
            url = f"{_BASE}{url}"

        bedrooms = int(prop.get("rooms") or prop.get("bedrooms") or 0)
        bathrooms_raw = prop.get("baths") or prop.get("bathrooms")
        bathrooms = int(bathrooms_raw) if bathrooms_raw is not None else None
        prop_type = str(
            prop.get("category")
            or prop.get("propertyType")
            or prop.get("type")
            or "Property"
        )

        images = _extract_images(prop)
        if not images:
            return None

        return {
            "rightmove_id": f"BAYUT-{external_id}"[:50],
            "url": url,
            "title": headline,
            "address": headline,
            "city": city,
            "region": "dubai",
            "country": "dubai",
            "source": "bayut",
            "price_native": price_native,
            "price_currency": "AED",
            "price_gbp": 0,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "property_type": prop_type[:100],
            "description": subtitle if subtitle != headline else None,
            "images_json": json.dumps(images),
        }
    except Exception as exc:
        logger.debug("Bayut parse failed: %s", exc)
        return None


async def _fetch_api_page(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: WorkItem,
    page: int,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "locationExternalIDs": item.location_id,
        "purpose": "for-sale",
        "categoryExternalID": "1",
        "hitsPerPage": HITS_PER_PAGE,
        "page": page,
        "sort": "date-desc",
    }
    if item.min_price is not None:
        params["priceMin"] = item.min_price
    if item.max_price is not None:
        params["priceMax"] = item.max_price

    resp = await rate_limited_get(
        client,
        sem,
        f"{_BASE}/api/search",
        params=params,
        headers={"Referer": f"{_BASE}/for-sale/property/uae/"},
    )
    if resp.status_code != 200:
        return []
    try:
        data = resp.json()
    except json.JSONDecodeError:
        return []
    hits = data.get("hits") or data.get("results") or []
    return [hit for hit in hits if isinstance(hit, dict)]


async def _fetch_html_page(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: WorkItem,
    page: int,
) -> list[dict[str, Any]]:
    slug = item.city.lower().replace(" ", "-")
    url = f"{_BASE}/for-sale/property/dubai/{slug}/"
    if page:
        url = f"{url}page-{page + 1}/"
    resp = await rate_limited_get(client, sem, url)
    if resp.status_code != 200:
        return []
    return parse_next_data(
        resp.text,
        [
            ["props", "pageProps", "searchResult", "hits"],
            ["props", "pageProps", "searchResults", "hits"],
            ["props", "pageProps", "properties"],
        ],
    )


async def _scrape_work_item(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: WorkItem,
) -> int:
    saved = 0
    empty_streak = 0
    for page in range(MAX_PAGES):
        hits = await _fetch_api_page(client, sem, item, page)
        if not hits:
            hits = await _fetch_html_page(client, sem, item, page)
        if not hits:
            empty_streak += 1
            if empty_streak >= 2:
                break
            continue
        empty_streak = 0
        rows: list[dict[str, Any]] = []
        for hit in hits:
            extracted = _extract_hit(hit, item.city)
            if extracted:
                extracted["price_gbp"] = await to_gbp(extracted["price_native"], "AED")
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
                    save_progress(PROGRESS_FILE, completed)
        except Exception as exc:
            logger.error("Bayut worker %d error on %s: %s", worker_id, item.city, exc)
        finally:
            queue.task_done()


async def scrape_all() -> dict[str, int]:
    completed = load_progress(PROGRESS_FILE)
    async with httpx.AsyncClient() as client:
        sem = asyncio.Semaphore(HTTP_CONCURRENCY)
        queue: asyncio.Queue[WorkItem] = asyncio.Queue()
        for city, loc_id in KNOWN_LOCATIONS:
            for band_label, min_price, max_price in PRICE_BANDS:
                item = WorkItem(city, loc_id, band_label, min_price, max_price)
                if _item_key(item) not in completed:
                    queue.put_nowait(item)

        total = len(completed) + queue.qsize()
        if queue.qsize() == 0:
            logger.info("Bayut scraper: all work items complete for this cycle.")
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

    save_progress(PROGRESS_FILE, completed)
    return stats


async def start_scraper_loop() -> None:
    await run_scraper_loop("Bayut", scrape_all, SCRAPE_INTERVAL_HOURS, initial_delay_seconds=120)
