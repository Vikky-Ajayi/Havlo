"""
Enterprise-grade property listing scraper.

Extraction strategy (tried in order per platform):
  1. Embedded JSON — window.jsonModel (Rightmove), __NEXT_DATA__ (Zoopla), JSON-LD
  2. CSS selectors — robust multi-selector fallback
  3. Per-listing deep scrape — follows each listing URL for full image gallery,
     exact added date, features list, floor area, bathrooms

Anti-bot hardening:
  • Rotating realistic browser User-Agent strings
  • Full browser-like Accept / Accept-Encoding / Referer / Sec-Fetch headers
  • Exponential back-off retry (3 attempts, 1 s / 2 s / 4 s + jitter)
  • Polite per-page delay (0.8 – 1.6 s) between pagination requests
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import re
from datetime import datetime
from typing import Any
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ── Rotating User-Agent pool ────────────────────────────────────────────────
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
]


def _browser_headers(referer: str | None = None) -> dict[str, str]:
    h: dict[str, str] = {
        "User-Agent": random.choice(_USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none" if not referer else "same-origin",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
        "DNT": "1",
    }
    if referer:
        h["Referer"] = referer
    return h


# ── Retry fetch ─────────────────────────────────────────────────────────────
async def _fetch(url: str, referer: str | None = None, max_retries: int = 3) -> str:
    """HTTP GET with browser-like headers and exponential back-off."""
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        if attempt > 0:
            await asyncio.sleep((2 ** attempt) + random.uniform(0, 0.5))
        try:
            async with httpx.AsyncClient(
                timeout=30,
                follow_redirects=True,
                headers=_browser_headers(referer),
            ) as client:
                r = await client.get(url)
                r.raise_for_status()
                return r.text
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            last_exc = e
            if isinstance(e, httpx.HTTPStatusError) and e.response.status_code in (403, 429, 503):
                logger.warning("Anti-bot block %s on %s (attempt %d/%d)",
                               e.response.status_code, url, attempt + 1, max_retries)
    raise last_exc or RuntimeError(f"Failed to fetch {url}")


# ── Platform detection ──────────────────────────────────────────────────────
def _detect_platform(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if "rightmove" in host:
        return "rightmove"
    if "zoopla" in host:
        return "zoopla"
    if "onthemarket" in host:
        return "onthemarket"
    if "primelocation" in host:
        return "primelocation"
    return "generic"


# ── General helpers ─────────────────────────────────────────────────────────
def _clean(s: Any, maxlen: int = 500) -> str:
    if not s:
        return ""
    cleaned = re.sub(r"\s+", " ", str(s)).strip()
    cleaned = cleaned.replace("Â£", "£").replace("â‚¬", "€")
    cleaned = re.sub(r"(?<![A-Za-z])Ł(?=\d)", "£", cleaned)
    return cleaned[:maxlen]


def _fmt_price(amount: Any, currency: str = "GBP") -> str:
    if amount is None:
        return ""
    try:
        sym = {"GBP": "£", "EUR": "€", "USD": "$"}.get(str(currency).upper(), str(currency) + " ")
        return f"{sym}{int(float(amount)):,}"
    except (ValueError, TypeError):
        return str(amount)


def _parse_iso_date(raw: str) -> str:
    """Convert ISO date/datetime string to 'Added D Month YYYY'."""
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return f"Added {dt.strftime('%-d %B %Y')}"
    except Exception:
        return raw[:40]


def _safe_get(data: Any, *keys: str) -> Any:
    node = data
    for k in keys:
        if not isinstance(node, dict):
            return None
        node = node.get(k)
    return node


def _dig(data: dict, paths: list[list[str]]) -> list | None:
    """Try multiple key paths in nested dict; return first non-empty list found."""
    for path in paths:
        val = data
        for key in path:
            if not isinstance(val, dict):
                val = None
                break
            val = val.get(key)
        if isinstance(val, list) and val:
            return val
    return None


def _extract_js_var(html: str, var_name: str) -> dict | None:
    """Extract `window.VAR = {...};` JSON using brace-counting — handles deeply nested objects."""
    pattern = rf'(?:window\.)?{re.escape(var_name)}\s*=\s*\{{'
    m = re.search(pattern, html)
    if not m:
        return None
    start = m.end() - 1  # position of the opening '{'
    depth = 0
    in_string = False
    escape_next = False
    for i in range(start, len(html)):
        ch = html[i]
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(html[start:i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _extract_next_data(html: str) -> dict | None:
    """Extract __NEXT_DATA__ script tag JSON (Next.js apps)."""
    soup = BeautifulSoup(html, "lxml")
    tag = soup.find("script", {"id": "__NEXT_DATA__"})
    if not tag or not tag.string:
        return None
    try:
        return json.loads(tag.string)
    except json.JSONDecodeError:
        return None


def _extract_json_ld(html: str) -> list[dict]:
    """Extract all JSON-LD blocks from the page."""
    soup = BeautifulSoup(html, "lxml")
    results: list[dict] = []
    for tag in soup.find_all("script", {"type": "application/ld+json"}):
        if not tag.string:
            continue
        try:
            data = json.loads(tag.string)
            if isinstance(data, list):
                results.extend(data)
            else:
                results.append(data)
        except json.JSONDecodeError:
            pass
    return results


def _is_bot_blocked(html: str, platform: str) -> bool:
    """Return True if the response is a bot-detection / JS-required wall, not real content."""
    if platform == "rightmove":
        # Rightmove serves an identical 144 KB shell for all blocked requests.
        # Their SPA shell always contains this noscript banner and no property data.
        return (
            "Javascript is disabled" in html
            and "jsonModel" not in html
            and "__NEXT_DATA__" not in html
        )
    if platform == "zoopla":
        return len(html) < 5000  # Zoopla returns a tiny 403 page
    return False


def _normalize_rightmove_url(url: str) -> str:
    """
    Convert Rightmove agent profile URLs to the estate-agents/find.html search URL.

    Profile pattern:  …/estate-agents/agent/Name/Branch-12345.html
                      …/estate-agents/Name-12345.html
    Search pattern:   …/estate-agents/find.html?locationIdentifier=BRANCH^12345
    """
    if "locationIdentifier" in url or "find.html" in url:
        return url  # already a search URL

    m = re.search(r"[-/](\d{4,8})(?:\.html|$|/|\?|&)", url)
    if m:
        branch_id = m.group(1)
        return (
            f"https://www.rightmove.co.uk/estate-agents/find.html"
            f"?locationIdentifier=BRANCH%5E{branch_id}&index=0"
        )
    return url


def _empty_listing(platform: str, url: str = "") -> dict:
    return {
        "title": "", "address": "", "price": "", "description": "",
        "url": url, "images": [], "image": "", "bedrooms": "",
        "bathrooms": "", "property_type": "", "listed_date": "",
        "features": [], "floor_area": "", "platform": platform,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# RIGHTMOVE
# ═══════════════════════════════════════════════════════════════════════════════

def _rm_json_prop_to_listing(prop: dict) -> dict:
    price_obj = prop.get("price") or {}
    display = ""
    for dp in price_obj.get("displayPrices") or []:
        display = dp.get("displayPrice") or ""
        if display:
            break
    if not display:
        display = _fmt_price(price_obj.get("amount"), price_obj.get("currencyCode", "GBP"))

    prop_images = prop.get("propertyImages") or {}
    images: list[str] = []
    for img in prop_images.get("images") or []:
        src = img.get("srcUrl") or img.get("src") or img.get("url") or ""
        if src and src not in images:
            images.append(src)
    if not images:
        main = prop_images.get("mainImageSrc") or ""
        if main:
            images = [main]

    raw_date = prop.get("firstVisibleDate") or prop.get("addedOrReduced") or ""
    listed_date = _parse_iso_date(raw_date) if raw_date else ""

    prop_url = prop.get("propertyUrl") or ""
    full_url = prop_url if prop_url.startswith("http") else f"https://www.rightmove.co.uk{prop_url}"

    return {
        "title": _clean(prop.get("displayAddress")),
        "address": _clean(prop.get("displayAddress")),
        "price": display,
        "description": _clean(prop.get("summary"), 600),
        "url": full_url,
        "images": images,
        "image": images[0] if images else "",
        "bedrooms": str(prop.get("bedrooms", "")) if prop.get("bedrooms") is not None else "",
        "bathrooms": str(prop.get("bathrooms", "")) if prop.get("bathrooms") is not None else "",
        "property_type": _clean(prop.get("propertySubType") or prop.get("propertyType")),
        "listed_date": listed_date,
        "features": [],
        "floor_area": "",
        "platform": "rightmove",
    }


def _rm_pagination_urls(profile_url: str, json_model: dict) -> list[str]:
    pagination = json_model.get("pagination") or {}
    total = int(pagination.get("total") or 0)
    page_size = 24
    if total <= page_size:
        return []
    parsed = urlparse(profile_url)
    qs = parse_qs(parsed.query)
    urls = []
    for idx in range(page_size, min(total, page_size * 5), page_size):
        qs2 = {k: v[0] for k, v in qs.items()}
        qs2["index"] = str(idx)
        urls.append(urlunparse(parsed._replace(query=urlencode(qs2))))
    return urls


def _scrape_rightmove_html(html: str, base_url: str) -> tuple[list[dict], list[str]]:
    # Strategy 1: window.jsonModel
    jm = _extract_js_var(html, "jsonModel")
    if jm and jm.get("properties"):
        listings = [_rm_json_prop_to_listing(p) for p in jm["properties"]]
        return listings, _rm_pagination_urls(base_url, jm)

    # Strategy 2: CSS selectors
    soup = BeautifulSoup(html, "lxml")
    cards = (soup.select("li.l-searchResult")
             or soup.select("div[data-test='propertyCard']")
             or soup.select("article.propertyCard"))
    listings: list[dict] = []
    for card in cards[:24]:
        try:
            title_el = (card.select_one("h2.propertyCard-title")
                        or card.select_one(".propertyCard-address")
                        or card.select_one("address"))
            title = _clean(title_el.get_text() if title_el else "")
            price_el = (card.select_one(".propertyCard-priceValue")
                        or card.select_one("span[data-test='price']"))
            price = _clean(price_el.get_text() if price_el else "")
            desc_el = card.select_one(".propertyCard-description")
            description = _clean(desc_el.get_text() if desc_el else "", 400)
            link_el = (card.select_one("a.propertyCard-link")
                       or card.select_one("a[href*='/properties/']"))
            link = ""
            if link_el and link_el.get("href"):
                href = link_el["href"]
                link = href if href.startswith("http") else f"https://www.rightmove.co.uk{href}"
            img_el = (card.select_one("img.propertyCard-img")
                      or card.select_one("img[itemprop='image']")
                      or card.select_one("img"))
            image = ""
            if img_el:
                image = img_el.get("src") or img_el.get("data-src") or img_el.get("data-lazy-src") or ""
            if title or link:
                lst = _empty_listing("rightmove", link)
                lst.update({"title": title, "address": title, "price": price,
                            "description": description, "images": [image] if image else [], "image": image})
                listings.append(lst)
        except Exception as e:
            logger.debug("RM CSS card error: %s", e)
    return listings, []


def _rm_enrich_from_detail(html: str) -> dict:
    """Scrape a Rightmove listing detail page for full data."""
    enriched: dict = {"images": [], "features": [], "floor_area": "", "listed_date": "", "bathrooms": "", "description": ""}

    pm = _extract_js_var(html, "PAGE_MODEL")
    if pm:
        prop = pm.get("propertyData") or {}
        images = [img.get("url") or img.get("srcUrl") or "" for img in (prop.get("images") or []) if isinstance(img, dict)]
        enriched["images"] = [i for i in images if i]
        enriched["features"] = [_clean(f) for f in (prop.get("keyFeatures") or []) if f][:10]
        for tag in prop.get("tags") or []:
            f = _clean(tag.get("content") or str(tag)) if isinstance(tag, dict) else _clean(str(tag))
            if f and f not in enriched["features"]:
                enriched["features"].append(f)
        if prop.get("bathrooms") is not None:
            enriched["bathrooms"] = str(prop["bathrooms"])
        text_obj = prop.get("text") or {}
        enriched["description"] = _clean(text_obj.get("description") or prop.get("summary") or "", 800)
        raw = (prop.get("listingHistory") or {}).get("listingDate") or ""
        if raw:
            enriched["listed_date"] = _parse_iso_date(raw)
        for k in ("floorArea", "floor_area", "size"):
            fa = prop.get(k)
            if fa:
                enriched["floor_area"] = _clean(str(fa), 60)
                break
        return enriched

    # CSS fallback
    soup = BeautifulSoup(html, "lxml")
    for img in soup.select("img[itemprop='image'], img[class*='gallery'], img[class*='propertyImages']"):
        src = img.get("src") or img.get("data-src") or ""
        if src and src not in enriched["images"]:
            enriched["images"].append(src)
    for li in soup.select("ul[class*='key-features'] li, ul[class*='keyFeatures'] li"):
        f = _clean(li.get_text())
        if f:
            enriched["features"].append(f)
    enriched["features"] = enriched["features"][:10]
    date_el = soup.select_one("span[class*='listingUpdate'], p[class*='addedOrReduced']")
    if date_el:
        enriched["listed_date"] = _clean(date_el.get_text())
    return enriched


# ═══════════════════════════════════════════════════════════════════════════════
# ZOOPLA
# ═══════════════════════════════════════════════════════════════════════════════

def _zp_obj_to_listing(obj: dict) -> dict | None:
    title = address = price = description = url = bedrooms = bathrooms = property_type = listed_date = floor_area = ""
    images: list[str] = []
    features: list[str] = []

    for k in ("title", "listingTitle", "listing_title", "displayAddress"):
        if obj.get(k) and isinstance(obj[k], str):
            title = _clean(obj[k])
            break

    for k in ("displayAddress", "address", "location", "streetAddress"):
        val = obj.get(k)
        if val:
            address = _clean(val) if isinstance(val, str) else _clean(_safe_get(val, "displayAddress") or _safe_get(val, "streetAddress") or "")
            break
    if not title and address:
        title = address

    raw_price = obj.get("price") or obj.get("listingPrice") or obj.get("pricing")
    if isinstance(raw_price, str):
        price = _clean(raw_price)
    elif isinstance(raw_price, dict):
        dps = raw_price.get("displayPrices")
        if dps and isinstance(dps, list) and dps:
            price = dps[0].get("displayPrice") or ""
        price = price or raw_price.get("label") or _fmt_price(raw_price.get("amount"), raw_price.get("currencyCode", "GBP"))
    elif isinstance(raw_price, (int, float)):
        price = _fmt_price(raw_price)

    for k in ("description", "summaryDescription", "summary", "listingDescription"):
        if obj.get(k):
            description = _clean(obj[k], 600)
            break

    for k in ("listingUris", "links"):
        sub = obj.get(k)
        if isinstance(sub, dict):
            href = sub.get("detail") or sub.get("listing") or sub.get("canonical") or ""
            if href:
                url = href if href.startswith("http") else f"https://www.zoopla.co.uk{href}"
            break
    if not url:
        for k in ("listingId", "id"):
            lid = obj.get(k)
            if lid:
                url = f"https://www.zoopla.co.uk/for-sale/details/{lid}/"
                break

    for k in ("image", "mainImage", "primaryImage"):
        img = obj.get(k)
        if isinstance(img, str) and img:
            images.append(img)
            break
        elif isinstance(img, dict):
            src = img.get("src") or img.get("url") or ""
            if src:
                images.append(src)
            break
    for k in ("images", "media", "photos", "propertyImages"):
        imgs = obj.get(k)
        if isinstance(imgs, list):
            for i in imgs:
                if isinstance(i, str) and i and i not in images:
                    images.append(i)
                elif isinstance(i, dict):
                    src = i.get("src") or i.get("url") or i.get("srcUrl") or ""
                    if src and src not in images:
                        images.append(src)
            break

    for k in ("numBedrooms", "bedrooms", "bedroomsCount"):
        v = obj.get(k)
        if v is not None:
            bedrooms = str(v)
            break

    for k in ("numBathrooms", "bathrooms", "bathroomsCount"):
        v = obj.get(k)
        if v is not None:
            bathrooms = str(v)
            break

    for k in ("propertyType", "property_type", "listingType", "category"):
        if obj.get(k):
            property_type = _clean(str(obj[k])).replace("_", " ").title()
            break

    for k in ("firstPublishedAt", "firstListedAt", "listingDate", "publishedOn", "addedOn"):
        raw = obj.get(k)
        if raw:
            listed_date = _parse_iso_date(str(raw)[:25])
            break

    if not (title or url):
        return None

    return {
        "title": title or address,
        "address": address or title,
        "price": price,
        "description": description,
        "url": url,
        "images": images,
        "image": images[0] if images else "",
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "property_type": property_type,
        "listed_date": listed_date,
        "features": features,
        "floor_area": floor_area,
        "platform": "zoopla",
    }


def _zp_pagination_urls(nd: dict, base_url: str) -> list[str]:
    pagination = _dig(nd, [
        ["props", "pageProps", "listingsData", "pagination"],
        ["props", "pageProps", "agentListings", "pagination"],
        ["props", "pageProps", "pagination"],
    ])
    if not isinstance(pagination, dict):
        return []
    total_pages = int(pagination.get("totalPages") or 1)
    current = int(pagination.get("page") or pagination.get("currentPage") or 1)
    parsed = urlparse(base_url)
    qs = parse_qs(parsed.query)
    urls = []
    for page in range(current + 1, min(total_pages + 1, current + 5)):
        qs2 = {k: v[0] for k, v in qs.items()}
        qs2["pn"] = str(page)
        urls.append(urlunparse(parsed._replace(query=urlencode(qs2))))
    return urls


def _scrape_zoopla_html(html: str, base_url: str) -> tuple[list[dict], list[str]]:
    nd = _extract_next_data(html)
    if nd:
        raw_listings = _dig(nd, [
            ["props", "pageProps", "listingsData", "listings"],
            ["props", "pageProps", "agentListings", "listings"],
            ["props", "pageProps", "listings"],
            ["props", "pageProps", "searchResults", "listings"],
            ["props", "pageProps", "regularListings"],
        ])
        if raw_listings:
            listings = [r for obj in raw_listings if (r := _zp_obj_to_listing(obj)) is not None]
            return listings, _zp_pagination_urls(nd, base_url)

    # CSS fallback
    soup = BeautifulSoup(html, "lxml")
    cards = (soup.select("article[data-testid='search-result']")
             or soup.select("li[data-testid='search-result']")
             or soup.select("div[class*='listing-result']"))
    listings: list[dict] = []
    for card in cards[:24]:
        try:
            title_el = card.select_one("h2, h3, [data-testid='listing-title']")
            title = _clean(title_el.get_text() if title_el else "")
            price_el = card.select_one("[data-testid='price'], p[class*='price']")
            price = _clean(price_el.get_text() if price_el else "")
            link_el = (card.select_one("a[href*='/for-sale/']")
                       or card.select_one("a[href*='/to-rent/']")
                       or card.select_one("a"))
            link = ""
            if link_el and link_el.get("href"):
                href = link_el["href"]
                link = href if href.startswith("http") else f"https://www.zoopla.co.uk{href}"
            img_el = card.select_one("img")
            image = (img_el.get("src") or img_el.get("data-src") or "") if img_el else ""
            if title or link:
                lst = _empty_listing("zoopla", link)
                lst.update({"title": title, "address": title, "price": price,
                            "images": [image] if image else [], "image": image})
                listings.append(lst)
        except Exception as e:
            logger.debug("ZP CSS card error: %s", e)
    return listings, []


def _zp_enrich_from_detail(html: str) -> dict:
    enriched: dict = {"images": [], "features": [], "floor_area": "", "listed_date": "", "bathrooms": "", "description": ""}
    nd = _extract_next_data(html)
    if nd:
        listing = (
            _safe_get(nd, "props", "pageProps", "listingDetails", "listing")
            or _safe_get(nd, "props", "pageProps", "listing")
            or _safe_get(nd, "props", "pageProps", "propertyDetails")
        )
        if isinstance(listing, dict):
            for k in ("images", "media", "photos"):
                imgs = listing.get(k)
                if isinstance(imgs, list):
                    enriched["images"] = [i.get("src") or i.get("url") or "" for i in imgs if isinstance(i, dict)]
                    enriched["images"] = [i for i in enriched["images"] if i]
                    break
            for k in ("keyFeatures", "features", "detailedDescription"):
                feats = listing.get(k)
                if isinstance(feats, list):
                    enriched["features"] = [_clean(f if isinstance(f, str) else f.get("text") or "") for f in feats[:10]]
                    break
            for k in ("firstPublishedAt", "listingDate", "firstListedAt"):
                raw = listing.get(k)
                if raw:
                    enriched["listed_date"] = _parse_iso_date(str(raw)[:25])
                    break
            for k in ("numBathrooms", "bathrooms"):
                v = listing.get(k)
                if v is not None:
                    enriched["bathrooms"] = str(v)
                    break
            for k in ("floorArea", "size"):
                v = listing.get(k)
                if v:
                    enriched["floor_area"] = _clean(str(v), 60)
                    break
            enriched["description"] = _clean(
                listing.get("description") or listing.get("summaryDescription") or "", 800
            )
    return enriched


# ═══════════════════════════════════════════════════════════════════════════════
# GENERIC (OnTheMarket, PrimeLocation, etc.)
# ═══════════════════════════════════════════════════════════════════════════════

_PROPERTY_JLD_TYPES = frozenset({
    "Residence", "SingleFamilyResidence", "House", "Apartment",
    "RealEstateListing", "Product",
})


def _scrape_generic_html(html: str, base_url: str, platform: str) -> tuple[list[dict], list[str]]:
    domain = urlparse(base_url).netloc
    listings: list[dict] = []

    # JSON-LD
    for item in _extract_json_ld(html):
        if item.get("@type") not in _PROPERTY_JLD_TYPES:
            continue
        title = _clean(item.get("name") or "")
        addr_raw = item.get("address") or {}
        address = _clean(addr_raw.get("streetAddress") or "") if isinstance(addr_raw, dict) else _clean(str(addr_raw))
        offers = item.get("offers") or {}
        price = _fmt_price(offers.get("price"), offers.get("priceCurrency", "GBP")) if offers else ""
        img_raw = item.get("image")
        images = img_raw if isinstance(img_raw, list) else ([img_raw] if img_raw else [])
        url = item.get("url") or ""
        if url and not url.startswith("http"):
            url = f"https://{domain}{url}"
        if title or url:
            lst = _empty_listing(platform, url)
            lst.update({"title": title, "address": address or title, "price": price,
                        "description": _clean(item.get("description") or "", 600),
                        "images": [i for i in images if i],
                        "image": images[0] if images else "",
                        "property_type": _clean(item.get("@type"))})
            listings.append(lst)

    if listings:
        return listings, []

    # CSS fallback
    soup = BeautifulSoup(html, "lxml")
    cards: list = []
    for sel in ("article", "li[class*='property']", "div[class*='property-card']",
                "div[class*='listing']", "div[class*='result']"):
        found = soup.select(sel)
        if len(found) >= 2:
            cards = found
            break

    for card in cards[:24]:
        try:
            price_el = card.select_one("[class*='price'], [data-test*='price']")
            price = _clean(price_el.get_text() if price_el else "")
            if not price:
                continue
            title_el = card.select_one("h2, h3, h4, [class*='title'], [class*='address']")
            title = _clean(title_el.get_text() if title_el else "")
            link_el = card.select_one("a")
            link = ""
            if link_el and link_el.get("href"):
                href = link_el["href"]
                link = href if href.startswith("http") else f"https://{domain}{href}"
            img_el = card.select_one("img")
            image = (img_el.get("src") or img_el.get("data-src") or "") if img_el else ""
            lst = _empty_listing(platform, link)
            lst.update({"title": title, "address": title, "price": price,
                        "images": [image] if image else [], "image": image})
            listings.append(lst)
        except Exception as e:
            logger.debug("Generic CSS card error: %s", e)

    return listings, []


# ═══════════════════════════════════════════════════════════════════════════════
# Deep scrape — per listing detail page
# ═══════════════════════════════════════════════════════════════════════════════

async def _deep_scrape_listing(url: str, platform: str, referer: str) -> dict:
    """Fetch a single listing detail page and return enrichment data."""
    try:
        html = await _fetch(url, referer=referer, max_retries=2)
    except Exception as e:
        logger.debug("Deep scrape failed for %s: %s", url, e)
        return {}

    if platform == "rightmove":
        return _rm_enrich_from_detail(html)
    if platform == "zoopla":
        return _zp_enrich_from_detail(html)

    # Generic
    soup = BeautifulSoup(html, "lxml")
    images: list[str] = []
    for img in soup.select("img[itemprop='image'], img[class*='gallery'], img[class*='property-image']"):
        src = img.get("src") or img.get("data-src") or ""
        if src and src not in images:
            images.append(src)
    features: list[str] = []
    for li in soup.select("ul[class*='feature'] li, ul[class*='key-feature'] li, ul[class*='keyFeature'] li"):
        f = _clean(li.get_text())
        if f:
            features.append(f)
    return {"images": images, "features": features[:10], "floor_area": "", "listed_date": "", "bathrooms": "", "description": ""}


# ═══════════════════════════════════════════════════════════════════════════════
# OnTheMarket extractor
# ═══════════════════════════════════════════════════════════════════════════════

def _otm_extract_from_redux(html: str, url: str) -> dict | None:
    """
    Extract property details from OnTheMarket's initialReduxState JSON blob.

    OTM embeds all listing data inside a <script> tag as:
      {"props": {"initialReduxState": { "property": { ... } } } }
    The property object contains flat fields: displayAddress, price, bedrooms,
    bathrooms, humanisedPropertyType, features (list of dicts), images (list of
    dicts with largeUrl), description (HTML), summary (plain text).
    """
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", html, re.DOTALL)
    for s in scripts:
        if "initialReduxState" not in s:
            continue
        m = re.search(r'"initialReduxState"\s*:\s*(\{)', s)
        if not m:
            continue
        start = m.start(1)
        depth = 0
        end = start
        for i, ch in enumerate(s[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        try:
            state = json.loads(s[start : end + 1])
        except json.JSONDecodeError:
            continue

        prop = state.get("property") or {}
        if not prop:
            continue

        addr_str = _clean(prop.get("displayAddress") or "")
        price_str = _clean(str(prop.get("price") or ""))

        # Beds / baths
        bedrooms = str(prop.get("bedrooms") or "")
        bathrooms = str(prop.get("bathrooms") or "")

        # Property type
        property_type = _clean(str(prop.get("humanisedPropertyType") or ""))

        # Features — list of {"id": N, "feature": "text"} dicts
        features: list[str] = []
        for f in (prop.get("features") or [])[:10]:
            if isinstance(f, dict):
                txt = _clean(f.get("feature") or "")
            else:
                txt = _clean(str(f))
            if txt:
                features.append(txt)

        # Images — list of dicts with largeUrl / url keys
        images: list[str] = []
        for img in prop.get("images") or []:
            if isinstance(img, dict):
                src = img.get("largeUrl") or img.get("url") or ""
                if src and src.startswith("http") and src not in images:
                    images.append(src)
        # Hero images as fallback
        if not images:
            for k in ("heroImage1", "heroImage2", "heroImage3"):
                img = prop.get(k)
                if isinstance(img, dict):
                    src = img.get("largeUrl") or img.get("url") or ""
                    if src and src.startswith("http"):
                        images.append(src)

        # Description — HTML stripped; fall back to plain summary
        raw_desc = prop.get("description") or prop.get("summary") or ""
        description = _clean(re.sub(r"<[^>]+>", " ", str(raw_desc)), 800)

        if addr_str or price_str:
            return {
                "title": addr_str,
                "address": addr_str,
                "price": price_str,
                "description": description,
                "url": url,
                "images": images,
                "image": images[0] if images else "",
                "bedrooms": bedrooms,
                "bathrooms": bathrooms,
                "property_type": property_type,
                "listed_date": "",
                "features": features,
                "floor_area": "",
                "platform": "onthemarket",
            }
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# Scrape a single listing URL  (used by the 'Paste a link' feature)
# ═══════════════════════════════════════════════════════════════════════════════

def _rm_decode_page_model_v2(data: list) -> dict | None:
    """
    Decode Rightmove's compressed flat-index PAGE_MODEL format (encoding='on').

    Structure: data[0] is a top-level schema mapping field names to integer indices.
    Each index points into data[]; values can be primitives, nested schemas (dicts),
    or lists of indices.  We resolve recursively.
    """
    if not isinstance(data, list) or len(data) < 2:
        return None

    def r(idx: Any) -> Any:
        """Resolve index → value from the flat data array."""
        if isinstance(idx, int) and 0 <= idx < len(data):
            return data[idx]
        return idx

    try:
        top_schema = data[0]
        if not isinstance(top_schema, dict) or "propertyData" not in top_schema:
            return None

        prop_schema = r(top_schema["propertyData"])
        if not isinstance(prop_schema, dict):
            return None

        # ── Address ──────────────────────────────────────────────────────────
        addr_str = ""
        addr_schema = r(prop_schema.get("address"))
        if isinstance(addr_schema, dict):
            addr_str = _clean(r(addr_schema.get("displayAddress")) or "")

        # ── Price ─────────────────────────────────────────────────────────────
        price_str = ""
        prices_schema = r(prop_schema.get("prices"))
        if isinstance(prices_schema, dict):
            price_str = _clean(str(r(prices_schema.get("primaryPrice")) or ""))

        # ── Description (may contain HTML tags) ───────────────────────────────
        description = ""
        text_schema = r(prop_schema.get("text"))
        if isinstance(text_schema, dict):
            raw_desc = r(text_schema.get("description")) or ""
            description = _clean(re.sub(r"<[^>]+>", " ", str(raw_desc)), 800)

        # ── Bedrooms / bathrooms ───────────────────────────────────────────────
        bedrooms = str(r(prop_schema.get("bedrooms")) or "")
        bathrooms = str(r(prop_schema.get("bathrooms")) or "")

        # ── Key features ──────────────────────────────────────────────────────
        features: list[str] = []
        kf_list = r(prop_schema.get("keyFeatures"))
        if isinstance(kf_list, list):
            features = [_clean(str(r(i))) for i in kf_list if r(i)][:10]

        # ── Images ────────────────────────────────────────────────────────────
        images: list[str] = []
        img_list = r(prop_schema.get("images"))
        if isinstance(img_list, list):
            for img_schema_idx in img_list:
                img_schema = r(img_schema_idx)
                if isinstance(img_schema, dict):
                    img_url = str(r(img_schema.get("url")) or "")
                    if img_url and img_url.startswith("http"):
                        images.append(img_url)

        # ── Property type (extracted from page title) ─────────────────────────
        property_type = ""
        if isinstance(text_schema, dict):
            page_title = str(r(text_schema.get("pageTitle")) or "")
            m = re.search(
                r"\d+\s+bedroom\s+(.+?)\s+for\s+(?:sale|rent)",
                page_title, re.IGNORECASE,
            )
            if m:
                property_type = m.group(1).strip().title()

        # ── Listed / reduced date ─────────────────────────────────────────────
        listed_date = ""
        price_reduced = False
        hist_schema = r(prop_schema.get("listingHistory"))
        if isinstance(hist_schema, dict):
            for k in ("listingDate", "dateFirstListed", "addedOrReduced",
                      "listingUpdateReason"):
                raw = r(hist_schema.get(k))
                if raw:
                    raw_str = str(raw)
                    if re.match(r"\d{4}-\d{2}-\d{2}", raw_str):
                        listed_date = _parse_iso_date(raw_str)
                    else:
                        listed_date = _clean(raw_str)
                    break
            # Independent of which field supplied listed_date above — Rightmove's
            # own listingHistory is the only place a genuine price-reduction
            # signal exists ("Reduced on DD/MM/YYYY" in addedOrReduced, or a
            # matching listingUpdateReason). Check both fields explicitly
            # rather than fabricating a value when this data isn't available.
            for k in ("addedOrReduced", "listingUpdateReason"):
                raw = r(hist_schema.get(k))
                if raw and "reduc" in str(raw).lower():
                    price_reduced = True
                    break

        return {
            "title": addr_str,
            "address": addr_str,
            "price": price_str,
            "description": description,
            "url": "",  # filled in by caller
            "images": images,
            "image": images[0] if images else "",
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "property_type": property_type,
            "listed_date": listed_date,
            "price_reduced": price_reduced,
            "features": features,
            "floor_area": "",
            "platform": "rightmove",
        }
    except Exception as exc:
        logger.debug("PAGE_MODEL v2 decode error: %s", exc)
        return None


async def scrape_single_listing(url: str) -> dict:
    """Fetch full details for a single property listing URL."""
    # Strip URL fragment before fetching (fragments are not sent to the server
    # and can cause issues with URL parsing on some portals).
    clean_url = url.split("#")[0]
    platform = _detect_platform(clean_url)
    referer = f"https://{urlparse(clean_url).netloc}/"
    try:
        html = await _fetch(clean_url, referer=referer, max_retries=2)
    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        if status_code in (403, 429, 503):
            logger.warning(
                "Portal blocked scrape for %s (HTTP %s) — returning partial result",
                clean_url, status_code,
            )
            empty = _empty_listing(platform, url)
            empty["blocked"] = True
            return empty
        raise ValueError(f"Could not fetch the listing page: {e}")
    except Exception as e:
        raise ValueError(f"Could not fetch the listing page: {e}")

    result: dict | None = None

    if platform == "rightmove":
        pm = _extract_js_var(html, "PAGE_MODEL")
        if pm:
            # ── New compressed format (encoding='on') ────────────────────────
            if pm.get("encoding") == "on" and pm.get("data"):
                try:
                    data_arr = json.loads(pm["data"])
                    result = _rm_decode_page_model_v2(data_arr)
                    if result:
                        result["url"] = url
                except Exception as exc:
                    logger.debug("PAGE_MODEL v2 parse failed: %s", exc)
                    result = None

            # ── Legacy flat format ────────────────────────────────────────────
            if not result:
                prop = pm.get("propertyData") or {}
                images = [img.get("url") or img.get("srcUrl") or "" for img in (prop.get("images") or []) if isinstance(img, dict)]
                images = [i for i in images if i]
                price_obj = prop.get("prices") or prop.get("price") or {}
                price_str = price_obj.get("primaryPrice") or _fmt_price(price_obj.get("amount"), price_obj.get("currencyCode", "GBP"))
                addr = (prop.get("address") or {})
                addr_str = _clean(addr.get("displayAddress") or prop.get("displayAddress") or "")
                listing_history = prop.get("listingHistory") or {}
                raw_date = listing_history.get("listingDate") or ""
                # Same price-reduction signal as the v2 decoder above, from
                # the same listingHistory object in this older flat schema.
                price_reduced = any(
                    "reduc" in str(listing_history.get(k) or "").lower()
                    for k in ("addedOrReduced", "listingUpdateReason")
                )
                if addr_str or price_str or images:
                    result = {
                        "title": addr_str,
                        "address": addr_str,
                        "price": price_str,
                        "description": _clean((prop.get("text") or {}).get("description") or prop.get("summary") or "", 800),
                        "url": url,
                        "images": images,
                        "image": images[0] if images else "",
                        "bedrooms": str(prop.get("bedrooms") or ""),
                        "bathrooms": str(prop.get("bathrooms") or ""),
                        "property_type": _clean(prop.get("propertySubType") or prop.get("propertyType") or ""),
                        "listed_date": _parse_iso_date(raw_date) if raw_date else "",
                        "price_reduced": price_reduced,
                        "features": [_clean(f) for f in (prop.get("keyFeatures") or []) if f][:10],
                        "floor_area": "",
                        "platform": "rightmove",
                    }

    elif platform == "zoopla":
        # Zoopla is protected by Cloudflare — detect challenge/block pages
        if (len(html) < 50_000
                or "Just a moment" in html
                or "__cf_chl_" in html
                or "cf-browser-verification" in html):
            logger.warning("Zoopla Cloudflare block detected for %s", url)
            empty = _empty_listing(platform, url)
            empty["blocked"] = True
            return empty

        nd = _extract_next_data(html)
        if nd:
            ld = (
                _safe_get(nd, "props", "pageProps", "listingDetails", "listing")
                or _safe_get(nd, "props", "pageProps", "listing")
                or _safe_get(nd, "props", "pageProps", "propertyDetails")
            )
            if isinstance(ld, dict):
                images = []
                for k in ("images", "media", "photos"):
                    imgs = ld.get(k)
                    if isinstance(imgs, list):
                        images = [i.get("src") or i.get("url") or "" for i in imgs if isinstance(i, dict)]
                        images = [i for i in images if i]
                        break
                addr_raw = ld.get("displayAddress") or ld.get("address") or {}
                addr_str = addr_raw if isinstance(addr_raw, str) else _clean(_safe_get(addr_raw, "displayAddress") or _safe_get(addr_raw, "streetAddress") or "")
                price_raw = ld.get("price") or ld.get("listingPrice") or {}
                price_str = ""
                if isinstance(price_raw, dict):
                    dps = price_raw.get("displayPrices")
                    price_str = (dps[0].get("displayPrice") or "") if dps else _fmt_price(price_raw.get("amount"))
                elif isinstance(price_raw, (int, float)):
                    price_str = _fmt_price(price_raw)
                features: list[str] = []
                for k in ("keyFeatures", "features"):
                    feats = ld.get(k)
                    if isinstance(feats, list):
                        features = [_clean(f if isinstance(f, str) else f.get("text") or "") for f in feats[:10]]
                        break
                listed_date = ""
                for k in ("firstPublishedAt", "firstListedAt", "listingDate"):
                    raw = ld.get(k)
                    if raw:
                        listed_date = _parse_iso_date(str(raw)[:25])
                        break
                result = {
                    "title": _clean(ld.get("title") or addr_str),
                    "address": _clean(addr_str),
                    "price": price_str,
                    "description": _clean(ld.get("description") or ld.get("summaryDescription") or "", 800),
                    "url": url,
                    "images": images,
                    "image": images[0] if images else "",
                    "bedrooms": str(ld.get("numBedrooms") or ld.get("bedrooms") or ""),
                    "bathrooms": str(ld.get("numBathrooms") or ld.get("bathrooms") or ""),
                    "property_type": _clean(str(ld.get("propertyType") or "")).replace("_", " ").title(),
                    "listed_date": listed_date,
                    "features": features,
                    "floor_area": str(ld.get("floorArea") or ""),
                    "platform": "zoopla",
                }

    elif platform == "onthemarket":
        result = _otm_extract_from_redux(html, url)

    elif platform == "primelocation":
        # Primelocation (Zoopla Group) — detect Cloudflare / bot wall
        if (len(html) < 80_000
                or "Just a moment" in html
                or "__cf_chl_" in html):
            logger.warning("Primelocation bot-wall detected for %s", url)
            empty = _empty_listing(platform, url)
            empty["blocked"] = True
            return empty
        # Otherwise fall through to generic extractor below

    # Generic fallback (JSON-LD + CSS)
    if not result:
        jld = _extract_json_ld(html)
        soup = BeautifulSoup(html, "lxml")
        prop_jld = next((d for d in jld if d.get("@type") in _PROPERTY_JLD_TYPES), None)

        images = []
        for img in soup.select("img[itemprop='image'], img[class*='gallery'], img[class*='property'], img[class*='photo']"):
            src = img.get("src") or img.get("data-src") or ""
            if src and src not in images:
                images.append(src)

        features = []
        for li in soup.select("ul[class*='feature'] li, ul[class*='key-feature'] li, ul[class*='keyFeature'] li"):
            f = _clean(li.get_text())
            if f:
                features.append(f)

        h1_el = soup.select_one("h1")
        title = _clean(h1_el.get_text() if h1_el else "")
        price_el = soup.select_one("[itemprop='price'], [class*='price'], [data-testid*='price']")
        price = _clean(price_el.get_text() if price_el else "")
        desc_el = soup.select_one("[itemprop='description'], [class*='description'] p")
        description = _clean(desc_el.get_text() if desc_el else "", 800)

        if prop_jld:
            title = _clean(prop_jld.get("name") or title)
            addr_raw = prop_jld.get("address") or {}
            if isinstance(addr_raw, dict):
                title = title or _clean(addr_raw.get("streetAddress") or "")
            img_raw = prop_jld.get("image")
            if isinstance(img_raw, list):
                images = [i for i in img_raw if isinstance(i, str)] + images
            elif isinstance(img_raw, str):
                images = [img_raw] + images
            offers = prop_jld.get("offers") or {}
            price = price or _fmt_price(offers.get("price"), offers.get("priceCurrency", "GBP"))

        images = list(dict.fromkeys([i for i in images if i]))[:15]
        result = {
            "title": title,
            "address": title,
            "price": price,
            "description": description,
            "url": url,
            "images": images,
            "image": images[0] if images else "",
            "bedrooms": "",
            "bathrooms": "",
            "property_type": "",
            "listed_date": "",
            "features": features[:10],
            "floor_area": "",
            "platform": platform,
        }

    return result


def normalize_listing_url(raw_url: str) -> str:
    cleaned = (raw_url or "").strip()
    if not cleaned:
        raise ValueError("Please enter a property URL.")
    if not re.match(r"^https?://", cleaned, re.IGNORECASE):
        cleaned = f"https://{cleaned.lstrip('/')}"
    parsed = urlparse(cleaned)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Please enter a valid property URL.")
    filtered_params: list[tuple[str, str]] = []
    for key, values in parse_qs(parsed.query, keep_blank_values=False).items():
        lowered = key.lower()
        if lowered.startswith("utm_") or lowered in {"fbclid", "gclid"}:
            continue
        for value in values:
            filtered_params.append((key, value))
    return urlunparse(parsed._replace(query=urlencode(filtered_params), fragment=""))


def detect_listing_platform(url: str) -> str:
    return _detect_platform(url)


def empty_listing_snapshot(url: str) -> dict:
    return _empty_listing(_detect_platform(url), url)


def _listing_missing_fields(listing: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if not _clean(listing.get("address") or listing.get("title")):
        missing.append("address")
    if not _clean(listing.get("price")):
        missing.append("price")
    if not _clean(listing.get("description")):
        missing.append("description")
    return missing


async def scrape_listing_for_public_flow(raw_url: str) -> dict:
    normalized_url = normalize_listing_url(raw_url)
    platform = _detect_platform(normalized_url)
    try:
        listing = await scrape_single_listing(normalized_url)
    except Exception as exc:
        logger.warning("Public scrape fallback for %s: %s", normalized_url, exc)
        listing = _empty_listing(platform, normalized_url)
        listing["url"] = normalized_url
        return {
            "status": "partial",
            "platform": platform,
            "message": (
                "We could not fully read this listing automatically. "
                "You can still continue and confirm the property details manually."
            ),
            "property": listing,
            "missing_fields": ["address", "price", "description"],
        }

    merged = {**_empty_listing(platform, normalized_url), **(listing or {})}
    merged["url"] = normalized_url
    merged["platform"] = merged.get("platform") or platform
    missing_fields = _listing_missing_fields(merged)
    blocked = bool(merged.get("blocked"))

    if blocked:
        status = "blocked"
        message = (
            "This listing blocked automated access. "
            "You can still continue and confirm the property details manually."
        )
    elif missing_fields:
        status = "partial"
        message = (
            "We found the listing, but a few details need your confirmation "
            "before the proposal is presented."
        )
    else:
        status = "complete"
        message = "Listing details collected successfully."

    return {
        "status": status,
        "platform": merged.get("platform") or platform,
        "message": message,
        "property": merged,
        "missing_fields": missing_fields,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Agent profile scrape — main entry point
# ═══════════════════════════════════════════════════════════════════════════════

async def scrape_agent_listings(profile_url: str, deep_scrape: bool = True) -> list[dict]:
    """
    Scrape all listings from an agent's profile page.

    Steps:
      1. Fetch profile HTML (3 retries, rotating User-Agent, browser headers)
      2. Extract listings via embedded JSON or CSS selectors
      3. Follow pagination links (up to 5 pages, max 100 listings)
      4. Enrich listings missing images / date / features via individual detail
         pages scraped in parallel (semaphore: 4 concurrent, cap: first 20)

    Returns list of dicts with full listing data.
    """
    logger.info("Scraping agent listings from: %s", profile_url)
    platform = _detect_platform(profile_url)
    logger.info("Platform detected: %s", platform)

    # Normalise Rightmove agent-profile URLs → estate-agents/find.html search URL
    if platform == "rightmove":
        fetch_url = _normalize_rightmove_url(profile_url)
        if fetch_url != profile_url:
            logger.info("Rightmove URL normalised → %s", fetch_url)
    else:
        fetch_url = profile_url

    referer = f"https://{urlparse(fetch_url).netloc}/"

    try:
        html = await _fetch(fetch_url, referer=referer)
    except httpx.HTTPStatusError as e:
        raise ValueError(
            f"Could not access the profile page (HTTP {e.response.status_code}). "
            "Please check the URL and try again."
        )
    except Exception as e:
        raise ValueError(f"Could not fetch the profile page: {e}")

    # Detect anti-bot wall early and give the user an actionable message
    if _is_bot_blocked(html, platform):
        platform_name = {"rightmove": "Rightmove", "zoopla": "Zoopla"}.get(platform, platform.title())
        raise ValueError(
            f"{platform_name} blocks automated access to agent listing pages from cloud servers. "
            "Please add your listings individually using the 'Paste a link' tab — "
            "paste each property URL and we'll import the full details automatically."
        )

    # Parse page 1
    if platform == "rightmove":
        listings, next_pages = _scrape_rightmove_html(html, fetch_url)
        # Rightmove loads listings via client-side JS after page render.
        # The estate-agents/find.html page has NEXT_DATA but no listing data in HTML.
        # Detect this and tell the user to use paste-a-link instead.
        if not listings and "__NEXT_DATA__" in html:
            raise ValueError(
                "Rightmove loads property listings via JavaScript after the page renders — "
                "they cannot be extracted automatically from your agent profile page. "
                "Please add your listings individually using the 'Paste a link' tab: "
                "paste each Rightmove property URL and all details will be imported automatically."
            )
    elif platform == "zoopla":
        listings, next_pages = _scrape_zoopla_html(html, fetch_url)
        if not listings and len(html) < 10000:
            raise ValueError(
                "Zoopla blocked automated access to your profile page. "
                "Please add your listings individually using the 'Paste a link' tab: "
                "paste each Zoopla property URL and all details will be imported automatically."
            )
    else:
        listings, next_pages = _scrape_generic_html(html, fetch_url, platform)

    # Paginate (pages 2-5, polite delay between each)
    for next_url in next_pages[:4]:
        if len(listings) >= 100:
            break
        await asyncio.sleep(random.uniform(0.8, 1.6))
        try:
            page_html = await _fetch(next_url, referer=profile_url)
            if platform == "rightmove":
                more, _ = _scrape_rightmove_html(page_html, next_url)
            elif platform == "zoopla":
                more, _ = _scrape_zoopla_html(page_html, next_url)
            else:
                more, _ = _scrape_generic_html(page_html, next_url, platform)
            listings.extend(more)
            logger.info("Pagination page scraped: +%d listings (total=%d)", len(more), len(listings))
        except Exception as e:
            logger.warning("Pagination failed for %s: %s", next_url, e)
            break

    listings = listings[:100]
    logger.info("Pre-enrichment listing count: %d", len(listings))

    # Deep scrape detail pages for enrichment (parallel, rate-limited)
    if deep_scrape:
        needs = [
            (i, lst) for i, lst in enumerate(listings[:20])
            if lst.get("url") and (
                not lst.get("images") or not lst.get("listed_date") or not lst.get("features")
            )
        ]
        if needs:
            sem = asyncio.Semaphore(4)

            async def _enrich(idx: int, lst: dict) -> None:
                async with sem:
                    await asyncio.sleep(random.uniform(0.3, 0.9))
                    patch = await _deep_scrape_listing(lst["url"], platform, referer=profile_url)
                    for key, val in patch.items():
                        if val and not listings[idx].get(key):
                            listings[idx][key] = val
                    if listings[idx].get("images"):
                        listings[idx]["image"] = listings[idx]["images"][0]

            await asyncio.gather(*[_enrich(i, lst) for i, lst in needs])

    logger.info("Final listing count after enrichment: %d", len(listings))
    return listings
