"""Recent sold prices near a property, from HM Land Registry's Price Paid Data.

These are genuine recorded sales (England and Wales only). The comparable sold
prices shown on the assessment page, in the full report and on letters come
from here -- never from the AI, which used to invent them.

Contains HM Land Registry data (c) Crown copyright and database right, licensed
under the Open Government Licence v3.0. The attribution must be shown wherever
the data is.

Lookup: postcodes.io turns the property's postcode (or, failing that, its
outcode) into a location and the postcodes around it; one query of our own
copy of the data (land_registry_sales, kept in step with Land Registry's
yearly files by price_paid_data.py) then pulls every standard sale in those
postcodes over the last few years, and `select_comparables` keeps the few
most similar to the subject property. (Until September 2026 that query went
to Land Registry's SPARQL endpoint, which started refusing the server.)
"""
from __future__ import annotations

import asyncio
import logging
import math
import re
import time
from datetime import date, datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

POSTCODES_IO = "https://api.postcodes.io"

COMPARABLE_COUNT = 4
# Nearby-postcode search radii (metres, postcodes.io caps at 2000 / 100 postcodes),
# widened only when the closer ring doesn't have enough similar sales.
SEARCH_RADII = (600, 2000)
# Nearest postcodes per radius: enough sales in towns without widening the
# net to streets that aren't really comparable.
NEARBY_POSTCODES = 60
LOOKBACK_MONTHS = 36
PREFERRED_MONTHS = 24

USER_AGENT = "Havlo/1.0 (+https://www.heyhavlo.com; sold-price comparables)"
_RETRY_STATUSES = {429, 500, 502, 503, 504}
# A 403, or a 429 that outlasts the retries, means the service is refusing
# us. Carrying on with the next lookup only keeps the block in place, so a
# refusal pauses every request to that host from this worker for an hour.
REFUSED_PAUSE_SECONDS = 3600
_paused_until: dict[str, float] = {}


class LookupUnavailable(RuntimeError):
    """postcodes.io didn't answer properly, or our copy of Land Registry's
    data is still loading. Never cached as "no sales" -- the lookup is
    simply tried again later."""


def _host(url: str) -> str:
    return httpx.URL(url).host


def paused_for(url: str = POSTCODES_IO) -> float:
    """Seconds this worker is still holding off url's host after a refusal."""
    return max(0.0, _paused_until.get(_host(url), 0.0) - time.monotonic())


async def _request(client: httpx.AsyncClient, method: str, url: str, **kwargs: Any) -> httpx.Response:
    """One request with a couple of retries for rate limits, 5xx and network
    errors. Returns 200/404 responses; anything else raises LookupUnavailable."""
    host = _host(url)
    wait = paused_for(url)
    if wait:
        raise LookupUnavailable(f"{host} refused our requests; paused for another {wait / 60:.0f} min")
    last: str = ""
    for attempt in range(3):
        try:
            r = await client.request(method, url, **kwargs)
        except httpx.TransportError as exc:
            last = f"{type(exc).__name__}: {exc}"
        else:
            if r.status_code in (200, 404):
                return r
            last = f"HTTP {r.status_code} from {url.split('?')[0]}: {r.text[:160]!r}"
            if r.status_code == 403 or (r.status_code == 429 and attempt == 2):
                _paused_until[host] = time.monotonic() + REFUSED_PAUSE_SECONDS
                logger.warning("%s; pausing requests to %s for %d min", last, host, REFUSED_PAUSE_SECONDS // 60)
                break
            if r.status_code not in _RETRY_STATUSES:
                break
        await asyncio.sleep(2 * (attempt + 1))
    raise LookupUnavailable(last)

_UK_POSTCODE_RE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b", re.IGNORECASE)
_OUTCODE_RE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?)\b", re.IGNORECASE)

LR_TYPE_LABELS = {
    "detached": "Detached",
    "semi-detached": "Semi-detached",
    "terraced": "Terraced",
    "flat-maisonette": "Flat",
    "otherPropertyType": "Other",
}


def attribution() -> str:
    return (
        f"Contains HM Land Registry data © Crown copyright and database right {datetime.now(timezone.utc).year}. "
        "Licensed under the Open Government Licence v3.0."
    )


def lr_property_type(property_type: str | None) -> str | None:
    """Our listing's property type as a Land Registry type, or None if unclear."""
    text = (property_type or "").lower()
    if not text:
        return None
    if "semi" in text:
        return "semi-detached"
    if "detached" in text:
        return "detached"
    if any(word in text for word in ("terrace", "town house", "townhouse", "mews")):
        return "terraced"
    if any(word in text for word in ("flat", "apartment", "maisonette", "penthouse", "studio")):
        return "flat-maisonette"
    return None


def full_postcode(*texts: str | None) -> str | None:
    for text in texts:
        match = _UK_POSTCODE_RE.search(text or "")
        if match:
            return f"{match.group(1).upper()} {match.group(2).upper()}"
    return None


def outcode(*texts: str | None) -> str | None:
    """The outward code ("N1", "CF23") from a postcode, or the last one in an address."""
    for text in texts:
        pc = full_postcode(text)
        if pc:
            return pc.split()[0]
    for text in texts:
        candidates = [m.group(1).upper() for m in _OUTCODE_RE.finditer(text or "") if re.search(r"\d", m.group(1))]
        if candidates:
            return candidates[-1]
    return None


def _tidy(text: str) -> str:
    """LR data is upper case: "TY-DRAW ROAD" -> "Ty-Draw Road", "ST JOHN'S" -> "St John's"."""
    words = []
    for word in (text or "").split():
        words.append("-".join(part[:1].upper() + part[1:].lower() for part in word.split("-")))
    return " ".join(words)


def format_address(saon: str, paon: str, street: str, postcode: str) -> str:
    saon, paon, street = _tidy(saon), _tidy(paon), _tidy(street)
    if paon and street:
        line = f"{paon} {street}" if paon[:1].isdigit() else f"{paon}, {street}"
    else:
        line = paon or street
    parts = [p for p in (saon, line) if p]
    return ", ".join(parts + ([postcode] if postcode else []))


def _house_key(address: str) -> tuple[str, str] | None:
    """("6", "bronwydd avenue") from "6, Bronwydd Avenue, ..." -- to skip the subject's own past sales."""
    match = re.match(r"\s*(?:flat\s+\S+,?\s*)?(\d+[a-z]?)\s*,?\s+([a-z][a-z' -]+?)(?:,|$)", (address or "").lower())
    return (match.group(1), re.sub(r"\s+", " ", match.group(2)).strip()) if match else None


def _months_ago(when: date, today: date) -> float:
    return (today - when).days / 30.44


def select_comparables(
    sales: list[dict[str, Any]],
    *,
    asking_price: float | None,
    lr_type: str | None,
    subject_address: str,
    today: date | None = None,
    count: int = COMPARABLE_COUNT,
) -> list[dict[str, Any]]:
    """The `count` recorded sales most like the subject: same property type
    where known, closest in price, recent first. Returned newest first."""
    today = today or datetime.now(timezone.utc).date()
    subject = _house_key(subject_address)
    pool = []
    for sale in sales:
        if sale.get("category") != "standard" or not sale.get("price") or not sale.get("date"):
            continue
        if subject and _house_key(sale["address"]) == subject:
            continue
        if _months_ago(sale["date"], today) > LOOKBACK_MONTHS:
            continue
        pool.append(sale)

    def rank(sale: dict[str, Any]) -> float:
        age = _months_ago(sale["date"], today)
        price_gap = abs(math.log(sale["price"] / asking_price)) if asking_price else 0.0
        type_gap = 0.0 if not lr_type or sale["type"] == lr_type else 1.0
        stale = 0.25 if age > PREFERRED_MONTHS else 0.0
        return type_gap + price_gap + stale + age / 240

    chosen = sorted(pool, key=rank)[:count]
    chosen.sort(key=lambda s: s["date"], reverse=True)
    return chosen


async def _locate(client: httpx.AsyncClient, postcode: str | None, out: str | None) -> tuple[float, float] | None:
    """Latitude/longitude of the postcode, else of its outcode. None only when
    postcodes.io genuinely doesn't know either (404); errors raise."""
    for url in (
        f"{POSTCODES_IO}/postcodes/{postcode.replace(' ', '')}" if postcode else None,
        f"{POSTCODES_IO}/outcodes/{out}" if out else None,
    ):
        if not url:
            continue
        r = await _request(client, "GET", url)
        if r.status_code == 200:
            result = r.json().get("result") or {}
            if result.get("latitude") is not None:
                return float(result["latitude"]), float(result["longitude"])
    return None


async def _nearby_postcodes(client: httpx.AsyncClient, lat: float, lon: float, radius: int) -> list[str]:
    r = await _request(
        client, "GET", f"{POSTCODES_IO}/postcodes",
        params={"lat": lat, "lon": lon, "radius": radius, "limit": NEARBY_POSTCODES},
    )
    if r.status_code != 200:
        raise LookupUnavailable(f"postcodes.io nearby search returned HTTP {r.status_code}")
    return [item["postcode"] for item in (r.json().get("result") or []) if item.get("postcode")]



async def _recorded_sales(postcodes: list[str], since: date) -> list[dict[str, Any]]:
    from app.services import price_paid_data

    try:
        return await price_paid_data.recorded_sales(postcodes, since)
    except price_paid_data.PricePaidNotReady as exc:
        raise LookupUnavailable(str(exc)) from exc


def _client() -> httpx.AsyncClient:
    # trust_env=False: never route these through a proxy configured for the
    # marketplace scrapers; these are plain public APIs.
    return httpx.AsyncClient(
        timeout=httpx.Timeout(45.0, connect=10.0), headers={"User-Agent": USER_AGENT}, trust_env=False
    )


async def check_services() -> dict[str, Any]:
    """Can this server reach postcodes.io right now, and is our copy of Land
    Registry's data loaded? For diagnosing lookups that fail on a server but
    not locally. Status codes, error types, the start of any error page, and
    counts only."""
    from app.services import price_paid_data

    results: dict[str, Any] = {}
    started = time.monotonic()
    try:
        async with _client() as client:
            r = await client.get(f"{POSTCODES_IO}/postcodes/SW1A1AA")
        results["postcodes_io"] = {"status": r.status_code, "ms": int((time.monotonic() - started) * 1000)}
        if r.status_code != 200:
            results["postcodes_io"]["body"] = " ".join(r.text.split())[:300]
    except Exception as exc:  # noqa: BLE001 -- reporting it is the point
        results["postcodes_io"] = {"error": f"{type(exc).__name__}: {str(exc)[:200]}", "ms": int((time.monotonic() - started) * 1000)}
    try:
        results["price_paid_data"] = await price_paid_data.status()
    except Exception as exc:  # noqa: BLE001
        results["price_paid_data"] = {"error": f"{type(exc).__name__}: {str(exc)[:200]}"}
    return results


def to_stored(sale: dict[str, Any]) -> dict[str, Any]:
    return {
        "address": sale["address"],
        "property_type": LR_TYPE_LABELS.get(sale["type"], "Other"),
        "price": sale["price"],
        "date": sale["date"].isoformat(),
    }


async def find_sold_comparables(
    *,
    postcode: str | None,
    address: str,
    property_type: str | None,
    asking_price: float | None,
) -> list[dict[str, Any]]:
    """Up to COMPARABLE_COUNT recorded sales similar to the subject, as
    {address, property_type, price, date}. [] when the area has none (or
    isn't covered, e.g. Scotland). Raises on network/service failure so the
    caller can retry later instead of caching an empty result."""
    from app.services import price_paid_data

    if not await price_paid_data.ready():
        # Before any postcodes.io calls: they'd be wasted.
        raise LookupUnavailable("Land Registry price paid data is still loading")
    pc = full_postcode(postcode, address)
    out = outcode(postcode, address)
    lr_type = lr_property_type(property_type)
    today = datetime.now(timezone.utc).date()
    since = date(today.year - LOOKBACK_MONTHS // 12, today.month, 1)
    async with _client() as client:
        location = await _locate(client, pc, out)
        if location is None:
            return []
        chosen: list[dict[str, Any]] = []
        seen: set[str] = set()
        sales: list[dict[str, Any]] = []
        for radius in SEARCH_RADII:
            nearby = [p for p in await _nearby_postcodes(client, *location, radius) if p not in seen]
            if pc and pc not in seen and pc not in nearby:
                nearby.insert(0, pc)
            seen.update(nearby)
            if nearby:
                sales += await _recorded_sales(nearby, since)
            chosen = select_comparables(sales, asking_price=asking_price, lr_type=lr_type, subject_address=address, today=today)
            same_type = [s for s in chosen if not lr_type or s["type"] == lr_type]
            if len(same_type) >= COMPARABLE_COUNT:
                break
    return [to_stored(s) for s in chosen]
