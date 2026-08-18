"""Rightmove overseas scraper for Buy Abroad marketplace sections."""
from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
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
    scraper_http_client,
    upsert_listing_rows,
)

logger = logging.getLogger(__name__)

NUM_WORKERS = 2
HTTP_CONCURRENCY = 2
MAX_PAGES_PER_QUERY = 42
PAGE_SIZE = 24
SCRAPE_INTERVAL_HOURS = 8
PROGRESS_FILE = Path("/tmp/rightmove_overseas_scraper_progress.json")
PROGRESS_NAMESPACE = "rightmove-overseas-v1"
_BASE = "https://www.rightmove.co.uk"


@dataclass(frozen=True)
class CountryConfig:
    country: str
    city: str
    url_path: str
    default_currency: str


@dataclass(frozen=True)
class WorkItem:
    config: CountryConfig
    band_label: str
    min_price: Optional[int]
    max_price: Optional[int]


COUNTRIES: tuple[CountryConfig, ...] = (
    CountryConfig("america", "USA", "/overseas-property-for-sale/USA.html", "USD"),
    CountryConfig("dubai", "Dubai", "/overseas-property-for-sale/Dubai.html", "GBP"),
    CountryConfig("canada", "Canada", "/overseas-property-for-sale/Canada.html", "USD"),
)

PRICE_BANDS: tuple[tuple[str, Optional[int], Optional[int]], ...] = (
    ("u150k", None, 150_000),
    ("150k-300k", 150_001, 300_000),
    ("300k-500k", 300_001, 500_000),
    ("500k-800k", 500_001, 800_000),
    ("800k-1m", 800_001, 1_000_000),
    ("1m-2m", 1_000_001, 2_000_000),
    ("2m-5m", 2_000_001, 5_000_000),
    ("over5m", 5_000_001, None),
)


def _item_key(item: WorkItem) -> str:
    return f"{item.config.country}:{item.band_label}"


def _extract_images(prop: dict[str, Any]) -> list[str]:
    images: list[str] = []
    image_data = prop.get("propertyImages") or prop.get("images") or {}
    if isinstance(image_data, dict):
        main = image_data.get("mainImageSrc") or image_data.get("mainImageUrl")
        if main:
            images.append(str(main))
        for image in image_data.get("images") or []:
            if not isinstance(image, dict):
                continue
            src = image.get("srcUrl") or image.get("url") or image.get("src")
            if src and str(src) not in images:
                images.append(str(src))
    return images[:12]


def _extract_city(address: str, fallback: str) -> str:
    parts = [part.strip() for part in address.split(",") if part.strip()]
    return (parts[-2] if len(parts) >= 2 else parts[-1] if parts else fallback)[:100]


async def _extract_listing(prop: dict[str, Any], config: CountryConfig) -> Optional[dict[str, Any]]:
    try:
        rm_id = str(prop.get("id") or "").strip()
        if not rm_id:
            return None

        price_info = prop.get("price") or {}
        if isinstance(price_info, dict):
            price_native = parse_int(price_info.get("amount"))
            currency = str(price_info.get("currencyCode") or config.default_currency).upper()[:3]
        else:
            price_native = parse_int(price_info)
            currency = config.default_currency
        if price_native <= 0:
            return None

        address = str(prop.get("displayAddress") or prop.get("heading") or config.city).strip()
        raw_title = str(prop.get("heading") or prop.get("summary") or address).strip()
        headline, subtitle = normalize_listing_text(raw_title, address)

        images = _extract_images(prop)
        if not images:
            return None

        prop_url = str(prop.get("propertyUrl") or f"/properties/{rm_id}").strip()
        if not prop_url.startswith("http"):
            prop_url = f"{_BASE}{prop_url}"

        prop_type = (
            prop.get("propertySubType")
            or prop.get("propertyTypeFullDescription")
            or prop.get("propertyType")
            or "Property"
        )
        price_gbp = await to_gbp(price_native, currency)

        return {
            "rightmove_id": f"RM-{config.country}-{re.sub(r'[^A-Za-z0-9_-]', '', rm_id)}"[:50],
            "url": prop_url,
            "title": headline,
            "price_gbp": price_gbp,
            "price_native": price_native,
            "price_currency": currency,
            "address": address[:500],
            "city": _extract_city(address, config.city),
            "region": config.city,
            "country": config.country,
            "source": "rightmove",
            "bedrooms": parse_int(prop.get("bedrooms")),
            "bathrooms": parse_int(prop.get("bathrooms")) or None,
            "property_type": str(prop_type)[:100],
            "description": subtitle,
            "images_json": json.dumps(images),
            "is_active": True,
            "scraped_at": datetime.now(timezone.utc),
        }
    except Exception as exc:
        logger.debug("Rightmove overseas parse failed for %s: %s", config.country, exc)
        return None


async def _fetch_page(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: WorkItem,
    page_num: int,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"index": page_num * PAGE_SIZE}
    if item.min_price is not None:
        params["minPrice"] = item.min_price
    if item.max_price is not None:
        params["maxPrice"] = item.max_price

    response = await rate_limited_get(
        client,
        sem,
        f"{_BASE}{item.config.url_path}",
        params=params,
        headers={"Referer": f"{_BASE}/overseas-property.html"},
    )
    if response.status_code != 200 or "page-not-found" in str(response.url):
        logger.debug("Rightmove overseas HTTP %s for %s", response.status_code, response.url)
        return []

    return parse_next_data(response.text, [["props", "pageProps", "searchResults", "properties"]])


async def _scrape_work_item(client: httpx.AsyncClient, sem: asyncio.Semaphore, item: WorkItem) -> int:
    saved = 0
    empty_streak = 0
    for page_num in range(MAX_PAGES_PER_QUERY):
        props = await _fetch_page(client, sem, item, page_num)
        if not props:
            empty_streak += 1
            if empty_streak >= 2:
                break
            continue
        empty_streak = 0
        rows: list[dict[str, Any]] = []
        for prop in props:
            extracted = await _extract_listing(prop, item.config)
            if extracted:
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
                stats["saved"] += saved
                stats["done"] += 1
                if stats["done"] % 8 == 0:
                    save_progress(PROGRESS_FILE, completed, namespace=PROGRESS_NAMESPACE)
        except Exception as exc:
            logger.error(
                "Rightmove overseas worker %d error on %s/%s: %s",
                worker_id,
                item.config.country,
                item.band_label,
                exc,
            )
        finally:
            queue.task_done()


async def scrape_all() -> dict[str, int]:
    completed = load_progress(
        PROGRESS_FILE,
        namespace=PROGRESS_NAMESPACE,
        max_age_seconds=(SCRAPE_INTERVAL_HOURS * 3600) - 60,
    )
    async with scraper_http_client("RIGHTMOVE_OVERSEAS") as client:
        sem = asyncio.Semaphore(HTTP_CONCURRENCY)
        queue: asyncio.Queue[WorkItem] = asyncio.Queue()
        for config in COUNTRIES:
            for band_label, min_price, max_price in PRICE_BANDS:
                item = WorkItem(config, band_label, min_price, max_price)
                if _item_key(item) not in completed:
                    queue.put_nowait(item)

        total = len(completed) + queue.qsize()
        if queue.qsize() == 0:
            logger.info("Rightmove overseas scraper: all work items complete for this cycle.")
            return {"saved": 0, "done": len(completed), "total": total}

        stats = {"saved": 0, "done": len(completed), "total": total}
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
    await run_scraper_loop("Rightmove overseas", scrape_all, SCRAPE_INTERVAL_HOURS, initial_delay_seconds=15)
