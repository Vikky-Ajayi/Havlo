"""Recently assessed properties, for the scrolling strip on the /offer landing
page: social proof that other owners are checking their homes with Havlo.

Each shows the listing's lead photo (public on Rightmove), the street name only
(never a house number or postcode) and its Saleability Score from the
20-factor report. Paying customers, typed-in (unread) listings and agency
copies are left out, and each street appears once. Cached for a few minutes,
since every landing page view asks.
"""
from __future__ import annotations

import json
import re
import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import StaleListingProspect

LIMIT = 20
SCAN = 250  # recent assessments looked at to find LIMIT good ones
CACHE_SECONDS = 600

_cache: dict[str, Any] = {"at": 0.0, "items": []}
_HOUSE_NUMBER = re.compile(r"^\s*(?:flat|apartment|unit|plot)?\s*[\d]+[a-z]?(?:\s*[-–/]\s*\d+[a-z]?)?\s*,?\s*", re.IGNORECASE)
_POSTCODE = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]?(?:\s*\d[A-Z]{2})?\b", re.IGNORECASE)


def street_and_town(address: str | None) -> tuple[str, str]:
    """("Bishop Norton Road", "Glentham") from "12 Bishop Norton Road,
    Glentham, Lincolnshire, LN8 2BL". Never a house number or postcode."""
    parts = [p.strip() for p in str(address or "").split(",") if p.strip()]
    parts = [p for p in parts if not _POSTCODE.fullmatch(p)]
    if not parts:
        return "", ""
    street = _HOUSE_NUMBER.sub("", parts[0]).strip()
    if not street or street[0].isdigit():
        return "", ""
    town = _POSTCODE.sub("", parts[1]).strip() if len(parts) > 1 else ""
    return street[:60], town[:40]


def _loads(text: str | None) -> dict[str, Any]:
    try:
        value = json.loads(text) if text else {}
    except (TypeError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


def pick(rows: list[Any], limit: int = LIMIT) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    streets: set[str] = set()
    for p in rows:
        if p.payment_status == "completed" or p.parent_prospect_id or p.is_manual:
            continue
        report = _loads(p.report_json)
        score = report.get("overall_score")
        if report.get("version") != 2 or not isinstance(score, (int, float)):
            continue
        snapshot = _loads(p.listing_snapshot_json)
        if snapshot.get("manual_details"):
            continue
        images = snapshot.get("images") if isinstance(snapshot.get("images"), list) else []
        image = snapshot.get("image") or (images[0] if images else "")
        if not isinstance(image, str) or not image.startswith("https://"):
            continue
        street, town = street_and_town(p.property_address)
        key = street.lower()
        if not street or key in streets:
            continue
        streets.add(key)
        out.append({"image": image, "street": street, "town": town, "score": int(round(score))})
        if len(out) >= limit:
            break
    return out


async def recent(db: AsyncSession) -> list[dict[str, Any]]:
    if time.monotonic() - _cache["at"] < CACHE_SECONDS and _cache["items"]:
        return _cache["items"]
    P = StaleListingProspect
    rows = (await db.execute(
        select(P.payment_status, P.parent_prospect_id, P.is_manual, P.report_json, P.listing_snapshot_json,
               P.property_address)
        .where(P.report_json.is_not(None), P.country == "UK")
        .order_by(P.created_at.desc())
        .limit(SCAN)
    )).all()
    items = pick(list(rows))
    _cache.update(at=time.monotonic(), items=items)
    return items
