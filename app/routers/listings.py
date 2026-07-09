"""Public listings API — returns Rightmove-scraped properties with NGN price."""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.models import RightmoveListing

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


@router.get("/")
async def list_listings(
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
        return await _list_listings_inner(city, min_price, max_price, min_beds, property_type, search, page, per_page, db)
    except Exception as exc:
        logger.error("listings endpoint error: %s", exc, exc_info=True)
        raise


async def _list_listings_inner(
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
    from sqlalchemy import or_
    stmt = select(RightmoveListing).where(RightmoveListing.is_active.is_(True))
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

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    stmt = stmt.order_by(RightmoveListing.scraped_at.desc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    listings = result.scalars().all()

    ngn_rate = await _get_gbp_ngn_rate()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
        "ngn_rate": ngn_rate,
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
