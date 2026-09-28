"""The 90-day monitoring dashboard that comes with a purchased report.

Once a report is bought, the property gets a StaleListingMonitor:

  * its Rightmove listing is re-read daily, and each change (price, photos,
    floorplan, video tour, description, key features, featured placement,
    agent, under offer / sold STC / removed) becomes a "listing" event --
    these also tick the matching checklist items automatically;
  * the homes for sale within half a mile (a mile if that's thin) are read
    weekly: new listings, price cuts and homes going under offer or sold
    STC become "nearby" events, with a market summary then vs now;
  * new HM Land Registry sales in the property's postcode sector (our own
    copy of the price paid data) become "nearby" events too;
  * the customer ticks off what they've done that can't be seen on the
    listing ("customer" events).

The dashboard link is texted once, soon after purchase (8am-7pm UK, never
after an SMS opt-out), and is also on the report page. After 90 days the
checks stop and the dashboard stays viewable as a summary.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import random
import re
import secrets
import statistics
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.models import (
    LandRegistrySale,
    StaleListingMonitor,
    StaleListingMonitorEvent,
    StaleListingProspect,
)
from app.services import listing_scraper, twilio_service
from app.services.rightmove_scraper import _parse_next_data, build_proxied_request
from app.services.stale_prospect_abandonment import _within_sms_send_window
from app.services.stale_prospect_service import current_report_json, hash_access_token

logger = logging.getLogger(__name__)

MONITOR_DAYS = 90
LISTING_CHECK_EVERY = timedelta(hours=24)
NEARBY_CHECK_EVERY = timedelta(days=7)
SOLD_CHECK_EVERY = timedelta(days=7)
RETRY_AFTER_FAILURE = timedelta(hours=6)
# Purchases older than this when their monitor is created (i.e. before the
# dashboard existed) get one without the text.
SMS_MAX_PURCHASE_AGE = timedelta(days=2)
SMS_GIVE_UP_AFTER = timedelta(days=3)
_CHECKS_PER_CYCLE = 20
_RM = "https://www.rightmove.co.uk"
NEARBY_RADII = (0.5, 1.0)
NEARBY_MIN_LISTINGS = 8
NEARBY_PAGES = 2
NEARBY_PAGE_SIZE = 24


class ListingGone(Exception):
    """Rightmove says the listing no longer exists."""


# ── Tokens ────────────────────────────────────────────────────────────────


def new_token() -> str:
    return secrets.token_urlsafe(15)  # 20 characters, short enough to text


def issue_token(monitor: StaleListingMonitor, *, share: bool = False) -> str:
    token = new_token()
    token_hash = hash_access_token(token)
    if share:
        monitor.share_token_hashes = [*(monitor.share_token_hashes or []), token_hash]
    else:
        monitor.token_hashes = [*(monitor.token_hashes or []), token_hash]
    return token


async def find_by_token(db: AsyncSession, token: str) -> tuple[StaleListingMonitor, bool] | None:
    """(monitor, read_only) for a dashboard link, or None."""
    token = (token or "").strip()
    if not token:
        return None
    token_hash = hash_access_token(token)
    monitor = (await db.execute(
        select(StaleListingMonitor).where(StaleListingMonitor.token_hashes.contains([token_hash]))
    )).scalar_one_or_none()
    if monitor is not None:
        return monitor, False
    monitor = (await db.execute(
        select(StaleListingMonitor).where(StaleListingMonitor.share_token_hashes.contains([token_hash]))
    )).scalar_one_or_none()
    return (monitor, True) if monitor is not None else None


def public_base() -> str:
    base = (get_settings().FRONTEND_URL or "https://www.heyhavlo.com").rstrip("/")
    return "https://www.heyhavlo.com" if "localhost" in base or "127.0.0.1" in base else base


def dashboard_url(token: str) -> str:
    return f"{public_base()}/m/{token}"


# ── Reading the listing ───────────────────────────────────────────────────


def _resolved(data: list, index: Any, depth: int = 0) -> Any:
    """One value from Rightmove's flat PAGE_MODEL format (data[0] is the
    top-level schema; every dict value and list item is an index into
    data), resolved all the way down."""
    value = data[index] if isinstance(index, int) and 0 <= index < len(data) else index
    if depth > 12:
        return None
    if isinstance(value, dict):
        return {k: _resolved(data, v, depth + 1) for k, v in value.items()}
    if isinstance(value, list):
        return [_resolved(data, v, depth + 1) for v in value]
    return value


def property_data_from_page(html: str) -> dict[str, Any] | None:
    page_model = listing_scraper._extract_js_var(html, "PAGE_MODEL")
    if not page_model:
        return None
    if page_model.get("encoding") == "on" and page_model.get("data"):
        try:
            data = json.loads(page_model["data"])
        except ValueError:
            return None
        if not isinstance(data, list) or not data or not isinstance(data[0], dict) or "propertyData" not in data[0]:
            return None
        prop = _resolved(data, data[0]["propertyData"])
    else:
        prop = page_model.get("propertyData")
    return prop if isinstance(prop, dict) else None


def _price_number(text: Any) -> int | None:
    digits = re.sub(r"[^\d]", "", str(text or ""))
    return int(digits) if digits else None


def _media_id(url: str) -> str:
    """Stable id for a Rightmove photo: its file name (a content hash)."""
    name = (url or "").rstrip("/").rsplit("/", 1)[-1]
    name = re.sub(r"_max_\d+x\d+", "", name)
    return name.rsplit(".", 1)[0]


def status_from(tags: Any, display_status: Any = "") -> str | None:
    """on_market / under_offer / sold_stc from Rightmove's page tags or
    search-result displayStatus; None when neither says."""
    words = " ".join([*(str(t) for t in (tags or [])), str(display_status or "")]).upper().replace(" ", "_")
    if "SOLD" in words:
        return "sold_stc"
    if "OFFER" in words:
        return "under_offer"
    return "on_market" if tags is not None else None


def _text(value: Any) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(value or ""))).strip()


def listing_state(prop: dict[str, Any]) -> dict[str, Any]:
    """What we track on a listing, from its resolved propertyData."""
    prices = prop.get("prices") or {}
    text = prop.get("text") or {}
    mis = prop.get("misInfo") or {}
    status = prop.get("status") or {}
    location = prop.get("location") or {}
    address = prop.get("address") or {}
    customer = prop.get("customer") or {}
    images = [img.get("url") for img in (prop.get("images") or []) if isinstance(img, dict) and img.get("url")]
    description = _text(text.get("description"))
    removed = bool(status.get("archived")) or status.get("published") is False
    return {
        "price": _price_number(prices.get("primaryPrice")),
        "price_text": _text(prices.get("primaryPrice")),
        "price_qualifier": _text(prices.get("displayPriceQualifier")),
        "status": "removed" if removed else (status_from(prop.get("tags") or []) or "on_market"),
        "images": [_media_id(u) for u in images],
        "main_image": images[0] if images else "",
        "image_count": len(images),
        "floorplans": len([f for f in (prop.get("floorplans") or []) if f]),
        "virtual_tours": len([v for v in (prop.get("virtualTours") or []) if v]),
        "brochures": len([b for b in (prop.get("brochures") or []) if b]),
        "description_hash": hashlib.sha1(description.lower().encode()).hexdigest()[:16] if description else "",
        "description_words": len(description.split()),
        "features": [_text(f) for f in (prop.get("keyFeatures") or []) if _text(f)][:20],
        "featured": bool(mis.get("featuredProperty")),
        "premium": bool(mis.get("premiumDisplay")),
        "branch_id": str(mis.get("branchId") or customer.get("branchId") or ""),
        "agent": _text(customer.get("branchDisplayName") or customer.get("brandTradingName") or customer.get("companyName")),
        "listing_update": _text((prop.get("listingHistory") or {}).get("listingUpdateReason")),
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "postcode": listing_scraper._combine_postcode(address.get("outcode"), address.get("incode")),
        "bedrooms": prop.get("bedrooms"),
        "property_type": _text(prop.get("propertySubType")),
    }


async def fetch_listing_state(url: str) -> dict[str, Any]:
    try:
        html = await listing_scraper._fetch(url.split("#")[0], referer=f"{_RM}/", max_retries=2)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (404, 410):
            raise ListingGone() from exc
        raise
    prop = property_data_from_page(html)
    if prop is None:
        # Rightmove sends withdrawn listings to a "no longer available" page.
        if "no longer available" in html.lower() or "property-removed" in html.lower():
            raise ListingGone()
        raise RuntimeError("No listing data on the page (blocked or changed layout)")
    return listing_state(prop)


def _money(n: int | None) -> str:
    return f"£{n:,}" if n is not None else "—"


def diff_listing(prev: dict[str, Any], cur: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """Changes between two listing states, as (kind, data)."""
    events: list[tuple[str, dict[str, Any]]] = []
    p0, p1 = prev.get("price"), cur.get("price")
    if p0 and p1 and p0 != p1:
        change = p1 - p0
        events.append(("price_reduced" if change < 0 else "price_increased", {
            "from": p0, "to": p1, "change": change, "percent": round(100 * change / p0, 1),
        }))
    elif prev.get("price_qualifier") != cur.get("price_qualifier") and cur.get("price_qualifier") is not None and prev.get("price_qualifier") is not None:
        events.append(("price_wording_changed", {"from": prev.get("price_qualifier") or "", "to": cur.get("price_qualifier") or ""}))

    before, after = prev.get("images") or [], cur.get("images") or []
    added = [i for i in after if i not in before]
    removed = [i for i in before if i not in after]
    main_changed = bool(before and after and before[0] != after[0])
    if added or removed or main_changed:
        events.append(("photos_updated", {
            "added": len(added), "removed": len(removed), "total": len(after),
            "new_lead_photo": main_changed, "main_image": cur.get("main_image") or "",
        }))

    for field, kind in (("floorplans", "floorplan_added"), ("virtual_tours", "virtual_tour_added"), ("brochures", "brochure_added")):
        if (cur.get(field) or 0) > (prev.get(field) or 0):
            events.append((kind, {"count": cur.get(field)}))

    if prev.get("description_hash") and cur.get("description_hash") and prev["description_hash"] != cur["description_hash"]:
        events.append(("description_updated", {"words_before": prev.get("description_words"), "words_after": cur.get("description_words")}))

    f0, f1 = prev.get("features") or [], cur.get("features") or []
    if f0 != f1 and (f0 or f1):
        events.append(("features_updated", {
            "added": [f for f in f1 if f not in f0][:6], "removed": [f for f in f0 if f not in f1][:6],
        }))

    if cur.get("featured") and not prev.get("featured"):
        events.append(("featured_added", {}))
    if cur.get("premium") and not prev.get("premium"):
        events.append(("premium_added", {}))

    if prev.get("branch_id") and cur.get("branch_id") and prev["branch_id"] != cur["branch_id"]:
        events.append(("agent_changed", {"from": prev.get("agent") or "", "to": cur.get("agent") or ""}))

    s0, s1 = prev.get("status") or "on_market", cur.get("status") or "on_market"
    if s0 != s1:
        if s1 == "under_offer":
            events.append(("status_under_offer", {}))
        elif s1 == "sold_stc":
            events.append(("status_sold_stc", {}))
        elif s1 == "removed":
            events.append(("listing_removed", {}))
        elif s0 == "removed":
            events.append(("listing_relisted", {}))
        else:
            events.append(("back_on_market", {"from": s0}))
    return events


# ── Nearby homes ──────────────────────────────────────────────────────────


async def _get(client: httpx.AsyncClient, url: str) -> httpx.Response:
    request_url, params, headers = build_proxied_request(url)
    return await client.get(request_url, params=params, headers=headers, follow_redirects=True,
                            timeout=60 if params else 25)


def location_id_from_typeahead(body: str, kind: str) -> str | None:
    """Rightmove's location lookup answers JSON or XML depending on the
    Accept header (which a proxy may not pass on)."""
    try:
        matches = json.loads(body).get("matches") or []
        for match in matches:
            if match.get("type") == kind and match.get("id"):
                return f"{kind}^{match['id']}"
        return None
    except (ValueError, AttributeError):
        found = re.search(rf"<id>([^<]+)</id>\s*<type>{kind}</type>", body or "")
        return f"{kind}^{found.group(1)}" if found else None


async def resolve_location_id(client: httpx.AsyncClient, postcode: str) -> str | None:
    postcode = (postcode or "").upper().strip()
    candidates = [(postcode, "POSTCODE")] if " " in postcode else []
    if postcode:
        candidates.append((postcode.split(" ")[0], "OUTCODE"))
    for query, kind in candidates:
        url = f"https://los.rightmove.co.uk/typeahead?query={query.replace(' ', '%20')}&limit=10"
        response = await _get(client, url)
        if response.status_code == 200:
            location = location_id_from_typeahead(response.text, kind)
            if location:
                return location
    return None


def nearby_row(prop: dict[str, Any]) -> dict[str, Any] | None:
    rm_id = str(prop.get("id") or "").strip()
    if not rm_id:
        return None
    price = (prop.get("price") or {}).get("amount")
    update = prop.get("listingUpdate") or {}
    images = prop.get("propertyImages") or {}
    url = prop.get("propertyUrl") or f"/properties/{rm_id}"
    return {
        "id": rm_id,
        "address": _text(prop.get("displayAddress")),
        "price": int(price) if isinstance(price, (int, float)) and price else None,
        "bedrooms": prop.get("bedrooms") if isinstance(prop.get("bedrooms"), int) else None,
        "type": _text(prop.get("propertySubType")),
        "status": status_from(None, prop.get("displayStatus")) or "on_market",
        "update": _text(update.get("listingUpdateReason")),
        "update_date": _text(update.get("listingUpdateDate"))[:10],
        "first_listed": _text(prop.get("firstVisibleDate"))[:10],
        "distance": round(float(prop.get("distance")), 2) if isinstance(prop.get("distance"), (int, float)) else None,
        "url": url if url.startswith("http") else f"{_RM}{url}",
        "image": _text(images.get("mainImageSrc") or images.get("mainImageUrl")),
    }


async def fetch_nearby(client: httpx.AsyncClient, location_id: str, radius: float) -> list[dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for page in range(NEARBY_PAGES):
        url = (
            f"{_RM}/property-for-sale/find.html?searchType=SALE&locationIdentifier={location_id}"
            f"&radius={radius}&sortType=6&includeSSTC=true&index={page * NEARBY_PAGE_SIZE}"
        )
        response = await _get(client, url)
        response.raise_for_status()
        props = _parse_next_data(response.text)
        for prop in props:
            row = nearby_row(prop)
            if row:
                rows.setdefault(row["id"], row)
        if len(props) < NEARBY_PAGE_SIZE:
            break
    return list(rows.values())


def broad_type(text: str) -> str:
    t = (text or "").lower()
    for word in ("semi", "detached", "terrace", "flat", "apartment", "bungalow", "maisonette"):
        if word in t:
            return {"apartment": "flat", "maisonette": "flat"}.get(word, word)
    return t


def is_similar(row: dict[str, Any], bedrooms: Any, property_type: str) -> bool:
    beds_ok = not isinstance(bedrooms, int) or not isinstance(row.get("bedrooms"), int) or abs(row["bedrooms"] - bedrooms) <= 1
    return beds_ok and (not property_type or broad_type(row.get("type") or "") == broad_type(property_type))


def market_pulse(rows: list[dict[str, Any]]) -> dict[str, Any]:
    prices = [r["price"] for r in rows if r.get("price") and r.get("status") == "on_market"]
    return {
        "for_sale": len([r for r in rows if r.get("status") == "on_market"]),
        "under_offer_or_sold": len([r for r in rows if r.get("status") in ("under_offer", "sold_stc")]),
        "reduced": len([r for r in rows if r.get("update") == "price_reduced" and r.get("status") == "on_market"]),
        "median_price": int(statistics.median(prices)) if prices else None,
    }


def diff_nearby(prev: list[dict[str, Any]], cur: list[dict[str, Any]], *, since: str) -> list[tuple[str, dict[str, Any]]]:
    """New listings, price cuts and homes going under offer / sold STC
    between two nearby snapshots. `since` (YYYY-MM-DD) guards against a home
    merely appearing because the search window moved."""
    before = {r["id"]: r for r in prev}
    events: list[tuple[str, dict[str, Any]]] = []
    for row in cur:
        old = before.get(row["id"])
        if old is None:
            if (row.get("first_listed") or "") >= since:
                events.append(("nearby_new", row))
            continue
        if old.get("price") and row.get("price") and row["price"] < old["price"]:
            events.append(("nearby_reduced", {**row, "from": old["price"], "change": row["price"] - old["price"]}))
        if row.get("status") != old.get("status") and row.get("status") in ("under_offer", "sold_stc"):
            events.append(("nearby_under_offer" if row["status"] == "under_offer" else "nearby_sold_stc", row))
    return events


# ── Recorded sales (Land Registry) ────────────────────────────────────────

_LR_TYPES = {"D": "Detached", "S": "Semi-detached", "T": "Terraced", "F": "Flat", "O": "Other"}


def postcode_sector(postcode: str) -> str | None:
    """"M30 9HE" -> "M30 9"."""
    pc = re.sub(r"\s+", " ", (postcode or "").upper().strip())
    return pc[:-2] if re.fullmatch(r"[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}", pc) else None


async def recent_sales(db: AsyncSession, postcode: str, *, months: int = 12, limit: int = 60) -> list[dict[str, Any]]:
    sector = postcode_sector(postcode)
    if not sector:
        return []
    since = datetime.now(timezone.utc).date() - timedelta(days=30 * months)
    sale = LandRegistrySale
    rows = (await db.execute(
        select(sale.transaction_id, sale.paon, sale.saon, sale.street, sale.postcode, sale.price, sale.sale_date, sale.property_type)
        .where(sale.postcode >= sector, sale.postcode < f"{sector}ZZZ", sale.postcode.like(f"{sector}%"))
        .where(sale.sale_date >= since)
        .order_by(sale.sale_date.desc())
        .limit(limit)
    )).all()
    out = []
    for tid, paon, saon, street, pc, price, sale_date, ptype in rows:
        address = ", ".join(part for part in (" ".join(p for p in (saon, paon) if p), (street or "").title(), pc) if part)
        out.append({"id": str(tid), "address": address, "price": price, "date": sale_date.isoformat(), "type": _LR_TYPES.get(ptype, "")})
    return out


# ── Monitors ──────────────────────────────────────────────────────────────


def _loads(text: str | None, default: Any) -> Any:
    try:
        return json.loads(text) if text else default
    except ValueError:
        return default


def _add_event(db: AsyncSession, monitor: StaleListingMonitor, scope: str, kind: str, data: dict[str, Any], at: datetime) -> None:
    db.add(StaleListingMonitorEvent(monitor_id=monitor.id, scope=scope, kind=kind, detected_at=at, data_json=json.dumps(data)))


def rightmove_listing_id(url: str | None) -> str:
    found = re.search(r"/properties/(\d+)", url or "")
    return found.group(1) if found else ""


async def create_monitor(db: AsyncSession, prospect: StaleListingProspect, *, now: datetime | None = None) -> StaleListingMonitor:
    """The caller commits. Purchases from before the dashboard existed are
    marked not to be texted."""
    now = now or datetime.now(timezone.utc)
    started = prospect.unlocked_at or now
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    monitor = StaleListingMonitor(
        prospect_id=prospect.id,
        started_at=started,
        ends_at=started + timedelta(days=MONITOR_DAYS),
        next_listing_check_at=now,
        sms_status="not_texted" if now - started > SMS_MAX_PURCHASE_AGE else None,
    )
    db.add(monitor)
    await db.flush()
    return monitor


async def get_or_create_monitor(db: AsyncSession, prospect: StaleListingProspect) -> StaleListingMonitor:
    monitor = (await db.execute(
        select(StaleListingMonitor).where(StaleListingMonitor.prospect_id == prospect.id)
    )).scalar_one_or_none()
    return monitor or await create_monitor(db, prospect)


async def ensure_monitors(now: datetime) -> int:
    """A monitor for every purchased UK property still inside its 90 days."""
    async with AsyncSessionLocal() as db:
        existing = select(StaleListingMonitor.prospect_id)
        prospects = (await db.execute(
            select(StaleListingProspect)
            .where(StaleListingProspect.unlocked_at.is_not(None))
            .where(StaleListingProspect.unlocked_at >= now - timedelta(days=MONITOR_DAYS))
            .where(StaleListingProspect.rightmove_url.ilike("%rightmove.co.uk/properties/%"))
            .where(StaleListingProspect.id.not_in(existing))
            .limit(200)
        )).scalars().all()
        for prospect in prospects:
            await create_monitor(db, prospect, now=now)
        await db.commit()
    return len(prospects)


def short_address(address: str) -> str:
    parts = [p.strip() for p in (address or "").split(",") if p.strip()]
    return ", ".join(parts[:2])[:48] or "your property"


async def send_dashboard_texts(now: datetime) -> int:
    """The one text with the dashboard link, for each new monitor."""
    if not _within_sms_send_window(now):
        return 0
    sent = 0
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(StaleListingMonitor, StaleListingProspect)
            .join(StaleListingProspect, StaleListingProspect.id == StaleListingMonitor.prospect_id)
            .where(StaleListingMonitor.sms_status.is_(None))
            .limit(50)
        )).all()
        for monitor, prospect in rows:
            if prospect.sms_unsubscribed_at is not None:
                monitor.sms_status = "opted_out"
                continue
            phone = twilio_service.normalize_to_e164(prospect.contact_phone or "")
            if not phone:
                monitor.sms_status = "no_phone"
                continue
            token = issue_token(monitor)
            await db.commit()
            ok = await asyncio.to_thread(
                twilio_service.send_monitor_dashboard_sms, phone,
                address=short_address(prospect.property_address), link=dashboard_url(token),
            )
            if ok:
                monitor.sms_status, monitor.sms_sent_at = "sent", now
                sent += 1
            elif now - monitor.created_at > SMS_GIVE_UP_AFTER:
                monitor.sms_status = "failed"
            await db.commit()
        await db.commit()
    return sent


async def check_monitor(monitor_id: UUID, now: datetime) -> dict[str, Any]:
    """One round of checks for one monitor: the listing, and (weekly) the
    homes nearby and recorded sales."""
    async with AsyncSessionLocal() as db:
        monitor = await db.get(StaleListingMonitor, monitor_id)
        prospect = await db.get(StaleListingProspect, monitor.prospect_id) if monitor else None
        if monitor is None or prospect is None:
            return {"skipped": True}
        result: dict[str, Any] = {"events": 0}
        latest = _loads(monitor.latest_json, None)

        # The listing.
        try:
            try:
                state = await fetch_listing_state(prospect.rightmove_url)
            except ListingGone:
                state = {**(latest or {}), "status": "removed"}
            if latest is None:
                monitor.baseline_json = monitor.baseline_json or json.dumps(state)
            else:
                for kind, data in diff_listing(latest, state):
                    _add_event(db, monitor, "listing", kind, data, now)
                    result["events"] += 1
            monitor.latest_json = json.dumps(state)
            monitor.listing_status = state.get("status") or "on_market"
            monitor.last_listing_check_at = now
            monitor.check_failures = 0
            monitor.last_error = None
            monitor.next_listing_check_at = now + LISTING_CHECK_EVERY + timedelta(minutes=random.randint(0, 60))
            latest = state
        except Exception as exc:  # noqa: BLE001
            monitor.check_failures += 1
            monitor.last_error = f"listing: {type(exc).__name__}: {exc}"[:500]
            monitor.next_listing_check_at = now + RETRY_AFTER_FAILURE
            logger.warning("Listing monitor %s: listing check failed: %s", monitor.id, exc)
        await db.commit()

        postcode = (latest or {}).get("postcode") or prospect.postcode or ""

        # Homes for sale nearby, weekly.
        if monitor.last_nearby_check_at is None or now - monitor.last_nearby_check_at >= NEARBY_CHECK_EVERY:
            try:
                async with httpx.AsyncClient(headers=listing_scraper._browser_headers(f"{_RM}/")) as client:
                    if not monitor.rightmove_location_id:
                        monitor.rightmove_location_id = await resolve_location_id(client, postcode)
                    if monitor.rightmove_location_id:
                        previous = _loads(monitor.nearby_json, None)
                        radius = (previous or {}).get("radius")
                        rows: list[dict[str, Any]] = []
                        for r in ([radius] if radius else NEARBY_RADII):
                            rows = await fetch_nearby(client, monitor.rightmove_location_id, r)
                            radius = r
                            if len(rows) > NEARBY_MIN_LISTINGS:
                                break
                        own_id = rightmove_listing_id(prospect.rightmove_url)
                        own = next((x for x in rows if x["id"] == own_id), None)
                        rows = [x for x in rows if x["id"] != own_id]
                        snapshot = {"checked_at": now.isoformat(), "radius": radius, "listings": rows, "pulse": market_pulse(rows)}
                        if previous is None:
                            monitor.nearby_baseline_json = json.dumps({k: snapshot[k] for k in ("checked_at", "radius", "pulse")})
                        else:
                            since = (monitor.last_nearby_check_at or now).date().isoformat()
                            for kind, data in diff_nearby(previous.get("listings") or [], rows, since=since):
                                _add_event(db, monitor, "nearby", kind, data, now)
                                result["events"] += 1
                        monitor.nearby_json = json.dumps(snapshot)
                        # The search can see under offer / sold STC before the page does.
                        if own and own.get("status") in ("under_offer", "sold_stc") and monitor.listing_status == "on_market":
                            _add_event(db, monitor, "listing", "status_" + own["status"], {}, now)
                            monitor.listing_status = own["status"]
                            if latest is not None:
                                monitor.latest_json = json.dumps({**latest, "status": own["status"]})
                    monitor.last_nearby_check_at = now
            except Exception as exc:  # noqa: BLE001
                monitor.last_error = f"nearby: {type(exc).__name__}: {exc}"[:500]
                logger.warning("Listing monitor %s: nearby check failed: %s", monitor.id, exc)
            await db.commit()

        # Recorded sales in the postcode sector, weekly.
        if monitor.last_sold_check_at is None or now - monitor.last_sold_check_at >= SOLD_CHECK_EVERY:
            try:
                sales = await recent_sales(db, postcode)
                seen = set(monitor.seen_sale_ids or [])
                if monitor.last_sold_check_at is not None:
                    for sale in sales:
                        if sale["id"] not in seen:
                            _add_event(db, monitor, "nearby", "nearby_sold", sale, now)
                            result["events"] += 1
                monitor.seen_sale_ids = list(seen | {s["id"] for s in sales})
                monitor.last_sold_check_at = now
            except Exception as exc:  # noqa: BLE001
                logger.warning("Listing monitor %s: sold prices check failed: %s", monitor.id, exc)
            await db.commit()
        return result


async def run_monitor_cycle() -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    created = await ensure_monitors(now)
    texted = await send_dashboard_texts(now)
    async with AsyncSessionLocal() as db:
        due = (await db.execute(
            select(StaleListingMonitor.id)
            .where(StaleListingMonitor.ends_at > now)
            .where(or_(StaleListingMonitor.next_listing_check_at.is_(None), StaleListingMonitor.next_listing_check_at <= now))
            .order_by(StaleListingMonitor.next_listing_check_at.asc().nulls_first())
            .limit(_CHECKS_PER_CYCLE)
        )).scalars().all()
    events = 0
    for monitor_id in due:
        events += (await check_monitor(monitor_id, datetime.now(timezone.utc))).get("events", 0)
        await asyncio.sleep(2)
    return {"created": created, "texted": texted, "checked": len(due), "events": events}


# ── What the customer sees ────────────────────────────────────────────────

# Checklist items we can see happen on the listing, and the ones only the
# customer can tell us about. A report's own action_plan items are mapped
# onto these by keyword, so ticking is shared.
CATALOGUE: tuple[dict[str, Any], ...] = (
    {"key": "price", "title": "Review the asking price with your agent", "detects": ("price_reduced",),
     "keywords": ("price", "pricing", "valuation", "reduc")},
    {"key": "photos", "title": "Refresh the photos, starting with the lead image", "detects": ("photos_updated",),
     "keywords": ("photo", "image", "photograph", "visual")},
    {"key": "description", "title": "Rewrite the listing description", "detects": ("description_updated",),
     "keywords": ("description", "copy", "wording", "headline", "narrative")},
    {"key": "features", "title": "Sharpen the key features", "detects": ("features_updated",),
     "keywords": ("key feature", "bullet")},
    {"key": "floorplan", "title": "Add a floorplan", "detects": ("floorplan_added",),
     "keywords": ("floorplan", "floor plan"), "unless": "floorplans"},
    {"key": "virtual_tour", "title": "Add a video or virtual tour", "detects": ("virtual_tour_added",),
     "keywords": ("video", "virtual", "tour"), "unless": "virtual_tours"},
    {"key": "featured", "title": "Boost the listing with a featured or premium placement", "detects": ("featured_added", "premium_added"),
     "keywords": ("featured", "premium listing", "boost")},
    {"key": "staging", "title": "Declutter and stage the main rooms", "detects": (),
     "keywords": ("stag", "declutter", "presentation", "kerb")},
    {"key": "viewing_feedback", "title": "Get written feedback after every viewing", "detects": (),
     "keywords": ("feedback", "viewing")},
    {"key": "neighbourhood", "title": "Have your agent leaflet neighbouring homes", "detects": (),
     "keywords": ("neighbour", "leaflet", "flyer")},
    {"key": "buyer_profiles", "title": "Market to investors, landlords and relocation buyers", "detects": (),
     "keywords": ("investor", "landlord", "buyer profile", "relocation")},
)
_BY_KEY = {item["key"]: item for item in CATALOGUE}
PRIORITY_ORDER = {"URGENT": 0, "HIGH": 1, "MEDIUM": 2}


def _catalogue_key_for(text: str, taken: set[str]) -> str | None:
    lower = text.lower()
    for item in CATALOGUE:
        if item["key"] not in taken and any(word in lower for word in item["keywords"]):
            return item["key"]
    return None


def build_checklist(report: dict[str, Any], baseline: dict[str, Any] | None, events: list[dict[str, Any]],
                    ticks: dict[str, Any]) -> list[dict[str, Any]]:
    """The report's own actions first (by priority), then the rest of the
    catalogue, each done if seen on the listing or ticked by the customer."""
    baseline = baseline or {}
    detected: dict[str, str] = {}
    for event in sorted(events, key=lambda e: e["at"]):
        detected.setdefault(event["kind"], event["at"])
    items: list[dict[str, Any]] = []
    taken: set[str] = set()
    actions = [a for a in (report.get("action_plan") or []) if isinstance(a, dict) and a.get("priority")]
    actions.sort(key=lambda a: PRIORITY_ORDER.get(str(a.get("priority")).upper(), 3))
    for index, action in enumerate(actions):
        title = _text(action.get("title"))
        if not title:
            continue
        key = _catalogue_key_for(f"{title} {action.get('description') or ''}", taken)
        if key:
            taken.add(key)
        items.append({
            "key": key or f"report_{index}",
            "title": title,
            "detail": _text(action.get("description")),
            "priority": str(action.get("priority")).upper(),
            "source": "report",
            "detects": list(_BY_KEY[key]["detects"]) if key else [],
        })
    for item in CATALOGUE:
        if item["key"] in taken:
            continue
        if item.get("unless") and (baseline.get(item["unless"]) or 0) > 0:
            continue  # already had one on day 0
        items.append({"key": item["key"], "title": item["title"], "detail": "", "priority": None,
                      "source": "havlo", "detects": list(item["detects"])})
    for item in items:
        seen_at = next((detected[k] for k in item["detects"] if k in detected), None)
        tick = ticks.get(item["key"]) or {}
        item["auto"] = bool(item["detects"])
        if seen_at:
            item.update(done=True, done_by="detected", done_at=seen_at)
        elif tick.get("done"):
            item.update(done=True, done_by="you", done_at=tick.get("at"))
        else:
            item.update(done=False, done_by=None, done_at=None)
        del item["detects"]
    return items


PHASES = (
    {"title": "Fix the fundamentals", "days": (1, 30)},
    {"title": "Build momentum", "days": (31, 60)},
    {"title": "Decide the next move", "days": (61, 90)},
)
LATER_WEEKS = (
    (5, "Review the first month's enquiries and viewings"),
    (6, "Act on viewing feedback"),
    (7, "Reach buyers beyond the portals"),
    (8, "Refresh the lead photo and headline"),
    (9, "Compare against what's selling nearby"),
    (10, "Take the next pricing step if interest is flat"),
    (11, "Review your agent's results"),
    (12, "Decide: hold, relaunch or change approach"),
    (13, "Your 90-day review"),
)


def build_plan(report: dict[str, Any], day: int, checklist: list[dict[str, Any]]) -> dict[str, Any]:
    first_month = {int(w.get("week")): _text(w.get("title")) for w in (report.get("thirty_day_plan") or [])
                   if isinstance(w, dict) and str(w.get("week") or "").isdigit() and _text(w.get("title"))}
    defaults = {1: "Act on the urgent recommendations", 2: "Fix the listing's presentation",
                3: "Widen where the listing is seen", 4: "Check what's changed"}
    weeks = [{"week": w, "title": first_month.get(w) or defaults[w]} for w in range(1, 5)]
    weeks += [{"week": w, "title": t} for w, t in LATER_WEEKS]
    current_week = min(max((day - 1) // 7 + 1, 1), 13)
    urgent = [c for c in checklist if c.get("priority") in ("URGENT", "HIGH")]
    rest = [c for c in checklist if c not in urgent]
    tasks = {
        0: urgent or checklist[:4],
        1: [c for c in rest if c["key"] in ("viewing_feedback", "neighbourhood", "buyer_profiles", "photos", "staging")]
           or rest[:4],
        2: [],
    }
    phases = []
    for index, phase in enumerate(PHASES):
        start, end = phase["days"]
        phases.append({
            "title": phase["title"], "start_day": start, "end_day": end,
            "current": start <= day <= end,
            # A week belongs to the phase holding most of its days.
            "weeks": [w for w in weeks if start <= (w["week"] - 1) * 7 + 4 <= end],
            "tasks": [{"key": c["key"], "title": c["title"], "done": c["done"]} for c in tasks[index]],
        })
    pricing = _text(report.get("pricing_recommendation"))
    phases[2]["notes"] = [
        "If there's still no offer, compare your price and presentation against the homes nearby that went under offer.",
        *( [f"The report's pricing advice: {pricing}"] if pricing else [] ),
        "Talk to us about a relaunch: a fresh start with new photos, copy and targeted buyer campaigns.",
    ]
    return {"current_week": current_week, "weeks": weeks, "phases": phases}


STATUS_LABELS = {"on_market": "On the market", "under_offer": "Under offer", "sold_stc": "Sold STC", "removed": "No longer listed"}


def next_step(checklist: list[dict[str, Any]], status: str, ended: bool) -> dict[str, str]:
    if status == "sold_stc":
        return {"title": "Keep the sale moving", "detail": "Ask your agent for a weekly update on the buyer's mortgage, survey and solicitors until exchange."}
    if status == "under_offer":
        return {"title": "Protect the offer", "detail": "Keep viewings going until the sale is agreed, and ask your agent how the buyer is progressing."}
    if ended:
        return {"title": "Plan what's next", "detail": "Your 90 days are up. Book a call and we'll go through what's worked and what to change."}
    todo = next((c for c in checklist if not c["done"]), None)
    if todo:
        return {"title": todo["title"], "detail": todo["detail"] or "Tick it off here once it's done, or we'll spot it on your listing."}
    return {"title": "Review your results with your agent", "detail": "Everything on your checklist is done. Ask your agent for this week's views, enquiries and viewings."}


def _event_json(event: StaleListingMonitorEvent) -> dict[str, Any]:
    return {"id": str(event.id), "scope": event.scope, "kind": event.kind,
            "at": event.detected_at.isoformat(), "data": _loads(event.data_json, {})}


async def dashboard(db: AsyncSession, monitor: StaleListingMonitor, *, read_only: bool,
                    now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    prospect = await db.get(StaleListingProspect, monitor.prospect_id)
    report = _loads(current_report_json(prospect), {}) or {}
    snapshot = _loads(prospect.listing_snapshot_json, {}) or {}
    baseline = _loads(monitor.baseline_json, None)
    latest = _loads(monitor.latest_json, None) or baseline
    events = [_event_json(e) for e in (await db.execute(
        select(StaleListingMonitorEvent)
        .where(StaleListingMonitorEvent.monitor_id == monitor.id)
        .order_by(StaleListingMonitorEvent.detected_at.desc())
    )).scalars().all()]
    ticks = _loads(monitor.checklist_json, {}) or {}
    checklist = build_checklist(report, baseline, [e for e in events if e["scope"] == "listing"], ticks)

    ended = now >= monitor.ends_at
    day = min(max((min(now, monitor.ends_at) - monitor.started_at).days + 1, 1), MONITOR_DAYS)
    listed = prospect.listed_date
    days_on_market = (now.date() - listed.date()).days if listed else prospect.listing_duration_days
    start_price = (baseline or {}).get("price") or (int(prospect.asking_price) if prospect.asking_price else None)
    now_price = (latest or {}).get("price") or start_price
    status = monitor.listing_status or "on_market"

    nearby = _loads(monitor.nearby_json, None)
    nearby_start = _loads(monitor.nearby_baseline_json, None)
    rows = (nearby or {}).get("listings") or []
    beds = prospect.bedrooms
    ptype = prospect.property_type or (latest or {}).get("property_type") or ""
    for row in rows:
        row["similar"] = is_similar(row, beds, ptype)
    rows.sort(key=lambda r: (not r["similar"], r.get("distance") if r.get("distance") is not None else 99))
    sales = await recent_sales(db, (latest or {}).get("postcode") or prospect.postcode or "", limit=12)

    listing_events = [e for e in events if e["scope"] in ("listing", "customer")]
    nearby_events = [e for e in events if e["scope"] == "nearby"]
    week_ago = now - timedelta(days=7)
    alerts = [e for e in events if e["scope"] != "customer" and datetime.fromisoformat(e["at"]) > week_ago][:5]

    image = (latest or {}).get("main_image") or snapshot.get("image") or ((snapshot.get("images") or [None])[0])
    payload: dict[str, Any] = {
        "read_only": read_only,
        "audience": prospect.audience,
        "property": {
            "address": prospect.property_address,
            "postcode": prospect.postcode,
            "image": image,
            "rightmove_url": prospect.rightmove_url,
            "bedrooms": beds,
            "property_type": ptype,
            "agent": prospect.agent_brand or prospect.agent_company_name,
            "agent_branch": prospect.agent_branch_name,
        },
        "contact_first_name": ((prospect.contact_name or "").split(" ")[0] or None) if not read_only else None,
        "day": day,
        "total_days": MONITOR_DAYS,
        "started_at": monitor.started_at.isoformat(),
        "ends_at": monitor.ends_at.isoformat(),
        "ended": ended,
        "last_checked_at": monitor.last_listing_check_at.isoformat() if monitor.last_listing_check_at else None,
        "headline": {
            "status": status,
            "status_label": STATUS_LABELS.get(status, status),
            "price_start": start_price,
            "price_now": now_price,
            "price_change": (now_price - start_price) if (now_price and start_price) else 0,
            "price_text": (latest or {}).get("price_text") or (_money(now_price) if now_price else None),
            "price_qualifier": (latest or {}).get("price_qualifier") or "",
            "days_on_market": days_on_market,
            "listing_changes": len([e for e in events if e["scope"] == "listing"]),
            "actions_done": len([c for c in checklist if c["done"]]),
            "actions_total": len(checklist),
            "photos": (latest or {}).get("image_count"),
            "floorplans": (latest or {}).get("floorplans"),
            "virtual_tours": (latest or {}).get("virtual_tours"),
        },
        "baseline": {k: (baseline or {}).get(k) for k in ("price", "image_count", "floorplans", "virtual_tours", "description_words", "featured")} if baseline else None,
        "next_step": next_step(checklist, status, ended),
        "alerts": alerts,
        "timeline": listing_events,
        "checklist": checklist,
        "plan": build_plan(report, day, checklist),
        "nearby": {
            "checked_at": (nearby or {}).get("checked_at"),
            "radius": (nearby or {}).get("radius"),
            "pulse_now": (nearby or {}).get("pulse"),
            "pulse_start": (nearby_start or {}).get("pulse"),
            "events": nearby_events[:40],
            "listings": rows[:12],
            "sold": sales,
        },
    }
    if ended:
        payload["summary"] = {
            "price_start": start_price, "price_end": now_price, "status": status,
            "listing_changes": payload["headline"]["listing_changes"],
            "actions_done": payload["headline"]["actions_done"], "actions_total": len(checklist),
            "nearby_new": len([e for e in nearby_events if e["kind"] == "nearby_new"]),
            "nearby_reduced": len([e for e in nearby_events if e["kind"] == "nearby_reduced"]),
            "nearby_agreed": len([e for e in nearby_events if e["kind"] in ("nearby_under_offer", "nearby_sold_stc")]),
            "nearby_sold": len([e for e in nearby_events if e["kind"] == "nearby_sold"]),
        }
    return payload


async def set_checklist_item(db: AsyncSession, monitor: StaleListingMonitor, key: str, done: bool,
                             title: str, now: datetime | None = None) -> None:
    """The caller commits."""
    now = now or datetime.now(timezone.utc)
    ticks = _loads(monitor.checklist_json, {}) or {}
    ticks[key] = {"done": bool(done), "at": now.isoformat()}
    monitor.checklist_json = json.dumps(ticks)
    if done:
        _add_event(db, monitor, "customer", "checklist_done", {"key": key, "title": title}, now)
    else:
        events = (await db.execute(
            select(StaleListingMonitorEvent)
            .where(StaleListingMonitorEvent.monitor_id == monitor.id)
            .where(StaleListingMonitorEvent.scope == "customer")
        )).scalars().all()
        stale = [e.id for e in events if _loads(e.data_json, {}).get("key") == key]
        if stale:
            await db.execute(delete(StaleListingMonitorEvent).where(StaleListingMonitorEvent.id.in_(stale)))
