"""Dubai property scraper — targets PropertyFinder.ae Next.js site.

Covers popular Dubai areas and neighbourhoods.
Stores results in international_listings with source='dubai'.
"""
from __future__ import annotations

import asyncio
import gc
import json
import logging
import random
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.database import AsyncSessionLocal
from app.models.models import InternationalListing

logger = logging.getLogger(__name__)

SCRAPE_INTERVAL_HOURS = 12
SOURCE = "dubai"
CURRENCY_CODE = "AED"
CURRENCY_SYMBOL = "AED"
COUNTRY = "United Arab Emirates"
MAX_PAGES = 5
PROGRESS_FILE = Path("/tmp/dubai_scraper_progress.json")

# PropertyFinder area slugs for popular Dubai locations
DUBAI_AREAS = [
    ("Dubai Marina", "dubai-marina"),
    ("Downtown Dubai", "downtown-dubai"),
    ("Palm Jumeirah", "palm-jumeirah"),
    ("Dubai Hills Estate", "dubai-hills-estate"),
    ("Arabian Ranches", "arabian-ranches"),
    ("Jumeirah", "jumeirah"),
    ("Business Bay", "business-bay"),
    ("Jumeirah Village Circle", "jumeirah-village-circle"),
    ("Al Barsha", "al-barsha"),
    ("Mirdif", "mirdif"),
    ("Dubai Silicon Oasis", "dubai-silicon-oasis"),
    ("Deira", "deira"),
    ("Bur Dubai", "bur-dubai"),
    ("DAMAC Hills", "damac-hills"),
    ("Emaar Beachfront", "emaar-beachfront"),
]

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.propertyfinder.ae/",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
}


def _load_progress() -> set[str]:
    try:
        if PROGRESS_FILE.exists():
            data = json.loads(PROGRESS_FILE.read_text())
            age = time.time() - data.get("ts", 0)
            if age < 86400 * 3:
                return set(data.get("done", []))
    except Exception:
        pass
    return set()


def _save_progress(done: set[str]) -> None:
    try:
        PROGRESS_FILE.write_text(json.dumps({"done": list(done), "ts": time.time()}))
    except Exception:
        pass


def _extract_from_next_data(html: str, area_name: str) -> list[dict[str, Any]]:
    """Parse PropertyFinder __NEXT_DATA__ for listing objects."""
    results = []
    try:
        # Find __NEXT_DATA__ script tag
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
        if not match:
            # Fallback: try to extract any JSON-LD or structured data
            return results

        raw = match.group(1)
        data = json.loads(raw)

        page_props = data.get("props", {}).get("pageProps", {})

        # PropertyFinder structures differ by page type
        listings = (
            page_props.get("listings")
            or page_props.get("searchResults", {}).get("listings")
            or page_props.get("properties")
            or []
        )

        for prop in listings:
            try:
                prop_id = str(prop.get("id") or prop.get("externalId") or "")
                if not prop_id:
                    continue

                price_raw = prop.get("price") or prop.get("priceValue") or 0
                if isinstance(price_raw, str):
                    price_raw = "".join(c for c in price_raw if c.isdigit())
                    price_raw = float(price_raw) if price_raw else 0.0
                else:
                    price_raw = float(price_raw or 0)

                title = prop.get("title") or prop.get("name") or ""
                address = (
                    prop.get("location", {}).get("fullLocation")
                    or prop.get("address")
                    or prop.get("communityName")
                    or area_name
                )
                city = prop.get("location", {}).get("city") or "Dubai"
                region = prop.get("location", {}).get("community") or area_name
                beds = int(prop.get("bedroomsCount") or prop.get("bedrooms") or 0)
                baths = float(prop.get("bathroomsCount") or prop.get("bathrooms") or 0) or None
                ptype = prop.get("propertyType") or prop.get("type") or ""

                slug = prop.get("slug") or prop.get("shareUrl") or ""
                if slug and not slug.startswith("http"):
                    url = f"https://www.propertyfinder.ae/en/property-for-sale/{slug}"
                elif slug.startswith("http"):
                    url = slug
                else:
                    url = f"https://www.propertyfinder.ae/en/search?c=1&t=1&fu=1"

                imgs = []
                photos = prop.get("photos") or prop.get("images") or prop.get("media") or []
                for ph in photos[:8]:
                    if isinstance(ph, str):
                        imgs.append(ph)
                    elif isinstance(ph, dict):
                        img_url = ph.get("url") or ph.get("src") or ph.get("fullUrl") or ""
                        if img_url:
                            imgs.append(img_url)

                description = prop.get("description") or None

                results.append({
                    "source": SOURCE,
                    "external_id": prop_id,
                    "url": url,
                    "title": title or address,
                    "price_local": price_raw if price_raw > 0 else None,
                    "currency_code": CURRENCY_CODE,
                    "currency_symbol": CURRENCY_SYMBOL,
                    "address": address,
                    "city": city,
                    "region": region,
                    "country": COUNTRY,
                    "bedrooms": beds,
                    "bathrooms": baths,
                    "property_type": ptype,
                    "description": description,
                    "images_json": json.dumps(imgs) if imgs else None,
                })
            except Exception as exc:
                logger.debug("Dubai: skip listing: %s", exc)
                continue

    except Exception as exc:
        logger.debug("Dubai: page parse error: %s", exc)

    return results


async def _scrape_area(client: httpx.AsyncClient, sem: asyncio.Semaphore, area_name: str, area_slug: str) -> int:
    saved = 0
    for page_num in range(1, MAX_PAGES + 1):
        url = f"https://www.propertyfinder.ae/en/search?c=1&t=1&fu=1&ob=pd&p={page_num}&n=24&l={area_slug}"

        try:
            async with sem:
                await asyncio.sleep(random.uniform(2, 4))
                resp = await client.get(url, headers=_HEADERS, timeout=30, follow_redirects=True)

            if resp.status_code == 429:
                logger.warning("Dubai: rate limited on %s page %d — pausing 120s", area_name, page_num)
                await asyncio.sleep(120)
                continue

            if resp.status_code != 200:
                logger.debug("Dubai: HTTP %d on %s page %d", resp.status_code, area_name, page_num)
                break

            rows = _extract_from_next_data(resp.text, area_name)
            if not rows:
                # Try a second URL format
                alt_url = f"https://www.propertyfinder.ae/en/property-for-sale/apartments-for-sale/?page={page_num}&neighborhoods[]={area_slug}"
                async with sem:
                    await asyncio.sleep(2)
                    alt_resp = await client.get(alt_url, headers=_HEADERS, timeout=30, follow_redirects=True)
                if alt_resp.status_code == 200:
                    rows = _extract_from_next_data(alt_resp.text, area_name)

            if not rows:
                break

            async with AsyncSessionLocal() as db:
                stmt = pg_insert(InternationalListing).values(rows)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["source", "external_id"],
                    set_={
                        c.key: stmt.excluded[c.key]
                        for c in InternationalListing.__table__.columns
                        if c.key not in ("id", "source", "external_id", "created_at")
                    },
                )
                await db.execute(stmt)
                await db.commit()
            saved += len(rows)

        except httpx.TimeoutException:
            logger.debug("Dubai: timeout on %s page %d", area_name, page_num)
            await asyncio.sleep(10)
        except Exception as exc:
            logger.warning("Dubai: error on %s page %d: %s", area_name, page_num, exc)
            break

    return saved


async def scrape_all_dubai() -> dict[str, Any]:
    cycle_start = time.time()
    done = _load_progress()
    new_total = 0

    logger.info("Dubai scraper starting — %d areas, %d already done", len(DUBAI_AREAS), len(done))

    async with httpx.AsyncClient() as client:
        sem = asyncio.Semaphore(2)
        for area_name, area_slug in DUBAI_AREAS:
            if area_slug in done:
                continue
            try:
                n = await _scrape_area(client, sem, area_name, area_slug)
                new_total += n
                done.add(area_slug)
                _save_progress(done)
                logger.info("Dubai: %s — %d listings saved", area_name, n)
            except Exception as exc:
                logger.error("Dubai: unhandled error on %s: %s", area_name, exc)

    elapsed = (time.time() - cycle_start) / 60
    gc.collect()
    logger.info("Dubai scrape complete in %.1f min | %d new listings", elapsed, new_total)
    PROGRESS_FILE.unlink(missing_ok=True)
    return {"source": SOURCE, "new": new_total}


async def start_dubai_scraper_loop() -> None:
    logger.info("Dubai property scraper loop started.")
    while True:
        try:
            await scrape_all_dubai()
        except Exception as exc:
            logger.error("Dubai scraper loop error: %s", exc)
        logger.info("Dubai scraper: next cycle in %d hours.", SCRAPE_INTERVAL_HOURS)
        await asyncio.sleep(SCRAPE_INTERVAL_HOURS * 3600)
