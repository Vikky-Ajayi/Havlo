"""Rightmove property scraper.

Scrapes for-sale listings from Rightmove for a set of UK cities and upserts
them into the `rightmove_listings` table.  Designed to run as a background
asyncio loop inside the FastAPI process — no external task-queue required.
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.models.models import RightmoveListing

logger = logging.getLogger(__name__)

# ── Cities to scrape ──────────────────────────────────────────────────────────
# Each tuple: (display_name, Rightmove locationIdentifier)
CITIES: list[tuple[str, str]] = [
    ("London",      "REGION%5E87"),
    ("Manchester",  "REGION%5E904"),
    ("Birmingham",  "REGION%5E2"),
    ("Leeds",       "REGION%5E787"),
    ("Bristol",     "REGION%5E219"),
    ("Liverpool",   "REGION%5E800"),
    ("Sheffield",   "REGION%5E1093"),
    ("Edinburgh",   "REGION%5E475"),
    ("Glasgow",     "REGION%5E550"),
    ("Nottingham",  "REGION%5E963"),
]

SCRAPE_INTERVAL_HOURS = 6
_BASE = "https://www.rightmove.co.uk"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
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


def _parse_next_data(html: str) -> list[dict[str, Any]]:
    """Extract property list from __NEXT_DATA__ JSON embedded in the page."""
    match = re.search(
        r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    if not match:
        return []
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []

    # Path varies slightly by page version; try the common paths.
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


def _extract_listing(prop: dict[str, Any], city: str) -> dict[str, Any] | None:
    """Convert a raw Rightmove property dict to our DB schema dict."""
    try:
        rm_id = str(prop.get("id", ""))
        if not rm_id:
            return None

        price_info = prop.get("price", {})
        price_gbp: int = price_info.get("amount", 0)
        if not price_gbp:
            return None

        address = prop.get("displayAddress", "")
        title = prop.get("summary", address)
        prop_type = prop.get("propertySubType") or prop.get("propertyTypeFullDescription", "Property")

        # Skip land listings
        if prop_type and "land" in str(prop_type).lower():
            return None

        bedrooms = int(prop.get("bedrooms") or 0)
        bathrooms_raw = prop.get("bathrooms")
        bathrooms: int | None = int(bathrooms_raw) if bathrooms_raw is not None else None

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

        description = prop.get("summary", "")

        return {
            "rightmove_id": rm_id,
            "url": prop_url,
            "title": title[:500],
            "price_gbp": price_gbp,
            "address": address[:500],
            "city": city,
            "region": "",
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "property_type": str(prop_type)[:100],
            "description": description,
            "images_json": json.dumps(images),
        }
    except Exception as exc:
        logger.debug("Failed to parse property %s: %s", prop.get("id"), exc)
        return None


async def _scrape_city(client: httpx.AsyncClient, city: str, location_id: str) -> int:
    """Scrape one city (pages 0, 24, 48) and upsert into DB. Returns count saved."""
    saved = 0
    for index in (0, 24, 48):
        url = (
            f"{_BASE}/property-for-sale/find.html"
            f"?searchType=SALE"
            f"&locationIdentifier={location_id}"
            f"&sortType=1"
            f"&numberOfPropertiesPerPage=24"
            f"&index={index}"
        )
        try:
            resp = await client.get(url, headers=_HEADERS, follow_redirects=True, timeout=20)
            if resp.status_code != 200:
                logger.warning("Rightmove %s (index=%s): HTTP %s", city, index, resp.status_code)
                break
            props = _parse_next_data(resp.text)
            if not props:
                logger.info("Rightmove %s (index=%s): no properties found in __NEXT_DATA__", city, index)
                break

            now = datetime.now(timezone.utc)
            async with AsyncSessionLocal() as db:
                for prop in props:
                    extracted = _extract_listing(prop, city)
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
        except Exception as exc:
            logger.warning("Rightmove scrape error city=%s index=%s: %s", city, index, exc)
            break

        await asyncio.sleep(random.uniform(1.5, 3.0))

    return saved


async def scrape_all() -> dict[str, int]:
    """Scrape all configured cities. Returns {city: count_new}."""
    results: dict[str, int] = {}
    logger.info("Rightmove scrape starting for %d cities …", len(CITIES))
    async with httpx.AsyncClient() as client:
        for city, loc_id in CITIES:
            try:
                count = await _scrape_city(client, city, loc_id)
                results[city] = count
                logger.info("Rightmove scrape %s: +%d new listings", city, count)
            except Exception as exc:
                logger.error("Rightmove scrape failed for %s: %s", city, exc)
                results[city] = 0
            await asyncio.sleep(random.uniform(2.0, 4.0))
    logger.info("Rightmove scrape complete: %s", results)
    return results


async def start_scraper_loop() -> None:
    """Background loop: scrape on startup then every SCRAPE_INTERVAL_HOURS hours."""
    logger.info("Rightmove scraper loop started (interval=%dh)", SCRAPE_INTERVAL_HOURS)
    while True:
        try:
            await scrape_all()
        except Exception as exc:
            logger.error("Rightmove scraper loop error: %s", exc)
        await asyncio.sleep(SCRAPE_INTERVAL_HOURS * 3600)
