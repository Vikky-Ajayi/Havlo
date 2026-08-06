"""International property listings API — USA, Canada, Dubai."""
from __future__ import annotations

import json as _json
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.models import InternationalListing

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/intl-listings", tags=["international-listings"])

VALID_SOURCES = {"usa", "canada", "dubai"}


def _listing_to_dict(listing: InternationalListing) -> dict[str, Any]:
    images: list[str] = []
    if listing.images_json:
        try:
            images = _json.loads(listing.images_json)
        except Exception:
            pass
    return {
        "id": str(listing.id),
        "source": listing.source,
        "external_id": listing.external_id,
        "url": listing.url,
        "title": listing.title,
        "price_local": listing.price_local,
        "currency_code": listing.currency_code,
        "currency_symbol": listing.currency_symbol,
        "address": listing.address,
        "city": listing.city,
        "region": listing.region,
        "country": listing.country,
        "bedrooms": listing.bedrooms,
        "bathrooms": listing.bathrooms,
        "property_type": listing.property_type,
        "description": listing.description,
        "images": images,
        "scraped_at": listing.scraped_at.isoformat() if listing.scraped_at else None,
    }


@router.get("/")
async def list_intl_listings(
    source: str = Query(..., description="Source: usa, canada, or dubai"),
    city: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    min_beds: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=48),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if source not in VALID_SOURCES:
        raise HTTPException(status_code=400, detail=f"Invalid source. Must be one of: {', '.join(VALID_SOURCES)}")

    from sqlalchemy import or_
    stmt = select(InternationalListing).where(
        InternationalListing.source == source,
        InternationalListing.is_active.is_(True),
    )

    if city:
        stmt = stmt.where(func.lower(InternationalListing.city) == city.lower())
    if min_price is not None:
        stmt = stmt.where(InternationalListing.price_local >= min_price)
    if max_price is not None:
        stmt = stmt.where(InternationalListing.price_local <= max_price)
    if min_beds is not None:
        stmt = stmt.where(InternationalListing.bedrooms >= min_beds)
    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(InternationalListing.title).like(term),
                func.lower(InternationalListing.address).like(term),
                func.lower(InternationalListing.city).like(term),
                func.lower(InternationalListing.region).like(term),
            )
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(InternationalListing.scraped_at.desc().nullslast())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    listings = (await db.execute(stmt)).scalars().all()

    return {
        "source": source,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
        "listings": [_listing_to_dict(l) for l in listings],
    }


@router.get("/preview")
async def preview_all_sources(
    per_page: int = Query(5, ge=1, le=20),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Fetch preview listings for all three sources in one call."""
    from sqlalchemy import or_

    result: dict[str, Any] = {}
    for source in VALID_SOURCES:
        stmt = select(InternationalListing).where(
            InternationalListing.source == source,
            InternationalListing.is_active.is_(True),
        )
        if search:
            term = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(InternationalListing.title).like(term),
                    func.lower(InternationalListing.address).like(term),
                    func.lower(InternationalListing.city).like(term),
                )
            )
        stmt = stmt.order_by(InternationalListing.scraped_at.desc().nullslast()).limit(per_page)
        listings = (await db.execute(stmt)).scalars().all()
        total_stmt = select(func.count()).where(
            InternationalListing.source == source,
            InternationalListing.is_active.is_(True),
        )
        total = (await db.execute(total_stmt)).scalar_one()
        result[source] = {
            "total": total,
            "listings": [_listing_to_dict(l) for l in listings],
        }

    return result


@router.get("/cities")
async def list_intl_cities(
    source: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if source not in VALID_SOURCES:
        raise HTTPException(status_code=400, detail="Invalid source")
    rows = (await db.execute(
        select(InternationalListing.city, func.count(InternationalListing.id).label("count"))
        .where(InternationalListing.source == source, InternationalListing.is_active.is_(True))
        .group_by(InternationalListing.city)
        .order_by(func.count(InternationalListing.id).desc())
    )).all()
    return {"source": source, "cities": [{"name": r[0], "count": r[1]} for r in rows if r[0]]}


@router.get("/stats")
async def intl_stats(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    stats = {}
    for source in VALID_SOURCES:
        count = (await db.execute(
            select(func.count()).where(
                InternationalListing.source == source,
                InternationalListing.is_active.is_(True),
            )
        )).scalar_one()
        stats[source] = count
    return stats


@router.get("/{source}/{external_id}")
async def get_intl_listing(source: str, external_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    if source not in VALID_SOURCES:
        raise HTTPException(status_code=400, detail="Invalid source")
    listing = (await db.execute(
        select(InternationalListing).where(
            InternationalListing.source == source,
            InternationalListing.external_id == external_id,
        )
    )).scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return _listing_to_dict(listing)
