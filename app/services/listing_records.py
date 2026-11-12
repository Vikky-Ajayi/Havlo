"""Every Rightmove listing the platform sees, and its estate agent
(MarketListing), for the agent referral service: which branches actually get
homes like yours sold, and how fast.

The platform already runs Rightmove searches all the time (the inventory and
discovery scans, the 30-day watch's weekly nearby checks, the agent report's
local searches, the Zoopla-to-Rightmove matching). Each result carries the
listing's agency and branch, first-listed date, price and status. observe()
keeps them: it's called with each search page's results and only buffers them
in memory (no database work in the search itself); a flusher in each web
worker writes the buffer every minute (flush()).

What's recorded per listing: the agent, area, type, bedrooms, price (first,
current, lowest, number of cuts), Rightmove's first-listed date, when we first
and last saw it, and when we first saw it under offer or sold STC.

The track record (track_records()) counts a branch's listings that agreed a
sale within 180 days. Only searches that include sold-STC homes can see a sale
agreed (the watch, agent report and matching searches; the inventory scans
leave them out), so both the successes and the failures are judged from those
searches alone. Otherwise every listing that sold would vanish from the
inventory scans unseen while every slow one kept showing up, and branches
would look worse than they are.
"""
from __future__ import annotations

import asyncio
import logging
import re
import statistics
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import MarketListing

logger = logging.getLogger(__name__)

FLUSH_SECONDS = 60
FLUSH_CHUNK = 400
MAX_PENDING = 50_000

DECIDE_DAYS = 180  # "agreed a sale within 180 days"
MIN_DECIDED = 10  # listings with a known outcome before a branch is ranked
PRECISE_GAP_DAYS = 14  # seen for sale this close before agreed: the day count is good to a fortnight
MAX_ROWS = 300_000

AGREED = ("under_offer", "sold_stc")
_OUTCODE = re.compile(r"^[A-Z]{1,2}\d[A-Z\d]?$")
_SQFT = re.compile(r"([\d,]+(?:\.\d+)?)\s*sq\.?\s*ft", re.IGNORECASE)

# rightmove_id -> (row, seen at, whether the search included sold-STC homes)
_pending: dict[str, tuple[dict[str, Any], datetime, bool]] = {}
_overflow_logged = False


def _text(value: Any, limit: int) -> str | None:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit] or None


def _int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _when(value: Any) -> datetime | None:
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def status_of(display_status: Any) -> str:
    words = str(display_status or "").upper()
    if "SOLD" in words:
        return "sold_stc"
    if "OFFER" in words:
        return "under_offer"
    return "on_market"


def outcode_of(address: Any) -> str | None:
    """"Hoo Road, Kidderminster, DY10" -> "DY10" (Rightmove ends the display
    address with the outcode)."""
    last = str(address or "").rsplit(",", 1)[-1].strip().upper()
    return last if _OUTCODE.match(last) else None


def row_from_search(prop: dict[str, Any]) -> dict[str, Any] | None:
    """One search result as a MarketListing row; None for anything that isn't a
    UK home for sale with an agent."""
    if not isinstance(prop, dict) or not prop.get("id"):
        return None
    if prop.get("commercial") or (prop.get("countryCode") not in (None, "GB")):
        return None
    customer = prop.get("customer") if isinstance(prop.get("customer"), dict) else {}
    price = prop.get("price") if isinstance(prop.get("price"), dict) else {}
    amount = price.get("amount")
    displays = price.get("displayPrices") or []
    qualifier = displays[0].get("displayPriceQualifier") if displays and isinstance(displays[0], dict) else None
    location = prop.get("location") if isinstance(prop.get("location"), dict) else {}
    size = _SQFT.search(str(prop.get("displaySize") or ""))
    outcode = outcode_of(prop.get("displayAddress"))
    return {
        "rightmove_id": str(prop["id"])[:20],
        "branch_id": _text(customer.get("branchId"), 20),
        "agency": _text(customer.get("brandTradingName"), 200),
        "branch_name": _text(customer.get("branchDisplayName"), 300),
        "outcode": outcode,
        "area": re.match(r"[A-Z]+", outcode).group(0) if outcode else None,
        "latitude": location.get("latitude") if isinstance(location.get("latitude"), (int, float)) else None,
        "longitude": location.get("longitude") if isinstance(location.get("longitude"), (int, float)) else None,
        "property_type": _text(prop.get("propertySubType"), 60),
        "bedrooms": _int(prop.get("bedrooms")),
        "bathrooms": _int(prop.get("bathrooms")),
        "tenure": _text(((prop.get("tenure") or {}).get("tenureType") or "").replace("_", " ").lower(), 30)
        if isinstance(prop.get("tenure"), dict) else None,
        "size_sqft": int(float(size.group(1).replace(",", ""))) if size else None,
        "auction": bool(prop.get("auction")),
        "new_home": bool(prop.get("development")),
        "first_listed_at": _when(prop.get("firstVisibleDate")),
        "price": int(amount) if isinstance(amount, (int, float)) and amount > 0 else None,
        "price_qualifier": _text(qualifier, 60),
        "photos": _int(prop.get("numberOfImages")),
        "floorplans": _int(prop.get("numberOfFloorplans")),
        "virtual_tours": _int(prop.get("numberOfVirtualTours")),
        "featured": bool(prop.get("featuredProperty")),
        "premium": bool(prop.get("premiumListing")),
        "status": status_of(prop.get("displayStatus")),
    }


def observe(props: Any, *, includes_agreed: bool) -> int:
    """Keep a search page's results for the next flush. Never raises and does
    no I/O, so it's safe in any search. `includes_agreed`: the search showed
    under-offer and sold-STC homes too (includeSSTC=true)."""
    global _overflow_logged
    kept = 0
    try:
        now = datetime.now(timezone.utc)
        for prop in props or []:
            row = row_from_search(prop)
            if row is None:
                continue
            key = row["rightmove_id"]
            if key not in _pending and len(_pending) >= MAX_PENDING:
                if not _overflow_logged:
                    logger.warning("Listing records: buffer full (%d); dropping until the next flush", MAX_PENDING)
                    _overflow_logged = True
                break
            previous = _pending.get(key)
            # Keep "seen in a search that shows agreed sales" if either sighting was.
            _pending[key] = (row, now, includes_agreed or bool(previous and previous[2]))
            kept += 1
    except Exception:  # noqa: BLE001 -- recording must never break a search
        logger.warning("Listing records: couldn't keep a search page", exc_info=True)
    return kept


def _new_values(row: dict[str, Any], seen: datetime, tracked: bool) -> dict[str, Any]:
    agreed = row["status"] in AGREED
    return {
        **row,
        "id": uuid.uuid4(),
        "first_price": row["price"],
        "lowest_price": row["price"],
        "reductions": 0,
        "first_seen_at": seen,
        "last_seen_at": seen,
        "last_on_market_at": None if agreed else seen,
        "tracked_on_market_at": seen if tracked and not agreed else None,
        "under_offer_at": seen if row["status"] == "under_offer" else None,
        "sold_stc_at": seen if row["status"] == "sold_stc" else None,
        "agreed_at": seen if agreed else None,
        "fell_through": 0,
        "times_seen": 1,
    }


def merge(record: MarketListing, row: dict[str, Any], seen: datetime, tracked: bool) -> None:
    """Fold a new sighting into a listing's record."""
    for key in ("branch_id", "agency", "branch_name", "outcode", "area", "latitude", "longitude", "property_type",
                "bedrooms", "bathrooms", "tenure", "size_sqft", "price_qualifier", "photos", "floorplans",
                "virtual_tours"):
        if row.get(key) is not None:
            setattr(record, key, row[key])
    for key in ("auction", "new_home", "featured", "premium"):
        setattr(record, key, bool(row.get(key)))
    if row.get("first_listed_at") and (record.first_listed_at is None or row["first_listed_at"] < _aware(record.first_listed_at)):
        record.first_listed_at = row["first_listed_at"]
    price = row.get("price")
    if price:
        if record.price and price < record.price:
            record.reductions = (record.reductions or 0) + 1
        record.price = price
        record.first_price = record.first_price or price
        record.lowest_price = min(record.lowest_price or price, price)
    status = row["status"]
    if status in AGREED:
        if status == "under_offer":
            record.under_offer_at = record.under_offer_at or seen
        else:
            record.sold_stc_at = record.sold_stc_at or seen
        record.agreed_at = record.agreed_at or seen
    else:
        if record.status in AGREED:
            record.fell_through = (record.fell_through or 0) + 1
        record.last_on_market_at = max(_aware(record.last_on_market_at) or seen, seen)
        if tracked:
            record.tracked_on_market_at = max(_aware(record.tracked_on_market_at) or seen, seen)
    record.status = status
    record.last_seen_at = max(_aware(record.last_seen_at) or seen, seen)
    record.times_seen = (record.times_seen or 0) + 1


def _aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _insert(db: AsyncSession):
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    return insert(MarketListing)


async def write(db: AsyncSession, items: dict[str, tuple[dict[str, Any], datetime, bool]]) -> dict[str, int]:
    """Add new listings and update known ones; the caller commits."""
    ids = list(items)
    existing = {
        r.rightmove_id: r
        for r in (await db.execute(select(MarketListing).where(MarketListing.rightmove_id.in_(ids)))).scalars()
    }
    new_rows = []
    for key, (row, seen, tracked) in items.items():
        record = existing.get(key)
        if record is None:
            new_rows.append(_new_values(row, seen, tracked))
        else:
            merge(record, row, seen, tracked)
    if new_rows:
        # Another worker may have added one in the meantime: its next sighting updates it.
        await db.execute(_insert(db).values(new_rows).on_conflict_do_nothing(index_elements=["rightmove_id"]))
    return {"added": len(new_rows), "updated": len(existing)}


async def flush() -> dict[str, int]:
    """Write everything buffered so far."""
    global _pending, _overflow_logged
    if not _pending:
        return {"added": 0, "updated": 0}
    items, _pending = _pending, {}
    _overflow_logged = False
    from app.db.database import AsyncSessionLocal

    totals = {"added": 0, "updated": 0}
    keys = list(items)
    for start in range(0, len(keys), FLUSH_CHUNK):
        chunk = {k: items[k] for k in keys[start:start + FLUSH_CHUNK]}
        try:
            async with AsyncSessionLocal() as db:
                out = await write(db, chunk)
                await db.commit()
            totals["added"] += out["added"]
            totals["updated"] += out["updated"]
        except Exception:  # noqa: BLE001 -- lose this chunk, keep the rest
            logger.warning("Listing records: couldn't write %d listings", len(chunk), exc_info=True)
    return totals


async def flush_forever() -> None:
    """Each web worker writes what its own searches saw, every minute."""
    while True:
        await asyncio.sleep(FLUSH_SECONDS)
        try:
            out = await flush()
            if out["added"] or out["updated"]:
                logger.info("Listing records: %d new, %d updated", out["added"], out["updated"])
        except Exception:  # noqa: BLE001
            logger.warning("Listing records flush failed", exc_info=True)


# ── Track records ─────────────────────────────────────────────────────────


def outcome(row: dict[str, Any]) -> dict[str, Any]:
    """Whether a listing agreed a sale within DECIDE_DAYS: True, False, or None
    while it can't be told yet; and the days to agree when known closely."""
    listed = _aware(row.get("first_listed_at"))
    agreed = _aware(row.get("agreed_at"))
    tracked_market = _aware(row.get("tracked_on_market_at"))
    last_market = _aware(row.get("last_on_market_at"))
    if listed is None:
        return {"within": None, "days": None}
    if agreed is not None:
        upper = max(0, (agreed - listed).days)
        precise = last_market is not None and last_market <= agreed and (agreed - last_market).days <= PRECISE_GAP_DAYS
        if upper <= DECIDE_DAYS:
            return {"within": True, "days": upper if precise else None}
        if tracked_market is not None and (tracked_market - listed).days > DECIDE_DAYS:
            return {"within": False, "days": upper if precise else None}
        return {"within": None, "days": upper if precise else None}
    if tracked_market is not None and (tracked_market - listed).days > DECIDE_DAYS:
        return {"within": False, "days": None}
    return {"within": None, "days": None}


def _pct(part: int, whole: int) -> float | None:
    return round(100 * part / whole, 1) if whole else None


def _broad(text: str | None) -> str:
    t = (text or "").lower()
    for word, broad in (("semi", "semi-detached"), ("detached", "detached"), ("terrace", "terraced"),
                        ("town house", "terraced"), ("bungalow", "bungalow"), ("flat", "flat"),
                        ("apartment", "flat"), ("maisonette", "flat")):
        if word in t:
            return broad
    return "other"


_COLUMNS = ("rightmove_id", "branch_id", "agency", "branch_name", "outcode", "area", "property_type", "bedrooms",
            "price", "first_price", "reductions", "photos", "floorplans", "virtual_tours", "status",
            "first_listed_at", "first_seen_at", "last_seen_at", "last_on_market_at", "tracked_on_market_at",
            "agreed_at", "fell_through")


async def load(db: AsyncSession, *, area: str = "", months: int = 12) -> list[dict[str, Any]]:
    q = select(*[getattr(MarketListing, c) for c in _COLUMNS])
    area = re.sub(r"[^A-Z0-9]", "", (area or "").upper())
    if area:
        q = q.where(MarketListing.outcode == area) if re.search(r"\d", area) else q.where(MarketListing.area == area)
    if months:
        since = datetime.now(timezone.utc) - timedelta(days=31 * months)
        q = q.where((MarketListing.first_listed_at >= since) | (MarketListing.last_seen_at >= since))
    rows = (await db.execute(q.limit(MAX_ROWS))).all()
    return [dict(zip(_COLUMNS, r)) for r in rows]


def compute(rows: list[dict[str, Any]], *, property_type: str = "", min_price: int | None = None,
            max_price: int | None = None, bedrooms: int | None = None, min_decided: int = MIN_DECIDED) -> dict[str, Any]:
    """Each branch's track record over `rows`, best first, and totals."""
    rows = [r for r in rows if not property_type or _broad(r.get("property_type")) == property_type]
    if min_price:
        rows = [r for r in rows if (r.get("price") or 0) >= min_price]
    if max_price:
        rows = [r for r in rows if r.get("price") and r["price"] <= max_price]
    if bedrooms:
        rows = [r for r in rows if r.get("bedrooms") == bedrooms or (bedrooms >= 5 and (r.get("bedrooms") or 0) >= 5)]

    by_branch: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        by_branch[r.get("branch_id") or "?"].append(r)

    branches = []
    for branch_id, items in by_branch.items():
        outs = [outcome(r) for r in items]
        decided = [o for o in outs if o["within"] is not None]
        within = sum(1 for o in decided if o["within"])
        days = [o["days"] for o in outs if o["days"] is not None]
        prices = [r["price"] for r in items if r.get("price")]
        latest = max(items, key=lambda r: _aware(r.get("last_seen_at")) or datetime.min.replace(tzinfo=timezone.utc))
        areas = Counter(r.get("outcode") for r in items if r.get("outcode"))
        branches.append({
            "branch_id": None if branch_id == "?" else branch_id,
            "agency": latest.get("agency"),
            "branch_name": latest.get("branch_name"),
            "main_areas": [a for a, _ in areas.most_common(3)],
            "listings": len(items),
            "for_sale_now": sum(1 for r in items if r.get("status") == "on_market"),
            "agreed_seen": sum(1 for r in items if r.get("agreed_at")),
            "decided": len(decided),
            "agreed_within_180": within,
            "share_within_180": _pct(within, len(decided)),
            "median_days_to_agree": int(statistics.median(days)) if len(days) >= 3 else None,
            "median_price": int(statistics.median(prices)) if prices else None,
            "reduced_pct": _pct(sum(1 for r in items if (r.get("reductions") or 0) > 0), len(items)),
            "fell_through": sum(r.get("fell_through") or 0 for r in items),
            "tour_pct": _pct(sum(1 for r in items if (r.get("virtual_tours") or 0) > 0),
                             sum(1 for r in items if r.get("virtual_tours") is not None)),
            "ranked": len(decided) >= min_decided,
        })
    branches.sort(key=lambda b: (not b["ranked"], -(b["share_within_180"] or 0), -b["decided"], -b["listings"]))

    outs = [outcome(r) for r in rows]
    decided = [o for o in outs if o["within"] is not None]
    now = datetime.now(timezone.utc)
    return {
        "totals": {
            "listings": len(rows),
            "branches": len([b for b in by_branch if b != "?"]),
            "agencies": len({r.get("agency") for r in rows if r.get("agency")}),
            "outcodes": len({r.get("outcode") for r in rows if r.get("outcode")}),
            "tracked": sum(1 for r in rows if r.get("tracked_on_market_at") or r.get("agreed_at")),
            "agreed_seen": sum(1 for r in rows if r.get("agreed_at")),
            "decided": len(decided),
            "share_within_180": _pct(sum(1 for o in decided if o["within"]), len(decided)),
            "ranked_branches": sum(1 for b in branches if b["ranked"]),
            "new_last_7_days": sum(1 for r in rows if (_aware(r.get("first_seen_at")) or now) >= now - timedelta(days=7)),
            "seen_last_7_days": sum(1 for r in rows if (_aware(r.get("last_seen_at")) or now - timedelta(days=30))
                                    >= now - timedelta(days=7)),
        },
        "top_areas": [{"outcode": a, "listings": c}
                      for a, c in Counter(r.get("outcode") for r in rows if r.get("outcode")).most_common(15)],
        "branches": branches[:300],
        "rules": {"decide_days": DECIDE_DAYS, "min_decided": min_decided, "precise_gap_days": PRECISE_GAP_DAYS},
    }


async def track_records(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    await flush()  # include this worker's latest sightings
    rows = await load(db, area=filters.pop("area", ""), months=filters.pop("months", 12))
    return compute(rows, **filters)
