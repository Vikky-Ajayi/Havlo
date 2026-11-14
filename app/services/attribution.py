"""Where leads and sales come from: UTM tags.

Three parts:

1. Outgoing links. Every link to the site in the funnel emails and texts is
   tagged (tag_html / tag_text): utm_source=email or sms, utm_medium the same,
   utm_campaign the flow (abandonment, post_purchase, ads_nurture ...) and, in
   emails, utm_content the step. A return visit from one then shows where it
   came from. Unsubscribe and opt-out links are left alone, as are links that
   already carry their own utm_source (an ad's).

2. Incoming visits. The site keeps the UTM tags of a visitor's first and
   latest tagged visit (havlo_frontend/src/lib/attribution.ts) and sends them
   with the property submission, the details form and each checkout. They're
   saved on the lead (lead_utm_json, kept from the first submission) and on
   the order (purchase_utm_json, the latest checkout; an add-on order's
   utm_json). source_label() turns one into "Meta ads", "Email", "SMS" ...
   for the console.

3. Test orders. is_test_order(): unlocked with the free promo code, or placed
   from an internal address (TEST_ORDER_EMAILS). The site only tells Meta and
   Tag Manager about a purchase the server says is a real card sale
   (count_as_sale()), so a test can never be counted as one.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.config import get_settings

UTM_KEYS = ("source", "medium", "campaign", "content", "term")
_SKIP_PATH = re.compile(r"unsubscribe|opt-?out|/stop\b", re.IGNORECASE)
_HREF = re.compile(r'(href\s*=\s*")(https?://[^"]+)(")', re.IGNORECASE)
_BARE_URL = re.compile(r"https?://[^\s<>\"')\]]+")
_TRAILING = ".,;:!?"


# ── 1. Tagging outgoing links ─────────────────────────────────────────────


def _own_hosts() -> set[str]:
    hosts = {"heyhavlo.com", "www.heyhavlo.com"}
    configured = urlsplit((get_settings().FRONTEND_URL or "").strip()).hostname
    if configured:
        hosts.add(configured.lower())
    return hosts


def tag_url(url: str, *, source: str, campaign: str, content: str | None = None, medium: str | None = None) -> str:
    """The link with UTM tags added, if it goes to the site; unchanged if it
    goes elsewhere, is an unsubscribe / opt-out link, or already has a
    utm_source."""
    try:
        parts = urlsplit(url)
    except ValueError:
        return url
    if (parts.hostname or "").lower() not in _own_hosts() or _SKIP_PATH.search(parts.path):
        return url
    query = parse_qsl(parts.query, keep_blank_values=True)
    if any(k == "utm_source" for k, _ in query):
        return url
    tags = [("utm_source", source), ("utm_medium", medium or source), ("utm_campaign", campaign)]
    if content:
        tags.append(("utm_content", content))
    # The site reads the fragment as part of some routes, so it stays last.
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query + tags), parts.fragment))


def tag_html(html: str, *, campaign: str, content: str | None = None) -> str:
    """Tag every link to the site in an email's HTML (href attributes only)."""
    def swap(m: re.Match) -> str:
        url = m.group(2).replace("&amp;", "&")
        tagged = tag_url(url, source="email", campaign=campaign, content=content)
        return m.group(0) if tagged == url else f"{m.group(1)}{tagged.replace('&', '&amp;')}{m.group(3)}"
    return _HREF.sub(swap, html or "")


def tag_text(text: str, *, source: str, campaign: str, content: str | None = None) -> str:
    """Tag every link to the site in plain text (an email's text part, a text message)."""
    def swap(m: re.Match) -> str:
        url = m.group(0)
        tail = ""
        while url and url[-1] in _TRAILING:
            url, tail = url[:-1], url[-1] + tail
        return tag_url(url, source=source, campaign=campaign, content=content) + tail
    return _BARE_URL.sub(swap, text or "")


# ── 2. Incoming visits ────────────────────────────────────────────────────


def _clean_touch(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    touch: dict[str, Any] = {}
    for key in UTM_KEYS:
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            touch[key] = re.sub(r"\s+", " ", value.strip())[:120]
    for key in ("landing", "referrer"):
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            # A path or a host only: never a full address with someone's token.
            touch[key] = value.strip().split("?")[0][:200]
    for key in ("fbclid", "gclid"):
        if raw.get(key):
            touch[key] = True  # an ad click, without keeping the click id
    if not touch:
        return None
    at = raw.get("at")
    if isinstance(at, str) and re.match(r"\d{4}-\d{2}-\d{2}T", at):
        touch["at"] = at[:25]
    return touch


def clean(raw: Any) -> dict[str, Any] | None:
    """The {"first": ..., "last": ...} the site sends, validated; None when
    there's nothing (no tagged visit)."""
    if not isinstance(raw, dict):
        return None
    out = {k: t for k in ("first", "last") if (t := _clean_touch(raw.get(k)))}
    if not out:
        return None
    out["recorded_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return out


def _loads(text: str | None) -> dict[str, Any]:
    try:
        value = json.loads(text) if text else {}
    except (TypeError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


def record_lead(prospect: Any, raw: Any) -> bool:
    """Save where the lead came from, once: a later visit (an email click, a
    second device) doesn't replace the visit that brought them in."""
    data = clean(raw)
    if not data or getattr(prospect, "lead_utm_json", None):
        return False
    prospect.lead_utm_json = json.dumps(data)
    return True


def record_purchase(prospect: Any, raw: Any) -> bool:
    """Save where the sale came from: the latest checkout's visit."""
    data = clean(raw)
    if not data:
        return False
    prospect.purchase_utm_json = json.dumps(data)
    return True


def record_order(order: Any, raw: Any) -> bool:
    data = clean(raw)
    if not data:
        return False
    order.utm_json = json.dumps(data)
    return True


_META = re.compile(r"facebook|^fb$|instagram|^ig$|meta", re.IGNORECASE)
_GOOGLE = re.compile(r"google|adwords|gads", re.IGNORECASE)


def source_label(touch: dict[str, Any] | None) -> str | None:
    """"Meta ads", "Google ads", "Email", "SMS", or the source as tagged."""
    if not touch:
        return None
    source = str(touch.get("source") or "")
    medium = str(touch.get("medium") or "")
    if source == "email" or medium == "email" or "mailchimp" in source.lower():
        return "Email"
    if source == "sms" or medium == "sms":
        return "SMS"
    if _META.search(source) or (touch.get("fbclid") and not source):
        return "Meta ads"
    if _GOOGLE.search(source) or (touch.get("gclid") and not source):
        return "Google ads"
    return source or medium or None


def _touch_summary(data: dict[str, Any]) -> dict[str, Any] | None:
    touch = data.get("last") or data.get("first")
    if not touch:
        return None
    return {
        "label": source_label(touch),
        "source": touch.get("source"), "medium": touch.get("medium"), "campaign": touch.get("campaign"),
        "content": touch.get("content"),
        # The first tagged visit, when it was something else (e.g. a Meta ad,
        # then an email click before buying).
        "first_label": source_label(data.get("first")) if data.get("first") and data.get("first") != touch else None,
    }


def summary(prospect: Any) -> dict[str, Any]:
    """For the console: where the lead and the sale came from."""
    return {
        "lead": _touch_summary(_loads(getattr(prospect, "lead_utm_json", None))),
        "purchase": _touch_summary(_loads(getattr(prospect, "purchase_utm_json", None))),
    }


def order_summary(order: Any) -> dict[str, Any] | None:
    return _touch_summary(_loads(getattr(order, "utm_json", None)))


# ── 3. Test orders ────────────────────────────────────────────────────────


def internal_email(email: str | None) -> bool:
    email = (email or "").strip().lower()
    if not email:
        return False
    for entry in (get_settings().TEST_ORDER_EMAILS or "").split(","):
        entry = entry.strip().lower()
        if entry and (email == entry or (entry.startswith("@") and email.endswith(entry))):
            return True
    return False


def is_test_order(prospect: Any) -> bool:
    """A test, not a sale: unlocked with the free promo code, or placed from
    an internal address."""
    return getattr(prospect, "payment_method", None) == "promo" or internal_email(
        getattr(prospect, "contact_email", None))


def count_as_sale(prospect: Any) -> bool:
    """A real card payment the ad platforms may count as a purchase."""
    return (getattr(prospect, "payment_status", None) == "completed"
            and getattr(prospect, "payment_method", None) == "card"
            and not is_test_order(prospect))


def order_counts_as_sale(order: Any, prospect: Any) -> bool:
    return (getattr(order, "status", None) == "completed" and getattr(order, "payment_method", None) != "promo"
            and not internal_email(getattr(prospect, "contact_email", None)))
