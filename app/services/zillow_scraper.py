"""Zillow (United States) scraping for the America stale-prospects console.

Zillow sits behind PerimeterX: a plain datacenter request (Railway's outbound
IP) gets a 403 captcha page. Every fetch here therefore goes through the
residential proxy configured in ZILLOW_SCRAPER_PROXY_URL (falling back to
MARKETPLACE_SCRAPER_PROXY_URL), using curl_cffi's Chrome TLS impersonation
when installed -- PerimeterX also fingerprints the TLS handshake, which
Python's stock HTTP stacks fail even from a residential IP.

Search pages and listing pages both embed their full data as JSON in
`__NEXT_DATA__`; nothing here parses rendered HTML.
"""
from __future__ import annotations

import asyncio
import html as html_lib
import json
import logging
import os
import random
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote, urlparse

import httpx

try:  # Optional: falls back to httpx (works only if the proxy itself unblocks Zillow).
    from curl_cffi import requests as curl_requests
except Exception:  # pragma: no cover - import guard
    curl_requests = None

logger = logging.getLogger(__name__)

ZILLOW_BASE = "https://www.zillow.com"
# Rotated per-session (not per-request) below -- a real browser's TLS/JS
# fingerprint stays fixed for the life of one visit, so picking a new one on
# every GET would itself be an inhuman signal. Diversity happens across
# sessions instead.
_IMPERSONATE_PROFILES = [
    p.strip() for p in os.getenv("ZILLOW_IMPERSONATE", "chrome124,chrome120,chrome119,edge101").split(",") if p.strip()
]
_PHOTO_BASE = "https://photos.zillowstatic.com/fp/{key}-p_e.jpg"

# Zillow caps a search at 20 pages regardless of result count.
MAX_SEARCH_PAGES = 20
# Zillow lists ~41 homes/page, so a search is only fully reachable when its
# total stays under this; callers bisect price bands to get below it.
MAX_REACHABLE_RESULTS = 800


class ZillowBlockedError(RuntimeError):
    """Zillow served a bot-protection page instead of the requested data."""


class ZillowNotFoundError(RuntimeError):
    pass


class ZillowCircuitOpenError(RuntimeError):
    """A session hit too many consecutive blocks. Stop -- retrying harder
    into an active block just burns proxy credits and makes a longer-lived
    ban on that identity more likely, it doesn't get past it."""


def proxy_url(session_id: str | None = None) -> str:
    """The configured proxy URL, with an optional per-session sticky-IP token
    substituted in.

    Most residential-proxy providers (Bright Data, Oxylabs, Webshare, IPRoyal,
    SOAX) support "sticky sessions": embedding an arbitrary session token in
    the proxy username keeps that token pinned to one exit IP for a few
    minutes, e.g. `user-session-{session}:pass@host:port`. Without this, every
    request through a rotating pool gets a random IP -- meaning one
    ZillowSession's cookies/fingerprint would be presented from a different
    IP on every single request, which is a much stronger tell than a
    consistent identity ever using a shared IP. If ZILLOW_SCRAPER_PROXY_URL
    contains the literal string "{session}", it's replaced with a fresh
    random token here so one IP maps to one ZillowSession's whole lifetime,
    and the next session (next scan run) gets a different one. Providers
    without sticky-session support, or a URL with no "{session}" placeholder
    at all, are unaffected -- this is purely additive templating.
    """
    raw = (os.getenv("ZILLOW_SCRAPER_PROXY_URL") or os.getenv("MARKETPLACE_SCRAPER_PROXY_URL") or "").strip()
    if raw and "{session}" in raw:
        token = session_id or f"{random.randint(0, 999_999_999):09d}"
        raw = raw.replace("{session}", token)
    return raw


def proxy_configured() -> bool:
    return bool(proxy_url())


_http_sem: asyncio.Semaphore | None = None


def _semaphore() -> asyncio.Semaphore:
    global _http_sem
    if _http_sem is None:
        try:
            limit = max(1, min(8, int(os.getenv("ZILLOW_HTTP_CONCURRENCY", "3"))))
        except ValueError:
            limit = 3
        _http_sem = asyncio.Semaphore(limit)
    return _http_sem


_BROWSER_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Upgrade-Insecure-Requests": "1",
}


def is_blocked_page(text: str) -> bool:
    head = (text or "")[:4000].lower()
    return "px-captcha" in head or "access to this page has been denied" in head or "_pxappid" in head


def _min_request_interval() -> float:
    try:
        return max(0.0, float(os.getenv("ZILLOW_MIN_REQUEST_INTERVAL_SECONDS", "2.5")))
    except ValueError:
        return 2.5


def _circuit_breaker_limit() -> int:
    try:
        return max(1, int(os.getenv("ZILLOW_CIRCUIT_BREAKER_BLOCKS", "3")))
    except ValueError:
        return 3


class ZillowSession:
    """One persistent scraping identity: a single cookie jar and a fixed
    browser fingerprint held for the life of a whole discovery run, instead
    of a brand-new, cookie-less HTTP client on every single request (the
    previous version of this module). PerimeterX scores a *visitor*, not a
    URL -- looking like the same returning visitor across many requests
    (shared cookies, one consistent fingerprint, human-paced timing, and a
    plain city page loaded before any filtered/paginated one) is what
    actually differs from a scripted client, not any one clever header.

    Also tracks consecutive blocks so a run can back off hard, or stop
    itself outright via ZillowCircuitOpenError, instead of hammering
    retries into an identity PerimeterX has already flagged -- confirmed
    live in this codebase's own development: a handful of rapid requests
    through one browser session was enough to trigger PerimeterX's
    interactive "Press & Hold" human-verification challenge. This module
    never attempts to solve that or any other CAPTCHA/bot-check -- when one
    appears, the only correct response is to stop and back off, which is
    exactly what the circuit breaker below does.
    """

    def __init__(self) -> None:
        self.impersonate = random.choice(_IMPERSONATE_PROFILES) if _IMPERSONATE_PROFILES else "chrome124"
        # One sticky-IP token for this session's whole lifetime -- see
        # proxy_url()'s docstring. Harmless no-op if the configured proxy
        # URL has no "{session}" placeholder.
        self.session_id = f"{random.randint(0, 999_999_999):09d}"
        proxy = proxy_url(session_id=self.session_id)
        self._curl_session = (
            curl_requests.AsyncSession(
                impersonate=self.impersonate,
                proxies={"http": proxy, "https": proxy} if proxy else None,
                timeout=45,
            )
            if curl_requests is not None
            else None
        )
        self._httpx_client = (
            None
            if self._curl_session is not None
            else httpx.AsyncClient(
                follow_redirects=True, timeout=45, cookies=httpx.Cookies(),
                **({"proxy": proxy} if proxy else {}),
            )
        )
        self._warmed_up: set[str] = set()
        self._last_request_monotonic = 0.0
        self._lock = asyncio.Lock()
        self.consecutive_blocks = 0

    async def aclose(self) -> None:
        if self._curl_session is not None:
            await self._curl_session.close()
        if self._httpx_client is not None:
            await self._httpx_client.aclose()

    async def __aenter__(self) -> "ZillowSession":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()

    async def _pace(self) -> None:
        """Human-ish, randomized gap since this session's last request --
        real browsing has think-time between page loads; a scraper with none
        is itself a detectable pattern regardless of fingerprint quality."""
        async with self._lock:
            min_interval = _min_request_interval()
            elapsed = asyncio.get_event_loop().time() - self._last_request_monotonic
            wait = min_interval - elapsed + random.uniform(0, min_interval * 0.6)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_request_monotonic = asyncio.get_event_loop().time()

    async def _raw_request(self, url: str) -> tuple[int, str]:
        """The actual network call, with no pacing -- split out from _get
        purely so tests can mock just the transport and still exercise real
        pacing/retry/circuit-breaker behaviour."""
        async with _semaphore():
            if self._curl_session is not None:
                response = await self._curl_session.get(url, headers=_BROWSER_HEADERS, allow_redirects=True)
                return response.status_code, response.text
            response = await self._httpx_client.get(
                url,
                headers={
                    **_BROWSER_HEADERS,
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                    ),
                },
            )
            return response.status_code, response.text

    async def _get(self, url: str) -> tuple[int, str]:
        await self._pace()
        return await self._raw_request(url)

    async def warm_up(self, region_slug: str) -> None:
        """Load the plain, unfiltered city page once before this session ever
        requests a filtered/paginated URL for it -- a real visitor lands on
        the city page and applies filters from there; jumping straight to a
        constructed `searchQueryState` deep link is itself a scripted-looking
        pattern (confirmed live: this exact jump is what triggered the
        Press & Hold challenge during development). Best-effort: a failed
        warm-up still lets the real request proceed and surface its own
        (more informative) error."""
        if region_slug in self._warmed_up:
            return
        self._warmed_up.add(region_slug)
        try:
            await self.fetch_html(f"{ZILLOW_BASE}/{region_slug}/", attempts=1)
        except Exception as exc:
            logger.info("Zillow warm-up fetch failed for %s (continuing anyway): %s", region_slug, exc)

    async def fetch_html(self, url: str, attempts: int = 3) -> str:
        """GET `url` through this session, retrying transient failures with
        backoff. A confirmed bot-protection block gets a much longer backoff
        than a plain network error (retrying instantly into an active block
        is pointless and looks even more like a script), and enough
        consecutive blocks trip the circuit breaker rather than continuing
        to retry at all.
        """
        if self.consecutive_blocks >= _circuit_breaker_limit():
            raise ZillowCircuitOpenError(
                f"Zillow blocked {self.consecutive_blocks} consecutive requests on this session -- stopping "
                "rather than continuing to retry into an active block."
            )
        last_exc: Exception = RuntimeError("no attempt made")
        for attempt in range(attempts):
            try:
                status, text = await self._get(url)
            except Exception as exc:  # network/proxy failure
                last_exc = exc
                blocked = False
            else:
                if status == 404:
                    self.consecutive_blocks = 0
                    raise ZillowNotFoundError(f"Zillow returned 404 for {url}")
                if status == 200 and not is_blocked_page(text):
                    self.consecutive_blocks = 0
                    return text
                blocked = status in (403, 429) or is_blocked_page(text)
                if blocked:
                    last_exc = ZillowBlockedError(
                        f"Zillow bot protection blocked the request (HTTP {status})"
                        + ("" if proxy_configured() else " -- ZILLOW_SCRAPER_PROXY_URL is not set")
                    )
                else:
                    last_exc = RuntimeError(f"Zillow returned HTTP {status}")
            if blocked:
                self.consecutive_blocks += 1
                if self.consecutive_blocks >= _circuit_breaker_limit():
                    raise ZillowCircuitOpenError(
                        f"Zillow blocked {self.consecutive_blocks} consecutive requests on this session -- "
                        "stopping rather than continuing to retry into an active block."
                    ) from last_exc
            if attempt < attempts - 1:
                # Confirmed block: a long, escalating cool-down (this identity
                # is actively flagged right now). Plain network hiccup: the
                # original short backoff is enough.
                delay = (8.0 * (attempt + 1) if blocked else 1.5 * (attempt + 1)) + random.uniform(0, 2.0)
                await asyncio.sleep(delay)
        raise last_exc


def open_session() -> ZillowSession:
    return ZillowSession()


async def fetch_html(url: str, attempts: int = 3) -> str:
    """One-off convenience wrapper for a single isolated fetch (manual-add,
    a lone CSV row) -- opens a throwaway session, uses it once, closes it.
    High-volume callers (the discovery scan) should open one ZillowSession
    and reuse it across every request instead, for the cookie/pacing/
    circuit-breaker benefits described on ZillowSession itself."""
    async with ZillowSession() as session:
        return await session.fetch_html(url, attempts=attempts)


# ── JSON extraction ──────────────────────────────────────────────────────────

_NEXT_DATA_RE = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)
_SHARED_STORE_RE = re.compile(r"<!--(&#123;.*?&#125;|\{.*?\})-->", re.S)


def parse_next_data(html: str) -> dict[str, Any] | None:
    match = _NEXT_DATA_RE.search(html or "")
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
    except (json.JSONDecodeError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _search_state(html: str) -> dict[str, Any] | None:
    """The searchPageState object, from __NEXT_DATA__ or, failing that, from
    the inline data-store comment older/alternate page shells use."""
    data = parse_next_data(html)
    if data:
        state = ((data.get("props") or {}).get("pageProps") or {}).get("searchPageState")
        if isinstance(state, dict):
            return state
    for match in _SHARED_STORE_RE.finditer(html or ""):
        raw = html_lib.unescape(match.group(1))
        if '"cat1"' not in raw:
            continue
        try:
            blob = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(blob, dict) and "cat1" in blob:
            return blob
        if isinstance(blob, dict) and isinstance(blob.get("searchPageState"), dict):
            return blob["searchPageState"]
    return None


# ── Field helpers ────────────────────────────────────────────────────────────

_HOME_TYPE_LABELS = {
    "SINGLE_FAMILY": "Single Family",
    "TOWNHOUSE": "Townhouse",
    "MULTI_FAMILY": "Multi Family",
    "CONDO": "Condo",
    "APARTMENT": "Apartment",
    "MANUFACTURED": "Manufactured",
    "LOT": "Land",
    "LAND": "Land",
}


def home_type_label(raw: Any) -> str:
    key = str(raw or "").strip().upper()
    return _HOME_TYPE_LABELS.get(key) or key.replace("_", " ").title()


def target_home_types() -> set[str]:
    raw = os.getenv("US_STALE_LISTINGS_HOME_TYPES", "SINGLE_FAMILY")
    return {part.strip().upper() for part in raw.split(",") if part.strip()}


def is_target_home_type(raw: Any) -> bool:
    key = str(raw or "").strip().upper().replace(" ", "_")
    return key in target_home_types()


def _num(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r"[^\d.]", "", str(value))
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def _int_or_none(value: Any) -> int | None:
    number = _num(value)
    return int(number) if number is not None else None


def _clean(value: Any, max_len: int = 500) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:max_len]


_ZPID_RE = re.compile(r"/(\d+)_zpid", re.I)


def zpid_from_url(url: str) -> str | None:
    match = _ZPID_RE.search(url or "")
    return match.group(1) if match else None


def normalize_zillow_url(raw: str) -> str:
    """Canonical listing URL: https, www, no query/fragment. Anything that
    isn't a Zillow homedetails URL is returned stripped but otherwise as-is so
    the caller's own validation can reject it."""
    text = (raw or "").strip()
    if not text:
        return text
    if not re.match(r"^https?://", text, re.I):
        text = "https://" + text.lstrip("/")
    parsed = urlparse(text)
    host = (parsed.netloc or "").lower()
    if host.endswith("zillow.com"):
        path = parsed.path if parsed.path.endswith("/") else parsed.path + "/"
        return f"https://www.zillow.com{path}"
    return text


def is_zillow_url(url: str) -> bool:
    host = (urlparse(url or "").netloc or "").lower()
    return host.endswith("zillow.com") and zpid_from_url(url) is not None


def format_usd(amount: float | None) -> str:
    return f"${amount:,.0f}" if amount else ""


def days_from_search_item(item: dict[str, Any], home_info: dict[str, Any]) -> int | None:
    days = home_info.get("daysOnZillow")
    if isinstance(days, (int, float)) and days >= 0:
        return int(days)
    time_ms = home_info.get("timeOnZillow")
    if isinstance(time_ms, (int, float)) and time_ms > 0:
        return int(time_ms // 86_400_000)
    text = _clean(((item.get("variableData") or {}) if isinstance(item.get("variableData"), dict) else {}).get("text"))
    match = re.search(r"(\d+)\s+days?\s+on\s+zillow", text, re.I)
    return int(match.group(1)) if match else None


def _photo_keys(item: dict[str, Any]) -> list[str]:
    composable = item.get("carouselPhotosComposable")
    if not isinstance(composable, dict):
        return []
    base = composable.get("baseUrl") or _PHOTO_BASE
    urls = []
    for entry in composable.get("photoData") or []:
        key = entry.get("photoKey") if isinstance(entry, dict) else None
        if key:
            urls.append(base.replace("{photoKey}", key))
    return urls


# ── Search results ───────────────────────────────────────────────────────────

@dataclass(slots=True)
class ZillowListing:
    zpid: str
    url: str
    address: str
    street: str
    city: str
    state: str
    zipcode: str
    price: float | None
    home_type: str
    beds: int | None
    baths: float | None
    sqft: int | None
    days_on_zillow: int | None
    image: str
    images: list[str] = field(default_factory=list)
    price_reduced: bool = False
    status_text: str = ""
    broker: str = ""


@dataclass(slots=True)
class SearchPage:
    listings: list[ZillowListing]
    total_results: int
    total_pages: int


def listing_from_search_item(item: dict[str, Any]) -> ZillowListing | None:
    if not isinstance(item, dict):
        return None
    home_info = ((item.get("hdpData") or {}).get("homeInfo") or {}) if isinstance(item.get("hdpData"), dict) else {}
    zpid = _clean(item.get("zpid") or item.get("id") or home_info.get("zpid"), 40)
    if not zpid:
        return None
    detail_url = _clean(item.get("detailUrl"), 1000)
    if detail_url.startswith("/"):
        detail_url = ZILLOW_BASE + detail_url
    if not detail_url:
        detail_url = f"{ZILLOW_BASE}/homedetails/{zpid}_zpid/"

    street = _clean(item.get("addressStreet") or home_info.get("streetAddress"), 200)
    city = _clean(item.get("addressCity") or home_info.get("city"), 100)
    state = _clean(item.get("addressState") or home_info.get("state"), 10)
    zipcode = _clean(item.get("addressZipcode") or home_info.get("zipcode"), 12)
    address = _clean(item.get("address"), 300) or ", ".join(
        part for part in (street, city, f"{state} {zipcode}".strip()) if part
    )

    price = _num(item.get("unformattedPrice")) or _num(home_info.get("price")) or _num(item.get("price"))
    images = _photo_keys(item)
    image = _clean(item.get("imgSrc"), 1000) or (images[0] if images else "")
    if image and image not in images:
        images.insert(0, image)

    status_type = _clean(item.get("statusType") or home_info.get("homeStatus"), 40).upper()
    return ZillowListing(
        zpid=zpid,
        url=normalize_zillow_url(detail_url),
        address=address,
        street=street,
        city=city,
        state=state,
        zipcode=zipcode,
        price=price,
        home_type=_clean(home_info.get("homeType"), 40).upper(),
        beds=_int_or_none(item.get("beds") if item.get("beds") is not None else home_info.get("bedrooms")),
        baths=_num(item.get("baths") if item.get("baths") is not None else home_info.get("bathrooms")),
        sqft=_int_or_none(item.get("area") if item.get("area") is not None else home_info.get("livingArea")),
        days_on_zillow=days_from_search_item(item, home_info),
        image=image,
        images=images[:12],
        price_reduced=bool(home_info.get("priceReduction") or home_info.get("priceChange")),
        status_text=status_type or _clean(item.get("statusText"), 40),
        broker=_clean(item.get("brokerName"), 120),
    )


def parse_search_results(html: str) -> SearchPage:
    state = _search_state(html)
    if not state:
        raise ValueError("Zillow search page had no embedded search data")
    cat1 = state.get("cat1") or {}
    results = (cat1.get("searchResults") or {}).get("listResults") or []
    search_list = cat1.get("searchList") or {}
    listings = [listing for item in results if (listing := listing_from_search_item(item))]
    total = _int_or_none(search_list.get("totalResultCount")) or len(listings)
    pages = _int_or_none(search_list.get("totalPages")) or 1
    return SearchPage(listings=listings, total_results=total, total_pages=min(pages, MAX_SEARCH_PAGES))


def build_search_url(region_slug: str, page: int, min_price: int, max_price: int | None) -> str:
    """Zillow's own search URL: regional slug + `searchQueryState`.

    Sorted by "Newest" so the longest-listed homes sit on the LAST pages (a
    search is capped at 20 pages, so callers keep each band under
    MAX_REACHABLE_RESULTS). Excludes non-house types server-side; callers still
    re-check homeType/price/days locally because this JSON is Zillow's
    internal contract and is not guaranteed stable.
    """
    price: dict[str, int] = {"min": int(min_price)}
    if max_price:
        price["max"] = int(max_price)
    filter_state = {
        "sort": {"value": "days"},
        "price": price,
        "tow": {"value": False},
        "mf": {"value": False},
        "con": {"value": False},
        "land": {"value": False},
        "apa": {"value": False},
        "apco": {"value": False},
        "manu": {"value": False},
        "fsbo": {"value": False},
        "cmsn": {"value": False},
    }
    query_state = {
        "pagination": {"currentPage": page} if page > 1 else {},
        "filterState": filter_state,
        "isMapVisible": False,
        "isListVisible": True,
    }
    path = f"/{region_slug.strip('/')}/" + (f"{page}_p/" if page > 1 else "")
    return f"{ZILLOW_BASE}{path}?searchQueryState={quote(json.dumps(query_state, separators=(',', ':')))}"


async def fetch_search_page(
    region_slug: str, page: int, min_price: int, max_price: int | None, session: ZillowSession | None = None
) -> SearchPage:
    url = build_search_url(region_slug, page, min_price, max_price)
    if session is not None:
        await session.warm_up(region_slug)
        html = await session.fetch_html(url)
    else:
        html = await fetch_html(url)
    return parse_search_results(html)


# Big-metro search slugs. `zillow.com/<slug>/` is Zillow's own city URL form.
SEARCH_REGIONS: list[tuple[str, str]] = [
    ("New York, NY", "new-york-ny"),
    ("Los Angeles, CA", "los-angeles-ca"),
    ("Chicago, IL", "chicago-il"),
    ("Houston, TX", "houston-tx"),
    ("Phoenix, AZ", "phoenix-az"),
    ("Philadelphia, PA", "philadelphia-pa"),
    ("San Antonio, TX", "san-antonio-tx"),
    ("San Diego, CA", "san-diego-ca"),
    ("Dallas, TX", "dallas-tx"),
    ("Austin, TX", "austin-tx"),
    ("San Jose, CA", "san-jose-ca"),
    ("Jacksonville, FL", "jacksonville-fl"),
    ("Fort Worth, TX", "fort-worth-tx"),
    ("Columbus, OH", "columbus-oh"),
    ("Charlotte, NC", "charlotte-nc"),
    ("San Francisco, CA", "san-francisco-ca"),
    ("Indianapolis, IN", "indianapolis-in"),
    ("Seattle, WA", "seattle-wa"),
    ("Denver, CO", "denver-co"),
    ("Washington, DC", "washington-dc"),
    ("Boston, MA", "boston-ma"),
    ("Nashville, TN", "nashville-tn"),
    ("Las Vegas, NV", "las-vegas-nv"),
    ("Portland, OR", "portland-or"),
    ("Atlanta, GA", "atlanta-ga"),
    ("Miami, FL", "miami-fl"),
    ("Tampa, FL", "tampa-fl"),
    ("Orlando, FL", "orlando-fl"),
    ("Minneapolis, MN", "minneapolis-mn"),
    ("Sacramento, CA", "sacramento-ca"),
    ("Raleigh, NC", "raleigh-nc"),
    ("Kansas City, MO", "kansas-city-mo"),
    ("Salt Lake City, UT", "salt-lake-city-ut"),
    ("Scottsdale, AZ", "scottsdale-az"),
    ("Naples, FL", "naples-fl"),
    ("Santa Barbara, CA", "santa-barbara-ca"),
    ("Newport Beach, CA", "newport-beach-ca"),
    ("Greenwich, CT", "greenwich-ct"),
    ("Westport, CT", "westport-ct"),
    ("Palm Beach, FL", "palm-beach-fl"),
]


def regions_for_request(names: list[str] | None) -> list[tuple[str, str]]:
    """Match requested names against SEARCH_REGIONS (by label or slug); any
    unmatched entry that looks like a slug ("boise-id") is used as-is so the
    admin can target a market that isn't in the built-in list."""
    if not names:
        return list(SEARCH_REGIONS)
    known = {label.lower(): (label, slug) for label, slug in SEARCH_REGIONS}
    known.update({slug: (label, slug) for label, slug in SEARCH_REGIONS})
    picked: list[tuple[str, str]] = []
    for raw in names:
        key = raw.strip().lower()
        if not key:
            continue
        if key in known:
            picked.append(known[key])
        elif re.fullmatch(r"[a-z0-9\-]+-[a-z]{2}", key):
            picked.append((raw.strip(), key))
    return picked or list(SEARCH_REGIONS)


# ── Listing (detail) pages ───────────────────────────────────────────────────

def _iter_dicts(node: Any):
    stack = [node]
    while stack:
        current = stack.pop()
        if isinstance(current, dict):
            yield current
            stack.extend(current.values())
        elif isinstance(current, list):
            stack.extend(current)


def _find_property(data: dict[str, Any]) -> dict[str, Any] | None:
    """The listing's `property` object. Zillow nests it under
    componentProps.gdpClientCache (a JSON *string* keyed by query) on current
    pages; the deep search is the fallback for any reshuffle of that path."""
    component = ((data.get("props") or {}).get("pageProps") or {}).get("componentProps") or {}
    cache = component.get("gdpClientCache")
    if isinstance(cache, str):
        try:
            cache = json.loads(cache)
        except (json.JSONDecodeError, ValueError):
            cache = None
    if isinstance(cache, dict):
        for value in cache.values():
            prop = value.get("property") if isinstance(value, dict) else None
            if isinstance(prop, dict) and prop.get("zpid"):
                return prop
    for candidate in _iter_dicts(data):
        if candidate.get("zpid") and candidate.get("homeType") and (
            candidate.get("streetAddress") or candidate.get("address")
        ):
            return candidate
    return None


def _detail_photos(prop: dict[str, Any]) -> list[str]:
    urls: list[str] = []
    for photo in prop.get("responsivePhotos") or prop.get("photos") or []:
        sources = ((photo or {}).get("mixedSources") or {}) if isinstance(photo, dict) else {}
        variants = sources.get("jpeg") or sources.get("webp") or []
        usable = [v for v in variants if isinstance(v, dict) and v.get("url")]
        if not usable:
            continue
        under = [v for v in usable if (_int_or_none(v.get("width")) or 0) <= 1100]
        best = max(under or usable, key=lambda v: _int_or_none(v.get("width")) or 0)
        if best["url"] not in urls:
            urls.append(best["url"])
    return urls[:12]


def _detail_features(prop: dict[str, Any]) -> list[str]:
    features: list[str] = []
    for fact in (prop.get("resoFacts") or {}).get("atAGlanceFacts") or prop.get("homeFacts", {}).get("atAGlanceFacts") or []:
        if isinstance(fact, dict):
            label, value = _clean(fact.get("factLabel"), 60), _clean(fact.get("factValue"), 80)
            if label and value and value.lower() != "no data":
                features.append(f"{label}: {value}")
    sqft = _int_or_none(prop.get("livingArea"))
    if sqft:
        features.append(f"Living area: {sqft:,} sqft")
    return features[:12]


def _price_reduced_from_detail(prop: dict[str, Any]) -> bool:
    if _num(prop.get("priceChange")) and _num(prop.get("priceChange")) < 0:  # type: ignore[operator]
        return True
    if prop.get("priceReduction"):
        return True
    for event in prop.get("priceHistory") or []:
        if not isinstance(event, dict):
            continue
        rate = _num(event.get("priceChangeRate"))
        if "price change" in str(event.get("event") or "").lower() and (rate is None or rate < 0):
            return True
    return False


def scraped_from_property(prop: dict[str, Any], url: str) -> dict[str, Any]:
    nested = prop.get("address") if isinstance(prop.get("address"), dict) else {}
    street = _clean(prop.get("streetAddress") or nested.get("streetAddress"), 200)
    city = _clean(prop.get("city") or nested.get("city"), 100)
    state = _clean(prop.get("state") or nested.get("state"), 10)
    zipcode = _clean(prop.get("zipcode") or nested.get("zipcode"), 12)
    address = ", ".join(part for part in (street, city, f"{state} {zipcode}".strip()) if part)

    price = _num(prop.get("price"))
    days = prop.get("daysOnZillow")
    days = int(days) if isinstance(days, (int, float)) and days >= 0 else None
    if days is None and isinstance(prop.get("timeOnZillow"), (int, float)) and prop["timeOnZillow"] > 0:
        days = int(prop["timeOnZillow"] // 86_400_000)
    listed_date = ""
    if days is not None:
        listed_date = (datetime.now(timezone.utc) - timedelta(days=days)).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()
    else:
        listed_date = _clean(prop.get("datePostedString") or prop.get("datePosted"), 40)

    images = _detail_photos(prop)
    return {
        "title": address,
        "address": address,
        "postcode": zipcode,
        "price": format_usd(price),
        "image": images[0] if images else "",
        "images": images,
        "bedrooms": _int_or_none(prop.get("bedrooms")) or "",
        "bathrooms": _int_or_none(prop.get("bathrooms")) or "",
        "property_type": home_type_label(prop.get("homeType")),
        "home_type_raw": _clean(prop.get("homeType"), 40).upper(),
        "description": _clean(prop.get("description"), 4000),
        "listed_date": listed_date,
        "days_on_zillow": days,
        "features": _detail_features(prop),
        "price_reduced": _price_reduced_from_detail(prop),
        "zpid": _clean(prop.get("zpid"), 40) or zpid_from_url(url) or "",
        "city": city,
        "state": state,
        "zipcode": zipcode,
        "sqft": _int_or_none(prop.get("livingArea")),
        "year_built": _int_or_none(prop.get("yearBuilt")),
        "status": _clean(prop.get("homeStatus"), 40).upper(),
    }


def _json_ld_fallback(html: str, url: str) -> dict[str, Any]:
    """Address/price only, from schema.org JSON-LD -- enough to let a page
    with an unrecognised embedded-data shape still be identified, but it has
    no days-on-Zillow, so the caller's staleness check will (correctly) treat
    it as undated."""
    for match in re.finditer(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html or "", re.S):
        try:
            blob = json.loads(match.group(1))
        except (json.JSONDecodeError, ValueError):
            continue
        for node in _iter_dicts(blob):
            address = node.get("address")
            if isinstance(address, dict) and address.get("streetAddress"):
                offers = node.get("offers") if isinstance(node.get("offers"), dict) else {}
                full = ", ".join(
                    part for part in (
                        _clean(address.get("streetAddress")),
                        _clean(address.get("addressLocality")),
                        f"{_clean(address.get('addressRegion'))} {_clean(address.get('postalCode'))}".strip(),
                    ) if part
                )
                return {
                    "title": full, "address": full, "postcode": _clean(address.get("postalCode")),
                    "price": format_usd(_num(offers.get("price"))), "image": _clean(node.get("image")),
                    "images": [], "bedrooms": "", "bathrooms": "", "property_type": "",
                    "home_type_raw": "", "description": _clean(node.get("description"), 4000),
                    "listed_date": "", "days_on_zillow": None, "features": [], "price_reduced": False,
                    "zpid": zpid_from_url(url) or "", "city": _clean(address.get("addressLocality")),
                    "state": _clean(address.get("addressRegion")), "zipcode": _clean(address.get("postalCode")),
                    "sqft": None, "year_built": None, "status": "",
                }
    return {}


def parse_listing_page(html: str, url: str) -> dict[str, Any]:
    data = parse_next_data(html)
    prop = _find_property(data) if data else None
    if prop:
        return scraped_from_property(prop, url)
    return _json_ld_fallback(html, url)


async def scrape_zillow_listing(url: str, session: ZillowSession | None = None) -> dict[str, Any]:
    """Fetch and parse one Zillow listing page. Raises on block/404 so the
    caller can decide whether to fall back to the search-result data."""
    canonical = normalize_zillow_url(url)
    html = await (session.fetch_html(canonical) if session is not None else fetch_html(canonical))
    scraped = parse_listing_page(html, canonical)
    if not scraped:
        raise ValueError("Could not read listing data from the Zillow page")
    return scraped


def scraped_from_search_listing(listing: ZillowListing) -> dict[str, Any]:
    """Same shape as scraped_from_property, built from just the search-result
    row -- used when the detail page can't be fetched (no description then)."""
    days = listing.days_on_zillow
    listed_date = ""
    if days is not None:
        listed_date = (datetime.now(timezone.utc) - timedelta(days=days)).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()
    return {
        "title": listing.address,
        "address": listing.address,
        "postcode": listing.zipcode,
        "price": format_usd(listing.price),
        "image": listing.image,
        "images": listing.images,
        "bedrooms": listing.beds or "",
        "bathrooms": int(listing.baths) if listing.baths is not None and float(listing.baths).is_integer() else (listing.baths or ""),
        "property_type": home_type_label(listing.home_type),
        "home_type_raw": listing.home_type,
        "description": "",
        "listed_date": listed_date,
        "days_on_zillow": days,
        "features": [f"Living area: {listing.sqft:,} sqft"] if listing.sqft else [],
        "price_reduced": listing.price_reduced,
        "zpid": listing.zpid,
        "city": listing.city,
        "state": listing.state,
        "zipcode": listing.zipcode,
        "sqft": listing.sqft,
        "year_built": None,
        "status": listing.status_text,
    }
