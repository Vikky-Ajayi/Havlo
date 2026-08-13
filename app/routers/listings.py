"""Public listings API — returns Rightmove-scraped properties with NGN price."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import require_admin
from app.db.database import get_db
from app.models.models import RightmoveListing, User
from app.services.listing_scraper import scrape_agent_listings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/listings", tags=["listings"])

_NGN_FALLBACK = 2100
_ngn_rate_cache: dict[str, Any] = {"rate": _NGN_FALLBACK, "fetched_at": 0}


async def _get_gbp_ngn_rate() -> float:
    """Return GBP→NGN exchange rate, cached for 1 hour."""
    import time
    if time.time() - _ngn_rate_cache["fetched_at"] < 3600:
        return float(_ngn_rate_cache["rate"])
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get("https://open.er-api.com/v6/latest/GBP")
            data = resp.json()
            rate = data["rates"]["NGN"]
            _ngn_rate_cache.update({"rate": rate, "fetched_at": time.time()})
            return float(rate)
    except Exception as exc:
        logger.warning("NGN rate fetch failed (%s), using fallback %d", exc, _NGN_FALLBACK)
        return float(_ngn_rate_cache["rate"])


def _listing_to_dict(listing: RightmoveListing, ngn_rate: float) -> dict[str, Any]:
    import json as _json
    images: list[str] = []
    if listing.images_json:
        try:
            images = _json.loads(listing.images_json)
        except Exception:
            pass
    return {
        "id": str(listing.id),
        "rightmove_id": listing.rightmove_id,
        "url": listing.url,
        "title": listing.title,
        "price_gbp": listing.price_gbp,
        "price_ngn": int(listing.price_gbp * ngn_rate),
        "ngn_rate": ngn_rate,
        "address": listing.address,
        "city": listing.city,
        "region": listing.region,
        "country": _infer_country(listing),
        "bedrooms": listing.bedrooms,
        "bathrooms": listing.bathrooms,
        "property_type": listing.property_type,
        "description": listing.description,
        "images": images,
        "scraped_at": listing.scraped_at.isoformat() if listing.scraped_at else None,
    }


_PROPERTY_TYPE_KEYWORDS: dict[str, list[str]] = {
    "house":      ["house", "detached", "semi-detached", "terraced", "town house", "end of terrace"],
    "flat":       ["flat", "apartment", "studio", "maisonette", "penthouse"],
    "bungalow":   ["bungalow"],
    "commercial": ["commercial", "office", "retail", "industrial", "warehouse"],
}

_COUNTRY_ALIASES: dict[str, list[str]] = {
    "uk": ["uk", "united kingdom", "england", "scotland", "wales", "northern ireland", "rightmove", "zoopla"],
    "america": ["america", "usa", "us", "united states", "zillow", "realtor.com", "redfin"],
    "dubai": ["dubai", "uae", "united arab emirates", "bayut", "propertyfinder"],
    "canada": ["canada", "realtor.ca", "toronto", "vancouver", "ontario", "british columbia"],
}

_KNOWN_UK_TERMS = {
    "london", "manchester", "birmingham", "leeds", "liverpool", "bristol",
    "cardiff", "glasgow", "edinburgh", "llanelli", "wales", "england", "scotland",
}


class ScrapeListingsRequest(BaseModel):
    country: str = Field(..., description="uk, america, dubai, or canada")
    urls: list[str] = Field(default_factory=list, description="Search/profile URLs to scrape")
    deep_scrape: bool = True


def _normalise_country(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    value = raw.strip().lower().replace("_", "-")
    aliases = {
        "united-kingdom": "uk",
        "gb": "uk",
        "great-britain": "uk",
        "britain": "uk",
        "usa": "america",
        "us": "america",
        "united-states": "america",
        "united-states-of-america": "america",
        "uae": "dubai",
        "united-arab-emirates": "dubai",
    }
    return aliases.get(value, value)


def _infer_country(listing: RightmoveListing) -> str:
    haystack = " ".join(
        str(part or "")
        for part in [listing.region, listing.city, listing.address, listing.title, listing.url]
    ).lower()
    host = urlparse(listing.url or "").netloc.lower()
    for country, aliases in _COUNTRY_ALIASES.items():
        if any(alias in haystack or alias in host for alias in aliases):
            return country
    if (listing.city or "").strip().lower() in _KNOWN_UK_TERMS:
        return "uk"
    return "uk"


def _country_matches(listing: RightmoveListing, country: Optional[str]) -> bool:
    expected = _normalise_country(country)
    return not expected or _infer_country(listing) == expected


def _parse_price_to_int(raw: Any) -> int:
    if isinstance(raw, (int, float)):
        return max(0, int(raw))
    digits = re.sub(r"[^0-9]", "", str(raw or ""))
    return int(digits) if digits else 0


def _scrape_sources_for_country(country: str) -> list[str]:
    raw = os.getenv(f"BUY_ABROAD_{country.upper()}_SCRAPE_URLS", "")
    return [url.strip() for url in raw.split(",") if url.strip()]


def _listing_identity(item: dict[str, Any]) -> str:
    source = str(item.get("rightmove_id") or item.get("id") or item.get("url") or item.get("external_url") or "")
    if source:
        cleaned = re.sub(r"[^A-Za-z0-9_-]", "", source)
        if cleaned and not source.startswith(("http://", "https://")):
            return cleaned[-48:]
        return f"BA-{hashlib.sha1(source.encode('utf-8')).hexdigest()[:18]}"
    raw = json.dumps(item, sort_keys=True, default=str)
    return f"BA-{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:18]}"


def _item_images(item: dict[str, Any]) -> list[str]:
    images = item.get("images")
    if isinstance(images, list):
        return [str(img) for img in images if img][:12]
    image = item.get("image") or item.get("image_url")
    return [str(image)] if image else []


def _item_to_model_values(item: dict[str, Any], country: str) -> dict[str, Any]:
    title = str(item.get("title") or item.get("address") or "Imported property").strip()
    url = str(item.get("url") or item.get("external_url") or "").strip()
    city = str(item.get("city") or item.get("town") or item.get("location") or country.title()).strip()
    address = str(item.get("address") or title).strip()
    price = _parse_price_to_int(item.get("price_gbp") or item.get("price") or item.get("price_text"))
    return {
        "rightmove_id": _listing_identity(item),
        "url": url or f"https://www.heyhavlo.com/buyabroad/uk/listings",
        "title": title[:500],
        "price_gbp": price or 0,
        "address": address[:500],
        "city": city[:100],
        "region": country,
        "bedrooms": int(_parse_price_to_int(item.get("bedrooms")) or 0),
        "bathrooms": int(_parse_price_to_int(item.get("bathrooms")) or 0) or None,
        "property_type": str(item.get("property_type") or item.get("type") or "Home")[:100],
        "description": str(item.get("description") or "") or None,
        "images_json": json.dumps(_item_images(item)),
        "is_active": True,
        "scraped_at": datetime.now(timezone.utc),
    }


@router.post("/scrape")
async def scrape_listings(
    payload: ScrapeListingsRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    country = _normalise_country(payload.country)
    if country not in _COUNTRY_ALIASES:
        raise HTTPException(status_code=400, detail="Unsupported country. Use uk, america, dubai, or canada.")

    urls = payload.urls or _scrape_sources_for_country(country)
    if not urls:
        raise HTTPException(
            status_code=400,
            detail=f"No scrape URLs supplied. Pass urls or configure BUY_ABROAD_{country.upper()}_SCRAPE_URLS.",
        )

    imported: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for url in urls:
        try:
            scraped = await scrape_agent_listings(url, deep_scrape=payload.deep_scrape)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Buy Abroad scrape failed for %s: %s", url, exc)
            errors.append({"url": url, "error": str(exc)})
            continue

        for item in scraped:
            values = _item_to_model_values(item, country)
            existing = await db.execute(
                select(RightmoveListing).where(RightmoveListing.rightmove_id == values["rightmove_id"])
            )
            listing = existing.scalar_one_or_none()
            if listing:
                for key, value in values.items():
                    setattr(listing, key, value)
            else:
                listing = RightmoveListing(**values)
                db.add(listing)
            imported.append({"rightmove_id": values["rightmove_id"], "title": values["title"]})

    await db.commit()
    return {"ok": True, "country": country, "imported_count": len(imported), "imported": imported, "errors": errors}


@router.get("/")
async def list_listings(
    country: Optional[str] = Query(None, description="Filter by country: uk, america, dubai, canada"),
    city: Optional[str] = Query(None, description="Filter by city name"),
    min_price: Optional[int] = Query(None, description="Min price in GBP"),
    max_price: Optional[int] = Query(None, description="Max price in GBP"),
    min_beds: Optional[int] = Query(None, description="Minimum bedrooms"),
    property_type: Optional[str] = Query(None, description="Property type: house, flat, bungalow, commercial"),
    search: Optional[str] = Query(None, description="Free-text search across title, address, city"),
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=48),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    try:
        return await _list_listings_inner(country, city, min_price, max_price, min_beds, property_type, search, page, per_page, db)
    except Exception as exc:
        logger.error("listings endpoint error: %s", exc, exc_info=True)
        raise


async def _list_listings_inner(
    country: Optional[str],
    city: Optional[str],
    min_price: Optional[int],
    max_price: Optional[int],
    min_beds: Optional[int],
    property_type: Optional[str],
    search: Optional[str],
    page: int,
    per_page: int,
    db: AsyncSession,
) -> dict[str, Any]:
    stmt = select(RightmoveListing).where(RightmoveListing.is_active.is_(True))
    expected_country = _normalise_country(country)
    if expected_country:
        aliases = _COUNTRY_ALIASES.get(expected_country, {expected_country})
        country_terms = {expected_country, *aliases}
        country_clauses = []
        for term_value in country_terms:
            term = f"%{term_value.lower()}%"
            country_clauses.extend(
                [
                    func.lower(RightmoveListing.region).like(term),
                    func.lower(RightmoveListing.url).like(term),
                    func.lower(RightmoveListing.city).like(term),
                    func.lower(RightmoveListing.address).like(term),
                    func.lower(RightmoveListing.title).like(term),
                ]
            )
        if expected_country == "uk":
            country_clauses.append(func.coalesce(RightmoveListing.region, "") == "")
        stmt = stmt.where(or_(*country_clauses))
    if city:
        stmt = stmt.where(func.lower(RightmoveListing.city) == city.lower())
    if min_price is not None:
        stmt = stmt.where(RightmoveListing.price_gbp >= min_price)
    if max_price is not None:
        stmt = stmt.where(RightmoveListing.price_gbp <= max_price)
    if min_beds is not None:
        stmt = stmt.where(RightmoveListing.bedrooms >= min_beds)
    if property_type and property_type in _PROPERTY_TYPE_KEYWORDS:
        keywords = _PROPERTY_TYPE_KEYWORDS[property_type]
        stmt = stmt.where(
            or_(*[func.lower(RightmoveListing.property_type).contains(kw) for kw in keywords])
        )
    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(RightmoveListing.title).like(term),
                func.lower(RightmoveListing.address).like(term),
                func.lower(RightmoveListing.city).like(term),
                func.lower(RightmoveListing.region).like(term),
                func.lower(RightmoveListing.description).like(term),
            )
        )

    stmt = stmt.order_by(RightmoveListing.scraped_at.desc())
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total_result = await db.execute(count_stmt)
    total = int(total_result.scalar_one() or 0)
    result = await db.execute(stmt.offset((page - 1) * per_page).limit(per_page))
    listings = result.scalars().all()

    ngn_rate = await _get_gbp_ngn_rate()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
        "ngn_rate": ngn_rate,
        "country": expected_country,
        "listings": [_listing_to_dict(l, ngn_rate) for l in listings],
    }


@router.get("/cities")
async def list_cities(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(
        select(RightmoveListing.city, func.count(RightmoveListing.id).label("count"))
        .where(RightmoveListing.is_active.is_(True))
        .group_by(RightmoveListing.city)
        .order_by(func.count(RightmoveListing.id).desc())
    )
    rows = result.all()
    return {"cities": [{"name": r[0], "count": r[1]} for r in rows]}


@router.get("/stats")
async def listings_stats(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    total = (await db.execute(
        select(func.count()).where(RightmoveListing.is_active.is_(True))
    )).scalar_one()
    last_scraped = (await db.execute(
        select(func.max(RightmoveListing.scraped_at))
    )).scalar_one()
    return {
        "total_listings": total,
        "last_scraped": last_scraped.isoformat() if last_scraped else None,
    }


@router.get("/by-ids")
async def get_listings_by_ids(
    ids: str = Query(..., description="Comma-separated rightmove_ids"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Fetch multiple listings by their rightmove_id — used by the Favourites tab."""
    from sqlalchemy import or_ as _or
    id_list = [i.strip() for i in ids.split(",") if i.strip()][:200]  # cap at 200
    if not id_list:
        return {"listings": []}
    result = await db.execute(
        select(RightmoveListing).where(RightmoveListing.rightmove_id.in_(id_list))
    )
    listings = result.scalars().all()
    ngn_rate = await _get_gbp_ngn_rate()
    return {"listings": [_listing_to_dict(l, ngn_rate) for l in listings]}


@router.get("/{rightmove_id}")
async def get_listing(rightmove_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(
        select(RightmoveListing).where(RightmoveListing.rightmove_id == rightmove_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    ngn_rate = await _get_gbp_ngn_rate()
    return _listing_to_dict(listing, ngn_rate)
