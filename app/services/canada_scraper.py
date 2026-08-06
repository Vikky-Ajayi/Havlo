"""Canada property scraper — uses the REALTOR.ca public JSON API.

Covers major Canadian cities. Scrapes via POST to the REALTOR.ca listing search API.
Stores results in international_listings with source='canada'.
"""
from __future__ import annotations

import asyncio
import gc
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.database import AsyncSessionLocal
from app.models.models import InternationalListing

logger = logging.getLogger(__name__)

SCRAPE_INTERVAL_HOURS = 12
SOURCE = "canada"
CURRENCY_CODE = "CAD"
CURRENCY_SYMBOL = "C$"
COUNTRY = "Canada"

# REALTOR.ca city search configs: (city_name, lat, lng, lat_min, lat_max, lng_min, lng_max)
CANADA_CITIES = [
    ("Toronto", 43.6532, -79.3832, 43.58, 43.85, -79.64, -79.12),
    ("Vancouver", 49.2827, -123.1207, 49.18, 49.37, -123.28, -122.95),
    ("Montreal", 45.5017, -73.5673, 45.42, 45.60, -73.75, -73.43),
    ("Calgary", 51.0447, -114.0719, 50.89, 51.21, -114.30, -113.85),
    ("Ottawa", 45.4215, -75.6972, 45.27, 45.54, -75.93, -75.47),
    ("Edmonton", 53.5461, -113.4938, 53.39, 53.71, -113.73, -113.26),
    ("Mississauga", 43.5890, -79.6441, 43.52, 43.66, -79.77, -79.52),
    ("Winnipeg", 49.8951, -97.1384, 49.79, 49.99, -97.31, -96.96),
    ("Hamilton", 43.2557, -79.8711, 43.20, 43.32, -80.00, -79.74),
    ("Quebec City", 46.8139, -71.2082, 46.72, 46.92, -71.43, -70.99),
]

_API_URL = "https://api2.realtor.ca/Listing.svc/PropertySearch_Post"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-CA,en;q=0.9",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": "https://www.realtor.ca",
    "Referer": "https://www.realtor.ca/",
    "X-Requested-With": "XMLHttpRequest",
}


def _parse_listing(prop: dict, city_name: str) -> Optional[dict[str, Any]]:
    try:
        listing_id = prop.get("Id") or prop.get("MlsNumber") or ""
        if not listing_id:
            return None

        listing_id = str(listing_id)
        price = 0.0
        price_info = prop.get("Property", {}).get("Price") or prop.get("Property", {}).get("PriceUnformattedValue")
        if isinstance(price_info, str):
            cleaned = "".join(c for c in price_info if c.isdigit())
            price = float(cleaned) if cleaned else 0.0
        elif isinstance(price_info, (int, float)):
            price = float(price_info)

        address_obj = prop.get("Property", {}).get("Address", {})
        address_line = address_obj.get("AddressText") or ""
        street = address_obj.get("StreetAddress") or ""
        city = address_obj.get("City") or city_name
        province = address_obj.get("Province") or ""

        full_address = address_line or f"{street}, {city}, {province}".strip(", ")

        building = prop.get("Building", {})
        beds_raw = building.get("BathroomTotal") or building.get("Bedrooms") or "0"
        beds = int("".join(c for c in str(beds_raw) if c.isdigit()) or "0")
        baths_raw = building.get("BathroomTotal") or building.get("Bathrooms") or ""
        baths_str = "".join(c for c in str(baths_raw) if c.isdigit() or c == ".")
        baths = float(baths_str) if baths_str else None

        beds_val = building.get("Bedrooms") or "0"
        beds = int("".join(c for c in str(beds_val) if c.isdigit()) or "0")

        ptype = building.get("Type") or prop.get("Property", {}).get("Type") or ""

        # URL
        listing_url = f"https://www.realtor.ca{prop.get('RelativeDetailsURL', '')}"

        # Images
        photos = prop.get("Property", {}).get("Photo") or []
        imgs = []
        for photo in photos[:8]:
            url = photo.get("HighResPath") or photo.get("MedResPath") or photo.get("LowResPath") or ""
            if url:
                imgs.append(url)

        description = prop.get("PublicRemarks") or None

        return {
            "source": SOURCE,
            "external_id": listing_id,
            "url": listing_url,
            "title": full_address or city,
            "price_local": price if price > 0 else None,
            "currency_code": CURRENCY_CODE,
            "currency_symbol": CURRENCY_SYMBOL,
            "address": full_address,
            "city": city,
            "region": province,
            "country": COUNTRY,
            "bedrooms": beds,
            "bathrooms": baths,
            "property_type": ptype,
            "description": description,
            "images_json": json.dumps(imgs) if imgs else None,
        }
    except Exception as exc:
        logger.debug("Canada: listing parse error: %s", exc)
        return None


async def _scrape_city(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    city_name: str,
    lat: float, lng: float,
    lat_min: float, lat_max: float,
    lng_min: float, lng_max: float,
) -> int:
    saved = 0
    for page in range(1, 6):
        payload = (
            f"LangCultureName=en-CA"
            f"&PropertySearchTypeId=1"
            f"&TransactionTypeId=2"
            f"&StoreyRange="
            f"&RecordsPerPage=50"
            f"&CurrentPage={page}"
            f"&MaximumResults=200"
            f"&SortOrder=A"
            f"&SortBy=1"
            f"&viewState=m"
            f"&Longitude={lng}"
            f"&Latitude={lat}"
            f"&LatitudeMax={lat_max}"
            f"&LatitudeMin={lat_min}"
            f"&LongitudeMax={lng_max}"
            f"&LongitudeMin={lng_min}"
            f"&ZoomLevel=11"
        )

        try:
            async with sem:
                await asyncio.sleep(1.5)
                resp = await client.post(_API_URL, content=payload, headers=_HEADERS, timeout=30)

            if resp.status_code != 200:
                logger.debug("Canada: HTTP %d on %s page %d", resp.status_code, city_name, page)
                break

            data = resp.json()
            results = data.get("Results") or []
            if not results:
                break

            rows = [r for r in (_parse_listing(p, city_name) for p in results) if r]
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

            total_records = data.get("Paging", {}).get("TotalRecords") or 0
            if page * 50 >= int(total_records):
                break

        except httpx.TimeoutException:
            await asyncio.sleep(10)
        except Exception as exc:
            logger.warning("Canada: error on %s page %d: %s", city_name, page, exc)
            break

    return saved


async def scrape_all_canada() -> dict[str, Any]:
    cycle_start = time.time()
    new_total = 0

    logger.info("Canada scraper starting — %d cities", len(CANADA_CITIES))

    async with httpx.AsyncClient() as client:
        sem = asyncio.Semaphore(2)
        for city_name, lat, lng, lat_min, lat_max, lng_min, lng_max in CANADA_CITIES:
            try:
                n = await _scrape_city(client, sem, city_name, lat, lng, lat_min, lat_max, lng_min, lng_max)
                new_total += n
                logger.info("Canada: %s — %d listings saved", city_name, n)
            except Exception as exc:
                logger.error("Canada: unhandled error on %s: %s", city_name, exc)

    elapsed = (time.time() - cycle_start) / 60
    gc.collect()
    logger.info("Canada scrape complete in %.1f min | %d new listings", elapsed, new_total)
    return {"source": SOURCE, "new": new_total}


async def start_canada_scraper_loop() -> None:
    logger.info("Canada property scraper loop started.")
    while True:
        try:
            await scrape_all_canada()
        except Exception as exc:
            logger.error("Canada scraper loop error: %s", exc)
        logger.info("Canada scraper: next cycle in %d hours.", SCRAPE_INTERVAL_HOURS)
        await asyncio.sleep(SCRAPE_INTERVAL_HOURS * 3600)
