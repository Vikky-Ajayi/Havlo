"""Meta Conversions API: the /assess/seller funnel's events, sent from the
server as well as the browser (the marketing team's tracking brief, Nov 2026).

Each event goes to Meta twice, from the pixel in the browser and from here,
under the same event_name and event_id, so Meta keeps one. The journey:

    PageView              the pixel's own (and Meta's gateway), not sent here
    PropertyFound         the listing link was accepted and the property loaded
    ListingLinkError      the link wasn't accepted (custom_data.error_type)
    AssessmentStarted     "continue" from the property page, details form shown
    Lead                  set up by the marketing team in Events Manager
    InitiateCheckout      the buy button on the assessment, value and currency
    AddPaymentInfo        "Pay" pressed, before SumUp
    Purchase              SumUp confirmed the payment (send_purchase), the
                          amount paid, the order ID as event_id
    AddOnPurchase         an add-on order paid (send_addon_purchase)

From the details form onwards every event carries the person's hashed email,
phone and names, and always external_id (the hashed prospect id), the click
IDs (fbp, fbc) and the browser's IP and user agent.

Only with consent: the browser sends an event only once the visitor has
accepted the cookie banner, and says so; the server keeps that, with the
click IDs, on the prospect (meta_tracking_json) for the Purchase it sends
later. Test orders (promo code, internal addresses: attribution.count_as_sale)
never send Purchase or AddOnPurchase.

Configured by META_CAPI_ACCESS_TOKEN (Events Manager > Settings > Conversions
API > Generate access token) and META_PIXEL_ID. META_TEST_EVENT_CODE sends
everything to Test events instead of the live data while it's set.
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from app.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingProspect, StaleProspectAddonOrder
from app.services import attribution

logger = logging.getLogger(__name__)

# The /assess/seller page's leads (ads_funnel.seller_source("meta")).
LEAD_SOURCE = "meta_seller"
# Sent from the browser through POST /stale-listings/meta/event.
BROWSER_EVENTS = {"PropertyFound", "ListingLinkError", "AssessmentStarted", "InitiateCheckout", "AddPaymentInfo"}
CUSTOM_EVENTS = {"PropertyFound", "ListingLinkError", "AssessmentStarted", "AddOnPurchase"}
VALUE_EVENTS = {"InitiateCheckout", "AddPaymentInfo"}
CURRENCY = "GBP"
# Payments confirmed longer ago than this aren't sent by the sweep (Meta
# drops events more than 7 days old).
SWEEP_WINDOW = timedelta(days=6)
_SWEEP_BATCH = 50
_TIMEOUT_SECONDS = 10


# ── Hashing (Meta's normalisation rules) ───────────────────────────────────

def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_email(email: str | None) -> str | None:
    email = (email or "").strip().lower()
    return _sha256(email) if "@" in email else None


def hash_phone(phone: str | None) -> str | None:
    """Country code and digits only: "+44 07700 900123" -> 447700900123."""
    from app.services.twilio_service import normalize_to_e164

    e164 = normalize_to_e164(phone or "")
    return _sha256(e164.lstrip("+")) if e164 else None


def split_name(full_name: str | None) -> tuple[str, str]:
    parts = (full_name or "").strip().lower().split()
    if not parts:
        return "", ""
    return parts[0], " ".join(parts[1:])


def external_id(prospect_id: Any) -> str:
    """The lead's own ID, hashed: the same value the browser sends."""
    return _sha256(str(prospect_id).lower())


def user_data(prospect: Any | None, client: dict[str, Any] | None) -> dict[str, Any]:
    """Meta's user_data: hashed contact details once they've been given,
    external_id, and the browser's IP, user agent and click IDs."""
    client = client or {}
    data: dict[str, Any] = {}
    if prospect is not None:
        data["external_id"] = [external_id(prospect.id)]
        if getattr(prospect, "contact_email", None) or getattr(prospect, "contact_phone", None):
            em = hash_email(prospect.contact_email)
            ph = hash_phone(prospect.contact_phone)
            first, last = split_name(prospect.contact_name)
            if em:
                data["em"] = [em]
            if ph:
                data["ph"] = [ph]
            if first:
                data["fn"] = [_sha256(first)]
            if last:
                data["ln"] = [_sha256(last)]
    for key, field in (("client_ip_address", "ip"), ("client_user_agent", "ua"), ("fbp", "fbp"), ("fbc", "fbc")):
        value = str(client.get(field) or "").strip()
        if value:
            data[key] = value[:500]
    return data


# ── What the browser told us (kept for the server's Purchase) ─────────────

def tracking(prospect: Any) -> dict[str, Any]:
    try:
        value = json.loads(getattr(prospect, "meta_tracking_json", None) or "{}")
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def remember(prospect: Any, client: dict[str, Any]) -> None:
    """Keep the visitor's consent and click IDs on the prospect, newest
    values winning (a later visit may have an fbc the first didn't). The
    caller commits."""
    kept = tracking(prospect)
    for key in ("fbp", "fbc", "ip", "ua", "url"):
        if client.get(key):
            kept[key] = str(client[key])[:500]
    kept["consent"] = True
    kept["at"] = datetime.now(timezone.utc).isoformat()
    prospect.meta_tracking_json = json.dumps(kept)


# ── Sending ────────────────────────────────────────────────────────────────

def configured() -> bool:
    s = get_settings()
    return bool((s.META_CAPI_ACCESS_TOKEN or "").strip() and (s.META_PIXEL_ID or "").strip())


def build_event(name: str, event_id: str, *, prospect: Any | None, client: dict[str, Any] | None,
                custom_data: dict[str, Any] | None = None, event_time: int | None = None) -> dict[str, Any]:
    event: dict[str, Any] = {
        "event_name": name,
        "event_time": int(event_time or time.time()),
        "event_id": event_id,
        "action_source": "website",
        "user_data": user_data(prospect, client),
    }
    url = (client or {}).get("url")
    if url:
        event["event_source_url"] = str(url)[:1000]
    if custom_data:
        event["custom_data"] = custom_data
    return event


async def send(events: list[dict[str, Any]]) -> bool:
    """POST the events to Meta. Never raises: tracking must never break a
    payment or a page."""
    if not events:
        return False
    if not configured():
        logger.info("Meta Conversions API not configured; %s not sent.", ", ".join(e["event_name"] for e in events))
        return False
    import httpx

    s = get_settings()
    body: dict[str, Any] = {"data": events, "access_token": s.META_CAPI_ACCESS_TOKEN.strip()}
    if (s.META_TEST_EVENT_CODE or "").strip():
        body["test_event_code"] = s.META_TEST_EVENT_CODE.strip()
    url = f"https://graph.facebook.com/{s.META_GRAPH_VERSION}/{s.META_PIXEL_ID.strip()}/events"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=body)
        if response.status_code >= 400:
            logger.warning("Meta Conversions API refused %s: HTTP %s %s", [e["event_name"] for e in events],
                           response.status_code, response.text[:300])
            return False
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Meta Conversions API send failed: %s", exc)
        return False


def value_data(prospect: Any) -> dict[str, Any]:
    from app.services import stale_prospect_service as sps

    return {"value": float(sps.unlock_price_for(prospect)), "currency": CURRENCY,
            "content_ids": [prospect.property_code], "content_type": "product",
            "content_name": "Havlo Property Assessment"}


def _uuid(value: Any) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def purchase_event_id(prospect_id: Any) -> str:
    """The order ID, as the browser's Purchase uses it too."""
    return f"order-{prospect_id}"


def wants_purchase(prospect: Any) -> bool:
    return (getattr(prospect, "lead_source", None) == LEAD_SOURCE
            and getattr(prospect, "meta_purchase_sent_at", None) is None
            and attribution.count_as_sale(prospect)
            and bool(tracking(prospect).get("consent")))


async def send_purchase(prospect_id: Any) -> bool:
    """Purchase for a confirmed card payment on /assess/seller, once."""
    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, _uuid(prospect_id))
        if prospect is None or not wants_purchase(prospect):
            return False
        custom = {**value_data(prospect), "order_id": str(prospect.id)}
        paid_at = prospect.unlocked_at or datetime.now(timezone.utc)
        event = build_event("Purchase", purchase_event_id(prospect.id), prospect=prospect,
                            client=tracking(prospect), custom_data=custom, event_time=int(paid_at.timestamp()))
        if not await send([event]):
            return False
        prospect.meta_purchase_sent_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info("Meta Purchase sent for prospect %s.", prospect.property_code)
        return True


async def send_addon_purchase(order_id: Any) -> bool:
    """AddOnPurchase for a paid add-on order from an /assess/seller lead, once."""
    async with AsyncSessionLocal() as db:
        order = await db.get(StaleProspectAddonOrder, _uuid(order_id))
        if order is None or order.meta_sent_at is not None:
            return False
        prospect = await db.get(StaleListingProspect, order.prospect_id)
        if (prospect is None or prospect.lead_source != LEAD_SOURCE or not tracking(prospect).get("consent")
                or not attribution.order_counts_as_sale(order, prospect)):
            return False
        try:
            items = json.loads(order.items_json or "[]")
        except ValueError:
            items = []
        names = ", ".join(str(i.get("name")) for i in items if isinstance(i, dict) and i.get("name"))
        custom = {"value": float(order.amount), "currency": order.currency or CURRENCY,
                  "content_name": names or "Havlo add-on", "order_id": str(order.id)}
        paid_at = order.paid_at or datetime.now(timezone.utc)
        event = build_event("AddOnPurchase", f"addon-{order.id}", prospect=prospect, client=tracking(prospect),
                            custom_data=custom, event_time=int(paid_at.timestamp()))
        if not await send([event]):
            return False
        order.meta_sent_at = datetime.now(timezone.utc)
        await db.commit()
        return True


async def run_sweep() -> dict[str, int]:
    """Anything confirmed but not yet sent (a payment confirmed in the
    background, or a send that failed): every few minutes."""
    if not configured():
        return {"purchases": 0, "addons": 0}
    cutoff = datetime.now(timezone.utc) - SWEEP_WINDOW
    async with AsyncSessionLocal() as db:
        prospect_ids = (await db.execute(
            select(StaleListingProspect.id)
            .where(StaleListingProspect.lead_source == LEAD_SOURCE,
                   StaleListingProspect.payment_status == "completed",
                   StaleListingProspect.payment_method == "card",
                   StaleListingProspect.meta_purchase_sent_at.is_(None),
                   StaleListingProspect.meta_tracking_json.is_not(None),
                   StaleListingProspect.unlocked_at >= cutoff)
            .limit(_SWEEP_BATCH)
        )).scalars().all()
        order_ids = (await db.execute(
            select(StaleProspectAddonOrder.id)
            .join(StaleListingProspect, StaleListingProspect.id == StaleProspectAddonOrder.prospect_id)
            .where(StaleListingProspect.lead_source == LEAD_SOURCE,
                   StaleProspectAddonOrder.status == "completed",
                   StaleProspectAddonOrder.meta_sent_at.is_(None),
                   StaleProspectAddonOrder.paid_at >= cutoff)
            .limit(_SWEEP_BATCH)
        )).scalars().all()
    purchases = sum([await send_purchase(pid) for pid in prospect_ids])
    addons = sum([await send_addon_purchase(oid) for oid in order_ids])
    return {"purchases": purchases, "addons": addons}
