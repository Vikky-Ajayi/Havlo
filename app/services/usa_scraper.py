"""USA property scraper — targets Zillow.com using their Next.js __NEXT_DATA__ payload.

Covers 20 major US metro areas, scrapes the first 5 pages per city.
Stores results in the international_listings table with source='usa'.
"""
from __future__ import annotations

import asyncio
import gc
import json
import logging
import random
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
SOURCE = "usa"
CURRENCY_CODE = "USD"
CURRENCY_SYMBOL = "$"
COUNTRY = "United States"
MAX_PAGES = 5
PROGRESS_FILE = Path("/tmp/usa_scraper_progress.json")

US_CITIES = [
    ("New York", "New-York-NY"),
    ("Los Angeles", "Los-Angeles-CA"),
    ("Miami", "Miami-FL"),
    ("Chicago", "Chicago-IL"),
    ("Houston", "Houston-TX"),
    ("Phoenix", "Phoenix-AZ"),
    ("Philadelphia", "Philadelphia-PA"),
    ("San Diego", "San-Diego-CA"),
    ("Dallas", "Dallas-TX"),
    ("Austin", "Austin-TX"),
    ("Seattle", "Seattle-WA"),
    ("Denver", "Denver-CO"),
    ("Boston", "Boston-MA"),
    ("Las Vegas", "Las-Vegas-NV"),
    ("Nashville", "Nashville-TN"),
    ("Atlanta", "Atlanta-GA"),
    ("Charlotte", "Charlotte-NC"),
    ("Orlando", "Orlando-FL"),
    ("San Antonio", "San-Antonio-TX"),
    ("Sacramento", "Sacramento-CA"),
]

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.zillow.com/",
    "Sec-Ch-Ua": '"Google Chrome";v="125", "Chromium";v="125", "Not-A-Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
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


def _extract_listings_from_page(html: str, city: str) -> list[dict[str, Any]]:
    """Parse Zillow __NEXT_DATA__ and extract listing dicts."""
    results = []
    try:
        start = html.find('__NEXT_DATA__')
        if start == -1:
            # Try alternate pattern
            start = html.find('"searchResults"')
            if start == -1:
                return results

        # Find the script tag containing __NEXT_DATA__
        tag_start = html.rfind('<script', 0, start)
        tag_end = html.find('</script>', start)
        if tag_start == -1 or tag_end == -1:
            return results

        json_start = html.find('>', tag_start) + 1
        raw = html[json_start:tag_end].strip()
        data = json.loads(raw)

        # Navigate to search results — structure varies by Zillow version
        props = data.get("props", {})
        page_props = props.get("pageProps", {})

        # Try multiple paths where Zillow puts listing data
        search_state = (
            page_props.get("searchPageState")
            or page_props.get("gdpClientCache")
            or {}
        )

        # cat1 path (most common)
        cat1 = search_state.get("cat1", {})
        search_results = cat1.get("searchResults", {})
        list_results = search_results.get("listResults", [])

        if not list_results:
            # Try mapResults path
            list_results = search_results.get("mapResults", [])

        for prop in list_results:
            try:
                zpid = str(prop.get("zpid", ""))
                if not zpid:
                    continue

                price_raw = prop.get("price") or prop.get("unformattedPrice") or 0
                if isinstance(price_raw, str):
                    price_raw = "".join(c for c in price_raw if c.isdigit() or c == ".")
                    try:
                        price_raw = float(price_raw)
                    except ValueError:
                        price_raw = 0

                address = prop.get("address") or prop.get("streetAddress") or ""
                url = prop.get("detailUrl", "")
                if url and not url.startswith("http"):
                    url = f"https://www.zillow.com{url}"

                beds = int(prop.get("beds") or prop.get("bedrooms") or 0)
                baths = float(prop.get("baths") or prop.get("bathrooms") or 0) or None
                ptype = prop.get("statusType") or prop.get("homeType") or ""

                imgs = []
                img_src = prop.get("imgSrc") or prop.get("carouselPhotos")
                if isinstance(img_src, str):
                    imgs = [img_src]
                elif isinstance(img_src, list):
                    imgs = [i.get("url") or i if isinstance(i, str) else "" for i in img_src[:8]]
                    imgs = [i for i in imgs if i]

                region = prop.get("addressState") or ""
                listing_city = prop.get("addressCity") or city

                results.append({
                    "source": SOURCE,
                    "external_id": zpid,
                    "url": url,
                    "title": address or listing_city,
                    "price_local": float(price_raw) if price_raw else None,
                    "currency_code": CURRENCY_CODE,
                    "currency_symbol": CURRENCY_SYMBOL,
                    "address": address,
                    "city": listing_city,
                    "region": region,
                    "country": COUNTRY,
                    "bedrooms": beds,
                    "bathrooms": baths,
                    "property_type": ptype,
                    "description": None,
                    "images_json": json.dumps(imgs) if imgs else None,
                })
            except Exception as exc:
                logger.debug("USA: skip listing parse error: %s", exc)
                continue

    except Exception as exc:
        logger.debug("USA: page parse error: %s", exc)

    return results


async def _scrape_city(client: httpx.AsyncClient, sem: asyncio.Semaphore, city_name: str, city_slug: str) -> int:
    saved = 0
    for page_num in range(1, MAX_PAGES + 1):
        if page_num == 1:
            url = f"https://www.zillow.com/homes/for_sale/{city_slug}_rb/"
        else:
            url = f"https://www.zillow.com/homes/for_sale/{city_slug}_rb/{page_num}_p/"

        try:
            async with sem:
                await asyncio.sleep(random.uniform(2, 4))
                resp = await client.get(url, headers=_HEADERS, timeout=30, follow_redirects=True)

            if resp.status_code == 429:
                logger.warning("USA: rate limited on %s page %d — pausing 120s", city_name, page_num)
                await asyncio.sleep(120)
                continue

            if resp.status_code != 200:
                logger.debug("USA: HTTP %d on %s page %d", resp.status_code, city_name, page_num)
                break

            rows = _extract_listings_from_page(resp.text, city_name)
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
            logger.debug("USA: timeout on %s page %d", city_name, page_num)
            await asyncio.sleep(10)
        except Exception as exc:
            logger.warning("USA: error on %s page %d: %s", city_name, page_num, exc)
            break

    return saved


async def scrape_all_usa() -> dict[str, Any]:
    """Run one full USA scrape cycle."""
    cycle_start = time.time()
    done = _load_progress()
    new_total = 0

    logger.info("USA scraper starting — %d cities, %d already done", len(US_CITIES), len(done))

    async with httpx.AsyncClient() as client:
        sem = asyncio.Semaphore(2)
        for city_name, city_slug in US_CITIES:
            if city_slug in done:
                continue
            try:
                n = await _scrape_city(client, sem, city_name, city_slug)
                new_total += n
                done.add(city_slug)
                _save_progress(done)
                logger.info("USA: %s — %d listings saved", city_name, n)
            except Exception as exc:
                logger.error("USA: unhandled error on %s: %s", city_name, exc)

    elapsed = (time.time() - cycle_start) / 60
    gc.collect()
    logger.info("USA scrape complete in %.1f min | %d new listings", elapsed, new_total)
    # Reset progress for next cycle
    PROGRESS_FILE.unlink(missing_ok=True)
    return {"source": SOURCE, "new": new_total}


async def start_usa_scraper_loop() -> None:
    logger.info("USA property scraper loop started.")
    while True:
        try:
            await scrape_all_usa()
        except Exception as exc:
            logger.error("USA scraper loop error: %s", exc)
        logger.info("USA scraper: next cycle in %d hours.", SCRAPE_INTERVAL_HOURS)
        await asyncio.sleep(SCRAPE_INTERVAL_HOURS * 3600)
