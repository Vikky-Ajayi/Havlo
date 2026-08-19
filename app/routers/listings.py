"""Public listings API — returns Rightmove-scraped properties with NGN price."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

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
_ngn_rate_cache: dict[str, Any] = {"rate": _NGN_FALLBACK, "fetched_at": time.time()}


async def _get_gbp_ngn_rate() -> float:
    """Return GBP→NGN exchange rate, cached for 1 hour."""
    if time.time() - _ngn_rate_cache["fetched_at"] < 3600:
        return float(_ngn_rate_cache["rate"])
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            resp = await client.get("https://open.er-api.com/v6/latest/GBP")
            data = resp.json()
            rate = data["rates"]["NGN"]
            _ngn_rate_cache.update({"rate": rate, "fetched_at": time.time()})
            return float(rate)
    except Exception as exc:
        logger.warning("NGN rate fetch failed (%s), using fallback %d", exc, _NGN_FALLBACK)
        _ngn_rate_cache["fetched_at"] = time.time()
        return float(_ngn_rate_cache["rate"])


def _clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _source_label(source: str, country: str) -> str:
    labels = {
        "rightmove": "Rightmove",
        "realtor_com": "Realtor.com",
        "realtor_ca": "Realtor.ca",
        "bayut": "Bayut",
    }
    if source:
        return labels.get(source, source.replace("_", " ").title())
    return {
        "uk": "Rightmove",
        "america": "Rightmove",
        "canada": "Rightmove",
        "dubai": "Rightmove",
    }.get(country, "Source")


def _price_display(amount: int, currency: str) -> str:
    currency = (currency or "GBP").upper()
    symbols = {"GBP": "£", "USD": "$", "CAD": "C$", "AED": "AED "}
    prefix = symbols.get(currency, f"{currency} ")
    return f"{prefix}{max(0, int(amount or 0)):,}"


_MARKETING_TITLE_PATTERNS = (
    "appealing to",
    "attention",
    "beautifully",
    "located within",
    "immaculate",
    "offers",
    "presented",
    "opportunity",
    "viewing",
    "buyers",
    "investors",
)


def _display_title(raw_title: str, address: str) -> str:
    title = _clean_text(raw_title)
    clean_address = _clean_text(address)
    if not title:
        return clean_address or "Property for sale"
    if clean_address:
        looks_like_description = (
            len(title) > 90
            or title.count(" ") >= 12
            or any(pattern in title.lower() for pattern in _MARKETING_TITLE_PATTERNS)
        )
        if looks_like_description:
            return clean_address
    return title


def _looks_like_broad_location(value: str, country: str, city: str, region: str) -> bool:
    text = _clean_text(value).lower()
    if not text:
        return True
    parts = [part.strip().lower() for part in re.split(r",|\|", text) if part.strip()]
    broad_terms = {
        "dubai",
        "canada",
        "america",
        "usa",
        "united states",
        "british columbia",
        "ontario",
        "vancouver",
    }
    broad_terms.update(part.lower() for part in (country, city, region) if part)
    return (
        text in broad_terms
        or (parts and all(part in broad_terms for part in parts))
        or (len(parts) <= 3 and not re.search(r"\d|bed|villa|apartment|house|condo|townhouse|penthouse|detached", text))
    )


def _marketplace_title(listing: RightmoveListing, address: str, country: str) -> str:
    raw_title = _display_title(listing.title, address)
    city = _clean_text(listing.city)
    region = _clean_text(listing.region)
    property_type = _clean_text(listing.property_type) or "property"
    bedrooms = int(listing.bedrooms or 0)
    if raw_title and not _looks_like_broad_location(raw_title, country, city, region):
        return raw_title
    location = city or region or country.title()
    if bedrooms > 0:
        return f"{bedrooms} bedroom {property_type.lower()} in {location}"
    return f"{property_type.title()} in {location}"


def _listing_country(listing: RightmoveListing) -> str:
    stored = _normalise_country(getattr(listing, "country", None))
    if stored in _COUNTRY_ALIASES:
        return stored
    return _infer_country(listing)


def _listing_to_dict(listing: RightmoveListing, ngn_rate: float) -> dict[str, Any]:
    import json as _json
    images: list[str] = []
    if listing.images_json:
        try:
            images = _json.loads(listing.images_json)
        except Exception:
            pass
    country = _listing_country(listing)
    source = _clean_text(getattr(listing, "source", "")) or {
        "uk": "rightmove",
        "america": "rightmove",
        "canada": "rightmove",
        "dubai": "rightmove",
    }.get(country, "")
    price_gbp = int(listing.price_gbp or 0)
    price_native = int(getattr(listing, "price_native", 0) or price_gbp)
    price_currency = _clean_text(getattr(listing, "price_currency", "")) or "GBP"
    address = _clean_text(listing.address)
    title = _marketplace_title(listing, address, country)
    address = address or title

    return {
        "id": str(listing.id),
        "rightmove_id": listing.rightmove_id,
        "url": listing.url,
        "title": title,
        "price_gbp": price_gbp,
        "price_native": price_native,
        "price_currency": price_currency,
        "price_display": _price_display(price_native, price_currency),
        "price_ngn": int(price_gbp * ngn_rate),
        "ngn_rate": ngn_rate,
        "address": address,
        "city": _clean_text(listing.city),
        "region": _clean_text(listing.region),
        "country": country,
        "source": source,
        "source_label": _source_label(source, country),
        "bedrooms": listing.bedrooms,
        "bathrooms": listing.bathrooms,
        "property_type": _clean_text(listing.property_type) or "Property",
        "description": _clean_text(listing.description),
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
    stored = _normalise_country(getattr(listing, "country", None))
    if stored in _COUNTRY_ALIASES:
        return stored
    haystack = " ".join(
        str(part or "")
        for part in [listing.region, listing.city, listing.address, listing.title, listing.url]
    ).lower()
    for country, aliases in _COUNTRY_ALIASES.items():
        if any(alias in haystack for alias in aliases):
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
    title = _clean_text(item.get("title") or item.get("address") or "Imported property")
    url = str(item.get("url") or item.get("external_url") or "").strip()
    city = _clean_text(item.get("city") or item.get("town") or item.get("location") or country.title())
    address = _clean_text(item.get("address") or title)
    price = _parse_price_to_int(item.get("price_gbp") or item.get("price") or item.get("price_text"))
    source_by_country = {
        "uk": ("rightmove", "GBP"),
        "america": ("rightmove", "USD"),
        "canada": ("rightmove", "USD"),
        "dubai": ("rightmove", "GBP"),
    }
    source, currency = source_by_country.get(country, ("import", "GBP"))
    price_native = _parse_price_to_int(item.get("price_native") or item.get("price") or price)
    price_currency = _clean_text(item.get("price_currency") or currency).upper()[:3]
    return {
        "rightmove_id": _listing_identity(item),
        "url": url or f"https://www.heyhavlo.com/buyabroad/uk/listings",
        "title": title[:500],
        "price_gbp": price or 0,
        "price_native": price_native or price or 0,
        "price_currency": price_currency or "GBP",
        "address": address[:500],
        "city": city[:100],
        "region": country,
        "country": country,
        "source": str(item.get("source") or source)[:30],
        "bedrooms": int(_parse_price_to_int(item.get("bedrooms")) or 0),
        "bathrooms": int(_parse_price_to_int(item.get("bathrooms")) or 0) or None,
        "property_type": _clean_text(item.get("property_type") or item.get("type") or "Home")[:100],
        "description": _clean_text(item.get("description")) or None,
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
    include_total: bool = Query(True, description="Set false for fast preview rows when total/pages are not needed"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    try:
        return await _list_listings_inner(
            country,
            city,
            min_price,
            max_price,
            min_beds,
            property_type,
            search,
            page,
            per_page,
            include_total,
            db,
        )
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
    include_total: bool,
    db: AsyncSession,
) -> dict[str, Any]:
    stmt = select(RightmoveListing).where(RightmoveListing.is_active.is_(True))
    expected_country = _normalise_country(country)
    if expected_country:
        if expected_country not in _COUNTRY_ALIASES:
            raise HTTPException(status_code=400, detail="Unsupported country. Use uk, america, dubai, or canada.")
        stmt = stmt.where(RightmoveListing.country == expected_country)
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
    total: Optional[int] = None
    if include_total:
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
        "pages": max(1, -(-total // per_page)) if total is not None else None,
        "ngn_rate": ngn_rate,
        "country": expected_country,
        "listings": [_listing_to_dict(l, ngn_rate) for l in listings],
    }


@router.get("/cities")
async def list_cities(
    country: Optional[str] = Query(None, description="Filter by country: uk, america, dubai, canada"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = (
        select(RightmoveListing.city, func.count(RightmoveListing.id).label("count"))
        .where(RightmoveListing.is_active.is_(True))
    )
    expected_country = _normalise_country(country)
    if expected_country:
        if expected_country not in _COUNTRY_ALIASES:
            raise HTTPException(status_code=400, detail="Unsupported country. Use uk, america, dubai, or canada.")
        stmt = stmt.where(RightmoveListing.country == expected_country)
    stmt = stmt.group_by(RightmoveListing.city).order_by(func.count(RightmoveListing.id).desc())
    result = await db.execute(
        stmt
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
    per_country_result = await db.execute(
        select(RightmoveListing.country, func.count(RightmoveListing.id))
        .where(RightmoveListing.is_active.is_(True))
        .group_by(RightmoveListing.country)
    )
    return {
        "total_listings": total,
        "last_scraped": last_scraped.isoformat() if last_scraped else None,
        "countries": {country: count for country, count in per_country_result.all()},
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
        select(RightmoveListing).where(
            RightmoveListing.rightmove_id.in_(id_list),
            RightmoveListing.is_active.is_(True),
        )
    )
    listings = result.scalars().all()
    by_id = {listing.rightmove_id: listing for listing in listings}
    ordered = [by_id[item_id] for item_id in id_list if item_id in by_id]
    ngn_rate = await _get_gbp_ngn_rate()
    return {"listings": [_listing_to_dict(l, ngn_rate) for l in ordered]}


@router.get("/{rightmove_id}")
async def get_listing(rightmove_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(
        select(RightmoveListing).where(
            RightmoveListing.rightmove_id == rightmove_id,
            RightmoveListing.is_active.is_(True),
        )
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    ngn_rate = await _get_gbp_ngn_rate()
    return _listing_to_dict(listing, ngn_rate)
