"""Realtor.ca (Canada) high-volume property scraper."""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import httpx

from app.services.currency_rates import to_gbp
from app.services.scraper_base import (
    load_progress,
    normalize_listing_text,
    parse_int,
    rate_limited_post,
    run_scraper_loop,
    save_progress,
    upsert_listing_rows,
)

logger = logging.getLogger(__name__)

NUM_WORKERS = 2
HTTP_CONCURRENCY = 2
MAX_PAGES = 50
RECORDS_PER_PAGE = 12
SCRAPE_INTERVAL_HOURS = 8
PROGRESS_FILE = Path("/tmp/realtor_ca_scraper_progress.json")
PROGRESS_NAMESPACE = "realtor-ca-v2"
_API = "https://api37.realtor.ca/Listing.svc/PropertySearch_Post"

KNOWN_LOCATIONS: list[tuple[str, float, float, float, float]] = [
    ("Toronto", 43.581, 43.855, -79.639, -79.113),
    ("Vancouver", 49.198, 49.317, -123.224, -123.023),
    ("Montreal", 45.413, 45.704, -73.872, -73.475),
    ("Calgary", 50.842, 51.212, -114.271, -113.859),
    ("Ottawa", 45.251, 45.537, -76.032, -75.427),
    ("Edmonton", 53.395, 53.655, -113.715, -113.271),
    ("Mississauga", 43.511, 43.656, -79.812, -79.578),
    ("Brampton", 43.615, 43.882, -79.873, -79.611),
    ("Hamilton", 43.173, 43.330, -80.088, -79.720),
    ("Winnipeg", 49.762, 49.993, -97.349, -96.955),
]

PRICE_BANDS: list[tuple[str, Optional[int], Optional[int]]] = [
    ("u300k", None, 300_000),
    ("300k-600k", 300_001, 600_000),
    ("600k-1m", 600_001, 1_000_000),
    ("1m-2m", 1_000_001, 2_000_000),
    ("2m-5m", 2_000_001, 5_000_000),
    ("over5m", 5_000_001, None),
]


@dataclass(frozen=True)
class WorkItem:
    city: str
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    band_label: str
    min_price: Optional[int]
    max_price: Optional[int]


def _item_key(item: WorkItem) -> str:
    return f"{item.city}:{item.band_label}"


def _extract_listing(prop: dict[str, Any], city: str) -> Optional[dict[str, Any]]:
    try:
        listing_id = str(prop.get("Id") or prop.get("MlsNumber") or "").strip()
        if not listing_id:
            return None
        price_native = parse_int(prop.get("PriceUnformatted") or prop.get("Price"))
        if price_native <= 0:
            return None

        building = prop.get("Building") or {}
        address_block = prop.get("Property") or {}
        address = str(
            prop.get("Address")
            or address_block.get("AddressText")
            or prop.get("PublicRemarks")
            or city
        ).strip()
        title = str(prop.get("PublicRemarks") or address).strip()
        headline, subtitle = normalize_listing_text(title, address)

        bedrooms = parse_int(building.get("Bedrooms") or building.get("BedroomsTotal"))
        bathrooms_raw = building.get("BathroomTotal") or building.get("Bathrooms")
        bathrooms = parse_int(bathrooms_raw) or None
        prop_type = str(building.get("Type") or building.get("ArchitecturalStyle") or "Home")

        images: list[str] = []
        for photo in prop.get("Photos") or []:
            if isinstance(photo, dict):
                url = photo.get("HighResPath") or photo.get("LargePhotoURL") or photo.get("PhotoUrl")
                if url and url not in images:
                    images.append(str(url))
        if not images:
            return None

        relative = prop.get("RelativeDetailsURL") or f"/real-estate/{listing_id}"
        url = relative if str(relative).startswith("http") else f"https://www.realtor.ca{relative}"

        return {
            "rightmove_id": f"RCA-{listing_id}"[:50],
            "url": url,
            "title": headline,
            "address": headline,
            "city": city,
            "region": "canada",
            "country": "canada",
            "source": "realtor_ca",
            "price_native": price_native,
            "price_currency": "CAD",
            "price_gbp": 0,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "property_type": prop_type[:100],
            "description": subtitle if subtitle != headline else None,
            "images_json": json.dumps(images[:12]),
        }
    except Exception as exc:
        logger.debug("Realtor.ca parse failed: %s", exc)
        return None


async def _fetch_page(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: WorkItem,
    page: int,
) -> list[dict[str, Any]]:
    payload = {
        "ZoomLevel": "11",
        "LatitudeMax": str(item.lat_max),
        "LatitudeMin": str(item.lat_min),
        "LongitudeMax": str(item.lon_max),
        "LongitudeMin": str(item.lon_min),
        "CurrentPage": str(page),
        "RecordsPerPage": str(RECORDS_PER_PAGE),
        "PropertySearchTypeId": "1",
        "TransactionTypeId": "2",
        "PropertyTypeGroupID": "1",
        "Sort": "6-D",
        "CultureId": "1",
        "ApplicationId": "37",
        "HashCode": "0",
    }
    if item.min_price is not None:
        payload["PriceMin"] = str(item.min_price)
    if item.max_price is not None:
        payload["PriceMax"] = str(item.max_price)

    resp = await rate_limited_post(
        client,
        sem,
        _API,
        data=payload,
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": "https://www.realtor.ca/",
            "Origin": "https://www.realtor.ca",
        },
    )
    if resp.status_code != 200:
        return []
    try:
        data = resp.json()
    except json.JSONDecodeError:
        return []
    results = data.get("Results") or []
    return [row.get("Property") or row for row in results if isinstance(row, dict)]


async def _scrape_work_item(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: WorkItem,
) -> int:
    saved = 0
    empty_streak = 0
    for page in range(1, MAX_PAGES + 1):
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
                extracted["price_gbp"] = await to_gbp(extracted["price_native"], "CAD")
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
            logger.error("Realtor.ca worker %d error on %s: %s", worker_id, item.city, exc)
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
        for city, lat_min, lat_max, lon_min, lon_max in KNOWN_LOCATIONS:
            for band_label, min_price, max_price in PRICE_BANDS:
                item = WorkItem(city, lat_min, lat_max, lon_min, lon_max, band_label, min_price, max_price)
                if _item_key(item) not in completed:
                    queue.put_nowait(item)

        total = len(completed) + queue.qsize()
        if queue.qsize() == 0:
            logger.info("Realtor.ca scraper: all work items complete for this cycle.")
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
    await run_scraper_loop("Realtor.ca", scrape_all, SCRAPE_INTERVAL_HOURS, initial_delay_seconds=30)
